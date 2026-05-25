/**
 * Generic webpage fetcher orchestrator (P1-B1, preview-only).
 *
 * Flow:
 *   1. Resolve crawler_sources row by source_key (parser_type must be
 *      'generic_webpage').
 *   2. If source has idol_id, look up the idol name as a Claude prompt hint
 *      (display only; LLM is told it is a hint, not a constraint).
 *   3. fetchPublicHtml(source.source_url) — strict timeout / byte limits;
 *      fail gracefully on 403 / 429 / Cloudflare. Never bypass.
 *   4. cleanHtmlToText(html) — strip non-content nodes, take title +
 *      meta description + main body, cap at MAX_TEXT_LENGTH.
 *   5. parseWebpageWithClaude(...) — Claude Haiku JSON-only call.
 *
 * P1-B1 boundary: NEVER writes to event_candidates. NEVER writes to events.
 * NEVER calls service-role beyond crawler_sources status update. The
 * returned PreviewResult is purely informational for the admin.
 *
 * P1-B2 (separate PR, separate GPT audit) will add the commit path that
 * writes to event_candidates with dedupe / confidence threshold / max
 * candidates per run.
 */

import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  cleanHtmlToText,
  fetchPublicHtml,
  parseWebpageWithClaude,
  type CleanedPage,
  type ClaudeParseResult,
  type PreviewEvent,
  type PreviewEventType,
} from './genericWebpage'
import {
  getCrawlerSourceByKey,
  updateRunStatus,
  type CrawlerSourceRow,
  type RunStatus,
  type SourceTypeEnum,
} from './crawlerSource'
import {
  buildIdolMatchIndex,
  matchIdolFromTitle,
  type IdolForMatching,
  type IdolMatchIndex,
} from './idolMatcher'

const EXPECTED_PARSER_TYPE = 'generic_webpage'
const PARSER_VERSION = 'p1-b2'

// ── P1-B2 commit-path constants ─────────────────────────────────────────────

/**
 * Minimum Claude-reported confidence for a candidate to be written.
 * Null / NaN / undefined values are treated as failing this gate (no defaults
 * assumed). See GENERIC_WEBPAGE_COMMIT_WORK_ORDER.md §10.
 */
export const COMMIT_CONFIDENCE_THRESHOLD = 0.65

/**
 * Default cap on candidates per commit call. Raised from 3 → 10 (P1-B8) to
 * handle label-level / aggregator sources that commonly return 5–10 events.
 *
 * Per-source override: set `source.config.maxCandidatesPerCommit` (number)
 * in the crawler_sources jsonb config column — no migration needed.
 *
 * Hard cap: MAX_CANDIDATES_PER_COMMIT_HARD_CAP (50) — Claude returning >50
 * events almost always indicates noise; refuse and log so admin can investigate.
 *
 * Behavior when exceeded is unchanged: refuse entire batch (no partial writes).
 */
export const DEFAULT_MAX_CANDIDATES_PER_COMMIT = 10
export const MAX_CANDIDATES_PER_COMMIT_HARD_CAP = 50

/**
 * Resolve the effective per-commit cap for a given source.
 * Precedence: source.config.maxCandidatesPerCommit (if valid positive number)
 * → DEFAULT_MAX_CANDIDATES_PER_COMMIT. Always clamped to [1, HARD_CAP].
 */
function resolveMaxCandidates(source: CrawlerSourceRow): number {
  const configVal = source.config?.maxCandidatesPerCommit
  if (typeof configVal === 'number' && configVal > 0) {
    return Math.min(Math.floor(configVal), MAX_CANDIDATES_PER_COMMIT_HARD_CAP)
  }
  return DEFAULT_MAX_CANDIDATES_PER_COMMIT
}

/**
 * DB schema event_type enum (matches migration 001 `event_type`).
 * Kept local — runGenericWebpageFetcher is the only module that needs to
 * bridge the wider PreviewEventType set to the narrower DB enum.
 */
type DbEventType =
  | 'concert'
  | 'ticketing'
  | 'livestream'
  | 'streaming'
  | 'media'
  | 'brand'
  | 'official'

type EventTypeMapping = 'direct' | 'tentative'

interface EventTypeMapEntry {
  eventType: DbEventType
  mapping: EventTypeMapping
}

/**
 * PreviewEventType → DbEventType mapping. Entries marked `tentative` keep
 * the original `preview_event_type` in raw_data so admin reviewers can
 * recognise when the system made a best-effort guess. Types not present
 * here (or null) are skipped (counted in skippedUnsupportedType) — we never
 * fall back to 'official' / 'media' as a catch-all. See work order §4.
 */
export const EVENT_TYPE_MAP: Record<PreviewEventType, EventTypeMapEntry> = {
  concert: { eventType: 'concert', mapping: 'direct' },
  tour: { eventType: 'concert', mapping: 'direct' },
  fan_meeting: { eventType: 'concert', mapping: 'direct' },
  showcase: { eventType: 'concert', mapping: 'direct' },
  ticketing: { eventType: 'ticketing', mapping: 'direct' },
  livestream: { eventType: 'livestream', mapping: 'direct' },
  streaming: { eventType: 'streaming', mapping: 'direct' },
  media: { eventType: 'media', mapping: 'direct' },
  brand: { eventType: 'brand', mapping: 'direct' },
  popup_store: { eventType: 'brand', mapping: 'tentative' },
  exhibition: { eventType: 'brand', mapping: 'tentative' },
  official: { eventType: 'official', mapping: 'direct' },
}

function mapPreviewEventType(
  t: PreviewEventType | null,
): EventTypeMapEntry | null {
  if (!t) return null
  return EVENT_TYPE_MAP[t] ?? null
}

/**
 * Best-effort dateHint → YYYY-MM-DD parser. Returns null on any failure;
 * callers must NOT write a fallback like today's date — null means "let
 * admin fill it manually". Year is clamped to [2020, 2030] to reject
 * obviously bogus values. See work order §5.
 */
export function parseDateHint(hint: string | null | undefined): string | null {
  if (!hint || typeof hint !== 'string') return null
  const trimmed = hint.trim()
  if (!trimmed) return null

  // 1. Direct Date constructor (handles ISO, RFC 2822, many English forms)
  const direct = new Date(trimmed)
  if (!Number.isNaN(direct.getTime())) {
    const y = direct.getUTCFullYear()
    if (y >= 2020 && y <= 2030) {
      return direct.toISOString().slice(0, 10)
    }
  }

  // 2. YYYY-MM-DD / YYYY/MM/DD substring
  const ymd = trimmed.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (ymd) {
    const y = Number(ymd[1])
    const m = Number(ymd[2])
    const d = Number(ymd[3])
    if (y >= 2020 && y <= 2030 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    }
  }

  // 3. YYYY-MM only → first day of month
  const ym = trimmed.match(/(\d{4})[-/](\d{1,2})(?!\d)/)
  if (ym) {
    const y = Number(ym[1])
    const m = Number(ym[2])
    if (y >= 2020 && y <= 2030 && m >= 1 && m <= 12) {
      return `${y}-${String(m).padStart(2, '0')}-01`
    }
  }

  return null
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

type DedupeBasis = 'url+title+date+type' | 'url+title+snippet'

interface HashResult {
  hash: string
  basis: DedupeBasis
}

/**
 * Stable canonical hash for dedupe. Primary basis uses parsed date + mapped
 * event_type (more precise). Fallback (date missing) uses the first 100
 * chars of rawSnippet to keep the hash deterministic even when dateHint is
 * empty. The chosen basis is returned alongside so it can be recorded in
 * raw_data for debugging. See work order §6.
 */
function computeSourceHash(args: {
  sourceUrl: string
  rawTitle: string
  parsedDate: string | null
  mappedEventType: DbEventType
  rawSnippet: string
}): HashResult {
  const { sourceUrl, rawTitle, parsedDate, mappedEventType, rawSnippet } = args
  if (parsedDate) {
    return {
      hash: sha256Hex(
        `${sourceUrl}|${rawTitle}|${parsedDate}|${mappedEventType}`,
      ),
      basis: 'url+title+date+type',
    }
  }
  const snippet = (rawSnippet ?? '').slice(0, 100)
  return {
    hash: sha256Hex(`${sourceUrl}|${rawTitle}|${snippet}`),
    basis: 'url+title+snippet',
  }
}

// ── P1-B8: idol matching helpers ───────────────────────────────────────────

/**
 * How the detected_idol_id was resolved for a given candidate.
 * Recorded in raw_data.idol_matched_via for post-commit analysis.
 *   'source_binding' — source.idol_id was set; inherited directly
 *   'name'           — matched via idol.name
 *   'alt_name'       — matched via one of idol.alt_names
 *   'none'           — no match; detected_idol_id = null
 */
export type IdolMatchedVia = 'source_binding' | 'name' | 'alt_name' | 'none'

/**
 * Per-event idol match result returned in PreviewResult.idolMatchResults
 * so admin can see what would be committed before clicking Commit.
 */
export interface IdolMatchedEvent {
  rawTitle: string
  matchedIdolId: string | null
  matchedIdolName: string | null
  via: IdolMatchedVia
}

/**
 * Load all active idols and build the match index.
 * Throws on DB error — callers should propagate as a fatal run error
 * (per Q4 in the work order: fail-fast to avoid silently writing bad data).
 */
async function loadIdolMatcherIndex(
  supabase: SupabaseClient,
): Promise<IdolMatchIndex> {
  const { data, error } = await supabase
    .from('idols')
    .select('id, name, alt_names')
    .eq('is_active', true)
  if (error) {
    throw new Error(`idols 載入失敗 [${error.code ?? '?'}] ${error.message}`)
  }
  const idols: IdolForMatching[] = ((data ?? []) as Array<{
    id: string
    name: string
    alt_names: string[] | null
  }>).map((row) => ({
    id: row.id,
    name: row.name,
    alt_names: row.alt_names ?? [],
  }))
  return buildIdolMatchIndex(idols)
}

/**
 * Resolve detected_idol_id + how it was obtained for one event.
 *
 * If source has a bound idol_id, that always takes precedence (source_binding).
 * Otherwise run the matcher against the event title.
 * Returns null idol_id (via = 'none') when no match is found — the candidate
 * is still written so admin can manually assign the idol.
 *
 * idolName is returned for display / logging only; not stored in DB.
 */
function resolveDetectedIdol(args: {
  event: PreviewEvent
  source: CrawlerSourceRow
  matcherIndex: IdolMatchIndex | null
}): { idolId: string | null; idolName: string | null; via: IdolMatchedVia } {
  const { event, source, matcherIndex } = args
  if (source.idol_id !== null) {
    // Name for source_binding case is looked up separately by the preview
    // caller (hintIdolName) — return null here to avoid a second DB call.
    return { idolId: source.idol_id, idolName: null, via: 'source_binding' }
  }
  if (!matcherIndex) {
    return { idolId: null, idolName: null, via: 'none' }
  }
  const result = matchIdolFromTitle(event.rawTitle, matcherIndex)
  if (!result) {
    return { idolId: null, idolName: null, via: 'none' }
  }
  return {
    idolId: result.idol.id,
    idolName: result.idol.name,
    via: result.viaPrimaryName ? 'name' : 'alt_name',
  }
}

export interface FetcherOptions {
  sourceKey: string
}

// ── Commit-path public types ────────────────────────────────────────────────

export interface CommitSummary {
  /** Total candidates Claude returned (after parser cap, before commit gates). */
  candidatesFromClaude: number
  /** Rows successfully written to event_candidates. */
  inserted: number
  /** Skipped because source_hash unique constraint hit an existing row. */
  deduped: number
  /** Skipped because Claude confidence was missing or below threshold. */
  skippedLowConfidence: number
  /** Skipped because PreviewEventType could not be mapped to DB event_type. */
  skippedUnsupportedType: number
  /** Skipped because pageRelevance was 'none' (no candidates considered). */
  skippedPageRelevanceNone: number
}

export interface CommitResult {
  source: 'generic-webpage'
  mode: 'commit'
  sourceKey: string
  sourceName: string | null
  crawlerSourceId: string | null
  sourceUrl: string | null
  finalUrl: string | null
  httpStatus: number
  pageTitle: string | null
  pageRelevance: 'high' | 'medium' | 'low' | 'none' | null
  summary: CommitSummary
  warnings: string[]
  errors: string[]
  status: number
}

export interface PreviewResult {
  source: 'generic-webpage'
  mode: 'preview'
  sourceKey: string
  sourceName: string | null
  crawlerSourceId: string | null
  sourceUrl: string | null
  finalUrl: string | null
  httpStatus: number
  bytesRead: number
  wasByteTruncated: boolean
  pageTitle: string | null
  metaDescription: string | null
  bodyTextLength: number
  bodyTextTruncated: boolean
  hintIdolName: string | null
  pageRelevance: 'high' | 'medium' | 'low' | 'none' | null
  parserNote: string | null
  events: PreviewEvent[]
  truncatedEvents: number
  model: string | null
  /**
   * P1-B8: per-event idol match preview. Populated when source.idol_id is
   * null (aggregator / label sources). Empty array for idol-bound sources
   * (source_binding path). Parallel to `events` by index.
   */
  idolMatchResults: IdolMatchedEvent[]
  errors: string[]
  warnings: string[]
  status: number
}

function base(
  sourceKey: string,
  extra: Partial<PreviewResult>,
): PreviewResult {
  return {
    source: 'generic-webpage',
    mode: 'preview',
    sourceKey,
    sourceName: null,
    crawlerSourceId: null,
    sourceUrl: null,
    finalUrl: null,
    httpStatus: 0,
    bytesRead: 0,
    wasByteTruncated: false,
    pageTitle: null,
    metaDescription: null,
    bodyTextLength: 0,
    bodyTextTruncated: false,
    hintIdolName: null,
    pageRelevance: null,
    parserNote: null,
    events: [],
    truncatedEvents: 0,
    model: null,
    idolMatchResults: [],
    errors: [],
    warnings: [],
    status: 200,
    ...extra,
  }
}

async function lookupIdolName(
  supabase: SupabaseClient,
  idolId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('idols')
    .select('name')
    .eq('id', idolId)
    .maybeSingle()
  if (error || !data) return null
  const name = (data as { name?: unknown }).name
  return typeof name === 'string' && name.trim().length > 0
    ? name.trim()
    : null
}

export async function runGenericWebpagePreview(
  supabase: SupabaseClient,
  options: FetcherOptions,
): Promise<PreviewResult> {
  const sourceKey = options.sourceKey

  // ── Resolve crawler_sources row ─────────────────────────────────────────
  const { source, error: srcErr } = await getCrawlerSourceByKey(
    supabase,
    sourceKey,
  )
  if (srcErr || !source) {
    return base(sourceKey, {
      errors: [srcErr ?? `找不到 crawler_sources：${sourceKey}`],
      status: 404,
    })
  }
  if (source.parser_type !== EXPECTED_PARSER_TYPE) {
    return base(sourceKey, {
      crawlerSourceId: source.id,
      sourceName: source.name,
      sourceUrl: source.source_url,
      errors: [
        `parser_type 不符：expected '${EXPECTED_PARSER_TYPE}', got '${source.parser_type}'`,
      ],
      status: 400,
    })
  }

  const sourceUrl = source.source_url?.trim() ?? ''
  if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl)) {
    return base(sourceKey, {
      crawlerSourceId: source.id,
      sourceName: source.name,
      sourceUrl: source.source_url ?? null,
      errors: ['source_url 缺漏或不是 http(s) URL'],
      status: 400,
    })
  }

  // ── Optional: idol hint (display only) ─────────────────────────────────
  const hintIdolName = source.idol_id
    ? await lookupIdolName(supabase, source.idol_id)
    : null

  // ── 1. Fetch ────────────────────────────────────────────────────────────
  const fetched = await fetchPublicHtml(sourceUrl)
  if (!fetched.ok || !fetched.html) {
    // Best-effort status update; do not propagate failures.
    await updateRunStatus(supabase, source.id, {
      last_status: 'error' as RunStatus,
      last_error: fetched.error ?? `fetch failed (status ${fetched.status})`,
    })
    return base(sourceKey, {
      crawlerSourceId: source.id,
      sourceName: source.name,
      sourceUrl,
      finalUrl: fetched.finalUrl,
      httpStatus: fetched.status,
      bytesRead: fetched.bytesRead,
      wasByteTruncated: fetched.wasByteTruncated,
      hintIdolName,
      errors: [fetched.error ?? `fetch failed (status ${fetched.status})`],
      status: 502,
    })
  }

  const warnings: string[] = []
  if (fetched.wasByteTruncated) {
    warnings.push(`response body exceeded ${500 * 1024} bytes and was truncated`)
  }

  // ── 2. Clean ────────────────────────────────────────────────────────────
  let cleaned: CleanedPage
  try {
    cleaned = cleanHtmlToText(fetched.html)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await updateRunStatus(supabase, source.id, {
      last_status: 'error' as RunStatus,
      last_error: `HTML 清理失敗：${msg}`,
    })
    return base(sourceKey, {
      crawlerSourceId: source.id,
      sourceName: source.name,
      sourceUrl,
      finalUrl: fetched.finalUrl,
      httpStatus: fetched.status,
      bytesRead: fetched.bytesRead,
      wasByteTruncated: fetched.wasByteTruncated,
      hintIdolName,
      errors: [`HTML 清理失敗：${msg}`],
      warnings,
      status: 500,
    })
  }

  if (cleaned.wasTruncated) {
    warnings.push('extracted body text exceeded 8000 chars and was truncated')
  }

  // ── 3. Claude parse ─────────────────────────────────────────────────────
  let parseResult: ClaudeParseResult
  try {
    parseResult = await parseWebpageWithClaude({
      sourceUrl,
      page: cleaned,
      hintIdolName,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await updateRunStatus(supabase, source.id, {
      last_status: 'error' as RunStatus,
      last_error: msg,
    })
    return base(sourceKey, {
      crawlerSourceId: source.id,
      sourceName: source.name,
      sourceUrl,
      finalUrl: fetched.finalUrl,
      httpStatus: fetched.status,
      bytesRead: fetched.bytesRead,
      wasByteTruncated: fetched.wasByteTruncated,
      pageTitle: cleaned.pageTitle || null,
      metaDescription: cleaned.metaDescription || null,
      bodyTextLength: cleaned.bodyText.length,
      bodyTextTruncated: cleaned.wasTruncated,
      hintIdolName,
      errors: [msg],
      warnings,
      status: 502,
    })
  }

  if (parseResult.truncatedEvents > 0) {
    warnings.push(
      `Claude returned ${parseResult.events.length + parseResult.truncatedEvents} events; truncated to ${parseResult.events.length} (preview cap)`,
    )
  }

  // ── P1-B8: idol match preview (only when source has no bound idol) ──────
  // Mirrors the commit-path matcher so admin sees exactly what would be
  // written to detected_idol_id before clicking Commit. Failure is fatal
  // per Q4 (fail-fast to avoid misleading previews).
  const idolMatchResults: IdolMatchedEvent[] = []
  if (source.idol_id === null && parseResult.pageRelevance !== 'none') {
    let matcherIndex: IdolMatchIndex
    try {
      matcherIndex = await loadIdolMatcherIndex(supabase)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await updateRunStatus(supabase, source.id, {
        last_status: 'error' as RunStatus,
        last_error: `idol matcher load failed: ${msg}`,
      })
      return base(sourceKey, {
        crawlerSourceId: source.id,
        sourceName: source.name,
        sourceUrl,
        finalUrl: fetched.finalUrl,
        httpStatus: fetched.status,
        bytesRead: fetched.bytesRead,
        wasByteTruncated: fetched.wasByteTruncated,
        pageTitle: cleaned.pageTitle || null,
        metaDescription: cleaned.metaDescription || null,
        bodyTextLength: cleaned.bodyText.length,
        bodyTextTruncated: cleaned.wasTruncated,
        hintIdolName,
        pageRelevance: parseResult.pageRelevance,
        parserNote: parseResult.parserNote,
        events: parseResult.events,
        truncatedEvents: parseResult.truncatedEvents,
        model: parseResult.model,
        errors: [`idol matcher 載入失敗：${msg}`],
        warnings,
        status: 500,
      })
    }
    for (const evt of parseResult.events) {
      const { idolId, idolName, via } = resolveDetectedIdol({
        event: evt,
        source,
        matcherIndex,
      })
      idolMatchResults.push({
        rawTitle: evt.rawTitle,
        matchedIdolId: idolId,
        matchedIdolName: idolName,
        via,
      })
    }
  }

  // ── Success status write-back ──────────────────────────────────────────
  await updateRunStatus(supabase, source.id, {
    last_status: 'success' as RunStatus,
    last_error: null,
  })

  return base(sourceKey, {
    crawlerSourceId: source.id,
    sourceName: source.name,
    sourceUrl,
    finalUrl: fetched.finalUrl,
    httpStatus: fetched.status,
    bytesRead: fetched.bytesRead,
    wasByteTruncated: fetched.wasByteTruncated,
    pageTitle: cleaned.pageTitle || null,
    metaDescription: cleaned.metaDescription || null,
    bodyTextLength: cleaned.bodyText.length,
    bodyTextTruncated: cleaned.wasTruncated,
    hintIdolName,
    pageRelevance: parseResult.pageRelevance,
    parserNote: parseResult.parserNote,
    events: parseResult.events,
    truncatedEvents: parseResult.truncatedEvents,
    model: parseResult.model,
    idolMatchResults,
    errors: [],
    warnings,
    status: 200,
  })
}

// ── P1-B2: commit orchestrator ─────────────────────────────────────────────

function emptySummary(): CommitSummary {
  return {
    candidatesFromClaude: 0,
    inserted: 0,
    deduped: 0,
    skippedLowConfidence: 0,
    skippedUnsupportedType: 0,
    skippedPageRelevanceNone: 0,
  }
}

function commitBase(
  sourceKey: string,
  extra: Partial<CommitResult>,
): CommitResult {
  return {
    source: 'generic-webpage',
    mode: 'commit',
    sourceKey,
    sourceName: null,
    crawlerSourceId: null,
    sourceUrl: null,
    finalUrl: null,
    httpStatus: 0,
    pageTitle: null,
    pageRelevance: null,
    summary: emptySummary(),
    warnings: [],
    errors: [],
    status: 200,
    ...extra,
  }
}

function buildCommitSummaryString(summary: CommitSummary): string {
  return `inserted=${summary.inserted}, deduped=${summary.deduped}, lowConf=${summary.skippedLowConfidence}, badType=${summary.skippedUnsupportedType}, noneSkip=${summary.skippedPageRelevanceNone}`
}

interface CandidatePayload {
  raw_title: string
  raw_content: string | null
  detected_idol_id: string | null
  detected_event_type: DbEventType
  detected_date: string | null
  source_url: string
  source_name: string
  source_type: SourceTypeEnum
  ai_confidence: number
  review_status: 'pending'
  source_hash: string
  raw_data: Record<string, unknown>
}

/**
 * Build the event_candidates row payload for one PreviewEvent that has
 * already passed the confidence + type-mapping gates.
 *
 * Caller must have computed `parsedDate`, `mappedEventType`, `mapping`,
 * `sourceHash` (with its `dedupeBasis`), `detectedIdolId`, and
 * `idolMatchedVia`. This function is pure — it only assembles fields,
 * no DB call, no validation.
 */
function buildCandidatePayload(args: {
  event: PreviewEvent
  source: CrawlerSourceRow
  pageRelevance: ClaudeParseResult['pageRelevance'] | null
  mappedEventType: DbEventType
  mapping: EventTypeMapping
  parsedDate: string | null
  sourceHash: string
  dedupeBasis: DedupeBasis
  detectedIdolId: string | null
  idolMatchedVia: IdolMatchedVia
}): CandidatePayload {
  const {
    event,
    source,
    pageRelevance,
    mappedEventType,
    mapping,
    parsedDate,
    sourceHash,
    dedupeBasis,
    detectedIdolId,
    idolMatchedVia,
  } = args
  const rawSnippet = event.rawSnippet ?? ''
  return {
    raw_title: event.rawTitle,
    raw_content: rawSnippet.length > 0 ? rawSnippet : null,
    detected_idol_id: detectedIdolId,
    detected_event_type: mappedEventType,
    detected_date: parsedDate,
    source_url: source.source_url,
    source_name: source.name,
    source_type: source.source_type,
    ai_confidence: Number(event.confidence.toFixed(2)),
    review_status: 'pending',
    source_hash: sourceHash,
    raw_data: {
      provider: 'generic_webpage',
      parserVersion: PARSER_VERSION,
      crawlerSourceId: source.id,
      crawlerSourceKey: source.source_key,
      pageRelevance,
      dedupe_basis: dedupeBasis,
      preview_event_type: event.eventType,
      event_type_mapping: mapping,
      idol_matched_via: idolMatchedVia,
      idolHint: event.idolHint,
      locationHint: event.locationHint,
      originalDateHint: event.dateHint,
      parsedDate,
      confidence: event.confidence,
    },
  }
}

/**
 * P1-B2 commit orchestrator. Runs the full preview pipeline (fetch / clean /
 * Claude), then applies confidence + type-mapping gates and writes surviving
 * candidates to event_candidates with review_status='pending'.
 *
 * Hard guarantees (see work order §18):
 *   - Never writes to `events` table; only to event_candidates.
 *   - Never approves / publishes — review_status is hard-coded 'pending'.
 *   - Never bypasses SSRF / fetch limits (delegates to runGenericWebpagePreview's
 *     fetch path via the shared helpers).
 *   - pageRelevance='none' → zero writes.
 *   - confidence missing or < threshold → skip (no defaults).
 *   - PreviewEventType not in EVENT_TYPE_MAP → skip (no fallback to
 *     'official' / 'media').
 *   - Filtered candidates > MAX_CANDIDATES_PER_COMMIT → refuse all (no
 *     partial writes); admin must split the source or tighten the prompt.
 *
 * Auth + confirmCommit + single sourceKey + batch ban are enforced by the
 * API route before we get here.
 */
export async function runGenericWebpageCommit(
  supabase: SupabaseClient,
  options: FetcherOptions,
): Promise<CommitResult> {
  const sourceKey = options.sourceKey

  // Re-use the preview pipeline so SSRF / fetch / clean / Claude behaviour
  // stays identical and we cannot accidentally diverge. The double
  // updateRunStatus call (preview writes once, we write again below) is
  // harmless — the second write supersedes the first.
  const preview = await runGenericWebpagePreview(supabase, { sourceKey })

  // Carry forward any preview-side errors verbatim; do not attempt writes.
  if (preview.errors.length > 0 || !preview.crawlerSourceId) {
    const failResult = commitBase(sourceKey, {
      sourceName: preview.sourceName,
      crawlerSourceId: preview.crawlerSourceId,
      sourceUrl: preview.sourceUrl,
      finalUrl: preview.finalUrl,
      httpStatus: preview.httpStatus,
      pageTitle: preview.pageTitle,
      pageRelevance: preview.pageRelevance,
      warnings: preview.warnings,
      errors: preview.errors,
      status: preview.status,
    })
    if (preview.crawlerSourceId) {
      await updateRunStatus(supabase, preview.crawlerSourceId, {
        last_status: 'error' as RunStatus,
        last_error: `commit failed: ${preview.errors.join(' | ').slice(0, 1500)}`,
      })
    }
    return failResult
  }

  // Re-resolve the source row so we have idol_id / source_type / source_url
  // available without re-deriving from preview shape. Cheap second query;
  // preview already validated existence so this should always succeed.
  const { source } = await getCrawlerSourceByKey(supabase, sourceKey)
  if (!source) {
    return commitBase(sourceKey, {
      crawlerSourceId: preview.crawlerSourceId,
      sourceName: preview.sourceName,
      sourceUrl: preview.sourceUrl,
      pageTitle: preview.pageTitle,
      pageRelevance: preview.pageRelevance,
      errors: [`找不到 crawler_sources：${sourceKey}（preview 後消失）`],
      status: 500,
    })
  }

  const warnings: string[] = [...preview.warnings]
  const summary = emptySummary()
  summary.candidatesFromClaude = preview.events.length

  // pageRelevance='none' → zero writes. Counts every candidate as
  // skippedPageRelevanceNone for visibility.
  if (preview.pageRelevance === 'none') {
    summary.skippedPageRelevanceNone = preview.events.length
    await updateRunStatus(supabase, source.id, {
      last_status: 'skipped' as RunStatus,
      last_error: `commit skipped (pageRelevance=none): candidates=${preview.events.length}`,
    })
    return commitBase(sourceKey, {
      crawlerSourceId: source.id,
      sourceName: source.name,
      sourceUrl: source.source_url,
      finalUrl: preview.finalUrl,
      httpStatus: preview.httpStatus,
      pageTitle: preview.pageTitle,
      pageRelevance: preview.pageRelevance,
      summary,
      warnings,
      errors: [],
      status: 200,
    })
  }

  // ── P1-B8: load idol matcher index for unbound sources ─────────────────
  // When source.idol_id is null (label-level / aggregator), we try to infer
  // the idol from each event title. This mirrors runGenericWebpagePreview so
  // the commit result is consistent with what admin saw in the preview panel.
  // Failure is fatal (fail-fast per Q4: avoid silently writing bad data).
  let commitMatcherIndex: IdolMatchIndex | null = null
  if (source.idol_id === null) {
    try {
      commitMatcherIndex = await loadIdolMatcherIndex(supabase)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await updateRunStatus(supabase, source.id, {
        last_status: 'error' as RunStatus,
        last_error: `commit failed: idol matcher load error: ${msg}`,
      })
      return commitBase(sourceKey, {
        crawlerSourceId: source.id,
        sourceName: source.name,
        sourceUrl: source.source_url,
        finalUrl: preview.finalUrl,
        httpStatus: preview.httpStatus,
        pageTitle: preview.pageTitle,
        pageRelevance: preview.pageRelevance,
        summary,
        warnings,
        errors: [`idol matcher 載入失敗：${msg}`],
        status: 500,
      })
    }
  }

  // ── Apply confidence + type-mapping gates ───────────────────────────────
  interface PreparedCandidate {
    event: PreviewEvent
    mappedEventType: DbEventType
    mapping: EventTypeMapping
    parsedDate: string | null
    sourceHash: string
    dedupeBasis: DedupeBasis
    detectedIdolId: string | null
    idolMatchedVia: IdolMatchedVia
  }
  const prepared: PreparedCandidate[] = []
  for (const event of preview.events) {
    const conf =
      typeof event.confidence === 'number' && Number.isFinite(event.confidence)
        ? event.confidence
        : null
    if (conf === null || conf < COMMIT_CONFIDENCE_THRESHOLD) {
      summary.skippedLowConfidence += 1
      continue
    }
    const typeEntry = mapPreviewEventType(event.eventType)
    if (!typeEntry) {
      summary.skippedUnsupportedType += 1
      continue
    }
    const parsedDate = parseDateHint(event.dateHint)
    if (!parsedDate) {
      warnings.push(
        `event '${event.rawTitle}': detected_date is null, manual date fill required`,
      )
    }
    const { hash, basis } = computeSourceHash({
      sourceUrl: source.source_url,
      rawTitle: event.rawTitle,
      parsedDate,
      mappedEventType: typeEntry.eventType,
      rawSnippet: event.rawSnippet ?? '',
    })
    // P1-B8: resolve detected_idol_id via source binding or title matcher
    const { idolId: detectedIdolId, via: idolMatchedVia } = resolveDetectedIdol(
      { event, source, matcherIndex: commitMatcherIndex },
    )
    prepared.push({
      event,
      mappedEventType: typeEntry.eventType,
      mapping: typeEntry.mapping,
      parsedDate,
      sourceHash: hash,
      dedupeBasis: basis,
      detectedIdolId,
      idolMatchedVia,
    })
  }

  // ── maxCandidatesPerCommit guard (no partial writes) ────────────────────
  // P1-B8: cap is now configurable per source via source.config.maxCandidatesPerCommit
  const maxCandidates = resolveMaxCandidates(source)
  if (prepared.length > maxCandidates) {
    warnings.push(
      `too many candidates after filtering (${prepared.length} > ${maxCandidates}): refuse to commit; please split source or tighten Claude prompt`,
    )
    await updateRunStatus(supabase, source.id, {
      last_status: 'skipped' as RunStatus,
      last_error: `commit refused (too many candidates: ${prepared.length}>${maxCandidates})`,
    })
    return commitBase(sourceKey, {
      crawlerSourceId: source.id,
      sourceName: source.name,
      sourceUrl: source.source_url,
      finalUrl: preview.finalUrl,
      httpStatus: preview.httpStatus,
      pageTitle: preview.pageTitle,
      pageRelevance: preview.pageRelevance,
      summary,
      warnings,
      errors: [],
      status: 200,
    })
  }

  // ── Pre-dedupe SELECT (lookup existing source_hashes in one query) ──────
  const errors: string[] = []
  if (prepared.length > 0) {
    const hashes = prepared.map((p) => p.sourceHash)
    const { data: existingRows, error: dedupeErr } = await supabase
      .from('event_candidates')
      .select('source_hash')
      .in('source_hash', hashes)
    if (dedupeErr) {
      const msg = `dedupe lookup 失敗 [${dedupeErr.code ?? '?'}] ${dedupeErr.message}`
      await updateRunStatus(supabase, source.id, {
        last_status: 'error' as RunStatus,
        last_error: `commit failed: ${msg}`,
      })
      return commitBase(sourceKey, {
        crawlerSourceId: source.id,
        sourceName: source.name,
        sourceUrl: source.source_url,
        finalUrl: preview.finalUrl,
        httpStatus: preview.httpStatus,
        pageTitle: preview.pageTitle,
        pageRelevance: preview.pageRelevance,
        summary,
        warnings,
        errors: [msg],
        status: 500,
      })
    }
    const existingHashes = new Set<string>()
    for (const row of (existingRows ?? []) as Array<{ source_hash: string }>) {
      if (row.source_hash) existingHashes.add(row.source_hash)
    }

    // ── INSERT loop (per-row; ≤ maxCandidates iterations) ───────────────
    for (const p of prepared) {
      if (existingHashes.has(p.sourceHash)) {
        summary.deduped += 1
        continue
      }
      const payload = buildCandidatePayload({
        event: p.event,
        source,
        pageRelevance: preview.pageRelevance,
        mappedEventType: p.mappedEventType,
        mapping: p.mapping,
        parsedDate: p.parsedDate,
        sourceHash: p.sourceHash,
        dedupeBasis: p.dedupeBasis,
        detectedIdolId: p.detectedIdolId,
        idolMatchedVia: p.idolMatchedVia,
      })
      const { error: insertErr } = await supabase
        .from('event_candidates')
        .insert(payload)
      if (insertErr) {
        // 23505 = unique_violation on source_hash (race with another inserter
        // between SELECT and INSERT). Treat as dedupe, not as error.
        if (insertErr.code === '23505') {
          summary.deduped += 1
          continue
        }
        errors.push(
          `${p.event.rawTitle}: insert 失敗 ${insertErr.code ? `[${insertErr.code}] ` : ''}${insertErr.message}`,
        )
        continue
      }
      summary.inserted += 1
    }
  }

  // ── Status write-back ───────────────────────────────────────────────────
  const status: RunStatus =
    errors.length > 0 ? 'partial_error' : 'success'
  const statusNote =
    errors.length > 0
      ? `commit partial: ${buildCommitSummaryString(summary)}, errors=${errors.length}`
      : `commit ok: ${buildCommitSummaryString(summary)}`
  await updateRunStatus(supabase, source.id, {
    last_status: status,
    last_error: statusNote,
  })

  return commitBase(sourceKey, {
    crawlerSourceId: source.id,
    sourceName: source.name,
    sourceUrl: source.source_url,
    finalUrl: preview.finalUrl,
    httpStatus: preview.httpStatus,
    pageTitle: preview.pageTitle,
    pageRelevance: preview.pageRelevance,
    summary,
    warnings,
    errors,
    status: errors.length > 0 ? 207 : 200,
  })
}

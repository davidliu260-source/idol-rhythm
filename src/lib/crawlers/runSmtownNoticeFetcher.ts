/**
 * SMTOWN notice fetcher orchestrator.
 *
 * Orchestrates:
 *   1. Resolve crawler_sources row by source_key (parser_type must be
 *      'smtown_notice').
 *   2. Load the idol corresponding to source.idol_id, build a small
 *      name+alt_names match index restricted to this idol only.
 *   3. Fetch notice listing pages (up to MAX_PAGES) via query-string
 *      pagination ?page=N (0-indexed). Stops on first non-200 page.
 *   4. Parse notice items using smtownNotice.ts.
 *   5. Filter entries through isEventNotice() (conservative event keyword
 *      filter — most administrative notices are skipped by design).
 *   6. Match titles to the source idol using idolMatcher. Skip entries that
 *      don't mention this artist by name or alias.
 *   7. NCT-root unit guard: if the source idol is the root `nct` slug, skip
 *      titles that explicitly name a unit (NCT 127 / NCT DREAM / NCT WISH /
 *      WayV). Work order requires conservative root mapping in first pass.
 *   8. Dedup against event_candidates by source_hash AND source_url.
 *   9. INSERT new candidates (pending, not published, not approved).
 *      Content-changed rows get needs_recheck = true (J7d-A drift flow).
 *
 * Never writes events. Never approves. Never publishes.
 *
 * Phase A probe: https://www.smtown.com/notice is server-rendered HTML.
 * Pagination is ?page=N (N=0..36 at probe time; ?page=0 == base URL).
 * Notices have no per-notice permalink; we synthesize a stable id from
 * the listing's `span.number` field (see smtownNotice.ts).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildIdolMatchIndex,
  matchIdolFromTitle,
  type IdolForMatching,
} from './idolMatcher'
import {
  parseSmtownNoticeHtml,
  isEventNotice,
  entryToCandidatePayload,
  type SmtownCandidatePayload,
  type SmtownSourceContext,
} from './smtownNotice'
import {
  getCrawlerSourceByKey,
  type RunStatus,
  updateRunStatus,
} from './crawlerSource'

const EXPECTED_PARSER_TYPE = 'smtown_notice'
/** Safety cap per run. Each page has ~16 items; ~48 across 3 pages. */
const MAX_ENTRIES_PER_RUN = 60
/** Pages to fetch (?page=0 + ?page=1 + ?page=2 = 3 pages, ~48 items). */
const MAX_PAGES = 3
const FETCH_TIMEOUT_MS = 15_000
const USER_AGENT = 'IdolRhythm-Bot/0.1 (+https://idol-rhythm.vercel.app)'

/**
 * Unit names that must NOT be mapped to the root `nct` idol in first pass.
 * If a title contains any of these, the candidate is dropped (treated as
 * unmatched) when the source idol slug is `nct`.
 */
const NCT_UNIT_NAMES_LOWER = [
  'nct 127',
  'nct127',
  'nct dream',
  'nctdream',
  'nct wish',
  'nctwish',
  'wayv',
  'way v',
] as const

function titleNamesNctUnit(title: string): boolean {
  const lower = title.toLowerCase()
  return NCT_UNIT_NAMES_LOWER.some((u) => lower.includes(u))
}

export interface FetcherOptions {
  sourceKey: string
  dryRun?: boolean
}

export interface FetcherResult {
  source: 'smtown-notice'
  sourceKey: string
  mode: 'insert' | 'dry-run'
  fetched: number
  eventFiltered: number
  matched: number
  unmatched: number
  inserted: number
  wouldInsert: number
  skipped: number
  recheck: number
  errors: string[]
  crawlerSourceId: string | null
  sourceName: string | null
  status: number
}

async function fetchPageHtml(
  url: string,
  signal: AbortSignal,
): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      signal,
      cache: 'no-store',
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

export async function runSmtownNoticeFetcher(
  supabase: SupabaseClient,
  options: FetcherOptions,
): Promise<FetcherResult> {
  const dryRun = options.dryRun === true
  const mode: 'insert' | 'dry-run' = dryRun ? 'dry-run' : 'insert'
  const sourceKey = options.sourceKey

  const base = (extra: Partial<FetcherResult>): FetcherResult => ({
    source: 'smtown-notice',
    sourceKey,
    mode,
    fetched: 0,
    eventFiltered: 0,
    matched: 0,
    unmatched: 0,
    inserted: 0,
    wouldInsert: 0,
    skipped: 0,
    recheck: 0,
    errors: [],
    crawlerSourceId: null,
    sourceName: null,
    status: 200,
    ...extra,
  })

  // ── Resolve crawler_sources row ──────────────────────────────────────────
  const { source, error: sourceError } = await getCrawlerSourceByKey(
    supabase,
    sourceKey,
  )
  if (!source) {
    return base({
      errors: [sourceError ?? '找不到 crawler_sources'],
      status: 500,
    })
  }

  if (source.parser_type !== EXPECTED_PARSER_TYPE) {
    const msg = `parser_type 不符：crawler_sources=${source.parser_type}，預期=${EXPECTED_PARSER_TYPE}`
    await updateRunStatus(supabase, source.id, {
      last_status: 'error',
      last_error: msg,
    })
    return base({
      errors: [msg],
      crawlerSourceId: source.id,
      sourceName: source.name,
      status: 500,
    })
  }

  if (!source.is_active) {
    const msg = `來源已停用：${source.name}`
    await updateRunStatus(supabase, source.id, {
      last_status: 'skipped',
      last_error: msg,
    })
    return base({
      errors: [msg],
      crawlerSourceId: source.id,
      sourceName: source.name,
      status: 200,
    })
  }

  if (!source.idol_id) {
    const msg = `crawler_sources 缺少 idol_id：${source.name}（smtown_notice 必須設定對應 idol）`
    await updateRunStatus(supabase, source.id, {
      last_status: 'error',
      last_error: msg,
    })
    return base({
      errors: [msg],
      crawlerSourceId: source.id,
      sourceName: source.name,
      status: 500,
    })
  }

  const pageUrl = source.source_url
  try {
    new URL(pageUrl)
  } catch {
    const msg = `source_url 不是合法 URL：${pageUrl}`
    await updateRunStatus(supabase, source.id, {
      last_status: 'error',
      last_error: msg,
    })
    return base({
      errors: [msg],
      crawlerSourceId: source.id,
      sourceName: source.name,
      status: 500,
    })
  }

  // ── Load the target idol for name matching ────────────────────────────────
  const { data: idolRow, error: idolError } = await supabase
    .from('idols')
    .select('id, name, alt_names, slug')
    .eq('id', source.idol_id)
    .eq('is_active', true)
    .maybeSingle()

  if (idolError || !idolRow) {
    const msg = `找不到對應 idol（id: ${source.idol_id}）：${idolError?.message ?? '無資料'}`
    await updateRunStatus(supabase, source.id, {
      last_status: 'error',
      last_error: msg,
    })
    return base({
      errors: [msg],
      crawlerSourceId: source.id,
      sourceName: source.name,
      status: 500,
    })
  }

  const idolSlug =
    (idolRow.slug as string | null) ??
    source.source_key.split('-smtown-')[0] ??
    ''
  const targetIdol: IdolForMatching = {
    id: idolRow.id as string,
    name: idolRow.name as string,
    alt_names: ((idolRow.alt_names ?? []) as string[]).filter(
      (s) => typeof s === 'string',
    ),
  }
  const matchIndex = buildIdolMatchIndex([targetIdol])
  const isNctRoot = idolSlug === 'nct'

  // ── Fetch notice pages ────────────────────────────────────────────────────
  // SMTOWN uses query-string pagination ?page=N where N is 0-indexed.
  // ?page=0 returns the same content as the base URL (page 1).
  // We fetch the base URL first, then ?page=1 and ?page=2 (= pages 2 and 3).

  const pageUrls: string[] = [pageUrl]
  for (let p = 1; p < MAX_PAGES; p++) {
    const u = new URL(pageUrl)
    u.searchParams.set('page', String(p))
    pageUrls.push(u.toString())
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  const allEntries: ReturnType<typeof parseSmtownNoticeHtml> = []
  const fetchErrors: string[] = []
  const seenNoticeIds = new Set<string>()

  try {
    for (const url of pageUrls) {
      const html = await fetchPageHtml(url, controller.signal)
      if (!html) {
        if (url === pageUrl) {
          fetchErrors.push(`抓取首頁失敗：${url}`)
          break
        }
        // Stop fetching further pages once one returns non-200.
        break
      }
      const pageEntries = parseSmtownNoticeHtml(html, url)
      for (const e of pageEntries) {
        if (seenNoticeIds.has(e.noticeId)) continue
        seenNoticeIds.add(e.noticeId)
        allEntries.push(e)
      }
    }
  } finally {
    clearTimeout(timeout)
  }

  if (allEntries.length === 0 && fetchErrors.length > 0) {
    await updateRunStatus(supabase, source.id, {
      last_status: 'error',
      last_error: fetchErrors.join(' | '),
    })
    return base({
      errors: fetchErrors,
      crawlerSourceId: source.id,
      sourceName: source.name,
      status: 502,
    })
  }

  // ── Event keyword filter ──────────────────────────────────────────────────
  // Conservative: most administrative notices should be skipped.
  const eventEntries = allEntries.filter((e) => isEventNotice(e.title))
  const eventFiltered = allEntries.length - eventEntries.length

  // ── Artist name match (+ NCT unit guard for root NCT source) ──────────────
  let matched = 0
  let unmatched = 0

  const sourceCtx: SmtownSourceContext = {
    crawlerSourceId: source.id,
    sourceKey: source.source_key,
    sourceName: source.name,
    sourceType: source.source_type,
    parserType: source.parser_type,
    pageUrl,
    idolId: source.idol_id,
    idolSlug,
  }

  type EnrichedEntry = {
    entry: (typeof eventEntries)[number]
    payload: SmtownCandidatePayload
  }
  const enriched: EnrichedEntry[] = []

  for (const entry of eventEntries) {
    const result = matchIdolFromTitle(entry.title, matchIndex)
    if (!result) {
      unmatched += 1
      continue
    }
    // NCT root guard: if this source represents the root NCT idol, drop
    // any title that names a unit (NCT 127 / NCT DREAM / NCT WISH / WayV).
    // Treated as unmatched to keep counts honest.
    if (isNctRoot && titleNamesNctUnit(entry.title)) {
      unmatched += 1
      continue
    }
    matched += 1
    enriched.push({
      entry,
      payload: entryToCandidatePayload(entry, sourceCtx),
    })
  }

  const limited = enriched.slice(0, MAX_ENTRIES_PER_RUN)

  // ── Dedup query ───────────────────────────────────────────────────────────
  interface ExistingRow {
    id: string
    source_hash: string | null
    source_url: string | null
    content_hash: string | null
    reviewer_note: string | null
  }
  const existingByHash = new Map<string, ExistingRow>()
  const existingByUrl = new Map<string, ExistingRow>()

  if (limited.length > 0) {
    const hashes = limited.map((p) => p.payload.source_hash)
    const urls = limited.map((p) => p.payload.source_url)
    const [hashRes, urlRes] = await Promise.all([
      supabase
        .from('event_candidates')
        .select('id, source_hash, source_url, content_hash, reviewer_note')
        .in('source_hash', hashes),
      supabase
        .from('event_candidates')
        .select('id, source_hash, source_url, content_hash, reviewer_note')
        .in('source_url', urls),
    ])
    if (hashRes.error || urlRes.error) {
      const err = hashRes.error ?? urlRes.error
      const msg = `去重查詢失敗：${err?.code ? `[${err.code}] ` : ''}${err?.message ?? '未知錯誤'}`
      await updateRunStatus(supabase, source.id, {
        last_status: 'error',
        last_error: msg,
      })
      return base({
        fetched: allEntries.length,
        eventFiltered,
        matched,
        unmatched,
        errors: [msg, ...fetchErrors],
        crawlerSourceId: source.id,
        sourceName: source.name,
        status: 500,
      })
    }
    for (const row of (hashRes.data ?? []) as ExistingRow[]) {
      if (row.source_hash) existingByHash.set(row.source_hash, row)
    }
    for (const row of (urlRes.data ?? []) as ExistingRow[]) {
      if (row.source_url) existingByUrl.set(row.source_url, row)
    }
  }

  // ── INSERT / RECHECK loop ─────────────────────────────────────────────────
  let inserted = 0
  let wouldInsert = 0
  let skipped = 0
  let recheck = 0
  const errors: string[] = [...fetchErrors]

  for (const { entry, payload } of limited) {
    const existing =
      existingByHash.get(payload.source_hash) ??
      existingByUrl.get(payload.source_url) ??
      null

    if (!existing) {
      if (dryRun) {
        wouldInsert += 1
        continue
      }
      const { error } = await supabase.from('event_candidates').insert(payload)
      if (error) {
        if (error.code === '23505') {
          skipped += 1
          continue
        }
        errors.push(
          `${entry.title}: insert 失敗 ${error.code ? `[${error.code}] ` : ''}${error.message}`,
        )
        continue
      }
      inserted += 1
      continue
    }

    // Existing row: check content drift (J7d-A flow)
    if (existing.content_hash === null) {
      if (!dryRun) {
        const { error } = await supabase
          .from('event_candidates')
          .update({ content_hash: payload.content_hash })
          .eq('id', existing.id)
        if (error) {
          errors.push(
            `${entry.title}: content_hash backfill 失敗 ${error.code ? `[${error.code}] ` : ''}${error.message}`,
          )
          continue
        }
      }
      skipped += 1
      continue
    }

    if (existing.content_hash === payload.content_hash) {
      skipped += 1
      continue
    }

    if (dryRun) {
      recheck += 1
      continue
    }

    const noteSuffix = `[${new Date().toISOString()}] content changed after capture`
    const newNote = existing.reviewer_note
      ? `${existing.reviewer_note}\n${noteSuffix}`
      : noteSuffix

    const { error } = await supabase
      .from('event_candidates')
      .update({
        needs_recheck: true,
        content_hash: payload.content_hash,
        reviewer_note: newNote,
      })
      .eq('id', existing.id)
    if (error) {
      errors.push(
        `${entry.title}: recheck flag 失敗 ${error.code ? `[${error.code}] ` : ''}${error.message}`,
      )
      continue
    }
    recheck += 1
  }

  if (!dryRun) wouldInsert = inserted

  const lastStatus: RunStatus =
    errors.length === 0 ? 'success' : 'partial_error'
  await updateRunStatus(supabase, source.id, {
    last_status: lastStatus,
    last_error: errors.length > 0 ? errors.join('\n') : null,
  })

  return {
    source: 'smtown-notice',
    sourceKey,
    mode,
    fetched: allEntries.length,
    eventFiltered,
    matched,
    unmatched,
    inserted,
    wouldInsert,
    skipped,
    recheck,
    errors,
    crawlerSourceId: source.id,
    sourceName: source.name,
    status: 200,
  }
}

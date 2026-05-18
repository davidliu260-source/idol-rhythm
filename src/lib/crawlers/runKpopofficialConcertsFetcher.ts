/**
 * kpopofficial.com aggregator fetcher (M1a-B).
 *
 * Orchestrates:
 *   1. Resolve the crawler_sources row by source_key (parser_type must be
 *      'kpopofficial_concerts').
 *   2. Fetch the listing-page HTML.
 *   3. Parse event cards (kpopofficialConcerts.ts).
 *   4. Load every active idol once, build a normalized name+alt_names index,
 *      match each entry's title to an idol or skip it.
 *   5. Filter past-dated entries (matching the jyp_schedule fetcher's
 *      forward-looking policy).
 *   6. Dedup against existing event_candidates by source_hash AND source_url.
 *   7. INSERT new candidates with detected_idol_id, source_type from the
 *      crawler_sources row, reviewer_note flagged as aggregator. Existing
 *      candidates fall through the J7d-A content_hash drift flow exactly
 *      like the other fetchers.
 *
 * Never writes events. Never approves. Never publishes. Never touches the
 * frontend.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildIdolMatchIndex,
  matchIdolFromTitle,
  type IdolForMatching,
} from './idolMatcher'
import {
  entryToCandidatePayload,
  parseKpopofficialConcertsHtml,
  type KpopOfficialCandidatePayload,
  type KpopOfficialSourceContext,
} from './kpopofficialConcerts'
import {
  getCrawlerSourceByKey,
  type RunStatus,
  updateRunStatus,
} from './crawlerSource'

const EXPECTED_PARSER_TYPE = 'kpopofficial_concerts'
/** Per-run cap; the listing page typically shows < 100 future events. */
const MAX_ENTRIES_PER_RUN = 200
const FETCH_TIMEOUT_MS = 15_000
const USER_AGENT =
  'IdolRhythm-Bot/0.1 (+https://idol-rhythm.vercel.app)'

export interface FetcherOptions {
  sourceKey: string
  dryRun?: boolean
}

export interface FetcherResult {
  source: 'kpopofficial-concerts'
  sourceKey: string
  mode: 'insert' | 'dry-run'
  fetched: number
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

export async function runKpopofficialConcertsFetcher(
  supabase: SupabaseClient,
  options: FetcherOptions,
): Promise<FetcherResult> {
  const dryRun = options.dryRun === true
  const mode: 'insert' | 'dry-run' = dryRun ? 'dry-run' : 'insert'
  const sourceKey = options.sourceKey

  const base = (extra: Partial<FetcherResult>): FetcherResult => ({
    source: 'kpopofficial-concerts',
    sourceKey,
    mode,
    fetched: 0,
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
    await updateRunStatus(supabase, source.id, { last_status: 'error', last_error: msg })
    return base({
      errors: [msg],
      crawlerSourceId: source.id,
      sourceName: source.name,
      status: 500,
    })
  }

  if (!source.is_active) {
    const msg = `來源已停用：${source.name}`
    await updateRunStatus(supabase, source.id, { last_status: 'skipped', last_error: msg })
    return base({
      errors: [msg],
      crawlerSourceId: source.id,
      sourceName: source.name,
      status: 200,
    })
  }

  const pageUrl = source.source_url
  try {
    new URL(pageUrl)
  } catch {
    const msg = `source_url 不是合法 URL：${pageUrl}`
    await updateRunStatus(supabase, source.id, { last_status: 'error', last_error: msg })
    return base({
      errors: [msg],
      crawlerSourceId: source.id,
      sourceName: source.name,
      status: 500,
    })
  }

  // ── Fetch HTML ───────────────────────────────────────────────────────────
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  let html: string
  try {
    const res = await fetch(pageUrl, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
    html = await res.text()
  } catch (e) {
    clearTimeout(timeout)
    const msg = `抓取頁面失敗：${e instanceof Error ? e.message : String(e)}`
    await updateRunStatus(supabase, source.id, { last_status: 'error', last_error: msg })
    return base({
      errors: [msg],
      crawlerSourceId: source.id,
      sourceName: source.name,
      status: 502,
    })
  } finally {
    clearTimeout(timeout)
  }

  // ── Parse ────────────────────────────────────────────────────────────────
  const allEntries = parseKpopofficialConcertsHtml(html, pageUrl)

  // ── Load active idols, build match index ─────────────────────────────────
  const { data: idolRows, error: idolError } = await supabase
    .from('idols')
    .select('id, name, alt_names')
    .eq('is_active', true)
  if (idolError) {
    const msg = `讀取 idols 失敗 [${idolError.code ?? '?'}] ${idolError.message}`
    await updateRunStatus(supabase, source.id, { last_status: 'error', last_error: msg })
    return base({
      errors: [msg],
      crawlerSourceId: source.id,
      sourceName: source.name,
      status: 500,
    })
  }
  const idols: IdolForMatching[] = (idolRows ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    alt_names: ((r.alt_names ?? []) as string[]).filter((s) => typeof s === 'string'),
  }))
  const index = buildIdolMatchIndex(idols)

  // ── Past-date filter ─────────────────────────────────────────────────────
  const today = new Date()
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const futureEntries = allEntries.filter(
    (e) => e.detectedDate !== null && e.detectedDate >= todayIso,
  )

  // ── Idol match (skip unmatched) ──────────────────────────────────────────
  let matched = 0
  let unmatched = 0
  const sourceCtx: KpopOfficialSourceContext = {
    crawlerSourceId: source.id,
    sourceKey: source.source_key,
    sourceName: source.name,
    sourceType: source.source_type,
    parserType: source.parser_type,
    pageUrl,
  }

  type EnrichedEntry = {
    entry: (typeof futureEntries)[number]
    payload: KpopOfficialCandidatePayload
  }
  const enriched: EnrichedEntry[] = []
  for (const entry of futureEntries) {
    const result = matchIdolFromTitle(entry.title, index)
    if (!result) {
      unmatched += 1
      continue
    }
    matched += 1
    enriched.push({
      entry,
      payload: entryToCandidatePayload({
        entry,
        source: sourceCtx,
        matchedIdolId: result.idol.id,
        matchedIdolName: result.idol.name,
        matchedVia: result.viaPrimaryName ? 'name' : 'alt_name',
      }),
    })
  }

  const limited = enriched.slice(0, MAX_ENTRIES_PER_RUN)

  // ── Dedup query (J7d-A content_hash flow) ────────────────────────────────
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
    const urls = limited.map((p) => p.entry.sourceUrl)
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
      await updateRunStatus(supabase, source.id, { last_status: 'error', last_error: msg })
      return base({
        fetched: allEntries.length,
        matched,
        unmatched,
        errors: [msg],
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

  // ── INSERT / RECHECK loop ────────────────────────────────────────────────
  let inserted = 0
  let wouldInsert = 0
  let skipped = 0
  let recheck = 0
  const errors: string[] = []

  for (const { entry, payload } of limited) {
    const existing =
      existingByHash.get(payload.source_hash) ??
      existingByUrl.get(entry.sourceUrl) ??
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

  const lastStatus: RunStatus = errors.length === 0 ? 'success' : 'partial_error'
  await updateRunStatus(supabase, source.id, {
    last_status: lastStatus,
    last_error: errors.length > 0 ? errors.join('\n') : null,
  })

  return {
    source: 'kpopofficial-concerts',
    sourceKey,
    mode,
    fetched: allEntries.length,
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

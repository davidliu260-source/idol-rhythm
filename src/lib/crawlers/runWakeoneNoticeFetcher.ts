/**
 * WAKEONE notice fetcher orchestrator.
 *
 * Orchestrates:
 *   1. Resolve crawler_sources row by source_key (parser_type must be
 *      'wakeone_notice').
 *   2. Load the idol corresponding to source.idol_id, build a small
 *      name+alt_names match index restricted to this idol only.
 *   3. Fetch notice listing pages (up to MAX_PAGES) via URL pagination
 *      /notice/page/N/. Falls back to 1 page on non-200 pages.
 *   4. Parse notice items using wakeoneNotice.ts.
 *   5. Filter entries through isEventNotice() (conservative event keyword
 *      filter — most administrative notices are skipped by design).
 *   6. Match titles to the source idol using idolMatcher. Skip entries that
 *      don't mention this artist by name or alias.
 *   7. Dedup against event_candidates by source_hash AND source_url.
 *   8. INSERT new candidates (pending, not published, not approved).
 *      Content-changed rows get needs_recheck = true (J7d-A drift flow).
 *
 * Never writes events. Never approves. Never publishes.
 *
 * Phase A probe: https://wake-one.com/notice/ is server-rendered WordPress.
 * URL pagination /notice/page/N/ works. max_page = 2 at probe time.
 * The button "View more.." uses an AJAX endpoint with a rotating nonce —
 * we use URL pagination instead for stability.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildIdolMatchIndex,
  matchIdolFromTitle,
  type IdolForMatching,
} from './idolMatcher'
import {
  parseWakeoneNoticeHtml,
  isEventNotice,
  entryToCandidatePayload,
  type WakeoneCandidatePayload,
  type WakeoneSourceContext,
} from './wakeoneNotice'
import {
  getCrawlerSourceByKey,
  type RunStatus,
  updateRunStatus,
} from './crawlerSource'

const EXPECTED_PARSER_TYPE = 'wakeone_notice'
/** Safety cap per run. Notice board is small; 60 is generous. */
const MAX_ENTRIES_PER_RUN = 60
/** WordPress page count to fetch. Each page returns ~12 items. */
const MAX_PAGES = 3
const FETCH_TIMEOUT_MS = 15_000
const USER_AGENT = 'IdolRhythm-Bot/0.1 (+https://idol-rhythm.vercel.app)'

export interface FetcherOptions {
  sourceKey: string
  dryRun?: boolean
}

export interface FetcherResult {
  source: 'wakeone-notice'
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

async function fetchPageHtml(url: string, signal: AbortSignal): Promise<string | null> {
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

export async function runWakeoneNoticeFetcher(
  supabase: SupabaseClient,
  options: FetcherOptions,
): Promise<FetcherResult> {
  const dryRun = options.dryRun === true
  const mode: 'insert' | 'dry-run' = dryRun ? 'dry-run' : 'insert'
  const sourceKey = options.sourceKey

  const base = (extra: Partial<FetcherResult>): FetcherResult => ({
    source: 'wakeone-notice',
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

  if (!source.idol_id) {
    const msg = `crawler_sources 缺少 idol_id：${source.name}（wakeone_notice 必須設定對應 idol）`
    await updateRunStatus(supabase, source.id, { last_status: 'error', last_error: msg })
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
    await updateRunStatus(supabase, source.id, { last_status: 'error', last_error: msg })
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
    await updateRunStatus(supabase, source.id, { last_status: 'error', last_error: msg })
    return base({
      errors: [msg],
      crawlerSourceId: source.id,
      sourceName: source.name,
      status: 500,
    })
  }

  const idolSlug = (idolRow.slug as string | null) ?? source.source_key.split('-wakeone-')[0] ?? ''
  const targetIdol: IdolForMatching = {
    id: idolRow.id as string,
    name: idolRow.name as string,
    alt_names: ((idolRow.alt_names ?? []) as string[]).filter((s) => typeof s === 'string'),
  }
  const matchIndex = buildIdolMatchIndex([targetIdol])

  // ── Fetch notice pages ────────────────────────────────────────────────────
  // WordPress URL pagination: /notice/page/N/ (page 1 = base URL, page 2+ = /page/N/)
  // We fetch page 1 from source_url, then /page/2/ and /page/3/ if they exist.

  const origin = (() => {
    try { return new URL(pageUrl).origin } catch { return '' }
  })()

  const pageUrls: string[] = [pageUrl]
  for (let p = 2; p <= MAX_PAGES; p++) {
    pageUrls.push(`${origin}/notice/page/${p}/`)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  const allEntries: ReturnType<typeof parseWakeoneNoticeHtml> = []
  const fetchErrors: string[] = []

  try {
    let consecutiveNonOk = 0
    for (const url of pageUrls) {
      const html = await fetchPageHtml(url, controller.signal)
      if (!html) {
        consecutiveNonOk += 1
        // Stop fetching further pages once one returns non-200 (pagination end)
        if (consecutiveNonOk >= 1 && url !== pageUrl) break
        if (url === pageUrl) {
          // First page failed — hard error
          fetchErrors.push(`抓取首頁失敗：${url}`)
        }
        continue
      }
      consecutiveNonOk = 0
      const pageEntries = parseWakeoneNoticeHtml(html, url)
      allEntries.push(...pageEntries)
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

  // ── Artist name match ─────────────────────────────────────────────────────
  // Only include notices that explicitly mention this source's idol.
  let matched = 0
  let unmatched = 0

  const sourceCtx: WakeoneSourceContext = {
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
    payload: WakeoneCandidatePayload
  }
  const enriched: EnrichedEntry[] = []

  for (const entry of eventEntries) {
    const result = matchIdolFromTitle(entry.title, matchIndex)
    if (!result) {
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
      await updateRunStatus(supabase, source.id, { last_status: 'error', last_error: msg })
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

  const lastStatus: RunStatus = errors.length === 0 ? 'success' : 'partial_error'
  await updateRunStatus(supabase, source.id, {
    last_status: lastStatus,
    last_error: errors.length > 0 ? errors.join('\n') : null,
  })

  return {
    source: 'wakeone-notice',
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

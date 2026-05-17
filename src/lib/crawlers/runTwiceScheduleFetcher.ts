import type { SupabaseClient } from '@supabase/supabase-js'
import {
  entryToCandidatePayload,
  parseTwiceScheduleApiItems,
  type JypApiScheduleItem,
  type TwiceSourceContext,
} from './twiceJypSchedule'
import {
  getCrawlerSourceByKey,
  type RunStatus,
  updateRunStatus,
} from './crawlerSource'

const SOURCE_KEY = 'twice-jyp-schedule'
const EXPECTED_PARSER_TYPE = 'twice_jyp_schedule'
const MAX_ENTRIES_PER_RUN = 60
const FETCH_TIMEOUT_MS = 15_000
const USER_AGENT = 'IdolRhythm-Bot/0.1 (+https://idol-rhythm.vercel.app)'

// JYP public JSON endpoints (no auth required).
const JYP_GROUPS_URL = 'https://twice.jype.com/api/groups/twice'
const JYP_SCHEDULES_BASE = 'https://twice.jype.com/api/schedules'
// Fetch this many months starting from the current month.
const MONTHS_AHEAD = 3

export interface FetcherOptions {
  /** Skip INSERT loop; report wouldInsert. Still updates crawler_sources status. */
  dryRun?: boolean
}

export interface FetcherResult {
  source: 'twice-jyp-schedule'
  mode: 'insert' | 'dry-run'
  fetched: number
  inserted: number
  wouldInsert: number
  skipped: number
  errors: string[]
  crawlerSourceId: string | null
  sourceName: string | null
  status: number
}

/** ISO 8601 datetime string with local-offset, matching the JYP JS client. */
function formatIso(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  const offsetMin = -date.getTimezoneOffset()
  const sign = offsetMin >= 0 ? '+' : '-'
  const absMin = Math.abs(offsetMin)
  const oh = pad(Math.floor(absMin / 60))
  const om = pad(absMin % 60)
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${oh}:${om}`
  )
}

function monthRange(year: number, month: number): { startDate: string; endDate: string } {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0)
  const end = new Date(year, month, 0, 23, 59, 59, 0)
  return { startDate: formatIso(start), endDate: formatIso(end) }
}

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal,
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

/**
 * TWICE JYP Schedule fetcher.
 *
 * Reads config from crawler_sources, calls the JYP JSON API for the current
 * month plus MONTHS_AHEAD-1 additional months, parses schedule items, dedupes
 * by source_hash + source_url, and inserts pending event_candidates.
 * Updates crawler_sources.last_run_at / last_status / last_error in every path.
 *
 * Never writes to events, never approves, never publishes.
 */
export async function runTwiceScheduleFetcher(
  supabase: SupabaseClient,
  options: FetcherOptions = {},
): Promise<FetcherResult> {
  const dryRun = options.dryRun === true
  const mode: 'insert' | 'dry-run' = dryRun ? 'dry-run' : 'insert'

  // ── Resolve crawler_sources row ──────────────────────────────────────────
  const { source, error: sourceError } = await getCrawlerSourceByKey(
    supabase,
    SOURCE_KEY,
  )
  if (!source) {
    return {
      source: 'twice-jyp-schedule',
      mode,
      fetched: 0,
      inserted: 0,
      wouldInsert: 0,
      skipped: 0,
      errors: [sourceError ?? '找不到 crawler_sources'],
      crawlerSourceId: null,
      sourceName: null,
      status: 500,
    }
  }

  if (source.parser_type !== EXPECTED_PARSER_TYPE) {
    const msg = `parser_type 不符：crawler_sources=${source.parser_type}，預期=${EXPECTED_PARSER_TYPE}`
    await updateRunStatus(supabase, source.id, { last_status: 'error', last_error: msg })
    return {
      source: 'twice-jyp-schedule',
      mode,
      fetched: 0,
      inserted: 0,
      wouldInsert: 0,
      skipped: 0,
      errors: [msg],
      crawlerSourceId: source.id,
      sourceName: source.name,
      status: 500,
    }
  }

  if (!source.is_active) {
    const msg = `來源已停用：${source.name}`
    await updateRunStatus(supabase, source.id, { last_status: 'skipped', last_error: msg })
    return {
      source: 'twice-jyp-schedule',
      mode,
      fetched: 0,
      inserted: 0,
      wouldInsert: 0,
      skipped: 0,
      errors: [msg],
      crawlerSourceId: source.id,
      sourceName: source.name,
      status: 200,
    }
  }

  const pageUrl = source.source_url

  // ── Fetch JSON API ───────────────────────────────────────────────────────
  const allItems: JypApiScheduleItem[] = []
  const fetchErrors: string[] = []

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    // Step 1: resolve groupId
    const groupData = await fetchJson<{ groupId: string; fansKey: string }>(
      JYP_GROUPS_URL,
      controller.signal,
    )
    const { groupId } = groupData
    if (!groupId) throw new Error('JYP API 回傳的 groupId 為空')

    // Step 2: fetch schedules month by month
    const now = new Date()
    for (let i = 0; i < MONTHS_AHEAD; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const { startDate, endDate } = monthRange(d.getFullYear(), d.getMonth() + 1)
      const url =
        `${JYP_SCHEDULES_BASE}?groupId=${encodeURIComponent(groupId)}` +
        `&startDate=${encodeURIComponent(startDate)}` +
        `&endDate=${encodeURIComponent(endDate)}`
      try {
        const data = await fetchJson<{ schedules: JypApiScheduleItem[] }>(
          url,
          controller.signal,
        )
        allItems.push(...(data.schedules ?? []))
      } catch (e) {
        fetchErrors.push(
          `行程 API 失敗 ${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}：${e instanceof Error ? e.message : String(e)}`,
        )
      }
    }
  } catch (e) {
    clearTimeout(timeout)
    const msg = `JYP API 失敗：${e instanceof Error ? e.message : String(e)}`
    await updateRunStatus(supabase, source.id, { last_status: 'error', last_error: msg })
    return {
      source: 'twice-jyp-schedule',
      mode,
      fetched: 0,
      inserted: 0,
      wouldInsert: 0,
      skipped: 0,
      errors: [msg],
      crawlerSourceId: source.id,
      sourceName: source.name,
      status: 502,
    }
  } finally {
    clearTimeout(timeout)
  }

  // All months failed → hard error
  if (allItems.length === 0 && fetchErrors.length === MONTHS_AHEAD) {
    const msg = fetchErrors.join(' | ')
    await updateRunStatus(supabase, source.id, { last_status: 'error', last_error: msg })
    return {
      source: 'twice-jyp-schedule',
      mode,
      fetched: 0,
      inserted: 0,
      wouldInsert: 0,
      skipped: 0,
      errors: fetchErrors,
      crawlerSourceId: source.id,
      sourceName: source.name,
      status: 502,
    }
  }

  // ── Parse ────────────────────────────────────────────────────────────────
  const entries = parseTwiceScheduleApiItems(allItems, pageUrl)
  const limited = entries.slice(0, MAX_ENTRIES_PER_RUN)

  // ── Resolve idol id ──────────────────────────────────────────────────────
  let idolId: string | null = source.idol_id
  if (!idolId) {
    const { data, error } = await supabase
      .from('idols')
      .select('id')
      .eq('slug', 'twice')
      .eq('is_active', true)
      .maybeSingle()
    if (error) {
      // eslint-disable-next-line no-console
      console.warn('twice-schedule: idol lookup fallback failed', error)
    } else if (data?.id) {
      idolId = data.id as string
    }
  }

  const sourceCtx: TwiceSourceContext = {
    crawlerSourceId: source.id,
    sourceKey: source.source_key,
    sourceName: source.name,
    sourceType: source.source_type,
    parserType: source.parser_type,
    pageUrl,
    idolId,
  }

  const payloads = limited.map((entry) => ({
    entry,
    payload: entryToCandidatePayload(entry, sourceCtx),
  }))

  // ── Dedup query ──────────────────────────────────────────────────────────
  const hashes = payloads.map((p) => p.payload.source_hash)
  const urls = payloads.map((p) => p.entry.sourceUrl)
  const existingHashes = new Set<string>()
  const existingUrls = new Set<string>()

  if (limited.length > 0) {
    const hashQuery = supabase
      .from('event_candidates')
      .select('source_hash')
      .in('source_hash', hashes)
    const urlQuery = supabase
      .from('event_candidates')
      .select('source_url')
      .in('source_url', urls)
    const [hashRes, urlRes] = await Promise.all([hashQuery, urlQuery])
    if (hashRes.error || urlRes.error) {
      const err = hashRes.error ?? urlRes.error
      const msg = `去重查詢失敗：${err?.code ? `[${err.code}] ` : ''}${err?.message ?? '未知錯誤'}`
      await updateRunStatus(supabase, source.id, { last_status: 'error', last_error: msg })
      return {
        source: 'twice-jyp-schedule',
        mode,
        fetched: limited.length,
        inserted: 0,
        wouldInsert: 0,
        skipped: 0,
        errors: [msg, ...fetchErrors],
        crawlerSourceId: source.id,
        sourceName: source.name,
        status: 500,
      }
    }
    for (const row of hashRes.data ?? []) {
      const h = (row as { source_hash: string | null }).source_hash
      if (h) existingHashes.add(h)
    }
    for (const row of urlRes.data ?? []) {
      const u = (row as { source_url: string | null }).source_url
      if (u) existingUrls.add(u)
    }
  }

  // ── INSERT loop ──────────────────────────────────────────────────────────
  let inserted = 0
  let wouldInsert = 0
  let skipped = 0
  const errors: string[] = [...fetchErrors]

  for (const { entry, payload } of payloads) {
    if (existingHashes.has(payload.source_hash) || existingUrls.has(entry.sourceUrl)) {
      skipped += 1
      continue
    }

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
  }

  if (!dryRun) wouldInsert = inserted

  const lastStatus: RunStatus =
    errors.filter((e) => !fetchErrors.includes(e)).length > 0 || fetchErrors.length === MONTHS_AHEAD
      ? 'partial_error'
      : 'success'
  await updateRunStatus(supabase, source.id, {
    last_status: lastStatus,
    last_error: errors.length > 0 ? errors.join('\n') : null,
  })

  return {
    source: 'twice-jyp-schedule',
    mode,
    fetched: limited.length,
    inserted,
    wouldInsert,
    skipped,
    errors,
    crawlerSourceId: source.id,
    sourceName: source.name,
    status: 200,
  }
}

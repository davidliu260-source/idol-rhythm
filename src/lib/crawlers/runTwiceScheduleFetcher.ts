import type { SupabaseClient } from '@supabase/supabase-js'
import {
  entryToCandidatePayload,
  parseTwiceScheduleHtml,
  type TwiceSourceContext,
} from './twiceJypSchedule'
import {
  getCrawlerSourceByKey,
  type RunStatus,
  updateRunStatus,
} from './crawlerSource'

const SOURCE_KEY = 'twice-jyp-schedule'
const EXPECTED_PARSER_TYPE = 'twice_jyp_schedule'
const MAX_ENTRIES_PER_RUN = 30
const FETCH_TIMEOUT_MS = 15_000
const USER_AGENT =
  'IdolRhythm-Bot/0.1 (+https://idol-rhythm.vercel.app)'

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

/**
 * TWICE JYP Schedule fetcher (J6c).
 *
 * Mirrors the BLACKPINK fetcher's contract:
 *   - Reads crawler_sources WHERE source_key = 'twice-jyp-schedule'.
 *   - Short-circuits on missing row / wrong parser_type / is_active = false.
 *   - Fetches HTML from source.source_url.
 *   - Parses with the JYP schedule parser.
 *   - Dedupes by source_hash + source_url against event_candidates.
 *   - Inserts pending rows (or counts wouldInsert in dry-run).
 *   - Writes back last_run_at / last_status / last_error in every path.
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
    await updateRunStatus(supabase, source.id, {
      last_status: 'error',
      last_error: msg,
    })
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
    await updateRunStatus(supabase, source.id, {
      last_status: 'skipped',
      last_error: msg,
    })
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

  // ── Fetch ────────────────────────────────────────────────────────────────
  let html: string
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      const res = await fetch(pageUrl, {
        method: 'GET',
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml',
        },
        signal: controller.signal,
        cache: 'no-store',
      })
      if (!res.ok) {
        const msg = `來源頁回應 ${res.status} ${res.statusText}`
        await updateRunStatus(supabase, source.id, {
          last_status: 'error',
          last_error: msg,
        })
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
      }
      html = await res.text()
    } finally {
      clearTimeout(timeout)
    }
  } catch (e) {
    const msg = `抓取來源頁失敗：${e instanceof Error ? e.message : String(e)}`
    await updateRunStatus(supabase, source.id, {
      last_status: 'error',
      last_error: msg,
    })
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
  }

  // ── Parse ────────────────────────────────────────────────────────────────
  let entries
  try {
    entries = parseTwiceScheduleHtml(html, pageUrl)
  } catch (e) {
    const msg = `解析來源頁失敗：${e instanceof Error ? e.message : String(e)}`
    await updateRunStatus(supabase, source.id, {
      last_status: 'error',
      last_error: msg,
    })
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

  if (entries.length === 0) {
    const msg = '沒有解析到行程（頁面結構可能已變更）'
    await updateRunStatus(supabase, source.id, {
      last_status: 'error',
      last_error: msg,
    })
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
  {
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
      await updateRunStatus(supabase, source.id, {
        last_status: 'error',
        last_error: msg,
      })
      return {
        source: 'twice-jyp-schedule',
        mode,
        fetched: limited.length,
        inserted: 0,
        wouldInsert: 0,
        skipped: 0,
        errors: [msg],
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
  const errors: string[] = []

  for (const { entry, payload } of payloads) {
    if (existingHashes.has(payload.source_hash)) {
      skipped += 1
      continue
    }
    if (existingUrls.has(entry.sourceUrl)) {
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

  const lastStatus: RunStatus = errors.length > 0 ? 'partial_error' : 'success'
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

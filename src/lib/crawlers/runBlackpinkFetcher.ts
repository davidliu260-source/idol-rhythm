import type { SupabaseClient } from '@supabase/supabase-js'
import {
  type BlackpinkSourceContext,
  entryToCandidatePayload,
  parseBlackpinkTourHtml,
} from './blackpinkOfficialTour'

const SOURCE_KEY = 'blackpink-official-tour'
const EXPECTED_PARSER_TYPE = 'blackpink_official_tour'
const MAX_ENTRIES_PER_RUN = 30
const FETCH_TIMEOUT_MS = 15_000
const USER_AGENT =
  'IdolRhythm-Bot/0.1 (+https://idol-rhythm.vercel.app)'
const LAST_ERROR_MAX_LEN = 2000

export interface FetcherOptions {
  /**
   * When true, skip the INSERT loop entirely and report how many rows *would*
   * have been written. Used by the Vercel Cron route under ?dryRun=1. When
   * false, INSERT is performed as normal.
   *
   * Even in dry-run mode the fetcher still updates crawler_sources status,
   * because a dry-run is still a real source-availability check.
   *
   * Default: false (real insert).
   */
  dryRun?: boolean
}

export interface FetcherResult {
  source: 'blackpink-official-tour'
  mode: 'insert' | 'dry-run'
  fetched: number
  /** Rows actually inserted. Always 0 in dry-run mode. */
  inserted: number
  /**
   * Rows that *would* be inserted if we ran in insert mode.
   * Equals `inserted` in insert mode; computed from dedup in dry-run mode.
   */
  wouldInsert: number
  skipped: number
  errors: string[]
  /** Source row id from crawler_sources, when resolved. */
  crawlerSourceId: string | null
  /** Source display name from crawler_sources, when resolved. */
  sourceName: string | null
  /** HTTP-ish status hint for the caller's response code. 200/502/500. */
  status: number
}

type LastStatus = 'success' | 'partial_error' | 'error' | 'skipped'

interface CrawlerSourceRow {
  id: string
  name: string
  source_key: string
  idol_id: string | null
  source_url: string
  source_type: BlackpinkSourceContext['sourceType']
  parser_type: string
  is_active: boolean
}

/**
 * Reads the crawler_sources row by source_key.
 * Returns null + error message if not found or query failed.
 */
async function getCrawlerSourceByKey(
  supabase: SupabaseClient,
  key: string,
): Promise<{ source: CrawlerSourceRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from('crawler_sources')
    .select(
      'id, name, source_key, idol_id, source_url, source_type, parser_type, is_active',
    )
    .eq('source_key', key)
    .maybeSingle()

  if (error) {
    return {
      source: null,
      error: `讀取 crawler_sources 失敗 [${error.code ?? '?'}] ${error.message}`,
    }
  }
  if (!data) {
    return { source: null, error: `找不到 crawler_sources：${key}` }
  }
  return { source: data as CrawlerSourceRow, error: null }
}

/**
 * Updates crawler_sources status columns. Failures here are non-fatal —
 * the fetcher result is already determined; we only log to console.
 */
async function updateRunStatus(
  supabase: SupabaseClient,
  crawlerSourceId: string,
  patch: {
    last_status: LastStatus
    last_error: string | null
  },
): Promise<void> {
  const now = new Date().toISOString()
  const trimmed =
    patch.last_error && patch.last_error.length > LAST_ERROR_MAX_LEN
      ? patch.last_error.slice(0, LAST_ERROR_MAX_LEN)
      : patch.last_error

  const { error } = await supabase
    .from('crawler_sources')
    .update({
      last_run_at: now,
      last_status: patch.last_status,
      last_error: trimmed,
      updated_at: now,
    })
    .eq('id', crawlerSourceId)

  if (error) {
    // eslint-disable-next-line no-console
    console.warn('crawler_sources: status update failed', error)
  }
}

/**
 * Shared BLACKPINK fetcher logic, callable from either:
 *   - Admin manual route (POST /api/admin/crawlers/blackpink-tour/run)
 *     → real insert; auth = getCurrentAdmin() session cookie
 *   - Vercel Cron route (GET /api/cron/sync-candidates)
 *     → service_role + optional ?dryRun=1; auth = CRON_SECRET Bearer header
 *
 * Pure data layer: caller handles auth and HTTP response shaping.
 * Never writes to events, never approves candidates, never publishes.
 *
 * J6b: source config (URL, name, type, idol_id) is now read from
 * crawler_sources where source_key = 'blackpink-official-tour'.
 * After the run, last_run_at / last_status / last_error are written back
 * to the same row.
 */
export async function runBlackpinkFetcher(
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
    // Cannot update status without an id; return a hard error.
    return {
      source: 'blackpink-official-tour',
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
      source: 'blackpink-official-tour',
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
      source: 'blackpink-official-tour',
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

  // ── Fetch source page ────────────────────────────────────────────────────
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
          source: 'blackpink-official-tour',
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
      source: 'blackpink-official-tour',
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
    entries = parseBlackpinkTourHtml(html, pageUrl)
  } catch (e) {
    const msg = `解析來源頁失敗：${e instanceof Error ? e.message : String(e)}`
    await updateRunStatus(supabase, source.id, {
      last_status: 'error',
      last_error: msg,
    })
    return {
      source: 'blackpink-official-tour',
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
      source: 'blackpink-official-tour',
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

  // Cap entries per run.
  const limited = entries.slice(0, MAX_ENTRIES_PER_RUN)

  // ── Resolve idol id ──────────────────────────────────────────────────────
  // Prefer crawler_sources.idol_id (set during J6a seed). Fall back to
  // looking up by slug = 'blackpink' if the FK row was cleared by
  // ON DELETE SET NULL; never fabricate a UUID.
  let idolId: string | null = source.idol_id
  if (!idolId) {
    const { data, error } = await supabase
      .from('idols')
      .select('id')
      .eq('slug', 'blackpink')
      .eq('is_active', true)
      .maybeSingle()
    if (error) {
      // Non-fatal: continue with null idol id.
      // eslint-disable-next-line no-console
      console.warn('blackpink-tour: idol lookup fallback failed', error)
    } else if (data?.id) {
      idolId = data.id as string
    }
  }

  const sourceCtx: BlackpinkSourceContext = {
    crawlerSourceId: source.id,
    sourceKey: source.source_key,
    sourceName: source.name,
    sourceType: source.source_type,
    parserType: source.parser_type,
    pageUrl,
    idolId,
  }

  // ── Compute payloads up front (gives us source_hash for dedup query) ─────
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
        source: 'blackpink-official-tour',
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

  // ── INSERT (or dry-run count) loop ───────────────────────────────────────
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
        `${entry.city}: insert 失敗 ${error.code ? `[${error.code}] ` : ''}${error.message}`,
      )
      continue
    }
    inserted += 1
  }

  if (!dryRun) wouldInsert = inserted

  // ── Write back run status ────────────────────────────────────────────────
  const lastStatus: LastStatus = errors.length > 0 ? 'partial_error' : 'success'
  await updateRunStatus(supabase, source.id, {
    last_status: lastStatus,
    last_error: errors.length > 0 ? errors.join('\n') : null,
  })

  return {
    source: 'blackpink-official-tour',
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

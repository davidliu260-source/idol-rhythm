import type { SupabaseClient } from '@supabase/supabase-js'
import {
  BLACKPINK_TOUR_URL,
  entryToCandidatePayload,
  parseBlackpinkTourHtml,
} from './blackpinkOfficialTour'

const MAX_ENTRIES_PER_RUN = 30
const FETCH_TIMEOUT_MS = 15_000
const USER_AGENT =
  'IdolRhythm-Bot/0.1 (+https://idol-rhythm.vercel.app)'

export interface FetcherOptions {
  /**
   * When true, skip the INSERT loop entirely and report how many rows *would*
   * have been written. Used by the Vercel Cron route, which has no admin
   * session and therefore can't satisfy the event_candidates INSERT RLS
   * policy (admin_users-based). When false, INSERT is performed as normal.
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
  /** HTTP-ish status hint for the caller's response code. 200/502/500. */
  status: number
}

/**
 * Shared BLACKPINK fetcher logic, callable from either:
 *   - Admin manual route (POST /api/admin/crawlers/blackpink-tour/run)
 *     → real insert; auth = getCurrentAdmin() session cookie
 *   - Vercel Cron route (GET /api/cron/sync-candidates)
 *     → dry-run only; auth = CRON_SECRET Bearer header
 *
 * Pure data layer: caller handles auth (admin session vs CRON_SECRET) and
 * HTTP response shaping. This function never writes to events, never
 * approves candidates, never publishes. In insert mode, writes go to
 * event_candidates with review_status = 'pending' (DB default).
 */
export async function runBlackpinkFetcher(
  supabase: SupabaseClient,
  options: FetcherOptions = {},
): Promise<FetcherResult> {
  const dryRun = options.dryRun === true
  const mode: 'insert' | 'dry-run' = dryRun ? 'dry-run' : 'insert'
  // ── Fetch source page ────────────────────────────────────────────────────
  let html: string
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      const res = await fetch(BLACKPINK_TOUR_URL, {
        method: 'GET',
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml',
        },
        signal: controller.signal,
        cache: 'no-store',
      })
      if (!res.ok) {
        return {
          source: 'blackpink-official-tour',
          mode,
          fetched: 0,
          inserted: 0,
          wouldInsert: 0,
          skipped: 0,
          errors: [`來源頁回應 ${res.status} ${res.statusText}`],
          status: 502,
        }
      }
      html = await res.text()
    } finally {
      clearTimeout(timeout)
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      source: 'blackpink-official-tour',
      mode,
      fetched: 0,
      inserted: 0,
      wouldInsert: 0,
      skipped: 0,
      errors: [`抓取來源頁失敗：${msg}`],
      status: 502,
    }
  }

  // ── Parse ────────────────────────────────────────────────────────────────
  let entries
  try {
    entries = parseBlackpinkTourHtml(html)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      source: 'blackpink-official-tour',
      mode,
      fetched: 0,
      inserted: 0,
      wouldInsert: 0,
      skipped: 0,
      errors: [`解析來源頁失敗：${msg}`],
      status: 500,
    }
  }

  if (entries.length === 0) {
    return {
      source: 'blackpink-official-tour',
      mode,
      fetched: 0,
      inserted: 0,
      wouldInsert: 0,
      skipped: 0,
      errors: ['沒有解析到行程（頁面結構可能已變更）'],
      status: 200,
    }
  }

  // Cap entries per run.
  const limited = entries.slice(0, MAX_ENTRIES_PER_RUN)

  // ── Lookup BLACKPINK idol UUID (best effort) ─────────────────────────────
  let blackpinkIdolId: string | null = null
  {
    const { data, error } = await supabase
      .from('idols')
      .select('id')
      .eq('slug', 'blackpink')
      .eq('is_active', true)
      .maybeSingle()
    if (error) {
      // Non-fatal: continue with null idol id, admin can fix later.
      // eslint-disable-next-line no-console
      console.warn('blackpink-tour: idol lookup failed', error)
    } else if (data?.id) {
      blackpinkIdolId = data.id as string
    }
  }

  // ── Compute payloads up front (gives us source_hash for dedup query) ─────
  const payloads = limited.map((entry) => ({
    entry,
    payload: entryToCandidatePayload(entry, blackpinkIdolId),
  }))

  // ── Dedup query: which source_hashes / source_urls already exist? ────────
  // Two simple .in() queries — easier to reason about than .or() with
  // URL escaping. The volume per run is small (≤ MAX_ENTRIES_PER_RUN).
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
      return {
        source: 'blackpink-official-tour',
        mode,
        fetched: limited.length,
        inserted: 0,
        wouldInsert: 0,
        skipped: 0,
        errors: [
          `去重查詢失敗：${err?.code ? `[${err.code}] ` : ''}${err?.message ?? '未知錯誤'}`,
        ],
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
    // Primary dedup: source_hash (matches DB partial unique index).
    if (existingHashes.has(payload.source_hash)) {
      skipped += 1
      continue
    }
    // Secondary dedup: source_url, in case a historical row predates J4 and
    // has source_url but no source_hash.
    if (existingUrls.has(entry.sourceUrl)) {
      skipped += 1
      continue
    }

    // Dry-run: count as "would insert", do NOT touch the database.
    if (dryRun) {
      wouldInsert += 1
      continue
    }

    const { error } = await supabase.from('event_candidates').insert(payload)
    if (error) {
      // 23505 = unique_violation → treat as skipped, not error.
      // Race condition: another concurrent run inserted the same hash.
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

  // In insert mode, `wouldInsert` mirrors `inserted` for consistency.
  if (!dryRun) wouldInsert = inserted

  return {
    source: 'blackpink-official-tour',
    mode,
    fetched: limited.length,
    inserted,
    wouldInsert,
    skipped,
    errors,
    status: 200,
  }
}

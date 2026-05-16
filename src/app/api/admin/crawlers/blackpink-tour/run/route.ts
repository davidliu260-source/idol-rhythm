import { NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import {
  BLACKPINK_TOUR_URL,
  entryToCandidatePayload,
  parseBlackpinkTourHtml,
} from '@/lib/crawlers/blackpinkOfficialTour'

export const dynamic = 'force-dynamic'

const MAX_ENTRIES_PER_RUN = 30
const FETCH_TIMEOUT_MS = 15_000
const USER_AGENT =
  'IdolRhythm-Bot/0.1 (+https://idol-rhythm.vercel.app)'

interface CrawlerResponse {
  ok: boolean
  source: 'blackpink-official-tour'
  fetched: number
  inserted: number
  skipped: number
  errors: string[]
}

function buildResponse(
  body: CrawlerResponse,
  status: number,
): NextResponse<CrawlerResponse> {
  return NextResponse.json(body, { status })
}

/**
 * POST /api/admin/crawlers/blackpink-tour/run
 *
 * Admin-only. Fetches the BLACKPINK official tour page, parses the schedule,
 * and writes any new rows into event_candidates with review_status = 'pending'.
 *
 * Dedup: skip when source_url already exists in event_candidates.
 * Never writes events. Never publishes. Never approves.
 */
export async function POST(): Promise<NextResponse<CrawlerResponse>> {
  // ── Admin guard ──────────────────────────────────────────────────────────
  const { isAdmin } = await getCurrentAdmin()
  if (!isAdmin) {
    return buildResponse(
      {
        ok: false,
        source: 'blackpink-official-tour',
        fetched: 0,
        inserted: 0,
        skipped: 0,
        errors: ['未授權：需要管理員身份'],
      },
      401,
    )
  }

  const supabase = getSupabaseServerClient()
  if (!supabase) {
    return buildResponse(
      {
        ok: false,
        source: 'blackpink-official-tour',
        fetched: 0,
        inserted: 0,
        skipped: 0,
        errors: ['Supabase 未設定'],
      },
      500,
    )
  }

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
        return buildResponse(
          {
            ok: false,
            source: 'blackpink-official-tour',
            fetched: 0,
            inserted: 0,
            skipped: 0,
            errors: [`來源頁回應 ${res.status} ${res.statusText}`],
          },
          502,
        )
      }
      html = await res.text()
    } finally {
      clearTimeout(timeout)
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return buildResponse(
      {
        ok: false,
        source: 'blackpink-official-tour',
        fetched: 0,
        inserted: 0,
        skipped: 0,
        errors: [`抓取來源頁失敗：${msg}`],
      },
      502,
    )
  }

  // ── Parse ────────────────────────────────────────────────────────────────
  let entries
  try {
    entries = parseBlackpinkTourHtml(html)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return buildResponse(
      {
        ok: false,
        source: 'blackpink-official-tour',
        fetched: 0,
        inserted: 0,
        skipped: 0,
        errors: [`解析來源頁失敗：${msg}`],
      },
      500,
    )
  }

  if (entries.length === 0) {
    return buildResponse(
      {
        ok: true,
        source: 'blackpink-official-tour',
        fetched: 0,
        inserted: 0,
        skipped: 0,
        errors: ['沒有解析到行程（頁面結構可能已變更）'],
      },
      200,
    )
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
      // Surface as a soft error in the response.
      // (Caller can decide whether to retry.)
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
      return buildResponse(
        {
          ok: false,
          source: 'blackpink-official-tour',
          fetched: limited.length,
          inserted: 0,
          skipped: 0,
          errors: [
            `去重查詢失敗：${err?.code ? `[${err.code}] ` : ''}${err?.message ?? '未知錯誤'}`,
          ],
        },
        500,
      )
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

  return buildResponse(
    {
      ok: errors.length === 0,
      source: 'blackpink-official-tour',
      fetched: limited.length,
      inserted,
      skipped,
      errors,
    },
    200,
  )
}

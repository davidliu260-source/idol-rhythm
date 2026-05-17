import { NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { runBlackpinkFetcher } from '@/lib/crawlers/runBlackpinkFetcher'

export const dynamic = 'force-dynamic'

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
 * Auth: getCurrentAdmin() session cookie.
 * Logic: delegates to runBlackpinkFetcher (shared with the Vercel Cron route).
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

  const result = await runBlackpinkFetcher(supabase)

  return buildResponse(
    {
      ok: result.errors.length === 0,
      source: result.source,
      fetched: result.fetched,
      inserted: result.inserted,
      skipped: result.skipped,
      errors: result.errors,
    },
    result.status,
  )
}

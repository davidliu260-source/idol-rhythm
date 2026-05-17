import { NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { runTwiceScheduleFetcher } from '@/lib/crawlers/runTwiceScheduleFetcher'

export const dynamic = 'force-dynamic'

interface CrawlerResponse {
  ok: boolean
  source: 'twice-jyp-schedule'
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
 * POST /api/admin/crawlers/twice-schedule/run
 *
 * Admin-only. Fetches the TWICE JYP Schedule page, parses items, and
 * writes new rows into event_candidates with review_status = 'pending'.
 *
 * Auth: getCurrentAdmin() session cookie.
 * Logic: delegates to runTwiceScheduleFetcher (J6c, mirrors BLACKPINK).
 * Never writes events. Never publishes. Never approves.
 */
export async function POST(): Promise<NextResponse<CrawlerResponse>> {
  const { isAdmin } = await getCurrentAdmin()
  if (!isAdmin) {
    return buildResponse(
      {
        ok: false,
        source: 'twice-jyp-schedule',
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
        source: 'twice-jyp-schedule',
        fetched: 0,
        inserted: 0,
        skipped: 0,
        errors: ['Supabase 未設定'],
      },
      500,
    )
  }

  const result = await runTwiceScheduleFetcher(supabase)

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

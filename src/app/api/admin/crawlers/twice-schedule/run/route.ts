import { NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { runJypScheduleFetcher } from '@/lib/crawlers/runJypScheduleFetcher'

export const dynamic = 'force-dynamic'

/**
 * Legacy compatibility route from J6c.
 *
 * The new generic route is /api/admin/crawlers/jyp-schedule/run (J6d).
 * This shim forwards to the generic fetcher with the hard-coded TWICE
 * source_key so any already-deployed UI keeps working until callers
 * migrate to the generic route.
 *
 * New JYP artists must NOT use this route; add them via the generic one.
 */

interface CrawlerResponse {
  ok: boolean
  source: 'twice-jyp-schedule'
  fetched: number
  inserted: number
  skipped: number
  recheck: number
  errors: string[]
}

const TWICE_SOURCE_KEY = 'twice-jyp-schedule'

function buildResponse(
  body: CrawlerResponse,
  status: number,
): NextResponse<CrawlerResponse> {
  return NextResponse.json(body, { status })
}

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
        recheck: 0,
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
        recheck: 0,
        errors: ['Supabase 未設定'],
      },
      500,
    )
  }

  const result = await runJypScheduleFetcher(supabase, {
    sourceKey: TWICE_SOURCE_KEY,
  })

  return buildResponse(
    {
      ok: result.errors.length === 0,
      source: 'twice-jyp-schedule',
      fetched: result.fetched,
      inserted: result.inserted,
      skipped: result.skipped,
      recheck: result.recheck,
      errors: result.errors,
    },
    result.status,
  )
}

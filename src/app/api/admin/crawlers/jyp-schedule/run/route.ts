import { NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { runJypScheduleFetcher } from '@/lib/crawlers/runJypScheduleFetcher'

export const dynamic = 'force-dynamic'

interface CrawlerResponse {
  ok: boolean
  source: 'jyp-schedule'
  sourceKey: string | null
  fetched: number
  inserted: number
  skipped: number
  recheck: number
  errors: string[]
}

function buildResponse(
  body: CrawlerResponse,
  status: number,
): NextResponse<CrawlerResponse> {
  return NextResponse.json(body, { status })
}

/**
 * POST /api/admin/crawlers/jyp-schedule/run
 *
 * Admin-only generic JYP schedule runner. Picks which JYP source to run by
 * `sourceKey` in the request body (e.g. 'twice-jyp-schedule'). Future JYP
 * artists (Stray Kids, ITZY, …) reuse this same route — only a new
 * crawler_sources row is required, no new code.
 *
 * Body: { sourceKey: string }
 *
 * Never writes events. Never publishes. Never approves.
 */
export async function POST(
  request: Request,
): Promise<NextResponse<CrawlerResponse>> {
  const { isAdmin } = await getCurrentAdmin()
  if (!isAdmin) {
    return buildResponse(
      {
        ok: false,
        source: 'jyp-schedule',
        sourceKey: null,
        fetched: 0,
        inserted: 0,
        skipped: 0,
        recheck: 0,
        errors: ['未授權：需要管理員身份'],
      },
      401,
    )
  }

  let sourceKey: string | null = null
  try {
    const body = (await request.json()) as { sourceKey?: unknown }
    if (typeof body.sourceKey === 'string' && body.sourceKey.length > 0) {
      sourceKey = body.sourceKey
    }
  } catch {
    // empty / non-JSON body — handled below.
  }

  if (!sourceKey) {
    return buildResponse(
      {
        ok: false,
        source: 'jyp-schedule',
        sourceKey: null,
        fetched: 0,
        inserted: 0,
        skipped: 0,
        recheck: 0,
        errors: ['請在 body 提供 sourceKey'],
      },
      400,
    )
  }

  const supabase = getSupabaseServerClient()
  if (!supabase) {
    return buildResponse(
      {
        ok: false,
        source: 'jyp-schedule',
        sourceKey,
        fetched: 0,
        inserted: 0,
        skipped: 0,
        recheck: 0,
        errors: ['Supabase 未設定'],
      },
      500,
    )
  }

  const result = await runJypScheduleFetcher(supabase, { sourceKey })

  return buildResponse(
    {
      ok: result.errors.length === 0,
      source: result.source,
      sourceKey: result.sourceKey,
      fetched: result.fetched,
      inserted: result.inserted,
      skipped: result.skipped,
      recheck: result.recheck,
      errors: result.errors,
    },
    result.status,
  )
}

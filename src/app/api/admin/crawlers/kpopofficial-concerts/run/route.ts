import { NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { runKpopofficialConcertsFetcher } from '@/lib/crawlers/runKpopofficialConcertsFetcher'

export const dynamic = 'force-dynamic'

interface CrawlerResponse {
  ok: boolean
  source: 'kpopofficial-concerts'
  sourceKey: string | null
  fetched: number
  matched: number
  unmatched: number
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
 * POST /api/admin/crawlers/kpopofficial-concerts/run
 *
 * Admin-only manual trigger for the kpopofficial.com aggregator fetcher.
 * Body: { sourceKey: string }   (parser_type must be 'kpopofficial_concerts')
 *
 * Never writes events. Never publishes. Never approves. Cron fan-out wiring
 * comes in M1a-C — this route is the manual driver for verifying M1a-B in
 * isolation against a hand-inserted crawler_sources row.
 */
export async function POST(
  request: Request,
): Promise<NextResponse<CrawlerResponse>> {
  const { isAdmin } = await getCurrentAdmin()
  if (!isAdmin) {
    return buildResponse(
      {
        ok: false,
        source: 'kpopofficial-concerts',
        sourceKey: null,
        fetched: 0,
        matched: 0,
        unmatched: 0,
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
        source: 'kpopofficial-concerts',
        sourceKey: null,
        fetched: 0,
        matched: 0,
        unmatched: 0,
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
        source: 'kpopofficial-concerts',
        sourceKey,
        fetched: 0,
        matched: 0,
        unmatched: 0,
        inserted: 0,
        skipped: 0,
        recheck: 0,
        errors: ['Supabase 未設定'],
      },
      500,
    )
  }

  const result = await runKpopofficialConcertsFetcher(supabase, { sourceKey })

  return buildResponse(
    {
      ok: result.errors.length === 0,
      source: result.source,
      sourceKey: result.sourceKey,
      fetched: result.fetched,
      matched: result.matched,
      unmatched: result.unmatched,
      inserted: result.inserted,
      skipped: result.skipped,
      recheck: result.recheck,
      errors: result.errors,
    },
    result.status,
  )
}

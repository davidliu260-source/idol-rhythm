import { NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { runWakeoneNoticeFetcher } from '@/lib/crawlers/runWakeoneNoticeFetcher'

export const dynamic = 'force-dynamic'

interface CrawlerResponse {
  ok: boolean
  source: 'wakeone-notice'
  sourceKey: string | null
  fetched: number
  eventFiltered: number
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
 * POST /api/admin/crawlers/wakeone-notice/run
 *
 * Admin-only manual trigger for the WAKEONE notice fetcher.
 * Body: { sourceKey: string }  (parser_type must be 'wakeone_notice')
 *
 * Valid sourceKey values (after migration 044 is executed):
 *   - zerobaseone-wakeone-notice
 *   - kep1er-wakeone-notice
 *   - izna-wakeone-notice
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
        source: 'wakeone-notice',
        sourceKey: null,
        fetched: 0,
        eventFiltered: 0,
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
    // empty / non-JSON body — handled below
  }

  if (!sourceKey) {
    return buildResponse(
      {
        ok: false,
        source: 'wakeone-notice',
        sourceKey: null,
        fetched: 0,
        eventFiltered: 0,
        matched: 0,
        unmatched: 0,
        inserted: 0,
        skipped: 0,
        recheck: 0,
        errors: ['請在 body 提供 sourceKey（例如 zerobaseone-wakeone-notice）'],
      },
      400,
    )
  }

  const supabase = getSupabaseServerClient()
  if (!supabase) {
    return buildResponse(
      {
        ok: false,
        source: 'wakeone-notice',
        sourceKey,
        fetched: 0,
        eventFiltered: 0,
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

  const result = await runWakeoneNoticeFetcher(supabase, { sourceKey })

  return buildResponse(
    {
      ok: result.errors.length === 0,
      source: result.source,
      sourceKey: result.sourceKey,
      fetched: result.fetched,
      eventFiltered: result.eventFiltered,
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

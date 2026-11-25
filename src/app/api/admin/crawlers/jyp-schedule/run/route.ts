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
 * POST /api/admin/crawlers/jyp-schedule/run — 已停用（MUST #10）。
 *
 * JYP 藝人站 robots.txt 寫明 Disallow: /api/，runJypScheduleFetcher 已不發任何
 * /api/schedules、/api/groups/ 請求，只把來源記成 error 並回 410。
 * 改用 POST /api/admin/crawlers/jyp-notice/run（parser_type = jyp_notice）。
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

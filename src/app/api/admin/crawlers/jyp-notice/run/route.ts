import { NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { runJypNoticeFetcher } from '@/lib/crawlers/runJypNoticeFetcher'

export const dynamic = 'force-dynamic'
// 每次請求至少間隔 2 秒，最多約 1 次 robots + 3 頁列表 + 10 則詳情。
export const maxDuration = 120

interface CrawlerResponse {
  ok: boolean
  source: 'jyp-notice'
  sourceKey: string | null
  fetched: number
  detailsFetched: number
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
 * POST /api/admin/crawlers/jyp-notice/run
 *
 * Admin-only manual trigger for the JYP 藝人官網公告 fetcher (MUST #10).
 * Body: { sourceKey: string }  (parser_type must be 'jyp_notice')
 *
 * 建議 sourceKey（由部署後的 M080 建立）：twice-jyp-notice、stray-kids-jyp-notice、
 * itzy-jyp-notice、nmixx-jyp-notice、day6-jyp-notice、xdinary-heroes-jyp-notice、
 * 2pm-jyp-notice、jy-park-jyp-notice。
 *
 * 只抓 /robots.txt 與 /notice HTML，不打 /api/。
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
        source: 'jyp-notice',
        sourceKey: null,
        fetched: 0,
        detailsFetched: 0,
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
        source: 'jyp-notice',
        sourceKey: null,
        fetched: 0,
        detailsFetched: 0,
        inserted: 0,
        skipped: 0,
        recheck: 0,
        errors: ['請在 body 提供 sourceKey（例如 twice-jyp-notice）'],
      },
      400,
    )
  }

  const supabase = getSupabaseServerClient()
  if (!supabase) {
    return buildResponse(
      {
        ok: false,
        source: 'jyp-notice',
        sourceKey,
        fetched: 0,
        detailsFetched: 0,
        inserted: 0,
        skipped: 0,
        recheck: 0,
        errors: ['Supabase 未設定'],
      },
      500,
    )
  }

  const result = await runJypNoticeFetcher(supabase, { sourceKey })

  return buildResponse(
    {
      ok: result.errors.length === 0,
      source: result.source,
      sourceKey: result.sourceKey,
      fetched: result.fetched,
      detailsFetched: result.detailsFetched,
      inserted: result.inserted,
      skipped: result.skipped,
      recheck: result.recheck,
      errors: result.errors,
    },
    result.status,
  )
}

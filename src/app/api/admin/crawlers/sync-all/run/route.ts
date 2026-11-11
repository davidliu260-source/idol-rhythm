import { NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'
import { getSupabaseServiceClient } from '@/lib/supabase/serviceClient'
import {
  runActiveCrawlerSources,
  type CrawlerRunSummary,
  type SourceRunResult,
} from '@/lib/crawlers/runActiveCrawlerSources'

export const dynamic = 'force-dynamic'

interface SyncAllResponse {
  ok: boolean
  trigger: 'admin-manual'
  mode: 'insert'
  summary?: CrawlerRunSummary
  results?: SourceRunResult[]
  error?: string
}

function json(
  body: SyncAllResponse,
  status: number,
): NextResponse<SyncAllResponse> {
  return NextResponse.json(body, { status })
}

/**
 * POST /api/admin/crawlers/sync-all/run
 *
 * Admin-only manual fan-out across every active crawler source. This mirrors
 * the Vercel Cron behavior but is triggered from /admin/event-candidates.
 */
export async function POST(): Promise<NextResponse<SyncAllResponse>> {
  const { isAdmin } = await getCurrentAdmin()
  if (!isAdmin) {
    return json(
      {
        ok: false,
        trigger: 'admin-manual',
        mode: 'insert',
        error: '未授權：需要管理員身份',
      },
      401,
    )
  }

  let supabase
  try {
    supabase = getSupabaseServiceClient()
  } catch (e) {
    return json(
      {
        ok: false,
        trigger: 'admin-manual',
        mode: 'insert',
        error: e instanceof Error ? e.message : String(e),
      },
      500,
    )
  }

  const { result, error } = await runActiveCrawlerSources(supabase, {
    trigger: 'admin-manual',
  })
  if (!result) {
    return json(
      {
        ok: false,
        trigger: 'admin-manual',
        mode: 'insert',
        error: error ?? '同步 active crawler sources 失敗',
      },
      500,
    )
  }

  const allFailed =
    result.results.length > 0 &&
    result.results.every((r) => r.errors.length > 0)

  return json(
    {
      ok: !allFailed,
      trigger: 'admin-manual',
      mode: 'insert',
      summary: result.summary,
      results: result.results,
      error: allFailed ? '所有來源皆失敗' : undefined,
    },
    allFailed ? 502 : 200,
  )
}


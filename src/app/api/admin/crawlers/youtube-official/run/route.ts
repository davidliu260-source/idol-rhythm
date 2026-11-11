import { NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { runYoutubeOfficialChannelFetcher } from '@/lib/crawlers/runYoutubeOfficialChannelFetcher'

export const dynamic = 'force-dynamic'

interface CrawlerResponse {
  ok: boolean
  source: 'youtube-official-channel'
  sourceKey: string | null
  fetched: number
  classifiedA: number
  classifiedB: number
  classifiedC: number
  classifiedUnknown: number
  inserted: number
  skipped: number
  recheck: number
  quotaExceeded: boolean
  errors: string[]
  warnings: string[]
}

function buildResponse(
  body: CrawlerResponse,
  status: number,
): NextResponse<CrawlerResponse> {
  return NextResponse.json(body, { status })
}

function emptyResponse(
  ok: boolean,
  sourceKey: string | null,
  errors: string[],
  warnings: string[] = [],
): CrawlerResponse {
  return {
    ok,
    source: 'youtube-official-channel',
    sourceKey,
    fetched: 0,
    classifiedA: 0,
    classifiedB: 0,
    classifiedC: 0,
    classifiedUnknown: 0,
    inserted: 0,
    skipped: 0,
    recheck: 0,
    quotaExceeded: false,
    errors,
    warnings,
  }
}

/**
 * POST /api/admin/crawlers/youtube-official/run
 *
 * Admin-only manual trigger for the YouTube Official Channel fetcher (P2-A1).
 * Body: { sourceKey: string }  (parser_type must be 'youtube_official_channel')
 *
 * Never writes events. Never publishes. Never approves.
 * Requires env: YOUTUBE_API_KEY (server-side only).
 *
 * Sample sourceKey values (after migration 048 is applied and admin fills
 * the channelId / uploadsPlaylistId placeholders):
 *   - bts-youtube-official
 *   - blackpink-youtube-official
 *   - twice-youtube-official
 */
export async function POST(
  request: Request,
): Promise<NextResponse<CrawlerResponse>> {
  const { isAdmin } = await getCurrentAdmin()
  if (!isAdmin) {
    return buildResponse(emptyResponse(false, null, ['未授權：需要管理員身份']), 401)
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
      emptyResponse(
        false,
        null,
        ['請在 body 提供 sourceKey（例如 bts-youtube-official）'],
      ),
      400,
    )
  }

  const supabase = getSupabaseServerClient()
  if (!supabase) {
    return buildResponse(
      emptyResponse(false, sourceKey, ['Supabase 未設定']),
      500,
    )
  }

  const result = await runYoutubeOfficialChannelFetcher(supabase, { sourceKey })

  return buildResponse(
    {
      ok: result.errors.length === 0,
      source: result.source,
      sourceKey: result.sourceKey,
      fetched: result.fetched,
      classifiedA: result.classifiedA,
      classifiedB: result.classifiedB,
      classifiedC: result.classifiedC,
      classifiedUnknown: result.classifiedUnknown,
      inserted: result.inserted,
      skipped: result.skipped,
      recheck: result.recheck,
      quotaExceeded: result.quotaExceeded,
      errors: result.errors,
      warnings: result.warnings,
    },
    result.status,
  )
}

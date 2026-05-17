import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { runBlackpinkFetcher } from '@/lib/crawlers/runBlackpinkFetcher'

export const dynamic = 'force-dynamic'

interface CronOkResponse {
  ok: true
  trigger: 'vercel-cron'
  result: {
    source: 'blackpink-official-tour'
    fetched: number
    inserted: number
    skipped: number
    errors: string[]
  }
}

interface CronErrResponse {
  ok: false
  trigger: 'vercel-cron'
  error: string
  result?: {
    source: 'blackpink-official-tour'
    fetched: number
    inserted: number
    skipped: number
    errors: string[]
  }
}

type CronResponse = CronOkResponse | CronErrResponse

/**
 * GET /api/cron/sync-candidates
 *
 * Vercel Cron entry. Triggered by the schedule in vercel.json:
 *   "0 1 * * *"  → 09:00 Asia/Taipei (UTC+8) daily.
 *
 * Hobby plan limit: cron may run at most once per day. Vercel Cron also only
 * fires on the Production deployment; Preview deployments will not run cron
 * automatically, but the route can still be invoked manually for testing.
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}` header. No admin session.
 * Vercel Cron automatically sends this header when CRON_SECRET is configured
 * as an env var on the project.
 *
 * Scope: ONLY fetch → dedup → INSERT into event_candidates (pending).
 * Does NOT call AI parse, does NOT approve, does NOT write events,
 * does NOT publish.
 */
export async function GET(
  request: NextRequest,
): Promise<NextResponse<CronResponse>> {
  // ── Secret guard ─────────────────────────────────────────────────────────
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json(
      {
        ok: false,
        trigger: 'vercel-cron',
        error: 'CRON_SECRET 未設定（請在 Vercel Project Settings 加入）',
      },
      { status: 500 },
    )
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json(
      {
        ok: false,
        trigger: 'vercel-cron',
        error: '未授權：Authorization header 無效',
      },
      { status: 401 },
    )
  }

  // ── Supabase client ──────────────────────────────────────────────────────
  const supabase = getSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json(
      {
        ok: false,
        trigger: 'vercel-cron',
        error: 'Supabase 未設定',
      },
      { status: 500 },
    )
  }

  // ── Run shared fetcher ───────────────────────────────────────────────────
  const result = await runBlackpinkFetcher(supabase)

  const payload = {
    source: result.source,
    fetched: result.fetched,
    inserted: result.inserted,
    skipped: result.skipped,
    errors: result.errors,
  }

  // Surface fetcher failure as 5xx so Vercel Cron logs flag the run as failed.
  if (result.errors.length > 0 && result.status >= 500) {
    return NextResponse.json(
      {
        ok: false,
        trigger: 'vercel-cron',
        error: result.errors[0] ?? '抓取失敗',
        result: payload,
      },
      { status: result.status },
    )
  }

  return NextResponse.json(
    {
      ok: true,
      trigger: 'vercel-cron',
      result: payload,
    },
    { status: 200 },
  )
}

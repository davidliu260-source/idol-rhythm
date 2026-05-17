import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { runBlackpinkFetcher } from '@/lib/crawlers/runBlackpinkFetcher'

export const dynamic = 'force-dynamic'

interface CronOkResponse {
  ok: true
  trigger: 'vercel-cron'
  mode: 'dry-run'
  result: {
    source: 'blackpink-official-tour'
    fetched: number
    /** How many new rows would be inserted if cron had write permission. */
    wouldInsert: number
    skipped: number
    errors: string[]
  }
}

interface CronErrResponse {
  ok: false
  trigger: 'vercel-cron'
  mode: 'dry-run'
  error: string
  result?: {
    source: 'blackpink-official-tour'
    fetched: number
    wouldInsert: number
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
 * Auth: `Authorization: Bearer ${CRON_SECRET}` header. No admin session,
 * no service_role. Vercel Cron automatically sends this header when
 * CRON_SECRET is configured as an env var on the project.
 *
 * Scope (J5 — dry-run only):
 *   - Fetch the BLACKPINK tour page
 *   - Parse + compute payloads + check dedup against event_candidates
 *   - Report `wouldInsert / skipped / errors`
 *   - Does NOT call .insert(): the cron has no admin session and would be
 *     blocked by the event_candidates INSERT RLS policy (admin_users-based).
 *     Real auto-insert is deferred to a future phase (J5b) where the auth
 *     boundary (service_role vs RPC vs security-definer function) gets its
 *     own review.
 *
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
        mode: 'dry-run',
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
        mode: 'dry-run',
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
        mode: 'dry-run',
        error: 'Supabase 未設定',
      },
      { status: 500 },
    )
  }

  // ── Run shared fetcher in DRY-RUN mode ───────────────────────────────────
  const result = await runBlackpinkFetcher(supabase, { dryRun: true })

  const payload = {
    source: result.source,
    fetched: result.fetched,
    wouldInsert: result.wouldInsert,
    skipped: result.skipped,
    errors: result.errors,
  }

  // Surface fetcher failure as 5xx so Vercel Cron logs flag the run as failed.
  if (result.errors.length > 0 && result.status >= 500) {
    return NextResponse.json(
      {
        ok: false,
        trigger: 'vercel-cron',
        mode: 'dry-run',
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
      mode: 'dry-run',
      result: payload,
    },
    { status: 200 },
  )
}

import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { getSupabaseServiceClient } from '@/lib/supabase/serviceClient'
import { runBlackpinkFetcher } from '@/lib/crawlers/runBlackpinkFetcher'

export const dynamic = 'force-dynamic'

interface CronOkResponse {
  ok: true
  trigger: 'vercel-cron'
  mode: 'insert' | 'dry-run'
  result: {
    source: 'blackpink-official-tour'
    fetched: number
    /** Rows actually inserted. 0 in dry-run mode. */
    inserted: number
    /** Rows that would be inserted if run in insert mode. */
    wouldInsert: number
    skipped: number
    errors: string[]
  }
}

interface CronErrResponse {
  ok: false
  trigger: 'vercel-cron'
  mode: 'insert' | 'dry-run'
  error: string
  result?: {
    source: 'blackpink-official-tour'
    fetched: number
    inserted: number
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
 * Auth: `Authorization: Bearer ${CRON_SECRET}` header. Vercel Cron sends
 * this header automatically when CRON_SECRET is configured on the project.
 *
 * Modes:
 *   - Default (insert): uses the service_role client to bypass the
 *     event_candidates INSERT RLS policy and write new rows with
 *     review_status = 'pending' (DB default). Service role usage is
 *     confined to this CRON_SECRET-gated route.
 *   - ?dryRun=1: uses the anon server client, fetches + dedups but does
 *     NOT call .insert(). Returns `wouldInsert` instead of `inserted`.
 *     Safe to call without affecting the DB.
 *
 * Scope (J5b):
 *   - Writes to event_candidates only.
 *   - Never writes to events. Never approves. Never publishes.
 *   - Never calls AI parse.
 */
export async function GET(
  request: NextRequest,
): Promise<NextResponse<CronResponse>> {
  // ── Decide mode from query string ────────────────────────────────────────
  const dryRun = request.nextUrl.searchParams.get('dryRun') === '1'
  const mode: 'insert' | 'dry-run' = dryRun ? 'dry-run' : 'insert'

  // ── Secret guard ─────────────────────────────────────────────────────────
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json(
      {
        ok: false,
        trigger: 'vercel-cron',
        mode,
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
        mode,
        error: '未授權：Authorization header 無效',
      },
      { status: 401 },
    )
  }

  // ── Pick Supabase client per mode ────────────────────────────────────────
  // Dry-run: anon server client (read-only). Insert: service_role client
  // (server-only, bypasses RLS). Service client construction may throw if
  // SUPABASE_SERVICE_ROLE_KEY is missing — surface that as a 500.
  let supabase
  try {
    if (dryRun) {
      const anon = getSupabaseServerClient()
      if (!anon) {
        return NextResponse.json(
          {
            ok: false,
            trigger: 'vercel-cron',
            mode,
            error: 'Supabase 未設定',
          },
          { status: 500 },
        )
      }
      supabase = anon
    } else {
      supabase = getSupabaseServiceClient()
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json(
      {
        ok: false,
        trigger: 'vercel-cron',
        mode,
        error: msg,
      },
      { status: 500 },
    )
  }

  // ── Run shared fetcher ───────────────────────────────────────────────────
  const result = await runBlackpinkFetcher(supabase, { dryRun })

  const payload = {
    source: result.source,
    fetched: result.fetched,
    inserted: result.inserted,
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
        mode,
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
      mode,
      result: payload,
    },
    { status: 200 },
  )
}

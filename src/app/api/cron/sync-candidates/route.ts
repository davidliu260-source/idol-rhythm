import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseServiceClient } from '@/lib/supabase/serviceClient'
import {
  runActiveCrawlerSources,
  type CrawlerRunSummary,
  type SourceRunResult,
} from '@/lib/crawlers/runActiveCrawlerSources'

export const dynamic = 'force-dynamic'

interface CronOkResponse {
  ok: true
  trigger: 'vercel-cron'
  mode: 'insert' | 'dry-run'
  summary: CrawlerRunSummary
  results: SourceRunResult[]
}

interface CronErrResponse {
  ok: false
  trigger: 'vercel-cron'
  mode: 'insert' | 'dry-run'
  error: string
  summary?: CrawlerRunSummary
  results?: SourceRunResult[]
}

type CronResponse = CronOkResponse | CronErrResponse

/**
 * GET /api/cron/sync-candidates
 *
 * Vercel Cron entry. Triggered by the schedule in vercel.json:
 *   "0 1 * * *"  → 09:00 Asia/Taipei (UTC+8) daily.
 *
 * J6e fan-out: instead of running a single hard-coded fetcher, this route
 * now lists every `crawler_sources.is_active = true` row and dispatches to
 * the right fetcher by `parser_type`. Each fetcher already writes back its
 * own `last_run_at / last_status / last_error`, so this loop only needs to
 * collect their results.
 *
 * Sources are executed sequentially (not in parallel) — the dataset is tiny
 * (<10 sources for the foreseeable future), serial keeps logs readable and
 * avoids hammering JYP / YG from one IP simultaneously.
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}` header. Vercel Cron sends
 * this header automatically when CRON_SECRET is configured on the project.
 *
 * Modes:
 *   - Default (insert): writes event_candidates with review_status='pending'.
 *   - ?dryRun=1: per-source fetcher skips INSERT but still updates the
 *     source's run status (it's still a real availability check).
 *
 * Scope (unchanged):
 *   - Writes to event_candidates only.
 *   - Never writes to events. Never approves. Never publishes.
 *   - Never calls AI parse.
 */
export async function GET(
  request: NextRequest,
): Promise<NextResponse<CronResponse>> {
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

  // ── Supabase service client (bypasses RLS for INSERT + dedup SELECT) ─────
  let supabase: SupabaseClient
  try {
    supabase = getSupabaseServiceClient()
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        trigger: 'vercel-cron',
        mode,
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    )
  }

  const { result, error } = await runActiveCrawlerSources(supabase, {
    dryRun,
    trigger: 'vercel-cron',
  })
  if (!result) {
    return NextResponse.json(
      {
        ok: false,
        trigger: 'vercel-cron',
        mode,
        error: error ?? '同步 active crawler sources 失敗',
      },
      { status: 500 },
    )
  }

  // Surface as 500 only if EVERY source failed; otherwise return 200 with
  // partial errors so Vercel Cron logs distinguish "down" vs "noisy day".
  const { summary, results } = result
  const allFailed =
    results.length > 0 && results.every((r) => r.errors.length > 0)
  if (allFailed) {
    return NextResponse.json(
      {
        ok: false,
        trigger: 'vercel-cron',
        mode,
        error: '所有來源皆失敗',
        summary,
        results,
      },
      { status: 502 },
    )
  }

  return NextResponse.json(
    {
      ok: true,
      trigger: 'vercel-cron',
      mode,
      summary,
      results,
    },
    { status: 200 },
  )
}

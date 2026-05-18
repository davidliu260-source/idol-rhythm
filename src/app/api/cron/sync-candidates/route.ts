import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseServiceClient } from '@/lib/supabase/serviceClient'
import { runBlackpinkFetcher } from '@/lib/crawlers/runBlackpinkFetcher'
import { runJypScheduleFetcher } from '@/lib/crawlers/runJypScheduleFetcher'
import { runKpopofficialConcertsFetcher } from '@/lib/crawlers/runKpopofficialConcertsFetcher'

export const dynamic = 'force-dynamic'

// ── Per-source result shape (uniform across parser types) ─────────────────────

interface SourceRunResult {
  /** parser_type → 'blackpink-official-tour' | 'jyp-schedule' */
  source: string
  /** crawler_sources.source_key */
  sourceKey: string | null
  /** crawler_sources.name (for human-readable logs) */
  sourceName: string | null
  /** crawler_sources.parser_type, echoed for dispatch transparency */
  parserType: string
  mode: 'insert' | 'dry-run'
  fetched: number
  inserted: number
  wouldInsert: number
  skipped: number
  /** J7d-A: rows flagged needs_recheck on this run. */
  recheck: number
  errors: string[]
  /** Internal HTTP status from the fetcher (200 = ok, 5xx = hard failure). */
  status: number
}

interface CronSummary {
  totalSources: number
  successCount: number
  errorCount: number
  totalFetched: number
  totalInserted: number
  totalWouldInsert: number
  totalSkipped: number
  totalRecheck: number
}

interface CronOkResponse {
  ok: true
  trigger: 'vercel-cron'
  mode: 'insert' | 'dry-run'
  summary: CronSummary
  results: SourceRunResult[]
}

interface CronErrResponse {
  ok: false
  trigger: 'vercel-cron'
  mode: 'insert' | 'dry-run'
  error: string
  summary?: CronSummary
  results?: SourceRunResult[]
}

type CronResponse = CronOkResponse | CronErrResponse

// ── Dispatch table: parser_type → fetcher ────────────────────────────────────

interface ActiveSourceRow {
  id: string
  source_key: string
  name: string
  parser_type: string
}

/**
 * Run a single source by its parser_type. Returns a uniform SourceRunResult
 * even when the parser_type is unknown — the cron must continue to the next
 * source rather than aborting the whole run.
 */
async function runSource(
  supabase: SupabaseClient,
  source: ActiveSourceRow,
  dryRun: boolean,
): Promise<SourceRunResult> {
  const mode: 'insert' | 'dry-run' = dryRun ? 'dry-run' : 'insert'

  switch (source.parser_type) {
    case 'blackpink_official_tour': {
      const r = await runBlackpinkFetcher(supabase, { dryRun })
      return {
        source: r.source,
        sourceKey: source.source_key,
        sourceName: r.sourceName ?? source.name,
        parserType: source.parser_type,
        mode: r.mode,
        fetched: r.fetched,
        inserted: r.inserted,
        wouldInsert: r.wouldInsert,
        skipped: r.skipped,
        recheck: r.recheck,
        errors: r.errors,
        status: r.status,
      }
    }
    case 'jyp_schedule': {
      const r = await runJypScheduleFetcher(supabase, {
        sourceKey: source.source_key,
        dryRun,
      })
      return {
        source: r.source,
        sourceKey: r.sourceKey,
        sourceName: r.sourceName ?? source.name,
        parserType: source.parser_type,
        mode: r.mode,
        fetched: r.fetched,
        inserted: r.inserted,
        wouldInsert: r.wouldInsert,
        skipped: r.skipped,
        recheck: r.recheck,
        errors: r.errors,
        status: r.status,
      }
    }
    case 'kpopofficial_concerts': {
      const r = await runKpopofficialConcertsFetcher(supabase, {
        sourceKey: source.source_key,
        dryRun,
      })
      return {
        source: r.source,
        sourceKey: r.sourceKey,
        sourceName: r.sourceName ?? source.name,
        parserType: source.parser_type,
        mode: r.mode,
        fetched: r.fetched,
        inserted: r.inserted,
        wouldInsert: r.wouldInsert,
        skipped: r.skipped,
        recheck: r.recheck,
        errors: r.errors,
        status: r.status,
      }
    }
    default:
      // Unknown parser_type: do not fail the whole cron. Surface as a soft
      // error on this single source so admin can see it in the response and
      // wire up the dispatch table when adding a new parser.
      return {
        source: 'unknown',
        sourceKey: source.source_key,
        sourceName: source.name,
        parserType: source.parser_type,
        mode,
        fetched: 0,
        inserted: 0,
        wouldInsert: 0,
        skipped: 0,
        recheck: 0,
        errors: [`未知 parser_type：${source.parser_type}（dispatch table 未註冊）`],
        status: 200,
      }
  }
}

function summarise(results: SourceRunResult[]): CronSummary {
  return {
    totalSources: results.length,
    successCount: results.filter((r) => r.errors.length === 0).length,
    errorCount: results.filter((r) => r.errors.length > 0).length,
    totalFetched: results.reduce((s, r) => s + r.fetched, 0),
    totalInserted: results.reduce((s, r) => s + r.inserted, 0),
    totalWouldInsert: results.reduce((s, r) => s + r.wouldInsert, 0),
    totalSkipped: results.reduce((s, r) => s + r.skipped, 0),
    totalRecheck: results.reduce((s, r) => s + r.recheck, 0),
  }
}

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

  // ── List active sources ──────────────────────────────────────────────────
  const { data: rows, error: listError } = await supabase
    .from('crawler_sources')
    .select('id, source_key, name, parser_type')
    .eq('is_active', true)
    .order('source_key', { ascending: true })

  if (listError) {
    return NextResponse.json(
      {
        ok: false,
        trigger: 'vercel-cron',
        mode,
        error: `讀取 crawler_sources 失敗 [${listError.code ?? '?'}] ${listError.message}`,
      },
      { status: 500 },
    )
  }

  const sources = (rows ?? []) as ActiveSourceRow[]

  // No active sources → not an error; nothing to do.
  if (sources.length === 0) {
    return NextResponse.json(
      {
        ok: true,
        trigger: 'vercel-cron',
        mode,
        summary: summarise([]),
        results: [],
      },
      { status: 200 },
    )
  }

  // ── Fan out sequentially ─────────────────────────────────────────────────
  const results: SourceRunResult[] = []
  for (const source of sources) {
    try {
      const r = await runSource(supabase, source, dryRun)
      results.push(r)
    } catch (e) {
      // Defensive: any unexpected throw inside a fetcher should not abort
      // remaining sources. Per-fetcher contracts already guarantee they
      // return cleanly, but we belt-and-brace here.
      results.push({
        source: 'unknown',
        sourceKey: source.source_key,
        sourceName: source.name,
        parserType: source.parser_type,
        mode,
        fetched: 0,
        inserted: 0,
        wouldInsert: 0,
        skipped: 0,
        recheck: 0,
        errors: [
          `fetcher 拋出例外：${e instanceof Error ? e.message : String(e)}`,
        ],
        status: 500,
      })
    }
  }

  const summary = summarise(results)

  // Surface as 500 only if EVERY source failed; otherwise return 200 with
  // partial errors so Vercel Cron logs distinguish "down" vs "noisy day".
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

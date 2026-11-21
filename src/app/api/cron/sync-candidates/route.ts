import {
  AUTO_TRANSLATE_ENABLED, emptyTranslationSummary, translateAfterAutoPublish,
  translationErrorMessage, type TranslationSummary,
} from '@/lib/ai/autoTranslate'
import { runAutoPublish, emptyAutoPublishReport, type AutoPublishRunReport } from '@/lib/autoPublish/runAutoPublish'
import { createSupabaseAutoPublishStore } from '@/lib/autoPublish/supabaseAutoPublishStore'
import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseServiceClient } from '@/lib/supabase/serviceClient'
import {
  runActiveCrawlerSources,
  type CrawlerRunSummary,
  type SourceRunResult,
} from '@/lib/crawlers/runActiveCrawlerSources'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 與 runActiveCrawlerSources 的時間守門一致

interface CronOkResponse {
  ok: true
  trigger: 'vercel-cron'
  mode: 'insert' | 'dry-run'
  autoTranslate: TranslationSummary | null
  autoPublish: AutoPublishRunReport
  summary: CrawlerRunSummary
  results: SourceRunResult[]
}

interface CronErrResponse {
  ok: false
  trigger: 'vercel-cron'
  mode: 'insert' | 'dry-run'
  error: string
  autoTranslate?: TranslationSummary | null
  autoPublish?: AutoPublishRunReport
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
 * the right fetcher by `parser_type`. Fetchers and dispatch record
 * `last_run_at / last_status / last_error` for each source.
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
 * Scope:
 *   - 開關關＝只寫候選；開＝本輪 touched 的自動上架與補空地點。
 *   - 不讀寫開關以外的設定；永不改開關。dryRun 不跑自動上架。
 *   - 已上架後才跑中文顯示翻譯。
 */
export async function GET(
  request: NextRequest,
): Promise<NextResponse<CronResponse>> {
  const startedAt = Date.now()
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
    startedAt,
    trigger: 'vercel-cron',
  })
  if (!result) {
    const message = error ?? '同步 active crawler sources 失敗'
    console.error('[crawler-cron] summary', JSON.stringify({ mode, elapsedMs: Date.now() - startedAt, error: message }))
    return NextResponse.json(
      {
        ok: false,
        trigger: 'vercel-cron',
        mode,
        error: message,
      },
      { status: 500 },
    )
  }

  let autoPublish = emptyAutoPublishReport()
  if (dryRun) {
    autoPublish.reason = 'crawler_dry_run'
  } else {
    try {
      autoPublish = await runAutoPublish(createSupabaseAutoPublishStore(supabase), { touched: result.touched, now: new Date() })
    } catch (e) {
      autoPublish.reason = 'exception'
      autoPublish.errors.push({ candidateId: '', eventId: null, step: 'exception', message: e instanceof Error ? e.message : String(e) })
    }
  }
  for (const error of autoPublish.errors) console.error('[auto-publish]', error)

  let autoTranslate: TranslationSummary | null = null
  if (!dryRun && AUTO_TRANSLATE_ENABLED && autoPublish.switch === 'on') {
    autoTranslate = emptyTranslationSummary()
    try {
      const { createSupabaseAutoTranslateStore } = await import('@/lib/ai/supabaseAutoTranslateStore')
      const { claudeTranslator } = await import('@/lib/ai/claudeTranslator')
      await translateAfterAutoPublish(
        { store: createSupabaseAutoTranslateStore(supabase), translator: claudeTranslator, clock: Date.now },
        [...autoPublish.created, ...autoPublish.publishedExisting].map(({ eventId }) => eventId),
        startedAt,
        autoTranslate,
      )
    } catch (error) {
      autoTranslate.failures.push({ eventId: '', step: 'batch', message: translationErrorMessage(error) })
    }
    const { failures, ...counts } = autoTranslate
    for (const failure of failures) console.error('[auto-translate]', failure)
    console.log('[auto-translate] summary', counts)
  }

  // Surface as 502 only if EVERY source failed; otherwise return 200 with
  // partial errors so Vercel Cron logs distinguish "down" vs "noisy day".
  const { summary, results } = result
  const log = summary.errorCount > 0 || summary.statusWriteErrorCount > 0 ? console.error : console.log
  log('[crawler-cron] summary', JSON.stringify({
    summary,
    mode,
    elapsedMs: Date.now() - startedAt,
    results: results.map(({ sourceKey, status, errors }) => ({ sourceKey, status, errors })),
  }))
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
        autoPublish,
        autoTranslate,
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
      autoPublish,
      autoTranslate,
    },
    { status: 200 },
  )
}

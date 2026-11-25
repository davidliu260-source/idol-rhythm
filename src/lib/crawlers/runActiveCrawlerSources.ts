import { STATUS_WRITE_ERROR_PREFIX, updateRunStatus, withStatusWriteTracking, type RunStatus } from './crawlerSource'
import { sweepStaleSuccessAlerts } from './crawlerSourceAlerts'
import { runVenueCalendarFetcher } from './runVenueCalendarFetcher'
import { runYgNoticeFetcher } from './runYgNoticeFetcher'
import type { TouchedCandidate } from './touchedCandidate'
import type { SupabaseClient } from '@supabase/supabase-js'
import { runBlackpinkFetcher } from './runBlackpinkFetcher'
import { runJypScheduleFetcher } from './runJypScheduleFetcher'
import { runJypNoticeFetcher } from './runJypNoticeFetcher'
import { runKpopofficialConcertsFetcher } from './runKpopofficialConcertsFetcher'
import { runYgArtistScheduleFetcher } from './runYgArtistScheduleFetcher'
import { runWakeoneNoticeFetcher } from './runWakeoneNoticeFetcher'
import { runSmtownNoticeFetcher } from './runSmtownNoticeFetcher'
import { runYoutubeOfficialChannelFetcher } from './runYoutubeOfficialChannelFetcher'

export type CrawlerRunTrigger = 'vercel-cron' | 'admin-manual'

export interface SourceRunResult {
  source: string
  sourceKey: string | null
  sourceName: string | null
  parserType: string
  mode: 'insert' | 'dry-run'
  fetched: number
  inserted: number
  wouldInsert: number
  skipped: number
  recheck: number
  errors: string[]
  status: number
}

export interface CrawlerRunSummary {
  totalSources: number
  successCount: number
  errorCount: number
  statusWriteErrorCount: number
  totalFetched: number
  totalInserted: number
  totalWouldInsert: number
  totalSkipped: number
  totalRecheck: number
}

export interface ActiveSourceRow {
  id: string
  source_key: string
  name: string
  parser_type: string
}

export interface ActiveSourcesRunResult {
  touched: TouchedCandidate[]
  summary: CrawlerRunSummary
  results: SourceRunResult[]
}

export function summariseCrawlerRuns(
  results: SourceRunResult[],
): CrawlerRunSummary {
  return {
    totalSources: results.length,
    successCount: results.filter((r) => r.errors.length === 0).length,
    errorCount: results.filter((r) => r.errors.length > 0).length,
    statusWriteErrorCount: results.filter((r) =>
      r.errors.some((error) => error.startsWith(STATUS_WRITE_ERROR_PREFIX)),
    ).length,
    totalFetched: results.reduce((s, r) => s + r.fetched, 0),
    totalInserted: results.reduce((s, r) => s + r.inserted, 0),
    totalWouldInsert: results.reduce((s, r) => s + r.wouldInsert, 0),
    totalSkipped: results.reduce((s, r) => s + r.skipped, 0),
    totalRecheck: results.reduce((s, r) => s + r.recheck, 0),
  }
}

export async function runCrawlerSource(
  supabase: SupabaseClient,
  source: ActiveSourceRow,
  dryRun: boolean,
  trigger: CrawlerRunTrigger = 'vercel-cron',
): Promise<SourceRunResult & { touched: TouchedCandidate[] }> {
  const mode: 'insert' | 'dry-run' = dryRun ? 'dry-run' : 'insert'

  switch (source.parser_type) {
    case 'blackpink_official_tour': {
      const r = await runBlackpinkFetcher(supabase, { dryRun })
      return {
        touched: r.touched,
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
      // MUST #10：robots.txt 禁止 /api/。runJypScheduleFetcher 已不發任何 HTTP 請求，
      // 只把來源記成 error（訊息見 JYP_SCHEDULE_DISABLED_MESSAGE）。改走 jyp_notice；
      // 8 關 8 開見部署後的 M080。不碰已上架活動。
      const r = await runJypScheduleFetcher(supabase, { sourceKey: source.source_key, dryRun })
      return {
        touched: [],
        source: r.source,
        sourceKey: r.sourceKey,
        sourceName: r.sourceName ?? source.name,
        parserType: source.parser_type,
        mode: r.mode,
        fetched: 0,
        inserted: 0,
        wouldInsert: 0,
        skipped: 0,
        recheck: 0,
        errors: r.errors,
        status: r.status,
      }
    }
    case 'jyp_notice': {
      const r = await runJypNoticeFetcher(supabase, {
        sourceKey: source.source_key,
        dryRun,
      })
      return {
        touched: r.touched,
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
        touched: r.touched,
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
    case 'yg_artist_schedule': {
      const r = await runYgArtistScheduleFetcher(supabase, {
        sourceKey: source.source_key,
        dryRun,
      })
      return {
        touched: r.touched,
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
    case 'wakeone_notice': {
      const r = await runWakeoneNoticeFetcher(supabase, {
        sourceKey: source.source_key,
        dryRun,
      })
      return {
        touched: r.touched,
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
    case 'smtown_notice': {
      const r = await runSmtownNoticeFetcher(supabase, {
        sourceKey: source.source_key,
        dryRun,
      })
      return {
        touched: r.touched,
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
    case 'yg_notice': {
      const result = await runYgNoticeFetcher(supabase, {
        sourceKey: source.source_key, dryRun, sourceId: source.id,
      })
      return { ...result, parserType: source.parser_type, sourceName: result.sourceName ?? source.name }
    }
    case 'venue_calendar': {
      const result = await runVenueCalendarFetcher(supabase, {
        sourceKey: source.source_key, dryRun, sourceId: source.id,
      })
      return { ...result, parserType: source.parser_type, sourceName: result.sourceName ?? source.name }
    }
    case 'generic_webpage': {
      // P1-B1 边界守门：generic_webpage 仅允许专属 admin route 手动触发
      // (POST /api/admin/crawlers/generic-webpage/run)。dispatch 路径
      // (vercel-cron / admin sync-all fan-out) 一律 skip，只写来源状态，
      // 不调用 Claude，不消耗 token。
      //
      // 这是双重防线：cron guard + sync-all guard。专属 admin route
      // 完全绕开本 dispatch，因此 P1-B1 preview 仍可手动触发。
      const message = 'generic_webpage is dispatched only via /api/admin/crawlers/generic-webpage/run; cron and sync-all fan-out are intentionally disabled in P1-B1'
      const statusError = await updateRunStatus(supabase, source.id, { last_status: 'skipped', last_error: message, fetched: 0 })
      return {
        touched: [],
        source: 'generic-webpage',
        sourceKey: source.source_key,
        sourceName: source.name,
        parserType: source.parser_type,
        mode,
        fetched: 0,
        inserted: 0,
        wouldInsert: 0,
        skipped: 0,
        recheck: 0,
        errors: statusError ? [message, statusError] : [message],
        status: 200,
      }
    }
    case 'youtube_official_channel': {
      // P2-A1 边界守门：youtube_official_channel 在本 phase 仅允许 admin
      // 手动触发（POST /api/admin/crawlers/youtube-official/run 或
      // POST /api/admin/crawlers/sync-all/run）。Vercel Cron 透过
      // /api/cron/sync-candidates fan-out 时应略过，避免在 cron 排程
      // 与配额策略（P2-A2）正式定案前意外消耗 YouTube quota。
      if (trigger === 'vercel-cron') {
        const message = 'youtube_official_channel is manual-only in P2-A1; cron is intentionally disabled until P2-A2'
        const statusError = await updateRunStatus(supabase, source.id, { last_status: 'skipped', last_error: message, fetched: 0 })
        return {
          touched: [],
          source: 'youtube-official-channel',
          sourceKey: source.source_key,
          sourceName: source.name,
          parserType: source.parser_type,
          mode,
          fetched: 0,
          inserted: 0,
          wouldInsert: 0,
          skipped: 0,
          recheck: 0,
          errors: statusError ? [message, statusError] : [message],
          status: 200,
        }
      }
      const r = await runYoutubeOfficialChannelFetcher(supabase, {
        sourceKey: source.source_key,
        dryRun,
      })
      return {
        touched: r.touched,
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
    default: {
      const message = `未知 parser_type：${source.parser_type}（dispatch table 未註冊）`
      const statusError = await updateRunStatus(supabase, source.id, { last_status: 'error', last_error: message, fetched: 0 })
      return {
        touched: [],
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
        errors: statusError ? [message, statusError] : [message],
        status: 200,
      }
    }
  }
}

export async function runActiveCrawlerSources(
  supabase: SupabaseClient,
  options: { dryRun?: boolean; trigger?: CrawlerRunTrigger; startedAt?: number } = {},
): Promise<{ result: ActiveSourcesRunResult | null; error: string | null }> {
  // 300 秒與 sync-candidates route 的 maxDuration 一致，保留 25 秒寫狀態與收尾。
  const stopStartingAt = (options.startedAt ?? Date.now()) + (300 - 25) * 1000
  const dryRun = options.dryRun === true
  // Default to 'vercel-cron' so any future caller that forgets to set
  // trigger errs on the side of cron-disabled behavior for manual-only
  // parser_types (currently youtube_official_channel).
  const trigger: CrawlerRunTrigger = options.trigger ?? 'vercel-cron'

  const { data: rows, error: listError } = await supabase
    .from('crawler_sources')
    .select('id, source_key, name, parser_type')
    .eq('is_active', true)
    .order('source_key', { ascending: true })

  if (listError) {
    return {
      result: null,
      error: `讀取 crawler_sources 失敗 [${listError.code ?? '?'}] ${listError.message}`,
    }
  }

  const sources = (rows ?? []) as ActiveSourceRow[]

  // MUST #10：一進門先補看「已超過 48 小時沒有成功」的啟用中來源（含這輪可能派不到的）。
  // 只開／更新提醒，不改任何活動；失敗（含 migration 072 尚未套用）只 log，不影響本輪結果。
  await sweepStaleSuccessAlerts(supabase).catch(() => {})
  const results: SourceRunResult[] = []
  const touched: TouchedCandidate[] = []

  async function recordUndispatched(
    source: ActiveSourceRow, runStatus: RunStatus, message: string, errors: string[],
  ) {
    const statusError = await updateRunStatus(supabase, source.id, {
      last_status: runStatus, last_error: message, fetched: 0,
    })
    if (statusError) errors.push(statusError)
    results.push({
      source: runStatus === 'skipped' ? source.parser_type : 'unknown',
      sourceKey: source.source_key,
      sourceName: source.name,
      parserType: source.parser_type,
      mode: dryRun ? 'dry-run' : 'insert',
      fetched: 0,
      inserted: 0,
      wouldInsert: 0,
      skipped: runStatus === 'skipped' ? 1 : 0,
      recheck: 0,
      errors,
      status: errors.length ? 500 : 200,
    })
  }

  for (let index = 0; index < sources.length; index += 1) {
    const source = sources[index]
    const startedAt = Date.now()
    console.log('[crawler-source] start', JSON.stringify({
      source_key: source.source_key,
      parser_type: source.parser_type,
      index: index + 1,
      total: sources.length,
    }))
    await withStatusWriteTracking(async (tracker) => {
      try {
        if (Date.now() >= stopStartingAt) {
          await recordUndispatched(source, 'skipped', '本輪剩餘時間不足，下輪再跑', [])
          return
        }
        try {
          const { touched: sourceTouched, ...result } = await runCrawlerSource(supabase, source, dryRun, trigger)
          touched.push(...sourceTouched)
          results.push(result)
        } catch (e) {
          const message = `fetcher 拋出例外：${e instanceof Error ? e.message : String(e)}`
          await recordUndispatched(source, 'error', message, [message])
        }
      } finally {
        const result = results[index]
        const log = tracker.calls === 0 ? console.error : console.log
        log('[crawler-source] end', JSON.stringify({
          source_key: source.source_key,
          statusWriteCalls: tracker.calls,
          lastStatusWriteResult: tracker.lastResult?.slice(0, 300) ?? null,
          status: result?.status ?? null,
          errorCount: result?.errors.length ?? null,
          elapsedMs: Date.now() - startedAt,
        }))
      }
    })
  }

  return {
    result: {
      touched,
      summary: summariseCrawlerRuns(results),
      results,
    },
    error: null,
  }
}

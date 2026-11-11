import type { SupabaseClient } from '@supabase/supabase-js'
import { runBlackpinkFetcher } from './runBlackpinkFetcher'
import { runJypScheduleFetcher } from './runJypScheduleFetcher'
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
    case 'yg_artist_schedule': {
      const r = await runYgArtistScheduleFetcher(supabase, {
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
    case 'wakeone_notice': {
      const r = await runWakeoneNoticeFetcher(supabase, {
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
    case 'smtown_notice': {
      const r = await runSmtownNoticeFetcher(supabase, {
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
    case 'generic_webpage': {
      // P1-B1 边界守门：generic_webpage 仅允许专属 admin route 手动触发
      // (POST /api/admin/crawlers/generic-webpage/run)。dispatch 路径
      // (vercel-cron / admin sync-all fan-out) 一律 skip — 不写 DB，
      // 不调用 Claude，不消耗 token。
      //
      // 这是双重防线：cron guard + sync-all guard。专属 admin route
      // 完全绕开本 dispatch，因此 P1-B1 preview 仍可手动触发。
      return {
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
        errors: [
          'generic_webpage is dispatched only via /api/admin/crawlers/generic-webpage/run; cron and sync-all fan-out are intentionally disabled in P1-B1',
        ],
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
        return {
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
          errors: [
            'youtube_official_channel is manual-only in P2-A1; cron is intentionally disabled until P2-A2',
          ],
          status: 200,
        }
      }
      const r = await runYoutubeOfficialChannelFetcher(supabase, {
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
        errors: [
          `未知 parser_type：${source.parser_type}（dispatch table 未註冊）`,
        ],
        status: 200,
      }
  }
}

export async function runActiveCrawlerSources(
  supabase: SupabaseClient,
  options: { dryRun?: boolean; trigger?: CrawlerRunTrigger } = {},
): Promise<{ result: ActiveSourcesRunResult | null; error: string | null }> {
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
  const results: SourceRunResult[] = []

  for (const source of sources) {
    try {
      results.push(await runCrawlerSource(supabase, source, dryRun, trigger))
    } catch (e) {
      results.push({
        source: 'unknown',
        sourceKey: source.source_key,
        sourceName: source.name,
        parserType: source.parser_type,
        mode: dryRun ? 'dry-run' : 'insert',
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

  return {
    result: {
      summary: summariseCrawlerRuns(results),
      results,
    },
    error: null,
  }
}

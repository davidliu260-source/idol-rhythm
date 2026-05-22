import type { SupabaseClient } from '@supabase/supabase-js'
import { runBlackpinkFetcher } from './runBlackpinkFetcher'
import { runJypScheduleFetcher } from './runJypScheduleFetcher'
import { runKpopofficialConcertsFetcher } from './runKpopofficialConcertsFetcher'
import { runYgArtistScheduleFetcher } from './runYgArtistScheduleFetcher'
import { runWakeoneNoticeFetcher } from './runWakeoneNoticeFetcher'
import { runSmtownNoticeFetcher } from './runSmtownNoticeFetcher'

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
        errors: [`未知 parser_type：${source.parser_type}（dispatch table 未註冊）`],
        status: 200,
      }
  }
}

export async function runActiveCrawlerSources(
  supabase: SupabaseClient,
  options: { dryRun?: boolean } = {},
): Promise<{ result: ActiveSourcesRunResult | null; error: string | null }> {
  const dryRun = options.dryRun === true

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
      results.push(await runCrawlerSource(supabase, source, dryRun))
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

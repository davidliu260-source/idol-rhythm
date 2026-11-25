import type { TouchedCandidate } from './touchedCandidate'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getCrawlerSourceByKey, updateRunStatus } from './crawlerSource'

/**
 * JYP Schedule（parser_type = 'jyp_schedule'）— 已停用，MUST #10。
 *
 * 舊版會打 `{藝人站}/api/schedules?groupId=…` 與備用 `/api/groups/{slug}`，
 * 但各藝人站 robots.txt 明文 `Disallow: /api/`。依 Dave 2026-11-24 定案改走
 * 允許的公告頁 /notice（parser_type = 'jyp_notice'，見 runJypNoticeFetcher.ts），
 * 需求單：/workspace/meetings/idol/需求單_JYP改用公告頁_2026-11-24.md。
 *
 * 即使有人把舊的 8 筆 *-jyp-schedule 來源重新設成 is_active = true，
 * 或呼叫 POST /api/admin/crawlers/jyp-schedule/run、twice-schedule/run，
 * 這裡也**不發出任何 HTTP 請求**，只記錯誤並回傳。不碰 events（不下架、不刪）。
 * 8 關 8 開由部署後的 M080 貼上單處理。
 */

export const JYP_SCHEDULE_DISABLED_MESSAGE =
  'jyp_schedule 已停用：JYP 藝人站 robots.txt 寫明 Disallow: /api/，不再抓 /api/schedules 或 /api/groups/；' +
  '已改走 /notice（parser_type = jyp_notice），見需求單_JYP改用公告頁_2026-11-24.md'

export interface FetcherOptions {
  /** crawler_sources.source_key — required. */
  sourceKey: string
  /** 保留舊介面；已不影響行為。 */
  dryRun?: boolean
}

export interface FetcherResult {
  touched: TouchedCandidate[]
  source: 'jyp-schedule'
  sourceKey: string
  mode: 'insert' | 'dry-run'
  fetched: number
  inserted: number
  wouldInsert: number
  skipped: number
  recheck: number
  errors: string[]
  crawlerSourceId: string | null
  sourceName: string | null
  status: number
}

export async function runJypScheduleFetcher(
  supabase: SupabaseClient,
  options: FetcherOptions,
): Promise<FetcherResult> {
  const { source } = await getCrawlerSourceByKey(supabase, options.sourceKey)
  const errors = [JYP_SCHEDULE_DISABLED_MESSAGE]
  if (source) {
    const statusError = await updateRunStatus(supabase, source.id, {
      last_status: 'error',
      last_error: JYP_SCHEDULE_DISABLED_MESSAGE,
    })
    if (statusError) errors.push(statusError)
  }
  return {
    touched: [],
    source: 'jyp-schedule',
    sourceKey: options.sourceKey,
    mode: options.dryRun === true ? 'dry-run' : 'insert',
    fetched: 0,
    inserted: 0,
    wouldInsert: 0,
    skipped: 0,
    recheck: 0,
    errors,
    crawlerSourceId: source?.id ?? null,
    sourceName: source?.name ?? null,
    status: 410,
  }
}

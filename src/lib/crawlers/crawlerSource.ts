/**
 * Shared helpers for crawler_sources row resolution and run-status write-back.
 *
 * Extracted in J6c so multiple fetchers (BLACKPINK, TWICE, …) can share the
 * same source lookup + status update behavior without copy-paste drift.
 *
 * Intentionally narrow surface — anything more (multi-source loop,
 * scheduling, retry, queue) is out of scope.
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import type { SupabaseClient } from '@supabase/supabase-js'
import { recordCrawlerRunHealth } from './crawlerSourceAlerts'

export const LAST_ERROR_MAX_LEN = 2000
export const STATUS_WRITE_ERROR_PREFIX = 'crawler_sources 狀態寫入失敗'

export type SourceTypeEnum =
  | 'official_sns'
  | 'official_website'
  | 'media_outlet'
  | 'fan_account'
  | 'community'
  | 'unknown'

export type RunStatus = 'success' | 'partial_error' | 'error' | 'skipped'

const STATUS_COLUMNS = 'id, last_run_at, last_status, last_error, updated_at'

function stringifyStatusDiagnostic(value: unknown): string {
  return JSON.stringify(value, (_key, entry) => {
    if (!entry || typeof entry !== 'object' || !('last_error' in entry)) return entry
    const { last_error, ...fields } = entry
    return {
      ...fields,
      last_error_head: typeof last_error === 'string' ? last_error.slice(0, 200) : null,
      last_error_length: typeof last_error === 'string' ? last_error.length : 0,
    }
  })
}

interface StatusWriteTracker {
  calls: number
  lastResult: string | null
}

const statusWriteTracker = new AsyncLocalStorage<StatusWriteTracker>()

export function withStatusWriteTracking<T>(run: (tracker: StatusWriteTracker) => Promise<T>): Promise<T> {
  const tracker = { calls: 0, lastResult: null }
  return statusWriteTracker.run(tracker, run, tracker)
}

export interface CrawlerSourceRow {
  id: string
  name: string
  source_key: string
  idol_id: string | null
  source_url: string
  source_type: SourceTypeEnum
  parser_type: string
  is_active: boolean
  /**
   * Per-source parser parameters. Migration 022 introduces this column
   * with default '{}'::jsonb; older rows may have empty object.
   * Shape is parser-specific (e.g. jyp_schedule: { groupId, artistSlug }).
   */
  config: Record<string, unknown>
}

/**
 * Reads the crawler_sources row by source_key.
 * Returns null + a human-readable error if not found or query failed.
 */
export async function getCrawlerSourceByKey(
  supabase: SupabaseClient,
  key: string,
): Promise<
  | { source: CrawlerSourceRow; error: null; configType: string }
  | { source: null; error: string; configType?: never }
> {
  const { data, error } = await supabase
    .from('crawler_sources')
    .select(
      'id, name, source_key, idol_id, source_url, source_type, parser_type, is_active, config',
    )
    .eq('source_key', key)
    .maybeSingle()

  if (error) {
    return {
      source: null,
      error: `讀取 crawler_sources 失敗 [${error.code ?? '?'}] ${error.message}`,
    }
  }
  if (!data) {
    return { source: null, error: `找不到 crawler_sources：${key}` }
  }
  // Normalise: pre-migration-022 rows may not have config column; null → {}.
  const row = data as Omit<CrawlerSourceRow, 'config'> & {
    config: Record<string, unknown> | null
  }
  return {
    source: { ...row, config: row.config ?? {} },
    error: null,
    configType: row.config == null ? 'null' : Array.isArray(row.config) ? 'array' : typeof row.config,
  }
}

/**
 * Updates crawler_sources status columns and returns a diagnostic on failure.
 *
 * The migration 020 column-level GRANT confines this to
 * (last_run_at, last_status, last_error, updated_at) so RLS / GRANT
 * collisions on content fields cannot happen.
 *
 * MUST #10：`fetched`（本輪抓到幾筆）不會進這一次 update。狀態寫入成功後，
 * 另外「盡力」呼叫 recordCrawlerRunHealth 更新 migration 072 的健康欄並開單／結案；
 * 那一步失敗（含 072 尚未套用）只 log，不影響這裡的回傳值。
 */
export async function updateRunStatus(
  supabase: SupabaseClient,
  crawlerSourceId: string,
  patch: { last_status: RunStatus; last_error: string | null; fetched?: number },
): Promise<string | null> {
  const tracker = statusWriteTracker.getStore()
  if (tracker) tracker.calls += 1

  const now = new Date().toISOString()
  const expected = {
    last_run_at: now,
    last_status: patch.last_status,
    last_error: patch.last_error?.slice(0, LAST_ERROR_MAX_LEN) ?? null,
  }
  let returned: unknown = null
  let readBack: unknown = null
  let result: string | null = null

  try {
    const { data, error } = await supabase
      .from('crawler_sources')
      .update({ ...expected, updated_at: now })
      .eq('id', crawlerSourceId)
      .select(STATUS_COLUMNS)

    returned = data
    if (error) throw error
    if (data?.length !== 1) throw new Error(`預期更新 1 列，實際更新 ${data?.length ?? 0} 列`)

    const { data: row, error: readError } = await supabase
      .from('crawler_sources')
      .select(STATUS_COLUMNS)
      .eq('id', crawlerSourceId)
      .maybeSingle()

    readBack = row
    if (readError) throw readError
    if (!row) throw new Error('讀不到寫入後的狀態')
    for (const [step, actual] of [['RETURNING', data[0]], ['讀回', row]] as const) {
      if (
        actual.last_status !== expected.last_status ||
        Date.parse(actual.last_run_at) !== Date.parse(expected.last_run_at) ||
        actual.last_error !== expected.last_error
      ) {
        throw new Error(`${step}狀態不一致`)
      }
    }

    console.log('[crawler-status] write ok', JSON.stringify({
      id: crawlerSourceId, last_status: row.last_status, last_run_at: row.last_run_at,
    }))
    await recordCrawlerRunHealth(supabase, crawlerSourceId, {
      status: patch.last_status, fetched: patch.fetched, ranAt: now,
    }).catch(() => {})
    return null
  } catch (error) {
    const detail = error && typeof error === 'object' && 'message' in error
      ? String(error.message)
      : String(error)
    result = `${STATUS_WRITE_ERROR_PREFIX}（crawlerSourceId=${crawlerSourceId}）：${detail}；預期=${stringifyStatusDiagnostic(expected)}；RETURNING=${stringifyStatusDiagnostic(returned)}；實際讀回=${stringifyStatusDiagnostic(readBack)}`
    console.error(result, error)
    return result
  } finally {
    if (tracker) tracker.lastResult = result ?? 'ok'
  }
}

/**
 * Shared helpers for crawler_sources row resolution and run-status write-back.
 *
 * Extracted in J6c so multiple fetchers (BLACKPINK, TWICE, …) can share the
 * same source lookup + status update behavior without copy-paste drift.
 *
 * Intentionally narrow surface — anything more (multi-source loop,
 * scheduling, retry, queue) is out of scope.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

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
 */
export async function updateRunStatus(
  supabase: SupabaseClient,
  crawlerSourceId: string,
  patch: { last_status: RunStatus; last_error: string | null },
): Promise<string | null> {
  const now = new Date().toISOString()
  const trimmed =
    patch.last_error && patch.last_error.length > LAST_ERROR_MAX_LEN
      ? patch.last_error.slice(0, LAST_ERROR_MAX_LEN)
      : patch.last_error

  try {
    const { count, error } = await supabase
      .from('crawler_sources')
      .update({
        last_run_at: now,
        last_status: patch.last_status,
        last_error: trimmed,
        updated_at: now,
      }, { count: 'exact' })
      .eq('id', crawlerSourceId)

    if (error) throw error
    if (count !== 1) throw new Error(`預期更新 1 列，實際更新 ${count ?? '未知'} 列`)
    return null
  } catch (error) {
    const detail = error && typeof error === 'object' && 'message' in error
      ? String(error.message)
      : String(error)
    const message = `${STATUS_WRITE_ERROR_PREFIX}（crawlerSourceId=${crawlerSourceId}）：${detail}`
    console.error(message, error)
    return message
  }
}

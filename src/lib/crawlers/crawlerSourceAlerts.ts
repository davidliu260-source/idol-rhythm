/**
 * MUST #10 爬蟲故障提醒：來源健康計數、開單／結案，以及後台顯示用的計算。
 *
 * 規則集中在這一支，不要複製進各 fetcher。
 *
 * 硬性邊界：
 *   - 只碰 crawler_sources 的 4 個健康欄（migration 072）與 crawler_source_alerts。
 *   - 來源故障、0 筆、被停用，都「不會」更動任何活動；本檔沒有任何寫活動資料表的路徑。
 *   - 不寫粉絲通知表、不寄信、不接外部頻道。
 *   - 所有對外 async 函式都不丟例外：072 尚未套用、權限不足、網路錯誤一律只 log。
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { RunStatus } from './crawlerSource'

// ── 門檻（寫死的程式常數；要改請另開小單）────────────────────────────────────

export const ERROR_STREAK_THRESHOLD = 3
export const STALE_SUCCESS_MS = 48 * 60 * 60 * 1000
export const ZERO_FETCH_STREAK_THRESHOLD = 3

export const KPOPOFFICIAL_SOURCE_KEY = 'kpopofficial-concerts'
export const KPOPOFFICIAL_PARSER_TYPE = 'kpopofficial_concerts'
export const KPOPOFFICIAL_LABEL = 'KpopOfficial 主力來源'

/**
 * 排程本來就會略過、只能手動觸發的 parser（見 runActiveCrawlerSources 的 dispatch）：
 * 每日排程不會讓它們「成功」，所以「多久沒成功」不適用，不算故障。
 */
const MANUAL_ONLY_PARSER_TYPES = new Set(['generic_webpage', 'youtube_official_channel'])

export type AlertKind = 'error_streak' | 'stale_success' | 'zero_fetch'
export type AlertSeverity = 'fault' | 'warning'
export type AlertStatus = 'open' | 'acknowledged' | 'resolved'

export const ALERT_KINDS: AlertKind[] = ['error_streak', 'stale_success', 'zero_fetch']
export const UNRESOLVED_ALERT_STATUSES: AlertStatus[] = ['open', 'acknowledged']

export const ALERT_KIND_LABELS: Record<AlertKind, string> = {
  error_streak: '連續失敗',
  stale_success: '長時間沒有成功',
  zero_fetch: '成功但抓到 0 筆',
}

export const ALERT_SEVERITY_LABELS: Record<AlertSeverity, string> = {
  fault: '故障',
  warning: '警告',
}

const ALERTS_TABLE = 'crawler_source_alerts'
const LOG_PREFIX = '[crawler-alerts]'

export const SOURCE_HEALTH_COLUMNS =
  'id, name, source_key, parser_type, is_active, last_run_at, last_status, last_success_at, last_fetched_count, consecutive_error_count, consecutive_zero_fetch_count'

const ALERT_COLUMNS =
  'id, source_id, kind, severity, status, opened_at, last_triggered_at, acknowledged_at, resolved_at, detail'

export interface SourceHealthRow {
  id: string
  name: string
  source_key: string
  parser_type: string
  is_active: boolean
  last_run_at: string | null
  last_status: string | null
  last_success_at: string | null
  last_fetched_count: number | null
  consecutive_error_count: number
  consecutive_zero_fetch_count: number
}

export interface CrawlerSourceAlertRow {
  id: number
  source_id: string
  kind: AlertKind
  severity: AlertSeverity
  status: AlertStatus
  opened_at: string
  last_triggered_at: string
  acknowledged_at: string | null
  resolved_at: string | null
  detail: string | null
}

export interface ComputedAlert {
  kind: AlertKind
  severity: AlertSeverity
  detail: string
}

// ── 純函式 ──────────────────────────────────────────────────────────────────

export function isKpopOfficialSource(
  source: { source_key?: string | null; parser_type?: string | null },
): boolean {
  return source.source_key === KPOPOFFICIAL_SOURCE_KEY || source.parser_type === KPOPOFFICIAL_PARSER_TYPE
}

/** PostgREST／Postgres 表示「072 的欄位或資料表還不存在」的錯誤。 */
export function isMissingHealthSchemaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const { code, message } = error as { code?: unknown; message?: unknown }
  if (typeof code === 'string' && ['42703', '42P01', 'PGRST204', 'PGRST205'].includes(code)) return true
  return typeof message === 'string' &&
    /(?:column|relation) .* does not exist|could not find (?:the )?(?:table|relation|'?[\w.]+'? column)/i.test(message)
}

const taipeiFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Taipei',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
})

/** 以台北時間顯示 `YYYY-MM-DD HH:mm`。 */
export function formatTaipeiDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? taipeiFormatter.format(new Date(ms)) : iso
}

function hasHealthColumns(row: Partial<SourceHealthRow> | null | undefined): row is SourceHealthRow {
  return !!row && typeof row.consecutive_error_count === 'number' && typeof row.consecutive_zero_fetch_count === 'number'
}

function normaliseFetched(fetched: unknown): number | undefined {
  return typeof fetched === 'number' && Number.isFinite(fetched) && fetched >= 0 ? Math.floor(fetched) : undefined
}

export interface HealthTransition {
  /** 要寫回 crawler_sources 的健康欄（只會是 072 的 4 欄）。 */
  patch: Partial<Pick<SourceHealthRow,
    'last_success_at' | 'last_fetched_count' | 'consecutive_error_count' | 'consecutive_zero_fetch_count'>>
  /** 本輪要自動結案的提醒種類。 */
  resolveKinds: AlertKind[]
  /** 本輪可能觸發（達門檻才開單）的提醒種類。 */
  triggerKinds: AlertKind[]
}

/**
 * 一輪執行結束後的狀態轉換。回傳 null 表示這一輪什麼都不動
 * （skipped、或來源已停用：不發新提醒、不清既有紀錄、不改連續計數）。
 */
export function nextHealthState(
  row: SourceHealthRow,
  run: { status: RunStatus; fetched?: number; ranAt: string },
): HealthTransition | null {
  if (run.status === 'skipped' || !row.is_active) return null
  const fetched = normaliseFetched(run.fetched)

  if (run.status === 'error' || run.status === 'partial_error') {
    return {
      patch: {
        consecutive_error_count: row.consecutive_error_count + 1,
        ...(fetched === undefined ? {} : { last_fetched_count: fetched }),
      },
      resolveKinds: [],
      triggerKinds: ['error_streak', 'stale_success'],
    }
  }

  if (fetched === 0) {
    return {
      patch: {
        last_success_at: run.ranAt,
        last_fetched_count: 0,
        consecutive_error_count: 0,
        consecutive_zero_fetch_count: row.consecutive_zero_fetch_count + 1,
      },
      resolveKinds: ['error_streak', 'stale_success'],
      triggerKinds: ['zero_fetch'],
    }
  }

  if (fetched === undefined) {
    // 呼叫端沒給筆數：來源有通，但無法判斷是不是 0 筆，所以不動 0 筆計數。
    return {
      patch: { last_success_at: run.ranAt, consecutive_error_count: 0 },
      resolveKinds: ['error_streak', 'stale_success'],
      triggerKinds: [],
    }
  }

  return {
    patch: {
      last_success_at: run.ranAt,
      last_fetched_count: fetched,
      consecutive_error_count: 0,
      consecutive_zero_fetch_count: 0,
    },
    resolveKinds: ['error_streak', 'stale_success', 'zero_fetch'],
    triggerKinds: [],
  }
}

/**
 * 「多久沒成功」的起算點（毫秒）。
 * 有成功過 → 上次成功時間。沒成功過 → 只有在 072 欄位已被寫過
 *（本功能上線後至少真正執行過一次）時，才從 last_run_at 起算；
 * 上線前的空白一律不算故障。
 */
function staleAnchorMs(row: SourceHealthRow): number | null {
  const anchor = row.last_success_at ??
    (row.last_fetched_count != null || row.consecutive_error_count > 0 ? row.last_run_at : null)
  if (!anchor) return null
  const ms = Date.parse(anchor)
  return Number.isFinite(ms) ? ms : null
}

/**
 * 依來源列目前的計數，算出「此刻應該存在」的故障／警告。
 * 後台讀頁、cron 補看、每輪跑完都共用這一份，避免規則分岔。
 */
export function computeSourceAlerts(
  row: Partial<SourceHealthRow> | null | undefined,
  nowMs: number = Date.now(),
): ComputedAlert[] {
  if (!hasHealthColumns(row) || !row.is_active) return []
  const kpop = isKpopOfficialSource(row)
  const prefix = kpop ? `【${KPOPOFFICIAL_LABEL}】` : ''
  const alerts: ComputedAlert[] = []

  if (row.consecutive_error_count >= ERROR_STREAK_THRESHOLD) {
    alerts.push({
      kind: 'error_streak',
      severity: 'fault',
      detail: `${prefix}已連續 ${row.consecutive_error_count} 次執行失敗（門檻 ${ERROR_STREAK_THRESHOLD} 次）。既有活動維持原狀，請檢查來源。`,
    })
  }

  const anchor = staleAnchorMs(row)
  if (
    anchor !== null &&
    !MANUAL_ONLY_PARSER_TYPES.has(row.parser_type) &&
    nowMs - anchor >= STALE_SUCCESS_MS
  ) {
    const hours = Math.floor((nowMs - anchor) / 3_600_000)
    const since = row.last_success_at
      ? `上次成功：${formatTaipeiDateTime(row.last_success_at)}（台北時間）`
      : `尚未成功過，上次執行：${formatTaipeiDateTime(row.last_run_at)}（台北時間）`
    alerts.push({
      kind: 'stale_success',
      severity: 'fault',
      detail: `${prefix}已 ${hours} 小時沒有成功（門檻 ${STALE_SUCCESS_MS / 3_600_000} 小時）。${since}。既有活動維持原狀，請確認排程與來源。`,
    })
  }

  if (row.consecutive_zero_fetch_count >= ZERO_FETCH_STREAK_THRESHOLD) {
    alerts.push({
      kind: 'zero_fetch',
      severity: kpop ? 'fault' : 'warning',
      detail: `${prefix}已連續 ${row.consecutive_zero_fetch_count} 次執行成功但抓到 0 筆（門檻 ${ZERO_FETCH_STREAK_THRESHOLD} 次）。既有活動維持原狀，請確認來源頁面是否改版。`,
    })
  }

  return alerts
}

// ── 後台顯示：未解決提醒 + 由計數算出的提醒，合併去重 ─────────────────────────

export interface AlertView {
  /** React key／去重鍵：`${sourceId}:${kind}` */
  key: string
  /** crawler_source_alerts.id；null 表示只由計數算出、資料表尚未開單。 */
  id: number | null
  sourceId: string
  sourceName: string
  sourceKey: string
  isKpopOfficial: boolean
  kind: AlertKind
  severity: AlertSeverity
  status: 'open' | 'acknowledged'
  detail: string
  lastTriggeredAt: string | null
}

/**
 * 合併「資料表裡未解決的提醒」與「由來源計數算出的提醒」。
 * 同一來源同一種類只留一筆（資料表列優先，才能按已看過／已解決）。
 * 排序：尚未看過 → 故障 → KpopOfficial → 最近觸發。
 */
export function buildAlertViews(
  sources: Array<Partial<SourceHealthRow> & Pick<SourceHealthRow, 'id' | 'name' | 'source_key' | 'parser_type'>>,
  alerts: CrawlerSourceAlertRow[],
  nowMs: number = Date.now(),
): AlertView[] {
  const byId = new Map(sources.map((source) => [source.id, source]))
  const views = new Map<string, AlertView>()

  for (const alert of alerts) {
    if (alert.status === 'resolved') continue
    const source = byId.get(alert.source_id)
    if (!source) continue
    const key = `${alert.source_id}:${alert.kind}`
    if (views.has(key)) continue
    views.set(key, {
      key,
      id: alert.id,
      sourceId: source.id,
      sourceName: source.name,
      sourceKey: source.source_key,
      isKpopOfficial: isKpopOfficialSource(source),
      kind: alert.kind,
      severity: alert.severity,
      status: alert.status,
      detail: alert.detail ?? ALERT_KIND_LABELS[alert.kind],
      lastTriggeredAt: alert.last_triggered_at,
    })
  }

  for (const source of sources) {
    for (const computed of computeSourceAlerts(source, nowMs)) {
      const key = `${source.id}:${computed.kind}`
      if (views.has(key)) continue
      views.set(key, {
        key,
        id: null,
        sourceId: source.id,
        sourceName: source.name,
        sourceKey: source.source_key,
        isKpopOfficial: isKpopOfficialSource(source),
        kind: computed.kind,
        severity: computed.severity,
        status: 'open',
        detail: computed.detail,
        lastTriggeredAt: null,
      })
    }
  }

  const rank = (view: AlertView) =>
    (view.status === 'open' ? 0 : 4) + (view.severity === 'fault' ? 0 : 2) + (view.isKpopOfficial ? 0 : 1)
  return [...views.values()].sort((a, b) =>
    rank(a) - rank(b) || (b.lastTriggeredAt ?? '').localeCompare(a.lastTriggeredAt ?? '') || a.key.localeCompare(b.key),
  )
}

export interface CrawlerHealthSnapshot {
  /** false = 072 尚未套用或讀取失敗；呼叫端應直接略過健康區塊。 */
  available: boolean
  sources: SourceHealthRow[]
  alerts: CrawlerSourceAlertRow[]
}

const EMPTY_SNAPSHOT: CrawlerHealthSnapshot = { available: false, sources: [], alerts: [] }

/**
 * 後台讀頁用：讀來源健康欄與未解決提醒。只 SELECT，不寫入。
 * 任何失敗（含 072 尚未套用）都回 available=false，不丟例外。
 */
export async function loadCrawlerHealth(
  supabase: SupabaseClient,
  options: { sourceId?: string } = {},
): Promise<CrawlerHealthSnapshot> {
  try {
    let sourceQuery = supabase.from('crawler_sources').select(SOURCE_HEALTH_COLUMNS)
    if (options.sourceId) sourceQuery = sourceQuery.eq('id', options.sourceId)
    const { data: sourceRows, error: sourceError } = await sourceQuery
    if (sourceError) {
      if (!isMissingHealthSchemaError(sourceError)) console.warn(`${LOG_PREFIX} 讀取來源健康欄失敗`, sourceError)
      return EMPTY_SNAPSHOT
    }
    const sources = ((sourceRows ?? []) as Partial<SourceHealthRow>[]).filter(hasHealthColumns)

    let alertQuery = supabase.from(ALERTS_TABLE).select(ALERT_COLUMNS).in('status', UNRESOLVED_ALERT_STATUSES)
    if (options.sourceId) alertQuery = alertQuery.eq('source_id', options.sourceId)
    const { data: alertRows, error: alertError } = await alertQuery
    if (alertError) {
      if (!isMissingHealthSchemaError(alertError)) console.warn(`${LOG_PREFIX} 讀取提醒失敗`, alertError)
      return EMPTY_SNAPSHOT
    }
    return { available: true, sources, alerts: (alertRows ?? []) as CrawlerSourceAlertRow[] }
  } catch (error) {
    console.warn(`${LOG_PREFIX} 讀取健康狀態時發生例外`, error)
    return EMPTY_SNAPSHOT
  }
}

// ── 寫入：開單／更新／結案（盡力而為，永不丟例外）─────────────────────────────

function describeError(error: unknown): string {
  if (error && typeof error === 'object') {
    const { code, message } = error as { code?: unknown; message?: unknown }
    return `[${typeof code === 'string' ? code : '?'}] ${typeof message === 'string' ? message : String(error)}`
  }
  return String(error)
}

function logStepFailure(step: string, sourceId: string, error: unknown): void {
  if (isMissingHealthSchemaError(error)) {
    console.warn(`${LOG_PREFIX} migration 072 尚未套用，略過「${step}」（source=${sourceId}）`)
  } else {
    console.warn(`${LOG_PREFIX} 「${step}」失敗，已略過（source=${sourceId}）：${describeError(error)}`)
  }
}

/**
 * 同一來源同一 kind 只保留一筆未解決：先找未解決的 → 有就只更新
 * last_triggered_at／detail；沒有才 INSERT。
 * 後台手動執行（登入身分）沒有 INSERT 權限，失敗只 log。
 */
async function openOrTouchAlert(
  supabase: SupabaseClient,
  sourceId: string,
  alert: ComputedAlert,
  nowIso: string,
): Promise<void> {
  const { data: existing, error: findError } = await supabase
    .from(ALERTS_TABLE)
    .select('id')
    .eq('source_id', sourceId)
    .eq('kind', alert.kind)
    .in('status', UNRESOLVED_ALERT_STATUSES)
    .limit(1)
  if (findError) return logStepFailure(`查詢未解決提醒 ${alert.kind}`, sourceId, findError)

  const open = (existing ?? [])[0] as { id: number } | undefined
  if (open) {
    const { error } = await supabase
      .from(ALERTS_TABLE)
      .update({ last_triggered_at: nowIso, detail: alert.detail })
      .eq('id', open.id)
    if (error) logStepFailure(`更新提醒 ${alert.kind}`, sourceId, error)
    return
  }

  const { error } = await supabase.from(ALERTS_TABLE).insert({
    source_id: sourceId,
    kind: alert.kind,
    severity: alert.severity,
    status: 'open',
    opened_at: nowIso,
    last_triggered_at: nowIso,
    detail: alert.detail,
  })
  // 23505：另一個執行剛好先開了同一筆，視為已開單。
  if (error && (error as { code?: string }).code !== '23505') {
    logStepFailure(`開單 ${alert.kind}`, sourceId, error)
  }
}

async function resolveAlerts(
  supabase: SupabaseClient,
  sourceId: string,
  kinds: AlertKind[],
  nowIso: string,
): Promise<void> {
  if (kinds.length === 0) return
  const { error } = await supabase
    .from(ALERTS_TABLE)
    .update({ status: 'resolved', resolved_at: nowIso })
    .eq('source_id', sourceId)
    .in('kind', kinds)
    .in('status', UNRESOLVED_ALERT_STATUSES)
  if (error) logStepFailure(`自動結案 ${kinds.join('、')}`, sourceId, error)
}

/**
 * 每次來源跑完、既有狀態欄寫入成功後呼叫。
 * 更新 072 的 4 個健康欄，並依規則開單／結案。
 * 永不丟例外；不回滾、不影響已寫入的 last_status。
 */
export async function recordCrawlerRunHealth(
  supabase: SupabaseClient,
  sourceId: string,
  run: { status: RunStatus; fetched?: number; ranAt?: string },
): Promise<void> {
  try {
    if (run.status === 'skipped') return
    const ranAt = run.ranAt ?? new Date().toISOString()

    const { data, error: readError } = await supabase
      .from('crawler_sources')
      .select(SOURCE_HEALTH_COLUMNS)
      .eq('id', sourceId)
      .maybeSingle()
    if (readError) return logStepFailure('讀取來源健康欄', sourceId, readError)
    const row = data as Partial<SourceHealthRow> | null
    if (!hasHealthColumns(row)) return

    const transition = nextHealthState(row, { status: run.status, fetched: run.fetched, ranAt })
    if (!transition) return

    const { error: writeError } = await supabase
      .from('crawler_sources')
      .update(transition.patch)
      .eq('id', sourceId)
    if (writeError) return logStepFailure('寫入來源健康欄', sourceId, writeError)

    await resolveAlerts(supabase, sourceId, transition.resolveKinds, ranAt)

    const next: SourceHealthRow = { ...row, ...transition.patch, last_status: run.status, last_run_at: ranAt }
    const nowMs = Date.parse(ranAt)
    for (const alert of computeSourceAlerts(next, Number.isFinite(nowMs) ? nowMs : Date.now())) {
      if (transition.triggerKinds.includes(alert.kind)) {
        await openOrTouchAlert(supabase, sourceId, alert, ranAt)
      }
    }
  } catch (error) {
    console.warn(`${LOG_PREFIX} 健康狀態步驟發生例外，已略過（source=${sourceId}）`, error)
  }
}

/**
 * 排程一進門先補看：啟用中、但已超過門檻沒有成功的來源
 *（排程隔很久才跑、或之後因時間不足沒被派到的來源也看得到）。
 * 隨後若該來源這一輪成功，recordCrawlerRunHealth 會自動結案。
 * 只開／更新 stale_success，不改計數、不結案、不動活動。永不丟例外。
 */
export async function sweepStaleSuccessAlerts(
  supabase: SupabaseClient,
  nowMs: number = Date.now(),
): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('crawler_sources')
      .select(SOURCE_HEALTH_COLUMNS)
      .eq('is_active', true)
    if (error) return logStepFailure('補看長時間沒有成功的來源', '*', error)
    if (!Array.isArray(data)) return
    const nowIso = new Date(nowMs).toISOString()
    for (const row of data as Partial<SourceHealthRow>[]) {
      const stale = computeSourceAlerts(row, nowMs).find((alert) => alert.kind === 'stale_success')
      if (stale && row.id) await openOrTouchAlert(supabase, row.id, stale, nowIso)
    }
  } catch (error) {
    console.warn(`${LOG_PREFIX} 補看長時間沒有成功的來源時發生例外，已略過`, error)
  }
}

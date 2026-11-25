import { touchedFromPayload, type TouchedCandidate } from './touchedCandidate'
/**
 * JYP 藝人官網公告（/notice）fetcher。MUST #10，取代 jyp_schedule 的 /api/schedules。
 *
 * 規則（需求單_JYP改用公告頁_2026-11-24.md 第 5 節）：
 *   - User-Agent 固定 IdolRhythm-Bot，Accept: text/html；不帶 cookie、不登入、不開無頭瀏覽器。
 *   - 只請求 /robots.txt、/notice、/notice?PgIndex=N、/notice/{id}?NoticeNumber=N
 *     （isAllowedJypRequestUrl 擋住其他路徑，含 /api/、/_next/）。不跟隨轉址。
 *   - 每輪先抓 robots.txt；禁止 /notice 就停止並記 error。Crawl-delay 與 2 秒取大者。
 *   - 每輪最多 3 頁列表；請求間隔至少 2 秒；詳情只看「新、像活動」的公告，每輪最多 10 則。
 *   - 403／429／5xx：記失敗並停止，不重試、不改打 /api/。
 *
 * 只寫 event_candidates，不碰 events（不上架、不下架、不刪）。
 * 列表日期是公告發布日，只存 raw_data.notice_date，不當 detected_date。
 *
 * 正式庫來源列（8 筆 *-jyp-notice，例如 twice-jyp-notice、jy-park-jyp-notice）
 * 由部署後的 M080 貼上單開通；本程式不建立來源列。
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  JYP_NOTICE_PARSER_TYPE,
  JYP_NOTICE_USER_AGENT,
  entryToCandidatePayload,
  isAllowedJypRequestUrl,
  jypNoticeListUrl,
  jypNoticePageUrl,
  looksLikeEventNotice,
  parseJypNoticeDetailHtml,
  parseJypNoticeListHtml,
  parseRobotsTxt,
  robotsAllowsNotice,
  type JypNoticeCandidatePayload,
  type JypNoticeSourceContext,
  type ParsedJypNoticeDetail,
  type ParsedJypNoticeEntry,
} from './jypNotice'
import { getCrawlerSourceByKey, type RunStatus, updateRunStatus } from './crawlerSource'

/** 每個藝人每輪最多抓幾頁列表。 */
export const MAX_PAGES = 3
/** 任兩次 HTTP 請求之間至少間隔（毫秒）。不做成環境變數。 */
export const MIN_REQUEST_INTERVAL_MS = 2_000
/** robots 的 Crawl-delay 若超過此值，本輪直接停止（避免拖垮整個 cron）。 */
export const MAX_ACCEPTED_INTERVAL_MS = 10_000
/** 每個藝人每輪最多看幾則詳情。 */
export const MAX_DETAILS_PER_RUN = 10
/** 單輪最多考慮寫入幾則候選。 */
export const MAX_ENTRIES_PER_RUN = 60
/** 單一請求逾時。 */
export const FETCH_TIMEOUT_MS = 15_000
/** 單一來源本輪花在詳情頁的時間上限；超過就不再看詳情（列表照常入庫）。 */
export const DETAIL_TIME_BUDGET_MS = 30_000

export interface JypNoticeFetcherDeps {
  /** 測試可注入假 fetch。預設 globalThis.fetch。 */
  fetch?: typeof fetch
  /** 測試可注入假 sleep，避免真的等。預設 setTimeout。 */
  sleep?: (ms: number) => Promise<void>
  /** 測試可注入時鐘。預設 Date.now。 */
  now?: () => number
}

export interface FetcherOptions {
  sourceKey: string
  dryRun?: boolean
  deps?: JypNoticeFetcherDeps
}

export interface FetcherResult {
  touched: TouchedCandidate[]
  source: 'jyp-notice'
  sourceKey: string
  mode: 'insert' | 'dry-run'
  fetched: number
  detailsFetched: number
  inserted: number
  wouldInsert: number
  skipped: number
  recheck: number
  errors: string[]
  crawlerSourceId: string | null
  sourceName: string | null
  status: number
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** 403／429／5xx：站方擋或出錯，該來源本輪停止。 */
function isStopStatus(status: number): boolean {
  return status === 401 || status === 403 || status === 429 || status >= 500
}

type HttpResult = { ok: true; text: string } | { ok: false; status: number | null; message: string }

export async function runJypNoticeFetcher(
  supabase: SupabaseClient,
  options: FetcherOptions,
): Promise<FetcherResult> {
  const dryRun = options.dryRun === true
  const mode: 'insert' | 'dry-run' = dryRun ? 'dry-run' : 'insert'
  const sourceKey = options.sourceKey
  const fetchImpl = options.deps?.fetch ?? globalThis.fetch
  const sleep = options.deps?.sleep ?? defaultSleep
  const now = options.deps?.now ?? Date.now

  const base = (extra: Partial<FetcherResult>): FetcherResult => ({
    touched: [],
    source: 'jyp-notice',
    sourceKey,
    mode,
    fetched: 0,
    detailsFetched: 0,
    inserted: 0,
    wouldInsert: 0,
    skipped: 0,
    recheck: 0,
    errors: [],
    crawlerSourceId: null,
    sourceName: null,
    status: 200,
    ...extra,
  })

  const { source, error: sourceError } = await getCrawlerSourceByKey(supabase, sourceKey)
  if (!source) return base({ errors: [sourceError ?? '找不到 crawler_sources'], status: 500 })

  const fail = async (msg: string, status: number, extra: Partial<FetcherResult> = {}) => {
    await updateRunStatus(supabase, source.id, { last_status: 'error', last_error: msg })
    return base({ errors: [msg], crawlerSourceId: source.id, sourceName: source.name, status, ...extra })
  }

  if (source.parser_type !== JYP_NOTICE_PARSER_TYPE) {
    return fail(`parser_type 不符：crawler_sources=${source.parser_type}，預期=${JYP_NOTICE_PARSER_TYPE}`, 500)
  }
  if (!source.is_active) {
    const msg = `來源已停用：${source.name}`
    await updateRunStatus(supabase, source.id, { last_status: 'skipped', last_error: msg })
    return base({ errors: [msg], crawlerSourceId: source.id, sourceName: source.name, status: 200 })
  }
  if (!source.idol_id) return fail(`crawler_sources 缺少 idol_id：${source.name}（jyp_notice 必須設定對應 idol）`, 500)

  const listUrl = jypNoticeListUrl(source.source_url)
  if (!listUrl) {
    return fail(`source_url 必須是 https://{藝人}.jype.com/notice：${source.source_url}`, 500)
  }
  const origin = new URL(listUrl).origin

  const { data: idolRow, error: idolError } = await supabase
    .from('idols')
    .select('id, slug')
    .eq('id', source.idol_id)
    .eq('is_active', true)
    .maybeSingle()
  if (idolError || !idolRow) {
    return fail(`找不到對應 idol（id: ${source.idol_id}）：${idolError?.message ?? '無資料'}`, 500)
  }
  const idolSlug = (idolRow.slug as string | null) ?? source.source_key.replace(/-jyp-notice$/, '')

  // ── HTTP（節流、路徑白名單、不跟隨轉址） ─────────────────────────────────
  let intervalMs = MIN_REQUEST_INTERVAL_MS
  let requestCount = 0
  async function get(url: string): Promise<HttpResult> {
    if (!isAllowedJypRequestUrl(url)) {
      return { ok: false, status: null, message: `拒絕請求非公告路徑：${url}` }
    }
    if (requestCount > 0) await sleep(intervalMs)
    requestCount += 1
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      const res = await fetchImpl(url, {
        method: 'GET',
        headers: { 'User-Agent': JYP_NOTICE_USER_AGENT, Accept: 'text/html' },
        credentials: 'omit',
        redirect: 'manual',
        cache: 'no-store',
        signal: controller.signal,
      })
      if (res.status >= 300 && res.status < 400) {
        return { ok: false, status: res.status, message: `HTTP ${res.status} 轉址（不跟隨）：${url}` }
      }
      if (!res.ok) return { ok: false, status: res.status, message: `HTTP ${res.status}：${url}` }
      return { ok: true, text: await res.text() }
    } catch (e) {
      return { ok: false, status: null, message: `請求失敗 ${url}：${e instanceof Error ? e.message : String(e)}` }
    } finally {
      clearTimeout(timeout)
    }
  }

  // ── robots.txt（每輪先看） ───────────────────────────────────────────────
  const robotsRes = await get(`${origin}/robots.txt`)
  if (!robotsRes.ok) {
    // 4xx（401/403/429 除外）＝沒有 robots，依慣例視為允許；其他一律停止。
    const noRobots = robotsRes.status !== null && robotsRes.status >= 400 && robotsRes.status < 500 && !isStopStatus(robotsRes.status)
    if (!noRobots) return fail(`robots.txt 讀取失敗，本輪停止：${robotsRes.message}`, 502)
  } else {
    const rules = parseRobotsTxt(robotsRes.text)
    if (!robotsAllowsNotice(rules)) {
      return fail(`robots.txt 已禁止 /notice，本輪停止：${origin}/robots.txt`, 502)
    }
    if (rules.crawlDelaySeconds !== null) {
      intervalMs = Math.max(MIN_REQUEST_INTERVAL_MS, Math.ceil(rules.crawlDelaySeconds * 1000))
      if (intervalMs > MAX_ACCEPTED_INTERVAL_MS) {
        return fail(`robots.txt Crawl-delay=${rules.crawlDelaySeconds}s 超過上限，本輪停止`, 502)
      }
    }
  }

  // ── 列表（最多 MAX_PAGES 頁） ────────────────────────────────────────────
  const entries: ParsedJypNoticeEntry[] = []
  const seen = new Set<string>()
  const fetchErrors: string[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = jypNoticePageUrl(listUrl, page)
    const res = await get(url)
    if (!res.ok) {
      if (page === 1) return fail(`抓取公告列表失敗：${res.message}`, 502)
      fetchErrors.push(`抓取公告列表第 ${page} 頁失敗：${res.message}`)
      break
    }
    const parsed = parseJypNoticeListHtml(res.text, origin)
    if (page === 1 && parsed.length === 0) {
      return fail(`公告列表版型不符（解析不到任何公告），本輪停止：${url}`, 502)
    }
    let added = 0
    for (const e of parsed) {
      if (seen.has(e.noticeNumber)) continue
      seen.add(e.noticeNumber)
      entries.push(e)
      added += 1
    }
    if (added === 0) break
  }

  const limited = entries.slice(0, MAX_ENTRIES_PER_RUN)
  const sourceCtx: JypNoticeSourceContext = {
    crawlerSourceId: source.id,
    sourceKey: source.source_key,
    sourceName: source.name,
    sourceType: source.source_type,
    parserType: source.parser_type,
    listUrl,
    idolId: source.idol_id,
    idolSlug,
  }

  // ── 去重（先查，才知道哪些是新公告、值得看詳情） ────────────────────────
  interface ExistingRow {
    id: string
    source_hash: string | null
    source_url: string | null
    content_hash: string | null
    reviewer_note: string | null
  }
  const existingByHash = new Map<string, ExistingRow>()
  const existingByUrl = new Map<string, ExistingRow>()
  const listPayloads = limited.map((entry) => ({ entry, payload: entryToCandidatePayload(entry, sourceCtx) }))
  if (listPayloads.length > 0) {
    const cols = 'id, source_hash, source_url, content_hash, reviewer_note'
    const [hashRes, urlRes] = await Promise.all([
      supabase.from('event_candidates').select(cols).in('source_hash', listPayloads.map((p) => p.payload.source_hash)),
      supabase.from('event_candidates').select(cols).in('source_url', listPayloads.map((p) => p.payload.source_url)),
    ])
    if (hashRes.error || urlRes.error) {
      const err = hashRes.error ?? urlRes.error
      return fail(`去重查詢失敗：${err?.code ? `[${err.code}] ` : ''}${err?.message ?? '未知錯誤'}`, 500, { fetched: entries.length })
    }
    for (const row of (hashRes.data ?? []) as ExistingRow[]) if (row.source_hash) existingByHash.set(row.source_hash, row)
    for (const row of (urlRes.data ?? []) as ExistingRow[]) if (row.source_url) existingByUrl.set(row.source_url, row)
  }
  const findExisting = (p: JypNoticeCandidatePayload) =>
    existingByHash.get(p.source_hash) ?? existingByUrl.get(p.source_url) ?? null

  // ── 詳情（有限度） ───────────────────────────────────────────────────────
  const details = new Map<string, ParsedJypNoticeDetail>()
  const detailStartedAt = now()
  for (const { entry, payload } of listPayloads) {
    if (details.size >= MAX_DETAILS_PER_RUN) break
    if (now() - detailStartedAt >= DETAIL_TIME_BUDGET_MS) break
    if (findExisting(payload) || payload.detected_venue_name || !looksLikeEventNotice(entry.title)) continue
    const res = await get(entry.detailUrl)
    if (!res.ok) {
      fetchErrors.push(`抓取公告詳情失敗：${res.message}`)
      if (res.status === null || isStopStatus(res.status)) break
      continue
    }
    details.set(entry.noticeNumber, parseJypNoticeDetailHtml(res.text))
  }

  // ── INSERT / RECHECK ─────────────────────────────────────────────────────
  const touched: TouchedCandidate[] = []
  let inserted = 0
  let wouldInsert = 0
  let skipped = 0
  let recheck = 0
  const errors: string[] = [...fetchErrors]

  for (const { entry, payload: listPayload } of listPayloads) {
    const detail = details.get(entry.noticeNumber) ?? null
    const payload = detail ? entryToCandidatePayload(entry, sourceCtx, detail) : listPayload
    const existing = findExisting(payload)

    if (!existing) {
      if (dryRun) { wouldInsert += 1; continue }
      const { data: insertedRow, error } = await supabase.from('event_candidates').insert(payload).select('id').single()
      if (error) {
        if (error.code === '23505') { skipped += 1; continue }
        errors.push(`${entry.title}: insert 失敗 ${error.code ? `[${error.code}] ` : ''}${error.message}`)
        continue
      }
      if (insertedRow?.id) touched.push(touchedFromPayload(insertedRow.id, source.id, 'inserted', { ...payload }))
      inserted += 1
      continue
    }

    if (existing.content_hash === null) {
      if (!dryRun) {
        const { error } = await supabase.from('event_candidates').update({ content_hash: payload.content_hash }).eq('id', existing.id)
        if (error) {
          errors.push(`${entry.title}: content_hash backfill 失敗 ${error.code ? `[${error.code}] ` : ''}${error.message}`)
          continue
        }
        touched.push(touchedFromPayload(existing.id, source.id, 'backfilled_hash', { ...payload }))
      }
      skipped += 1
      continue
    }

    if (existing.content_hash === payload.content_hash) {
      if (!dryRun) touched.push(touchedFromPayload(existing.id, source.id, 'unchanged', { ...payload }))
      skipped += 1
      continue
    }

    if (dryRun) { recheck += 1; continue }
    const noteSuffix = `[${new Date(now()).toISOString()}] content changed after capture`
    const { error } = await supabase
      .from('event_candidates')
      .update({
        needs_recheck: true,
        content_hash: payload.content_hash,
        reviewer_note: existing.reviewer_note ? `${existing.reviewer_note}\n${noteSuffix}` : noteSuffix,
      })
      .eq('id', existing.id)
    if (error) {
      errors.push(`${entry.title}: recheck flag 失敗 ${error.code ? `[${error.code}] ` : ''}${error.message}`)
      continue
    }
    touched.push(touchedFromPayload(existing.id, source.id, 'drift', { ...payload }))
    recheck += 1
  }

  if (!dryRun) wouldInsert = inserted

  const lastStatus: RunStatus = errors.length === 0 ? 'success' : 'partial_error'
  await updateRunStatus(supabase, source.id, {
    last_status: lastStatus,
    last_error: errors.length > 0 ? errors.join('\n') : null,
  })

  return {
    touched,
    source: 'jyp-notice',
    sourceKey,
    mode,
    fetched: entries.length,
    detailsFetched: details.size,
    inserted,
    wouldInsert,
    skipped,
    recheck,
    errors,
    crawlerSourceId: source.id,
    sourceName: source.name,
    status: 200,
  }
}

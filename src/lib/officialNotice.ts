// MUST #10：YG 公告（yg_notice）、SMTOWN 公告（smtown_notice）與 JYP 藝人站公告（jyp_notice）只留事實。
// 前台只顯示名稱、日期、地點與「看官方公告」連結，不放公告正文、翻譯或摘要。
// yg_artist_schedule 等其他來源不在範圍內，行為不變。
// 本檔只放純函式，前台、後台、cron 都可以 import。

export const FACTS_ONLY_NOTICE_PARSER_TYPES = ['yg_notice', 'smtown_notice', 'jyp_notice'] as const
export const FACTS_ONLY_NOTICE_RAW_SOURCES = ['yg-notice', 'smtown-notice', 'jyp-notice'] as const

// 只認公告頁路徑，不只看網域：YG 官方行程頁（/ko/artists/{slug}/schedule）同網域但不在範圍內。
const YG_NOTICE_URL = /^https?:\/\/(?:www\.)?ygfamily\.com\/(?:[a-z]{2}\/)?news\/notice(?:[/?#]|$)/i
const SMTOWN_NOTICE_URL = /^https?:\/\/(?:www\.)?smtown\.com\/notice(?:[/?#]|$)/i
// JYP 各藝人站公告：https://{sub}.jype.com/notice、/notice?PgIndex=、/notice/{id}?NoticeNumber=。
// /schedule、/Mobile/Schedule、/api/ 不算公告頁。
const JYP_NOTICE_URL = /^https?:\/\/[a-z0-9-]+\.jype\.com\/notice(?:\/[a-z0-9]+)?(?:[?#]|$)/i

function rawData(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function includes(list: readonly string[], value: unknown): boolean {
  return typeof value === 'string' && list.includes(value.trim())
}

/** 網址是否為 YG 公告頁、SMTOWN 公告板或 JYP 藝人站公告。 */
export function isOfficialNoticeUrl(url: string | null | undefined): boolean {
  const value = url?.trim()
  return !!value && (YG_NOTICE_URL.test(value) || SMTOWN_NOTICE_URL.test(value) || JYP_NOTICE_URL.test(value))
}

/**
 * 候選是否來自 YG／SMTOWN／JYP 公告。以 parser_type / raw_data.source 為準，不看網址。
 * parserType 是 crawler_sources.parser_type（若呼叫端已查到）。
 */
export function isFactsOnlyNoticeCandidate(
  candidate: { raw_data?: unknown },
  parserType?: string | null,
): boolean {
  const r = rawData(candidate.raw_data)
  return includes(FACTS_ONLY_NOTICE_PARSER_TYPES, parserType) ||
    includes(FACTS_ONLY_NOTICE_PARSER_TYPES, r.parser_type) ||
    includes(FACTS_ONLY_NOTICE_RAW_SOURCES, r.source)
}

/** 活動列拿不到 parser 時，用來源網址找官方公告連結（任一來源是公告頁就算）。 */
export function findOfficialNoticeUrl(
  sources: ReadonlyArray<{ url?: string | null }> | null | undefined,
): string | undefined {
  return sources?.map(source => source.url?.trim()).find(url => isOfficialNoticeUrl(url)) ?? undefined
}

/** YG 公告已抽出的售票網址（raw_data.ticket_url）。其他來源一律回 null。 */
export function factsOnlyNoticeTicketUrl(
  candidate: { raw_data?: unknown },
  parserType?: string | null,
): string | null {
  const r = rawData(candidate.raw_data)
  const isYg = parserType === 'yg_notice' || r.parser_type === 'yg_notice' || r.source === 'yg-notice'
  if (!isYg || typeof r.ticket_url !== 'string') return null
  const url = r.ticket_url.trim()
  return /^https?:\/\/\S+$/i.test(url) ? url : null
}

/**
 * 前台用：活動若來自 YG／SMTOWN／JYP 公告，回傳官方公告連結，否則 undefined。
 * 先看 rowToEvent 從全部來源算好的 officialNoticeUrl，再退回主要來源網址。
 */
export function getEventOfficialNoticeUrl(
  event: { officialNoticeUrl?: string; source?: { url?: string } | null },
): string | undefined {
  if (isOfficialNoticeUrl(event.officialNoticeUrl)) return event.officialNoticeUrl!.trim()
  const url = event.source?.url?.trim()
  return url && isOfficialNoticeUrl(url) ? url : undefined
}

import { isOfficialNoticeUrl } from '../officialNotice'

// 待 Dave 決定，建議維持 false，因為標題裡的城市容易誤判且無法指引使用者到場。
export const TITLE_CITY_COUNTS_AS_CONTENT = false

export const MIN_CONTENT_FIELDS = [
  'time', 'location', 'venue_name', 'city', 'address', 'location_name_zh',
  'description', 'display_summary_zh', 'ticket_url', 'stream_url',
] as const

export function hasMinimumContent(row: Partial<Record<(typeof MIN_CONTENT_FIELDS)[number], string | null | undefined>>): boolean {
  return MIN_CONTENT_FIELDS.some(field => !!row[field]?.trim())
}

export const EMPTY_SHELL_REASON = 'empty_shell' as const

/**
 * MUST #10 來源例外：YG／SMTOWN／JYP 公告只留事實（不寫正文、摘要），
 * 所以正文與摘要不算內容，改把官方公告連結算進最低內容。
 * 只有 factsOnlyNotice 為 true 且網址真的是公告頁時才放行；其他來源與 hasMinimumContent 完全相同。
 */
export function hasMinimumContentOrOfficialNotice(
  row: Parameters<typeof hasMinimumContent>[0],
  { factsOnlyNotice, officialNoticeUrl }: { factsOnlyNotice: boolean; officialNoticeUrl?: string | null },
): boolean {
  if (!factsOnlyNotice) return hasMinimumContent(row)
  return hasMinimumContent({ ...row, description: null, display_summary_zh: null }) ||
    isOfficialNoticeUrl(officialNoticeUrl)
}

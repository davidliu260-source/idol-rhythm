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

export interface DetailHeroEventLike {
  title: string
  date: string
  startDate?: string
  endDate?: string
  dateLabel?: string
  time?: string
  /** T35：unknown（我們還沒查到）／announced（有明確時間）／tba（官方明說尚未公布）。舊資料沒有此欄視同 unknown。 */
  timeStatus?: string | null
  venueName?: string
  location?: string
  city?: string
  country?: string
  ticketUrl?: string
  source: { level: string }
}

export const HERO_SCRIM_END_ALPHA = 0.15
export function heroScrimBackground(startAlpha: number, endAlpha: number): string {
  return `linear-gradient(150deg, rgba(0, 0, 0, ${startAlpha}) 0%, rgba(0, 0, 0, ${endAlpha}) 100%)`
}
export const HERO_TYPE_CHIP_BACKGROUND = 'rgba(0, 0, 0, 0.26)'
export const HERO_TRUST_CHIP = { background: '#ffffff', color: '#18102c' } as const
export const DETAIL_PAGE_BACKGROUND = '#08070d'
export const HERO_FADE_BACKGROUND = `linear-gradient(180deg, rgba(8, 7, 13, 0) 0%, ${DETAIL_PAGE_BACKGROUND} 100%)`
export const WEEKDAY_LABELS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'] as const

export function parseYmd(value?: string | null): { year: number; month: number; day: number; weekday: number } | null {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/)
  if (!match) return null
  const [, y, m, d] = match
  const year = Number(y), month = Number(m), day = Number(d)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return { year, month, day, weekday: date.getUTCDay() }
}
export function getStartYmd(event: DetailHeroEventLike) {
  return parseYmd(event.startDate ?? event.date)
}
export const TIME_TBA_LABEL = '官方尚未公布'
export const TIME_UNKNOWN_LABEL = '時間未定'
/**
 * T35：tba →「官方尚未公布」；unknown（或缺）→ 維持「時間未定」；announced → 顯示 time。
 * 有填 time 時一律顯示 time（舊資料 time_status 預設是 unknown，但 time 可能已有值）。
 */
export function formatTimeLabel(time?: string | null, timeStatus?: string | null): string {
  if (time?.trim()) return time
  return timeStatus === 'tba' ? TIME_TBA_LABEL : TIME_UNKNOWN_LABEL
}
export function getRangeEndLabel(event: DetailHeroEventLike): string | null {
  const start = getStartYmd(event), end = parseYmd(event.endDate)
  if (!start || !end || Date.UTC(end.year, end.month - 1, end.day) <= Date.UTC(start.year, start.month - 1, start.day)) return null
  return `至 ${end.month}/${end.day}`
}
export function getHeroDateParts(event: DetailHeroEventLike) {
  const start = getStartYmd(event)
  if (!start) return null
  return { monthLabel: `${start.month}月`, dayLabel: `${start.day}`, metaLabel: [WEEKDAY_LABELS[start.weekday], formatTimeLabel(event.time, event.timeStatus), getRangeEndLabel(event)].filter(Boolean).join(' · ') }
}
export function getInfoDateRow(event: DetailHeroEventLike): { key: '日期' | '期間'; main: string; sub: string } {
  const start = getStartYmd(event), end = parseYmd(event.endDate)
  const range = getRangeEndLabel(event)
  const main = !start ? event.dateLabel?.trim() || '日期未定' : range && end
    ? `${start.month} 月 ${start.day} 日 至 ${end.month} 月 ${end.day} 日`
    : `${start.month} 月 ${start.day} 日　${WEEKDAY_LABELS[start.weekday]}`
  return { key: range ? '期間' : '日期', main, sub: formatTimeLabel(event.time, event.timeStatus) }
}
export function getTrustBadgeLabel(level?: string | null): '官方確認' | '媒體確認' | '非官方整理' | null {
  return level === 'official' ? '官方確認' : level === 'media' ? '媒體確認' : level === 'aggregator' ? '非官方整理' : null
}
export function getVenueRow(event: DetailHeroEventLike): { main: string; sub: string | null } | null {
  const venue = event.venueName?.trim() || event.location?.trim()
  const area = Array.from(new Set([event.country?.trim(), event.city?.trim()].filter(Boolean))).join('・')
  return venue ? { main: venue, sub: area || null } : area ? { main: area, sub: null } : null
}
export function getTicketRow(ticketUrl?: string | null): { main: string; sub: string; href: string | null } {
  const url = ticketUrl?.trim()
  return url ? { main: '官方售票中', sub: '以官方連結為準', href: url } : { main: '連結待補', sub: '尚未取得官方售票連結', href: null }
}

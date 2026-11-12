export interface DetailHeroEventLike {
  title: string
  date: string
  startDate?: string
  endDate?: string
  dateLabel?: string
  time?: string
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
export function formatTimeLabel(time?: string | null): string {
  return time?.trim() ? time : '時間未定'
}
export function getRangeEndLabel(event: DetailHeroEventLike): string | null {
  const start = getStartYmd(event), end = parseYmd(event.endDate)
  if (!start || !end || Date.UTC(end.year, end.month - 1, end.day) <= Date.UTC(start.year, start.month - 1, start.day)) return null
  return `至 ${end.month}/${end.day}`
}
export function getHeroDateParts(event: DetailHeroEventLike) {
  const start = getStartYmd(event)
  if (!start) return null
  return { monthLabel: `${start.month}月`, dayLabel: `${start.day}`, metaLabel: [WEEKDAY_LABELS[start.weekday], formatTimeLabel(event.time), getRangeEndLabel(event)].filter(Boolean).join(' · ') }
}
export function getInfoDateRow(event: DetailHeroEventLike): { key: '日期' | '期間'; main: string; sub: string } {
  const start = getStartYmd(event), end = parseYmd(event.endDate)
  const range = getRangeEndLabel(event)
  const main = !start ? event.dateLabel?.trim() || '日期未定' : range && end
    ? `${start.month} 月 ${start.day} 日 至 ${end.month} 月 ${end.day} 日`
    : `${start.month} 月 ${start.day} 日　${WEEKDAY_LABELS[start.weekday]}`
  return { key: range ? '期間' : '日期', main, sub: formatTimeLabel(event.time) }
}
export function getTrustBadgeLabel(level?: string | null): '官方確認' | '媒體確認' | null {
  return level === 'official' ? '官方確認' : level === 'media' ? '媒體確認' : null
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

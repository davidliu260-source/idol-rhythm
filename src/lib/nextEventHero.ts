// T30b 首頁「下一場」英雄卡與頁首副標的純函式。零 import，供 scripts/check-next-event-hero.mjs 直接以 node 執行。
export interface HeroDateInput { date: string; endDate?: string | null; time?: string | null }
export interface HeroDateParts { month: number; day: number; weekday: string; timeLabel: string; rangeEndLabel: string | null }
export interface SubtitleClause { lead: string; strong: string }
export const HERO_SCRIM_END_ALPHA = 0.15
export function heroScrimBackground(startAlpha: number, endAlpha: number): string {
  return `linear-gradient(150deg, rgba(0, 0, 0, ${startAlpha}) 0%, rgba(0, 0, 0, ${endAlpha}) 100%)`
}
export function toDateKey(value: string | null | undefined): string | null {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/)
  if (!match) return null
  const [, y, m, d] = match
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)))
  return date.getUTCFullYear() === Number(y) && date.getUTCMonth() + 1 === Number(m) && date.getUTCDate() === Number(d) ? `${y}-${m}-${d}` : null
}
const pad = (n: number) => String(n).padStart(2, '0')
const utc = (key: string) => { const [y, m, d] = key.split('-').map(Number); return Date.UTC(y, m - 1, d) }
export function getLocalDateKey(now: Date): string { return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` }
export function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}
export function diffDayKeys(fromKey: string, toKey: string): number { return Math.round((utc(toKey) - utc(fromKey)) / 86400000) }
export function selectNextEvent<T extends { date: string }>(events: readonly T[], now: Date = new Date()): T | null {
  const today = getLocalDateKey(now)
  let next: T | null = null
  let nextKey: string | null = null
  for (const event of events) {
    const key = toDateKey(event.date)
    if (!key) continue
    if (key === today) return event
    if (key > today && (nextKey === null || key < nextKey)) { next = event; nextKey = key }
  }
  return next
}
export function getDaysUntil(event: { date: string }, now: Date = new Date()): number | null {
  const key = toDateKey(event.date)
  return key ? diffDayKeys(getLocalDateKey(now), key) : null
}
export function getHeroCountdownLabel(days: number): string { return days === 0 ? '今天' : `還有 ${days} 天` }
export function countTomorrowTickets<T extends { date: string }>(events: readonly T[], isTicket: (event: T) => boolean, now: Date = new Date()): number {
  const tomorrow = addDaysToKey(getLocalDateKey(now), 1)
  return events.filter(event => toDateKey(event.date) === tomorrow && isTicket(event)).length
}
export function getHomeSubtitleClauses(input: { tomorrowTicketCount: number; nextEventDays: number | null }): SubtitleClause[] {
  const clauses: SubtitleClause[] = []
  if (input.tomorrowTicketCount > 0) clauses.push({ lead: '明天有 ', strong: `${input.tomorrowTicketCount} 場開賣` })
  if (input.nextEventDays !== null && input.nextEventDays > 0) clauses.push({ lead: '下一場活動在 ', strong: `${input.nextEventDays} 天後` })
  return clauses
}
export function getHomeSubtitleText(clauses: readonly SubtitleClause[]): string { return clauses.map(c => c.lead + c.strong).join('，') }
export function getHeroDateParts(event: HeroDateInput): HeroDateParts | null {
  const key = toDateKey(event.date)
  if (!key) return null
  const [, month, day] = key.split('-').map(Number)
  const end = toDateKey(event.endDate)
  const endParts = end?.split('-').map(Number)
  const [y] = key.split('-').map(Number)
  return { month, day, weekday: ['日', '一', '二', '三', '四', '五', '六'][new Date(Date.UTC(y, month - 1, day)).getUTCDay()], timeLabel: event.time?.trim() || '時間未定', rangeEndLabel: end && end > key && endParts ? `至 ${endParts[1]}/${endParts[2]}` : null }
}
export function getTrustLabel(level: string | null | undefined): string | null { return level === 'official' ? '官方確認' : level === 'media' ? '媒體確認' : null }
export function getHeroVenueLabel(event: { venueName?: string | null; location?: string | null }): string | null { return event.venueName?.trim() || event.location?.trim() || null }
export function getHeroAriaLabel(input: { countdownLabel: string; categoryLabel: string; date: HeroDateParts; idolName: string; title: string; venueLabel: string | null; trustLabel: string | null }): string {
  const { countdownLabel, categoryLabel, date, idolName, title, venueLabel, trustLabel } = input
  return `下一場活動，${countdownLabel}：${categoryLabel}，${date.month}月${date.day}日 週${date.weekday} ${date.timeLabel}${date.rangeEndLabel ? `，${date.rangeEndLabel}` : ''}，${idolName}，${title}${venueLabel ? `，${venueLabel}` : ''}${trustLabel ? `，${trustLabel}` : ''}`
}

import { taipeiToday, toDateKey, addDaysToKey, diffDayKeys, isEventEnded, isEventOngoing, eventEndKey } from './taipeiDate'
export { toDateKey, addDaysToKey, diffDayKeys } from './taipeiDate'
// T32 首頁英雄卡：今天統一為台北曆日。
export interface HeroDateInput { date: string; endDate?: string | null; time?: string | null }
export interface HeroDateParts { month: number; day: number; weekday: string; timeLabel: string; rangeEndLabel: string | null }
export interface SubtitleClause { lead: string; strong: string }
export const HERO_SCRIM_END_ALPHA = 0.15
export function heroScrimBackground(startAlpha: number, endAlpha: number): string {
  return `linear-gradient(150deg, rgba(0, 0, 0, ${startAlpha}) 0%, rgba(0, 0, 0, ${endAlpha}) 100%)`
}
export function getLocalDateKey(now: Date): string { return taipeiToday(now) }
export function selectNextEvent<T extends { date: string; endDate?: string | null }>(events: readonly T[], now: Date = new Date()): T | null {
  const today = taipeiToday(now)
  let ongoing: T | null = null
  let future: T | null = null
  for (const event of events) {
    const start = toDateKey(event.date)
    if (start === null || isEventEnded(event, now) !== false) continue
    if (start === today) return event
    if (isEventOngoing(event, now)) {
      if (ongoing === null || eventEndKey(event)! < eventEndKey(ongoing)!) ongoing = event
    } else if (start > today && (future === null || start < toDateKey(future.date)!)) future = event
  }
  return ongoing ?? future
}
export function getDaysUntil(event: { date: string }, now: Date = new Date()): number | null {
  const key = toDateKey(event.date)
  return key ? diffDayKeys(getLocalDateKey(now), key) : null
}
export function getHeroCountdownLabel(days: number): string { return days < 0 ? '進行中' : days === 0 ? '今天' : `還有 ${days} 天` }
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

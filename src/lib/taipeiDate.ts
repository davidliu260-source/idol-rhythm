export const TAIPEI_TIME_ZONE = 'Asia/Taipei'
const formatter = new Intl.DateTimeFormat('en-US', { timeZone: TAIPEI_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
export function taipeiToday(now: Date = new Date()): string {
  const parts = formatter.formatToParts(now)
  const part = (type: string) => parts.find(p => p.type === type)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}
export function formatTaipeiDateLabel(now: Date = new Date()): string {
  const [y, m, d] = taipeiToday(now).split('-').map(Number)
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return `${y} 年 ${m} 月 ${d} 日 週${'日一二三四五六'[weekday]}`
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
export function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}
export function diffDayKeys(fromKey: string, toKey: string): number { return Math.round((utc(toKey) - utc(fromKey)) / 86400000) }

type DatedEvent = { date: string; endDate?: string | null }
export function eventEndKey(event: DatedEvent): string | null { return toDateKey(event.endDate ?? event.date) }
export function isEventEnded(event: DatedEvent, now: Date = new Date()): boolean | null {
  const end = eventEndKey(event)
  return end === null ? null : end < taipeiToday(now)
}
export function isEventToday(event: { date: string }, now?: Date): boolean { return toDateKey(event.date) === taipeiToday(now) }
export function isEventOngoing(event: DatedEvent, now?: Date): boolean {
  const start = toDateKey(event.date)
  return start !== null && isEventEnded(event, now) === false && start < taipeiToday(now)
}
export function isEventOnDay(event: DatedEvent, dayKey: string): boolean {
  const start = toDateKey(event.date)
  const end = eventEndKey(event)
  return start !== null && end !== null && start <= dayKey && dayKey <= end
}
export function isOnTaipeiToday(value: string, now?: Date): boolean { return toDateKey(value) === taipeiToday(now) }
export function isWithinTaipeiDays(value: string, days: number, now?: Date): boolean {
  const key = toDateKey(value)
  const today = taipeiToday(now)
  return key !== null && today <= key && key <= addDaysToKey(today, days)
}

const dateTimeFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TAIPEI_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export function formatTaipeiDateTime(iso: string | null | undefined): string | null {
  if (!iso) return null
  const timestamp = Date.parse(iso)
  if (!Number.isFinite(timestamp)) return null
  const parts = dateTimeFormatter.formatToParts(timestamp)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value
  return `${part('year')}/${part('month')}/${part('day')} ${part('hour')}:${part('minute')}`
}

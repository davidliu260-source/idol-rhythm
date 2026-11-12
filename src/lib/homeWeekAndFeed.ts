import { addDaysToKey, getLocalDateKey, toDateKey } from './nextEventHero'
import { EVENT_CATEGORY_ORDER, getEventCategory, type EventCategoryId } from './eventCategory'
import type { CategoryFilter } from './upcomingFilters'

export const WEEK_LENGTH = 7
export const WEEK_MAX_DOTS = 3
export const LATEST_WINDOW_DAYS = 14
export const LATEST_NEW_DAYS = 7
export const LATEST_LIMIT = 3
const DAY_MS = 86_400_000
const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']
type Datable = { id: string; date: string; endDate?: string | null }
type Categorizable = Datable & { type?: string | null; subType?: string | null }
type Publishable = Datable & { publishedAt?: string | null }
export interface WeekDay { key: string; month: number; day: number; label: string; isToday: boolean }
export interface WeekDayDots { key: string; categories: EventCategoryId[] }

export function getWeekDays(now: Date = new Date()): WeekDay[] {
  const today = getLocalDateKey(now)
  return Array.from({ length: WEEK_LENGTH }, (_, i) => {
    const key = addDaysToKey(today, i)
    const [year, month, day] = key.split('-').map(Number)
    return { key, month, day, label: i === 0 ? '今天' : WEEKDAY_LABELS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()], isToday: i === 0 }
  })
}

export function getWeekDots(events: readonly Categorizable[], now: Date = new Date(), category: CategoryFilter = 'all'): WeekDayDots[] {
  return getWeekDays(now).map(({ key }) => {
    const categories = new Set(events.filter(event => toDateKey(event.date) === key).map(getEventCategory))
    return { key, categories: category === 'all' ? EVENT_CATEGORY_ORDER.filter(id => categories.has(id)).slice(0, WEEK_MAX_DOTS) : categories.has(category) ? [category] : [] }
  })
}

export function hasWeekEvents(events: readonly Categorizable[], now: Date = new Date()): boolean {
  return getWeekDots(events, now, 'all').some(day => day.categories.length > 0)
}

export function isEventEnded(event: Datable, now: Date = new Date()): boolean | null {
  const key = toDateKey(event.endDate ?? event.date)
  return key === null ? null : key < getLocalDateKey(now)
}

export function parsePublishedAt(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const time = Date.parse(value)
  return Number.isNaN(time) ? null : time
}

export function listLatestPublished<T extends Publishable>(events: readonly T[], now: Date): T[] {
  return events.filter(event => {
    const time = parsePublishedAt(event.publishedAt)
    return time !== null && time >= now.getTime() - LATEST_WINDOW_DAYS * DAY_MS && isEventEnded(event, now) === false
  }).sort((a, b) => parsePublishedAt(b.publishedAt)! - parsePublishedAt(a.publishedAt)! || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).slice(0, LATEST_LIMIT)
}

export function isNewlyPublished(event: Publishable, now: Date = new Date()): boolean {
  const time = parsePublishedAt(event.publishedAt)
  return time !== null && now.getTime() - time <= LATEST_NEW_DAYS * DAY_MS
}

export function countEndedEvents(events: readonly Datable[], now: Date = new Date()): number {
  return events.filter(event => isEventEnded(event, now) === true).length
}

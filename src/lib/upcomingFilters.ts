import { EVENT_CATEGORY_ORDER, getEventCategory, type EventCategoryId } from './eventCategory'
import { listUpcomingEvents } from './upcomingEvents'

export type CategoryFilter = EventCategoryId | 'all'
export interface UpcomingCategoryCounts {
  total: number
  byCategory: Record<EventCategoryId, number>
}
type Categorizable = { id: string; date: string; time?: string | null; type?: string | null; subType?: string | null }

export function countUpcomingByCategory(events: readonly Categorizable[], now: Date = new Date()): UpcomingCategoryCounts {
  const byCategory = Object.fromEntries(EVENT_CATEGORY_ORDER.map(id => [id, 0])) as Record<EventCategoryId, number>
  const upcoming = listUpcomingEvents(events, now)
  for (const event of upcoming) byCategory[getEventCategory(event)]++
  return { total: upcoming.length, byCategory }
}

export function getVisibleCategories(counts: UpcomingCategoryCounts, selected: CategoryFilter): EventCategoryId[] {
  return EVENT_CATEGORY_ORDER.filter(id => counts.byCategory[id] > 0 || id === selected)
}

export function filterByCategory<T extends { type?: string | null; subType?: string | null }>(events: readonly T[], category: CategoryFilter): T[] {
  return category === 'all' ? [...events] : events.filter(event => getEventCategory(event) === category)
}

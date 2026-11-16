import { toDateKey, isEventEnded, isEventOngoing } from './taipeiDate'

export const INITIAL_VISIBLE = 9

export function listUpcomingEvents<T extends { id: string; date: string; endDate?: string | null; time?: string | null }>(events: readonly T[], now: Date = new Date()): T[] {
  return events.filter(event => {
    const key = toDateKey(event.date)
    return key !== null && isEventEnded(event, now) === false
  }).sort((a, b) => {
    const ongoingOrder = Number(isEventOngoing(b, now)) - Number(isEventOngoing(a, now))
    const dateOrder = toDateKey(a.date)!.localeCompare(toDateKey(b.date)!)
    const aTime = a.time?.trim() || ''
    const bTime = b.time?.trim() || ''
    return ongoingOrder || dateOrder || Number(!aTime) - Number(!bTime) || aTime.localeCompare(bTime) || a.id.localeCompare(b.id)
  })
}

export function filterFollowedEvents<T extends { idolId: string }>(events: readonly T[], followedIds: readonly string[]): T[] {
  const followed = new Set(followedIds)
  return events.filter(event => followed.has(event.idolId))
}

export function getVisibleEvents<T>(events: readonly T[], expanded: boolean, limit: number = INITIAL_VISIBLE): T[] {
  return events.slice(0, expanded ? events.length : limit)
}

export function getRemainingCount(total: number, expanded: boolean, limit: number = INITIAL_VISIBLE): number {
  return expanded ? 0 : Math.max(0, total - limit)
}

export function formatListMeta(timeLabel: string, venueLabel: string | null): string {
  return venueLabel ? `${timeLabel}　${venueLabel}` : timeLabel
}

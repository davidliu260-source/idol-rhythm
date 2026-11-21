import { taipeiToday, toDateKey } from './taipeiDate'

type ScheduleEvent = { date: string; idolId: string; time?: string | null }

type IdolEventGroups<T> = Map<string, [T, ...T[]]>

function getScheduleDateKey(value: string): string | null {
  const key = toDateKey(value)
  // Date-only and timezone-less values already represent a calendar day.
  if (!key || !/^\d{4}-\d{2}-\d{2}[T ]\d{2}:.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) return key
  const instant = new Date(value)
  return Number.isNaN(instant.getTime()) ? null : taipeiToday(instant)
}

// 同組內依時間排序；沒有時間的排最後；sort 穩定，同時間維持原查詢順序。
function sortByTime<T extends ScheduleEvent>(events: [T, ...T[]]): [T, ...T[]] {
  return [...events].sort((a, b) => {
    const at = a.time?.trim() || ''
    const bt = b.time?.trim() || ''
    return Number(!at) - Number(!bt) || at.localeCompare(bt)
  }) as [T, ...T[]]
}

export function groupScheduleEvents<T extends ScheduleEvent>(events: readonly T[]) {
  const days = new Map<string, IdolEventGroups<T>>()
  for (const event of events) {
    const date = getScheduleDateKey(event.date)
    if (!date) continue
    const idols = days.get(date) ?? new Map<string, [T, ...T[]]>()
    days.set(date, idols)
    const rows = idols.get(event.idolId)
    if (rows) rows.push(event)
    else idols.set(event.idolId, [event])
  }

  return Array.from(days, ([date, idols]) => ({
    date,
    groups: Array.from(idols, ([idolId, events]) => ({ idolId, events: sortByTime(events) })),
    count: Array.from(idols.values()).reduce((total, events) => total + events.length, 0),
  })).sort((a, b) => a.date.localeCompare(b.date))
}

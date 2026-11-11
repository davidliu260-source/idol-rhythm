import type { Event } from './types'
import { formatEventDate } from './mockEvents'

function formatRangeEnd(dateStr: string): string {
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return dateStr

  return date.toLocaleDateString('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  })
}

export function getEventDateLabel(event: Event): string {
  if (event.dateLabel) return event.dateLabel

  const startDate = event.startDate ?? event.date
  if (!event.endDate || event.endDate === startDate) {
    return formatEventDate(startDate)
  }

  return `${formatEventDate(startDate)} - ${formatRangeEnd(event.endDate)}`
}

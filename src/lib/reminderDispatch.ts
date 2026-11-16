import { addDaysToKey, taipeiToday } from './taipeiDate'

export interface ReminderTargetDates { today: string; dayBefore: string; weekBefore: string }
export function reminderTargetDates(now: Date = new Date()): ReminderTargetDates {
  const today = taipeiToday(now)
  return { today, dayBefore: addDaysToKey(today, 1), weekBefore: addDaysToKey(today, 7) }
}

export interface PendingReminder {
  reminder_id: string
  user_id: string
  event_id: string
  reminder_type: 'day_before' | 'week_before'
  idol_id: string | null
  idol_name: string
  event_title: string
}

// Supabase returns joined relations as arrays even for to-one joins with !inner
export type EventShape = {
  idol_id: string | null
  idol_name: string
  title: string
  date: string
  is_published: boolean
  trust_level: string
}
export type RawReminderRow = {
  id: string
  user_id: string
  event_id: string
  type: string
  events: EventShape | EventShape[]
}

export function selectDueReminders(rows: readonly RawReminderRow[], targets: ReminderTargetDates): PendingReminder[] {
  return rows
    .flatMap((r) => {
      const e = Array.isArray(r.events) ? r.events[0] : r.events
      if (!e) return []
      if (!e.is_published) return []
      if (!['official', 'media'].includes(e.trust_level)) return []
      if (r.type === 'day_before' && e.date !== targets.dayBefore) return []
      if (r.type === 'week_before' && e.date !== targets.weekBefore) return []
      return [{
        reminder_id: r.id,
        user_id: r.user_id,
        event_id: r.event_id,
        reminder_type: r.type as 'day_before' | 'week_before',
        idol_id: e.idol_id,
        idol_name: e.idol_name,
        event_title: e.title,
      }]
    })
}

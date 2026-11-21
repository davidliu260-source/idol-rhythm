export type ReminderType = 'day_before' | 'week_before'
export type ReminderChoice = ReminderType | 'both'

export const REMINDER_TYPES: readonly ReminderType[] = ['day_before', 'week_before']
export const LOCAL_REMINDER_TYPES_KEY = 'idol-rhythm:reminder-types'

export const REMINDER_CHOICE_LABELS: Record<ReminderChoice, string> = {
  day_before: '前一天',
  week_before: '前一週',
  both: '前一天＋前一週',
}

export function isReminderType(value: unknown): value is ReminderType {
  return REMINDER_TYPES.some((type) => type === value)
}

export function choiceToTypes(choice: ReminderChoice): ReminderType[] {
  return choice === 'both' ? [...REMINDER_TYPES] : [choice]
}

export function normalizeReminderTypes(types: unknown): ReminderType[] {
  return Array.isArray(types) ? REMINDER_TYPES.filter((type) => types.includes(type)) : []
}

export function typesToChoice(types: unknown): ReminderChoice | null {
  const normalized = normalizeReminderTypes(types)
  return normalized.length === 2 ? 'both' : normalized[0] ?? null
}

export function planReminderTypeChange(current: unknown, next: unknown): {
  toInsert: ReminderType[]
  toDelete: ReminderType[]
} {
  const currentTypes = normalizeReminderTypes(current)
  const nextTypes = normalizeReminderTypes(next)
  return {
    toInsert: nextTypes.filter((type) => !currentTypes.includes(type)),
    toDelete: currentTypes.filter((type) => !nextTypes.includes(type)),
  }
}

export function reminderTypesLabel(types: unknown): string | null {
  const choice = typesToChoice(types)
  return choice ? REMINDER_CHOICE_LABELS[choice] : null
}

export function parseLocalReminderTypes(raw: string | null): Record<string, ReminderType[]> {
  if (raw === null) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}

    const entries: [string, ReminderType[]][] = []
    for (const [id, types] of Object.entries(parsed)) {
      const normalized = normalizeReminderTypes(types)
      if (normalized.length > 0) entries.push([id, normalized])
    }
    return Object.fromEntries(entries)
  } catch {
    return {}
  }
}

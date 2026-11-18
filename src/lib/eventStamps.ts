import { taipeiToday, toDateKey } from './taipeiDate'

export const STAMP_STORAGE_KEY = 'idol-rhythm:stamps:v1'
export const STAMP_LOCAL_MAX = 500
export const STAMP_COPY = {
  title: '去過蓋章',
  stamp: '蓋章',
  stamped: '已蓋章',
  ariaStamp: '標記我去過',
  ariaUnstamp: '取消去過蓋章',
  hintEmpty: '在已開始或已結束的收藏活動按「蓋章」，記下你去過的場次',
  hint: '蓋章只有你自己看得到',
} as const

export type StampErrorKind = 'missing' | 'rejected' | 'duplicate' | 'other'
type ReadStorage = { getItem(k: string): string | null }
type WriteStorage = { setItem(k: string, v: string): void }

export function isStampableId(id: unknown): id is string {
  return typeof id === 'string' && id.length === 36 &&
    /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)
}

export function normalizeStampIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.filter(isStampableId).map(id => id.toLowerCase()))).slice(0, STAMP_LOCAL_MAX)
}

export function readStampIds(storage: ReadStorage | null): string[] {
  try {
    const value = storage?.getItem(STAMP_STORAGE_KEY)
    return value == null ? [] : normalizeStampIds(JSON.parse(value))
  } catch {
    return []
  }
}

export function writeStampIds(storage: WriteStorage | null, ids: readonly string[]): boolean {
  if (!storage) return false
  try {
    storage.setItem(STAMP_STORAGE_KEY, JSON.stringify(normalizeStampIds(ids)))
    return true
  } catch {
    return false
  }
}

export function toggleStampId(ids: readonly string[], id: string): string[] {
  const normalized = normalizeStampIds(ids)
  if (!isStampableId(id)) return normalized
  const key = id.toLowerCase()
  return normalized.includes(key) ? normalized.filter(value => value !== key) : [...normalized, key]
}

export function classifyStampError(
  error: { code?: string | null; message?: string | null } | null | undefined,
): StampErrorKind | null {
  if (!error) return null
  const { code, message = '' } = error
  if (code === '42P01' || code === 'PGRST205' || /Could not find the table|relation .* does not exist/i.test(message ?? '')) {
    return 'missing'
  }
  if (code === '42501') return /row-level security/i.test(message ?? '') ? 'rejected' : 'missing'
  if (code === '23505') return 'duplicate'
  if (code === '23503') return 'rejected'
  return 'other'
}

export function isStampEligible(event: { id: string; date: string }, now: Date = new Date()): boolean {
  const date = toDateKey(event.date)
  return isStampableId(event.id) && date !== null && date <= taipeiToday(now)
}

export function countStamps(stampIds: readonly string[], events: readonly { id: string }[]): number {
  const stamped = new Set(stampIds.map(id => id.toLowerCase()))
  const eventIds = new Set(events.map(event => event.id.toLowerCase()).filter(id => stamped.has(id)))
  return eventIds.size
}

export function formatStampCount(n: number): string {
  return `已蓋 ${Number.isInteger(n) && n >= 0 ? n : 0} 章`
}

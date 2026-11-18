export const WANT_DEVICE_STORAGE_KEY = 'idol-rhythm:want-device:v1'
export const WANT_LIMITS = { perMinute: 10, perHour: 60, anonAddsPerEventPer10Min: 60, maxIdsPerRequest: 100 } as const
export const WANT_COPY = {
  idle: '我想去',
  active: '已標記想去',
  zero: '匿名計數，不會顯示你是誰',
  rateLimited: '操作太頻繁，請稍後再試',
  storageBlocked: '這個瀏覽器無法記住你的選擇，登入後再試',
} as const

export interface WantState { count: number; wanted: boolean }
export type WantRpcErrorKind = 'missing' | 'other'

type DeviceStorage = { getItem(k: string): string | null }
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DEVICE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isDeviceId(value: unknown): value is string {
  return typeof value === 'string' && DEVICE_ID_RE.test(value)
}

export function createDeviceId(c: { randomUUID?: () => string; getRandomValues: (a: Uint8Array) => Uint8Array }): string {
  if (c.randomUUID) {
    const id = c.randomUUID()
    if (isDeviceId(id)) return id.toLowerCase()
  }
  const bytes = c.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-')
}

export function getStoredDeviceId(storage: DeviceStorage | null): string | null {
  try {
    const id = storage?.getItem(WANT_DEVICE_STORAGE_KEY)
    return isDeviceId(id) ? id : null
  } catch {
    return null
  }
}

export function ensureDeviceId(
  storage: (DeviceStorage & { setItem(k: string, v: string): void }) | null,
  c: Parameters<typeof createDeviceId>[0],
): string | null {
  if (!storage) return null
  const stored = getStoredDeviceId(storage)
  if (stored) return stored
  try {
    const id = createDeviceId(c)
    storage.setItem(WANT_DEVICE_STORAGE_KEY, id)
    return getStoredDeviceId(storage)
  } catch {
    return null
  }
}

export function classifyWantRpcError(error: { code?: string | null; message?: string | null } | null | undefined): WantRpcErrorKind | null {
  if (!error) return null
  if (['PGRST202', '42883', '42501'].includes(error.code ?? '') ||
      /Could not find the function|function .* does not exist/i.test(error.message ?? '')) return 'missing'
  return 'other'
}

export function normalizeEventIds(ids: readonly string[]): string[] {
  return Array.from(new Set(ids.filter(id => UUID_RE.test(id)).map(id => id.toLowerCase())))
}

export function chunkIds(ids: readonly string[], size: number = WANT_LIMITS.maxIdsPerRequest): string[][] {
  if (!Number.isSafeInteger(size) || size < 1) size = WANT_LIMITS.maxIdsPerRequest
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += size) chunks.push(ids.slice(i, i + size))
  return chunks
}

export function optimisticWant(prev: WantState, nextWanted: boolean): WantState {
  if (prev.wanted === nextWanted) return prev
  return { count: Math.max(0, prev.count + (nextWanted ? 1 : -1)), wanted: nextWanted }
}

export function resolveWantResult(
  before: WantState,
  row: { status_code?: unknown; is_wanted?: unknown; want_count?: unknown } | null | undefined,
): { kind: 'ok' | 'rate_limited'; state: WantState } | { kind: 'gone' } {
  const kind = row?.status_code
  if (!row || (kind !== 'ok' && kind !== 'rate_limited')) return { kind: 'gone' }
  const { is_wanted: wanted, want_count: count } = row
  if (typeof wanted !== 'boolean' || typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
    return { kind, state: before }
  }
  return { kind, state: { count, wanted } }
}

export function formatWantCount(n: number): string {
  if (!Number.isInteger(n) || n <= 0) return ''
  return n >= 1000 ? '999+ 人想去' : `${n} 人想去`
}

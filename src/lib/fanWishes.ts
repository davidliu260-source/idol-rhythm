export { classifyWantRpcError as classifyWishRpcError, ensureDeviceId, getStoredDeviceId } from './eventWants'
// 裝置 id 與 F1 共用同一個 localStorage key（WANT_DEVICE_STORAGE_KEY）；DB 端 hash 前綴不同，不會關聯

export const WISH_KINDS = ['add_group', 'add_city'] as const
export type WishKind = (typeof WISH_KINDS)[number]
export const WISH_NAME_MAX_CHARS = 40
export const WISH_RAW_MAX_CHARS = 200
export const WISH_LIMITS = { perMinute: 5, perDay: 20, anonPer10MinSitewide: 100 } as const
export const WISH_TLDS = 'com|net|org|io|me|tv|kr|jp|tw|cn|hk|ly|gg|co|app|xyz|link|site|shop'
export const WISH_COPY = {
  title: '許願池',
  intro: '找不到你的團或城市？告訴我們，我們會優先補資料。',
  kindGroup: '加一個團',
  kindCity: '加一個城市',
  placeholderGroup: '團名或藝人名，例如 aespa',
  placeholderCity: '城市名，例如 台中',
  submit: '送出',
  received: '已收到，謝謝你！',
  duplicate: '你已許過這個願',
  rateLimited: '送出太頻繁，請稍後再試',
  invalid: '請輸入 1–40 字的名稱，不能有網址或換行',
  storageBlocked: '這個瀏覽器無法記住你的選擇，登入後再試',
  privacy: '只收名稱，不收留言；不會公開你是誰',
} as const

export type WishResult =
  | { kind: 'ok' | 'duplicate'; name: string }
  | { kind: 'rate_limited' | 'invalid' | 'gone' }

const forbiddenCharacters = /[\u0000-\u001F\u007F-\u009F\u00AD\u200B-\u200F\u2028-\u202E\u2060-\u2064\uFEFF]/
const forbiddenName = new RegExp(`(://|www\\.|https?:|@|<|>|\\.(${WISH_TLDS})([/?#\\s]|$))`)

export function isWishKind(value: unknown): value is WishKind {
  return value === 'add_group' || value === 'add_city'
}

export function normalizeWishName(raw: unknown): string | null {
  if (typeof raw !== 'string' || Array.from(raw).length > WISH_RAW_MAX_CHARS) return null
  if (forbiddenCharacters.test(raw)) return null

  const name = raw.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()
  const length = Array.from(name).length
  if (length < 1 || length > WISH_NAME_MAX_CHARS || forbiddenName.test(name)) return null
  return name
}

export function resolveWishResult(
  row: { status_code?: unknown; wish_name?: unknown } | null | undefined,
): WishResult {
  const kind = row?.status_code
  if (kind === 'ok' || kind === 'duplicate') {
    const name = row?.wish_name
    return { kind, name: typeof name === 'string' ? name : '' }
  }
  if (kind === 'rate_limited' || kind === 'invalid') return { kind }
  return { kind: 'gone' }
}

export function wishNotice(kind: WishResult['kind']): string {
  switch (kind) {
    case 'ok': return WISH_COPY.received
    case 'duplicate': return WISH_COPY.duplicate
    case 'rate_limited': return WISH_COPY.rateLimited
    case 'invalid': return WISH_COPY.invalid
    case 'gone': return ''
  }
}

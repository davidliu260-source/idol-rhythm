/**
 * T35 B-4：「同一場」判斷——同一藝人＋同一天＋同一城市（或同一場館），不論標題語言或來源。
 * 只用於程式去重與後台「可能重複」清單；**不加 DB 唯一索引**（多藝人同台、同日雙場會誤傷）。
 */
import { toDateKey } from '../taipeiDate'
import { inferTaiwanCity } from '../crawlers/taiwanEventCleanup'

/** 港星馬與常見海外城市的跨語言別名 → 統一鍵。台灣城市由 inferTaiwanCity 處理。 */
const CITY_ALIASES: ReadonlyArray<readonly [string, RegExp]> = [
  ['hong-kong', /^(?:hong\s*kong|香港|홍콩|hk)$/i],
  ['singapore', /^(?:singapore|新加坡|싱가포르|sg)$/i],
  ['kuala-lumpur', /^(?:kuala\s*lumpur|吉隆坡|쿠알라룸푸르|kl)$/i],
  ['seoul', /^(?:seoul|首爾|首尔|서울)$/i],
  ['tokyo', /^(?:tokyo|東京|东京|도쿄)$/i],
  ['osaka', /^(?:osaka|大阪|오사카)$/i],
  ['bangkok', /^(?:bangkok|曼谷|방콕)$/i],
  ['macau', /^(?:maca[ou]|澳門|澳门|마카오)$/i],
]

const squash = (v: string) => v.normalize('NFKC').toLowerCase().replace(/臺/g, '台').replace(/[\s\-_.,·・()（）]/g, '')

/** 城市鍵：台北／Taipei／타이베이 → 「台北」；Singapore／新加坡 → 「singapore」；其他取正規化字串。 */
export function canonicalCityKey(city: string | null | undefined): string | null {
  const text = city?.normalize('NFKC').trim()
  if (!text) return null
  const tw = inferTaiwanCity({ title: '', venueName: text })
  if (tw) return tw
  for (const [key, pattern] of CITY_ALIASES) if (pattern.test(text)) return key
  return squash(text) || null
}

/** 場館鍵：只做正規化（不做跨語言），供「同一場館」比對。 */
export function canonicalVenueKey(venue: string | null | undefined): string | null {
  const text = venue?.trim()
  return text ? squash(text) || null : null
}

export interface SameShowInput {
  idolId: string | null | undefined
  date: string | null | undefined
  city?: string | null
  venue?: string | null
}

/** 同藝人、同日，且城市鍵相同或場館鍵相同 → 視為同一場。缺藝人／日期／地點任一 → false。 */
export function isSameShow(a: SameShowInput, b: SameShowInput): boolean {
  if (!a.idolId || a.idolId !== b.idolId) return false
  const da = toDateKey(a.date), db = toDateKey(b.date)
  if (!da || da !== db) return false
  const ca = canonicalCityKey(a.city), cb = canonicalCityKey(b.city)
  if (ca && ca === cb) return true
  const va = canonicalVenueKey(a.venue), vb = canonicalVenueKey(b.venue)
  return !!va && va === vb
}

export interface DuplicateCandidateEvent {
  id: string
  idol_id: string
  date: string
  start_date?: string | null
  city?: string | null
  venue_name?: string | null
}

/** 後台「可能重複」清單：依 藝人＋日期＋城市鍵 分組，只回傳 2 列以上的組。 */
export function groupPossibleDuplicates<T extends DuplicateCandidateEvent>(events: readonly T[]): T[][] {
  const groups = new Map<string, T[]>()
  for (const e of events) {
    const date = toDateKey(e.start_date ?? e.date)
    const city = canonicalCityKey(e.city)
    if (!date || !city) continue
    const key = `${e.idol_id}|${date}|${city}`
    groups.set(key, [...(groups.get(key) ?? []), e])
  }
  return Array.from(groups.values()).filter(g => g.length > 1)
}

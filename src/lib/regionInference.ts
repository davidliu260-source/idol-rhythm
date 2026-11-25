/**
 * T35 B-1：依城市／場館／地點關鍵字推 country_code，再由 regions.ts 補 country／country_flag。
 * 推不出來（或同時命中多個國家）就回 null，不要猜。
 */
import { inferTaiwanCity } from './crawlers/taiwanEventCleanup'
import { regionByCode, type RegionCode } from './regions'

/** 港星馬主要城市與場館（台灣沿用 taiwanEventCleanup 的 TAIWAN_PLACES）。 */
const OVERSEAS_PLACES: ReadonlyArray<readonly [RegionCode, RegExp]> = [
  ['HK', /\bHong\s*Kong\b|香港|홍콩|AsiaWorld[-\s]?Expo|亞洲國際博覽館|亚洲国际博览馆|Kai\s*Tak|啟德|启德|Hong\s*Kong\s+Coliseum|紅磡|红磡|Hung\s*Hom|Macpherson\s+Stadium/i],
  ['SG', /\bSingapore\b|新加坡|싱가포르|Singapore\s+Indoor\s+Stadium|Singapore\s+National\s+Stadium|Kallang|加冷|Marina\s+Bay\s+Sands|Star\s+Theatre|Capitol\s+Theatre\s+Singapore/i],
  ['MY', /\bKuala\s*Lumpur\b|吉隆坡|쿠알라룸푸르|\bMalaysia\b|馬來西亞|马来西亚|Axiata\s+Arena|Bukit\s+Jalil|武吉加里爾|Mega\s*Star\s+Arena|Zepp\s+Kuala\s+Lumpur|MITEC|Putrajaya|Penang|檳城/i],
]

/**
 * 單獨寫「National Stadium」時才算新加坡，且必須是唯一的地點線索；
 * Kaohsiung National Stadium、Bukit Jalil National Stadium 等由各自的城市／場館判斷。
 */
const BARE_SG_NATIONAL_STADIUM = /^\s*National\s+Stadium\s*$/i

export interface RegionEvidence {
  city?: string | null
  venueName?: string | null
  location?: string | null
  address?: string | null
}

export function inferCountryCode(evidence: RegionEvidence): RegionCode | null {
  const texts = [evidence.city, evidence.venueName, evidence.location, evidence.address]
    .filter((v): v is string => !!v?.trim())
  if (!texts.length) return null
  const found = new Set<RegionCode>()
  for (const text of texts) {
    // 每段文字單獨判斷台灣城市（避免兩段文字被串成「多站」而判成 null）。
    if (inferTaiwanCity({ title: '', venueName: text })) found.add('TW')
    for (const [code, pattern] of OVERSEAS_PLACES) if (pattern.test(text)) found.add(code)
    if (texts.length === 1 && BARE_SG_NATIONAL_STADIUM.test(text)) found.add('SG')
  }
  return found.size === 1 ? Array.from(found)[0] : null
}

/** 建活動用：country_code 加上舊欄位 country／country_flag（NOT NULL，推不出來照舊 ''）。 */
export function inferRegionFields(evidence: RegionEvidence): { country_code: RegionCode | null; country: string; country_flag: string } {
  const region = regionByCode(inferCountryCode(evidence))
  return region
    ? { country_code: region.code, country: region.name, country_flag: region.flag }
    : { country_code: null, country: '', country_flag: '' }
}

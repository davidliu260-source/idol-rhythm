/** T35：國家／地區代碼單一對照表。events.country／country_flag 一律由 country_code 經此表補齊。 */
export const REGIONS = [
  { code: 'TW', name: '台灣', flag: '🇹🇼' },
  { code: 'HK', name: '香港', flag: '🇭🇰' },
  { code: 'SG', name: '新加坡', flag: '🇸🇬' },
  { code: 'MY', name: '馬來西亞', flag: '🇲🇾' },
  { code: 'JP', name: '日本', flag: '🇯🇵' },
  { code: 'KR', name: '韓國', flag: '🇰🇷' },
] as const

export type RegionCode = (typeof REGIONS)[number]['code']
export type Region = (typeof REGIONS)[number]

export function regionByCode(code: string | null | undefined): Region | null {
  const key = code?.trim().toUpperCase()
  return REGIONS.find(r => r.code === key) ?? null
}

export function regionByCountryName(name: string | null | undefined): Region | null {
  const key = name?.trim().replace(/臺/g, '台')
  return REGIONS.find(r => r.name === key) ?? null
}

/**
 * 存檔用：有對照表內的代碼就以表為準；沒有代碼（「其他」）則保留呼叫端原本填的文字。
 */
export function resolveCountryFields(input: { countryCode?: string | null; country?: string | null; countryFlag?: string | null }): {
  country_code: RegionCode | null; country: string; country_flag: string
} {
  const region = regionByCode(input.countryCode)
  if (region) return { country_code: region.code, country: region.name, country_flag: region.flag }
  return { country_code: null, country: input.country?.trim() ?? '', country_flag: input.countryFlag?.trim() ?? '' }
}

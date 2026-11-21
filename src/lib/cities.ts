import { taipeiToday, toDateKey } from './taipeiDate'
import { listCurrentEvents, listUpcomingEvents } from './upcomingEvents'

export const TAIWAN_CITIES = ['台北', '新北', '桃園', '台中', '台南', '高雄', '新竹', '基隆'] as const

type CityEvent = { city?: string | null; date: string; endDate?: string | null }

export type CityDirectoryEntry = {
  name: string
  count: number
  nextDate: string | null
}

export function normalizeCityName(name: string | null | undefined): string {
  return (name ?? '').trim().replace(/臺/g, '台')
}

export function buildCityDirectory(events: readonly CityEvent[], now = new Date()) {
  const cities = new Map<string, CityDirectoryEntry>()
  const taiwanCities = TAIWAN_CITIES.map<CityDirectoryEntry>(name => {
    const entry = { name, count: 0, nextDate: null }
    cities.set(name, entry)
    return entry
  })

  const otherCities: CityDirectoryEntry[] = []
  const today = taipeiToday(now)
  let unlabeledCount = 0
  for (const event of listCurrentEvents(events, now)) {
    const name = normalizeCityName(event.city)
    if (!name) {
      unlabeledCount++
      continue
    }

    let entry = cities.get(name)
    if (!entry) {
      entry = { name, count: 0, nextDate: null }
      cities.set(name, entry)
      otherCities.push(entry)
    }
    const startDate = toDateKey(event.date)!
    const date = startDate < today ? today : startDate
    entry.count++
    if (!entry.nextDate || date < entry.nextDate) entry.nextDate = date
  }

  otherCities.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-TW'))
  return { taiwanCities, otherCities, unlabeledCount }
}

export function getCityEvents<T extends CityEvent & { id: string; time?: string | null }>(events: readonly T[], city: string, now = new Date()): T[] {
  const name = normalizeCityName(city)
  if (!name) return []
  return listUpcomingEvents(events.filter(event => normalizeCityName(event.city) === name), now)
}

export function decodeCityParam(param: string): string | null {
  try {
    return decodeURIComponent(param)
  } catch {
    return null
  }
}

export function resolveCityParam(param: string, events: readonly { city?: string | null }[]): string | null {
  const name = normalizeCityName(decodeCityParam(param))
  if (!name) return null
  if (TAIWAN_CITIES.some(city => city === name) || events.some(event => normalizeCityName(event.city) === name)) {
    return name
  }
  return null
}

export function cityHref(name: string): string {
  return `/cities/${encodeURIComponent(name)}`
}

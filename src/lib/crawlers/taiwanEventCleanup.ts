import type { EventType, EventSubType } from '../types'

const OFFICIAL_SCHEDULE_PREFIX = new RegExp(String.raw`^.{0,40}?官方\s+(?:JYP|YG)\s+Schedule\s*[-–—]\s*`, 'iu')

export function cleanCrawledTitle(rawTitle: string, { sourceName }: { sourceName?: string | null } = {}): string {
  const title = rawTitle.trim()
  const source = sourceName?.trim()
  const afterSource = source && title.startsWith(source) ? title.slice(source.length) : ''
  const cleaned = /^\s*[-–—]/.test(afterSource)
    ? afterSource.replace(/^\s*[-–—]/, '')
    : title.replace(OFFICIAL_SCHEDULE_PREFIX, '')
  return cleaned.trim() || rawTitle
}

const TAIWAN_PLACES = [
  ['新北', /Zepp\s+New\s+Taipei|林口體育館|Linkou\s+Arena|新莊體育館/i, /新北|\bNew\s+Taipei\b|신베이/i],
  ['台北', /(?<![舞後后平電擂])[台臺]北(?:小巨蛋|大巨蛋|流行音樂中心)|Taipei\s+(?:Arena|Dome|Music\s+Center)|Legacy\s+(?:Taipei|Max)|Clapper\s+Studio|南港展覽館|Nangang\s+Exhibition/i, /(?<![舞後后平電擂])[台臺]北|\bTaipei\b|타이베이|타이페이/i],
  ['高雄', /高雄(?:巨蛋|國家體育場|流行音樂中心)|世運主場館|Kaohsiung\s+(?:Arena|National\s+Stadium)|Kaoarena|衛武營/i, /高雄|\bKaohsiung\b|가오슝/i],
  ['桃園', /桃園巨蛋|樂天桃園棒球場/i, /桃園|\bTaoyuan\b|타오위안/i],
  ['台中', /(?<![舞後后平電擂])[台臺]中洲際棒球場/i, /(?<![舞後后平電擂])[台臺]中|\bTaichung\b|타이중/i],
  ['台南', null, /(?<![舞後后平電擂])[台臺]南|\bTainan\b|타이난/i],
  ['新竹', null, /新竹|\bHsinchu\b|신주(?!쿠)/i],
  ['基隆', null, /基隆|\bKeelung\b|지룽/i],
] as const

const OVERSEAS_CITY = /\b(?:Seoul|Tokyo|Osaka|Bangkok|Singapore|Manila|Jakarta|Hong\s+Kong|Macau|Kuala\s+Lumpur|Los\s+Angeles|New\s+York|London|Paris|Busan|Incheon|Nagoya|Fukuoka|Yokohama|Saitama|Sydney|Melbourne|Ho\s+Chi\s+Minh|Hanoi)\b|서울|도쿄|오사카|방콕|首爾|東京|大阪|曼谷|新加坡|香港|澳門|부산|마닐라|雅加達|吉隆坡|釜山/i
const TOUR_STOP_SEPARATOR = /[\/,·、|／，｜&]/

interface CityEvidence {
  title: string
  venueName?: string | null
  locationText?: string | null
}

export function inferTaiwanCity({ title, venueName, locationText }: CityEvidence): typeof TAIWAN_PLACES[number][0] | null {
  const titleIsMultiStop = TOUR_STOP_SEPARATOR.test(title) && OVERSEAS_CITY.test(title)
  const texts = [venueName, locationText, titleIsMultiStop ? null : title].filter((value): value is string => !!value?.trim())
  const evidence = texts.map(text => {
    // Remove the longer city name before searching for Taipei on its own.
    const withoutNewTaipei = text.replace(/\bNew\s+Taipei\b/gi, ' ')
    const venues = TAIWAN_PLACES.filter(([venueCity, venue]) => venue?.test(venueCity === '台北' ? withoutNewTaipei : text)).map(([city]) => city)
    const cities = TAIWAN_PLACES.filter(([city, , pattern]) =>
      pattern.test(city === '台北' ? withoutNewTaipei : text),
    ).map(([city]) => city)
    return { venues, cities: Array.from(new Set([...venues, ...cities])) }
  })
  if (evidence.some(({ cities }) => cities.length > 1)) return null
  const venue = evidence.find(({ venues }) => venues.length)
  if (venue) return venue.venues[0]
  return evidence.find(({ cities }) => cities.length)?.cities[0] ?? null
}

interface CategoryEvidence {
  title: string
  type: EventType | null
  subType: EventSubType | null
}

const CLASSIFIED_SUBTYPES = ['fanmeet', 'fansign', 'popup_store', 'exhibition', 'birthday_cafe', 'award']
const NON_CONCERT_SUBTYPES = ['musicshow', 'variety', 'interview', 'release', 'announcement', 'magazine', 'brand_event']
const CATEGORY_EXCLUSION = /\b(?:dvd|blu-?ray|albums?|releases?|tickets?|ticketing|presales?|on\s+sale|ost)\b|발매|앨범|티켓|예매|發行|售票|開賣|搶票|預售|購票|抽選/i
const CATEGORY_RULES = [
  ['fanmeet', /\bfan(?:\s*meet(?:ing)?|[-\s]?con)\b|팬미팅|팬콘|見面會/i, 'concert', 'fanmeet'],
  ['fansign', /\bfan\s*sign(?:ing)?\b|팬사인회|簽名會|簽售/i, null, 'fansign'],
  ['popup', /\bpop-?up\b|팝업|快閃/i, 'brand', 'popup_store'],
  ['exhibition', /\bexhibition\b(?!\s+(?:center|centre|hall))|전시(?![장관])|展覽(?![館中])/i, null, 'exhibition'],
  ['concert', /\b(?:tour|concert|live\s+in)\b|콘서트|투어(?!스)|演唱會|巡演/i, 'concert', null],
] as const

export function refineEventCategory({ title, type, subType }: CategoryEvidence): {
  type: EventType | null; subType: EventSubType | null; rule: string | null
} {
  // Keep the same category exceptions as getEventCategory without a runtime import.
  if (
    type !== 'concert' && type !== 'ticketing' && type !== 'media' && type !== 'livestream' && type !== 'streaming'
    && !CLASSIFIED_SUBTYPES.includes(subType ?? '') && !NON_CONCERT_SUBTYPES.includes(subType ?? '')
    && !CATEGORY_EXCLUSION.test(title)
  ) {
    const canBecomeConcert = type === null || type === 'official' || type === 'brand'
    for (const [rule, pattern, nextType, nextSubType] of CATEGORY_RULES) {
      if (!pattern.test(title)) continue
      if ((rule === 'concert' || rule === 'fanmeet') && !canBecomeConcert) break
      return { type: nextType ?? type ?? 'official', subType: nextSubType, rule }
    }
  }
  return { type, subType, rule: null }
}

export function normalizeCrawledEvent({
  rawTitle, sourceName, venueName, locationText, city, type, subType,
}: Omit<CityEvidence & CategoryEvidence, 'title'> & {
  rawTitle: string; sourceName?: string | null; city?: string | null
}) {
  const title = cleanCrawledTitle(rawTitle, { sourceName })
  const inferredCity = city?.trim() ? null : inferTaiwanCity({ title, venueName, locationText })
  const category = refineEventCategory({ title, type, subType })
  const rules: string[] = []
  if (title !== rawTitle) rules.push('clean_title')
  if (inferredCity) rules.push('infer_city')
  if (category.rule) rules.push(category.rule)
  return { title, city: inferredCity ?? city ?? null, type: category.type, subType: category.subType, rules }
}

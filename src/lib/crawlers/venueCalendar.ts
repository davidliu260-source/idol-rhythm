import * as cheerio from 'cheerio'
import { toDateKey } from '../taipeiDate'
import { toDetectedLocation } from './candidateLocation'
import { computeContentHash } from './contentHash'
import type { CrawlerSourceRow } from './crawlerSource'
import { buildIdolMatchIndex, matchIdolFromTitle, normalizeName, type IdolForMatching } from './idolMatcher'
import { computeSourceHash } from './sourceHash'

export const KAOARENA_LIST_URL = 'https://www.kaoarena.com.tw/Home/CalendarList'
export const KAOARENA_SOURCE_KEY = 'kaoarena-venue-calendar'
const venue = '高雄巨蛋'
const address = '高雄市左營區博愛二路757號'

interface CalendarEntry {
  detailId: string
  sourceUrl: string
  pageUrl: string
  title: string
  category: string
  dateStart: string
  dateEnd: string
}

const clean = (text: string) => text.replace(/\s+/g, ' ').trim()
const dateKey = (year: string, month: string, day: string) =>
  toDateKey(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`)

function dateRange(text: string) {
  const keys = Array.from(text.matchAll(/(20\d{2})\/(\d{1,2})\/(\d{1,2})/g))
    .map(([, y, m, d]) => dateKey(y, m, d))
  const [dateStart, dateEnd = dateStart] = keys
  return dateStart && dateEnd && dateEnd >= dateStart ? { dateStart, dateEnd } : null
}

export function parseVenueCalendarList(html: string, pageUrl: string) {
  const $ = cheerio.load(html)
  const entries: CalendarEntry[] = []
  const cards = $('main section.activity a[href^="/Home/CalendarDetail?"]')
  cards.each((_, card) => {
    const link = new URL($(card).attr('href')!, KAOARENA_LIST_URL)
    const detailId = link.searchParams.get('id')
    const title = $(card).find('.card-title').text().trim()
    const category = clean($(card).find('.category').text())
    const dates = dateRange($(card).find('.card-text').text())
    if (!detailId || !/^\d+$/.test(detailId) || !title || !dates) return
    const sourceUrl = new URL(`/Home/CalendarDetail?id=${detailId}`, KAOARENA_LIST_URL).href
    entries.push({ detailId, sourceUrl, pageUrl, title, category, ...dates })
  })
  return { fetched: cards.length, entries }
}

export interface VenueIdol extends IdolForMatching {
  slug: string
}

const superJuniorAliases = [
  'Super Junior-D&E', 'Super Junior D&E', 'Super Junior-K.R.Y.', 'Super Junior K.R.Y.',
  'Super Junior-M', 'Super Junior M', 'Super Junior-L.S.S.', 'Super Junior-Happy',
  'Super Junior-T', 'Yesung', '藝聲', '예성', 'Ryeowook', '厲旭', '려욱',
  'Kyuhyun', '圭賢', '규현', 'Sungmin', '晟敏', '成敏', '성민',
  'Leeteuk', '利特', 'Heechul', '希澈', 'Shindong', '神童', 'Eunhyuk', '銀赫',
  'Donghae', '東海', 'Siwon', '始源', 'Kangin', '強仁', 'Kibum', '起範',
]

export function selectVenueEntries(entries: CalendarEntry[], idols: VenueIdol[], today: string) {
  // Prefer the unit's own roster row over aliases on the parent NCT row.
  const unitNames = new Set(idols.filter((idol) => idol.slug.startsWith('nct-'))
    .flatMap((idol) => [idol.name, ...(idol.alt_names ?? [])]).map(normalizeName))
  const index = buildIdolMatchIndex(idols.map((idol) => idol.slug === 'nct' ? {
    ...idol,
    alt_names: (idol.alt_names ?? []).filter((alias) => !unitNames.has(normalizeName(alias))),
  } : idol))
  const superJunior = idols.find((idol) => idol.slug === 'super-junior')
  const aliases = buildIdolMatchIndex(superJunior ? [{
    ...superJunior, alt_names: superJuniorAliases,
  }] : [])
  const eligible: { entry: CalendarEntry; idol: IdolForMatching }[] = []
  const counts = { matched: 0, skipped_past: 0, skipped_unmatched: 0, skipped_category: 0 }
  for (const entry of Array.from(new Map(entries.map((entry) => [entry.detailId, entry])).values())) {
    const title = entry.title.replace(
      /^(?:20\d{2}\b[\s:：–—-]*|\[[^\]]+\]\s*|\([^)]*\)\s*|【[^】]+】\s*|（[^）]+）\s*)+/,
      '',
    )
    const match = matchIdolFromTitle(title, aliases) ?? matchIdolFromTitle(title, index) ??
      matchIdolFromTitle(entry.title, aliases) ?? matchIdolFromTitle(entry.title, index)
    if (match) counts.matched++
    if (entry.dateStart < today) counts.skipped_past++
    else if (!match) counts.skipped_unmatched++
    else if (!['藝文表演', '演唱會'].includes(entry.category)) counts.skipped_category++
    else eligible.push({ entry, idol: match.idol })
  }
  return { ...counts, eligible }
}

function clockTime(text: string) {
  const match = /^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(AM|PM)?$/i.exec(text.trim())
  if (!match) return null
  const [, hours, minutes = '00', seconds = '00', period] = match
  let hour = Number(hours)
  if (hour > 23 || Number(minutes) > 59 || Number(seconds) > 59) return null
  if (period) {
    if (hour < 1 || hour > 12) return null
    hour = hour % 12 + (period.toUpperCase() === 'PM' ? 12 : 0)
  }
  return `${String(hour).padStart(2, '0')}:${minutes}:${seconds}`
}

function parseSaleLine(line: string) {
  const match = /^(.*?)[:：]\s*(20\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日\s*(?:[（(][^）)]*[）)])?\s*(.+)$/.exec(line)
  if (!match) return null
  const [, label, year, month, day, timeRange] = match
  const date = dateKey(year, month, day)
  const [first, last, extra] = timeRange.split(/\s*[-–—~～]\s*/)
  const starts = clockTime(first)
  const ends = last ? clockTime(last) : null
  if (!label.trim() || !date || !starts || extra || (last && (!ends || ends < starts))) return null
  return {
    label: label.trim(),
    starts_at: `${date}T${starts}+08:00`,
    ends_at: ends ? `${date}T${ends}+08:00` : null,
  }
}

export function venueCandidateFromDetail(
  html: string,
  entry: CalendarEntry,
  idolId: string,
  source: Pick<CrawlerSourceRow, 'id' | 'source_key' | 'name' | 'parser_type'>,
) {
  const $ = cheerio.load(html)
  const detail = $('main.calendar_detail')
  const title = detail.find('h1').first().text().trim()
  const dates = dateRange(detail.find('.activity_date span').first().text())
  if (!title || !dates) throw new Error(`無法解析活動詳情：${entry.sourceUrl}`)

  const content = detail.find('.activity_content')
  content.find('br').replaceWith('\n')
  const lines = content.children().toArray().flatMap((el) => $(el).text().split('\n'))
    .map(clean).filter(Boolean)
  const field = (label: string) => {
    const pattern = new RegExp(`^(?:🫧\\s*)?(?:${label})\\s*[｜|：:]\\s*`)
    const line = lines.find((line) => pattern.test(line))
    return line?.replace(pattern, '') || undefined
  }
  const saleIndex = lines.findIndex((line) => /開賣時間\s*[｜|：:]/.test(line))
  const nextField = lines.findIndex((line, i) => i > saleIndex &&
    /^(?:🫧\s*|(?:票價|主辦單位|購票網站|活動地點|活動時間)\s*[｜|：:])/.test(line))
  const saleLines = saleIndex < 0 ? [] : [
    field('開賣時間') ?? '',
    ...lines.slice(saleIndex + 1, nextField < 0 ? undefined : nextField),
  ].filter(Boolean)
  const sales = saleLines.map(parseSaleLine)
  const venueText = field('活動地點')
  const specificVenue = venueText?.replace(/\s*KAOHSIUNG ARENA\b/i, '')
    .replace(/[（(][^）)]*[）)]\s*$/, '').trim()
  const ticketHref = content.find('a[href^="https://"], a[href^="http://"]').toArray()
    .find((el) => /購票網站|購票連結/.test($(el).parent().text()))
  const showText = field('活動時間|開演時間')
  const showClock = showText?.match(/\b\d{1,2}(?::\d{2})?\s*(?:AM|PM)\b|\b\d{1,2}:\d{2}\b/i)?.[0]
  const showTime = showClock ? clockTime(showClock)?.slice(0, 5) : undefined

  const raw_data = {
    source: 'venue-calendar',
    venue_key: 'kaoarena',
    crawler_source_id: source.id,
    source_key: source.source_key,
    parser_type: source.parser_type,
    parser_version: 1,
    detail_id: entry.detailId,
    page_url: entry.pageUrl,
    category: entry.category,
    date_start: dates.dateStart,
    date_end: dates.dateEnd,
    show_time: showTime,
    on_sale: saleLines.length > 0 && sales.every(Boolean) ? sales : undefined,
    on_sale_text: sales.some((sale) => !sale) ? saleLines.join('\n') : undefined,
    ticket_url: ticketHref ? $(ticketHref).attr('href') : undefined,
    organizer: field('主辦單位'),
    price_text: field('票價'),
  }
  const location = toDetectedLocation({ city: '高雄', venueName: specificVenue || venue, address })
  const raw_content = [
    `Dates: ${dates.dateStart} ~ ${dates.dateEnd}`,
    `Category: ${entry.category}`,
    `Venue: ${location.detected_venue_name}`,
    `Address: ${address}`,
    ...lines,
    raw_data.ticket_url ? `Ticket URL: ${raw_data.ticket_url}` : '',
  ].filter(Boolean).join('\n')
  return {
    ...location,
    raw_title: title,
    raw_content,
    raw_data,
    detected_idol_id: idolId,
    detected_date: dates.dateStart,
    detected_event_type: 'concert' as const,
    source_url: entry.sourceUrl,
    source_name: source.name,
    source_type: 'official_website' as const,
    source_hash: computeSourceHash({ sourceUrl: entry.sourceUrl })!,
    content_hash: computeContentHash({
      rawTitle: title, rawContent: raw_content, detectedDate: dates.dateStart,
      detectedEventType: 'concert', detectedIdolId: idolId, sourceUrl: entry.sourceUrl,
      sourceName: source.name, sourceType: 'official_website',
    }),
  }
}

export function isKaoarenaLocation(...values: (string | null)[]) {
  return values.some((value) => {
    const normalized = (value ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, '')
    return normalized.includes('高雄巨蛋') || normalized.includes('kaohsiungarena') ||
      normalized.includes('博愛二路757號') || normalized.includes('博愛2路757號')
  })
}

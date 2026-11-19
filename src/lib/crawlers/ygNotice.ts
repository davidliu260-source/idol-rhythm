import * as cheerio from 'cheerio'
import { toDetectedLocation } from './candidateLocation'
import { computeContentHash } from './contentHash'
import type { CrawlerSourceRow } from './crawlerSource'
import { matchIdolFromTitle, type IdolMatchIndex } from './idolMatcher'
import { computeSourceHash } from './sourceHash'

export const YG_NOTICE_URL = 'https://ygfamily.com/ko/news/notice'
export const YG_NOTICE_SOURCE_KEY = 'generic-yg-notice'
export const YG_NOTICE_ROSTER = ['bigbang', 'g-dragon', 'taeyang', 'daesung']

interface NoticeEntry {
  id: string
  title: string
  category: string
  postedDate: string | null
  href: string
}

const clean = (text: string) => text.replace(/\s+/g, ' ').trim()

function isoDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day ? date.toISOString().slice(0, 10) : null
}

function postedDate(text: string) {
  const match = /^(\d{4})[.-](\d{1,2})[.-](\d{1,2})$/.exec(text.trim())
  return match ? isoDate(+match[1], +match[2], +match[3]) : null
}

export function parseYgNoticeList(html: string) {
  const $ = cheerio.load(html)
  if (!$('.notice_list ul.ly_flex').length) throw new Error('無法解析 YG 公告列表')
  const entries: NoticeEntry[] = []
  $('.notice_list ul.ly_flex > li > a').each((_, link) => {
    const item = $(link)
    const href = item.attr('href') ?? ''
    const id = /^\/ko\/news\/notice\/(\d+)\/?$/.exec(href)?.[1]
    const title = clean(item.find('p').text())
    if (id && title) entries.push({
      id, title, href,
      category: clean(item.find('.cate').text()),
      postedDate: postedDate(item.find('.date').text()),
    })
  })
  const page = (selector: string) => Number($(selector).first().text()) || null
  const nextHref = $('#post-pagination a.next').attr('href')
  const nextPage = nextHref && /^\/ko\/news\/notice\?/.test(nextHref)
    ? Number(new URL(nextHref, YG_NOTICE_URL).searchParams.get('page')) || null : null
  return { entries, currentPage: page('#post-pagination .current') ?? 1, nextPage }
}

export function matchYgNotice(title: string, index: IdolMatchIndex) {
  const withoutPrefix = title.replace(/^(?:\s*\[[^\]]+\]\s*|\s*20\d{2}(?:\s*[-–]\s*(?:20)?\d{2})?\s+)+/, '')
  return matchIdolFromTitle(withoutPrefix, index)
}

const months = 'January February March April May June July August September October November December'.split(' ')
const monthPattern = months.join('|')
const clockPattern = /\b(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(AM|PM)\b|\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/gi

function clocks(text: string) {
  return Array.from(text.matchAll(clockPattern)).flatMap((match) => {
    const [, hour, minute, second, meridiem, hour24, minute24, second24] = match
    const h = Number(hour ?? hour24)
    const m = Number(minute ?? minute24 ?? 0)
    const s = Number(second ?? second24 ?? 0)
    if (m >= 60 || s >= 60 || (meridiem ? h < 1 || h > 12 : h >= 24)) return []
    return [[meridiem ? h % 12 + (meridiem.toUpperCase() === 'PM' ? 12 : 0) : h, m, s]
      .map((part) => String(part).padStart(2, '0')).join(':')]
  })
}

function dateTokens(text: string) {
  const korean = Array.from(text.matchAll(/(?:(20\d{2})\s*년\s*)?(\d{1,2})\s*월\s*(\d{1,2})\s*일/g))
  const numeric = Array.from(text.matchAll(/\b(?:(20\d{2})[./-](\d{1,2})[./-](\d{1,2})|(\d{1,2})\/(\d{1,2}))\b/g))
  const lastNumeric = numeric[numeric.length - 1]
  const suffixYear = lastNumeric &&
    /^,?\s+(20\d{2})\b/.exec(text.slice(lastNumeric.index! + lastNumeric[0].length))?.[1]
  const year = (korean.find((match) => match[1]) ?? numeric.find((match) => match[1]))?.[1] ?? suffixYear
  if (year) {
    let currentYear = +year
    return (korean.length ? korean : numeric).flatMap((match) => {
      if (match[1]) currentYear = +match[1]
      const date = isoDate(currentYear, Number(match[2] ?? match[4]), Number(match[3] ?? match[5]))
      return date ? [{ date, index: match.index!, end: match.index! + match[0].length }] : []
    })
  }

  const english = new RegExp(`\\b(${monthPattern})\\s+(\\d{1,2})(?:\\s*(&|and|~|[-–])\\s*(\\d{1,2}))?[,]?\\s+(20\\d{2})\\b`, 'gi')
  return Array.from(text.matchAll(english)).flatMap((match) => {
    const month = months.findIndex((name) => name.toLowerCase() === match[1].toLowerCase()) + 1
    return [match[2], match[4]].flatMap((day, index) => {
      const date = day && isoDate(+match[5], month, +day)
      const start = match.index! + (index ? match[0].lastIndexOf(day) : 0)
      return date ? [{ date, index: start, end: index ? match.index! + match[0].length : start + match[1].length + 1 + day.length }] : []
    })
  })
}

function performanceDates(text: string) {
  const tokens = dateTokens(text)
  return tokens.flatMap((token, index) => {
    const next = tokens[index + 1]
    const separator = next && text.slice(token.end, next.index).replace(/\([^)]*\)/g, '').trim()
    if (!next || !/^(?:~|[-–—]|to)$/i.test(separator)) return [token.date]
    const start = Date.parse(token.date)
    const days = (Date.parse(next.date) - start) / 86_400_000
    return days > 0 && days <= 31
      ? Array.from({ length: days }, (_, day) => new Date(start + day * 86_400_000).toISOString().slice(0, 10))
      : [token.date]
  })
}

const bullet = /^[\s·•*-]+/
const dateLabel = /^(?:공연\s*일시|Performance Dates?)\s*[:：]\s*/i
const otherDateLabel = /^(?:공연\s*(?:날짜|일정)|행사\s*(?:일시|날짜)|(?:Concert|Event|Show) Dates?)\s*[:：]\s*/i
const saleLabel = /^(?:\[?\s*(?:BIGBANG V\.I\.P MEMBERSHIP\s+)?(?:선\s*예매(?:\s*(?:일정\s*안내|오픈\s*일시|기간))?|일반\s*예매(?:\s*오픈\s*일시)?|(?:Membership )?Presale(?: Date and Time)?|General (?:Ticket Reservation Date and Time|Sale))\s*\]?)(?:\s*[:：]\s*|$)/i

function parseSales(lines: string[]) {
  const saleLines = lines.flatMap((line, index) => {
    const label = saleLabel.exec(line)
    if (!label) return []
    const inline = line.slice(label[0].length)
    const value = inline || lines[index + 1] || ''
    return [{ label: label[0].replace(/[\[\]:：]/g, '').trim(), value }]
  })
  // Prefer the Korean section when the same schedule is repeated in English.
  const korean = saleLines.filter(({ label }) => /예매/.test(label))
  const sales = korean.length ? korean : saleLines
  const on_sale = []
  const unparsed = []
  for (const { label, value } of sales) {
    const dates = dateTokens(value)
    const times = clocks(value)
    if (dates.length && times.length && (dates.length === 1 || times.length >= dates.length)) {
      // The notices give local venue time. Preserve the clock without assuming a UTC offset.
      on_sale.push({
        label,
        starts_at: `${dates[0].date}T${times[0]}`,
        ends_at: times[1] ? `${dates[1]?.date ?? dates[0].date}T${times[1]}` : null,
      })
    } else {
      unparsed.push(`${label}: ${value}`)
    }
  }
  return { ...(on_sale.length ? { on_sale } : {}), on_sale_text: unparsed.join('\n') || (on_sale.length ? undefined : null) }
}

export function parseYgNoticeDetail(html: string, entry: NoticeEntry) {
  const $ = cheerio.load(html)
  const body = $('.view_body .ql-editor').first()
  if (!body.length) throw new Error(`無法解析 YG 公告詳情：${entry.id}`)
  body.find('a[href^="https://"], a[href^="http://"]').each((_, anchor) => {
    const link = $(anchor)
    const href = link.attr('href')!
    if (!link.text().includes(href)) link.text(`${link.text()} ${href}`)
  })
  body.find('br').replaceWith('\n')
  body.find('p, li, div').append('\n')
  const lines = body.text().split('\n').map((line) => clean(line).replace(bullet, '')).filter(Boolean)
  const headings = lines.flatMap((line, index) => {
    const primary = dateLabel.exec(line)
    const label = primary ?? otherDateLabel.exec(line)
    if (!label) return []
    const value = line.slice(label[0].length)
    return [{ index, value, dates: performanceDates(value), primary: !!primary, korean: !/^[A-Z]/i.test(line) }]
  })
  const first = headings.find(({ dates, primary }) => primary && dates.length) ??
    headings.find(({ dates }) => dates.length)
  // Use one language for the schedule and keep each date field paired with its own venue.
  const performances = headings.flatMap((heading, index) => {
    if (!first || heading.primary !== first.primary || heading.korean !== first.korean || !heading.dates.length) return []
    const fields = lines.slice(heading.index + 1, headings[index + 1]?.index)
    const field = (pattern: RegExp) => fields.find((line) => pattern.test(line))?.replace(pattern, '') || null
    return [{
      dates: Array.from(new Set(heading.dates)),
      city: field(/^(?:도시|City)\s*[:：]\s*/i),
      venue: field(/^(?:공연장|공연\s*장소|Venue)\s*[:：]\s*/i),
      address: field(/^(?:주소|Address)\s*[:：]\s*/i),
      showTimes: clocks(heading.value).map((time) => time.slice(0, 5)),
      ticketLinks: parseTicketLinks(fields),
    }]
  })
  return {
    performances,
    title: clean($('.view_tit h2').first().text()) || entry.title,
    postedDate: postedDate($('.view_tit .date').first().text()) ?? entry.postedDate,
    category: clean($('.view_tit .cate').first().text()) || entry.category,
    sales: parseSales(lines),
    content: lines.join('\n'),
  }
}

function parseTicketLinks(lines: string[]) {
  const ticketIndex = lines.findIndex((line) => /^(?:티켓\s*예매|Tickets?|Ticket Reservation)\s*[:：]/i.test(line))
  const ticketLines = ticketIndex < 0 ? [] : lines.slice(ticketIndex, ticketIndex + 1)
  for (let index = ticketIndex + 1; ticketIndex >= 0 && index < lines.length; index++) {
    if (!/^(?:\d{1,2}\s*월|https?:\/\/)/i.test(lines[index])) break
    ticketLines.push(lines[index])
  }
  return ticketLines.flatMap((line) => {
    const url = line.match(/https?:\/\/[^\s<>]+/i)?.[0]
    const day = /^(\d{1,2})\s*월\s*(\d{1,2})\s*일/.exec(line)
    return url ? [{ url, day: day ? day.slice(1).map((part) => part.padStart(2, '0')).join('-') : null }] : []
  })
}

export function ygNoticeCandidates(
  detail: ReturnType<typeof parseYgNoticeDetail>, entry: NoticeEntry, idolId: string,
  source: Pick<CrawlerSourceRow, 'id' | 'source_key' | 'name' | 'parser_type'>,
) {
  const pageUrl = `${YG_NOTICE_URL}/${entry.id}`
  const byDate = new Map<string, ReturnType<typeof buildCandidate>>()
  for (const performance of detail.performances) {
    performance.dates.forEach((date, index) => {
      if (!byDate.has(date)) byDate.set(date, buildCandidate(performance, date, index))
    })
  }
  return Array.from(byDate.values()).sort((a, b) => a.detected_date.localeCompare(b.detected_date))

  function buildCandidate(performance: typeof detail.performances[number], date: string, index: number) {
    const { city, venue, address, showTimes, ticketLinks } = performance
    const orderedDates = performance.dates.slice().sort()
    const sourceUrl = `${pageUrl}#${date}`
    const ticketUrl = ticketLinks.find(({ day }) => day === date.slice(5))?.url ??
      ticketLinks.find(({ day }) => !day)?.url ?? null
    const rawContent = [detail.content, ticketUrl ? `Ticket URL: ${ticketUrl}` : ''].filter(Boolean).join('\n')
    return {
      ...toDetectedLocation({ city, venueName: venue, address }),
      raw_title: detail.title,
      raw_content: rawContent,
      raw_data: {
        source: 'yg-notice', crawler_source_id: source.id, source_key: source.source_key,
        parser_type: source.parser_type, parser_version: 1, notice_id: entry.id, page_url: pageUrl,
        posted_date: detail.postedDate, category: detail.category,
        date_start: orderedDates[0], date_end: orderedDates[orderedDates.length - 1],
        show_time: (showTimes.length === orderedDates.length ? showTimes[index]
          : showTimes.length === 1 ? showTimes[0] : null) ?? null,
        ticket_url: ticketUrl, city, venue, address, ...detail.sales,
      },
      detected_idol_id: idolId,
      detected_date: date,
      detected_event_type: 'concert' as const,
      source_url: sourceUrl,
      source_name: source.name,
      source_type: 'official_website' as const,
      source_hash: computeSourceHash({ sourceUrl })!,
      content_hash: computeContentHash({
        rawTitle: detail.title, rawContent, detectedDate: date, detectedEventType: 'concert',
        detectedIdolId: idolId, sourceUrl, sourceName: source.name, sourceType: 'official_website',
      }),
    }
  }
}

export function isYgConcertNotice(title: string) {
  return !/에티켓|\betiquette\b/i.test(title) &&
    /공연|콘서트|티켓|\b(?:concert|tickets?|tour|show)\b/i.test(title)
}

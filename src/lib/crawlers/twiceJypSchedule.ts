/**
 * TWICE official JYP Schedule parser.
 *
 * Source: registered in crawler_sources where source_key =
 *         'twice-jyp-schedule'. URL comes from crawler_sources.source_url
 *         (typically https://twice.jype.com/Mobile/Schedule).
 *
 * The JYP Mobile Schedule page is a public, login-free static-ish page that
 * lists upcoming activities as <li> items with a date marker, a one-letter
 * category code, and a title (sometimes plus a venue / link).
 *
 * Because the page markup is not under our control and JYP redesigns
 * occasionally, the parser is intentionally defensive:
 *   - Tries several plausible container selectors (ul.schedule_list,
 *     ul.list_schedule, .schedule_box, …) in order.
 *   - Only emits an entry when it has BOTH a non-empty title AND a
 *     non-empty raw date text. Anything else is skipped silently.
 *   - When nothing matches, returns [] — the fetcher will report an
 *     "頁面結構可能已變更" error rather than synthesize fake entries.
 *   - Category mapping is conservative; ambiguous codes return null and
 *     leave detected_event_type unset for admin to classify.
 *
 * No browser automation. No new dependency — reuses cheerio.
 */

import { createHash } from 'node:crypto'
import * as cheerio from 'cheerio'
import { computeSourceHash } from './sourceHash'
import type { SourceTypeEnum } from './crawlerSource'

export const TWICE_PARSER_VERSION = 1

export interface ParsedTwiceEntry {
  /** Display title for the candidate row, never empty. */
  title: string
  /** Raw date text as it appeared on the page (preserved for admin). */
  rawDateText: string
  /** YYYY-MM-DD if safely parseable, else null. */
  detectedDate: string | null
  /** Raw category text (e.g. 'S', 'E', 'SHOW', '이벤트'). May be empty. */
  rawTypeText: string
  /** Per-entry URL: link if the row had one, else synthesized from pageUrl. */
  sourceUrl: string
  /** True when sourceUrl came from a real <a href>, not synthesized. */
  hasOwnUrl: boolean
}

/**
 * Parse the TWICE JYP Mobile Schedule page HTML.
 *
 * @param html      Raw HTML fetched from `pageUrl`.
 * @param pageUrl   The URL used to fetch, used to synthesize stable per-row
 *                  URLs when an item has no own link.
 */
export function parseTwiceScheduleHtml(
  html: string,
  pageUrl: string,
): ParsedTwiceEntry[] {
  const $ = cheerio.load(html)

  // Try selectors in order of specificity. Stop at the first that yields
  // any items so we don't double-count when JYP nests structures.
  const containerSelectors = [
    'ul.schedule_list > li',
    'ul.list_schedule > li',
    'div.schedule_box li',
    'div.schedule li',
    'ul.scheduleList > li',
    'div.scheduleList .item',
  ]

  let matchedSelector: string | null = null
  for (const sel of containerSelectors) {
    if ($(sel).length > 0) {
      matchedSelector = sel
      break
    }
  }

  if (!matchedSelector) return []

  const entries: ParsedTwiceEntry[] = []
  const seenKeys = new Set<string>()

  $(matchedSelector).each((_, el) => {
    const $el = $(el)

    const rawDateText = pickText($el, [
      '.date',
      '.day',
      'time',
      '[class*="date"]',
      '[class*="Date"]',
    ])
    const title = pickText($el, [
      '.title',
      '.subject',
      '.name',
      '.tit',
      '[class*="title"]',
      '[class*="Title"]',
    ])
    const rawTypeText = pickText($el, [
      '.type',
      '.cate',
      '.category',
      '.icon',
      '[class*="type"]',
      '[class*="cate"]',
    ])
    const ownHref = $el.find('a[href]').first().attr('href')?.trim() || null

    if (!title || !rawDateText) return

    const resolvedHref = ownHref ? resolveUrl(ownHref, pageUrl) : null
    // Fingerprint preserves uniqueness for CJK/Hangul titles whose
    // ASCII slug would otherwise collide.
    const fingerprint = shortHash(`${rawDateText}|${title}|${rawTypeText}`)
    const slug = slugify(`${rawDateText}-${title}`)
    const synthesized = `${pageUrl}#${slug}-${fingerprint}`
    const sourceUrl = resolvedHref ?? synthesized

    // Dedup within a single parse run by stable key.
    if (seenKeys.has(sourceUrl)) return
    seenKeys.add(sourceUrl)

    entries.push({
      title,
      rawDateText,
      detectedDate: extractFirstIsoDate(rawDateText),
      rawTypeText,
      sourceUrl,
      hasOwnUrl: resolvedHref !== null,
    })
  })

  return entries
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickText($el: any, selectors: string[]): string {
  for (const sel of selectors) {
    const t = $el.find(sel).first().text().trim()
    if (t) return t
  }
  return ''
}

function resolveUrl(href: string, pageUrl: string): string | null {
  try {
    return new URL(href, pageUrl).toString()
  } catch {
    return null
  }
}

function slugify(s: string): string {
  // ASCII-only slug (build target doesn't support \p{…} regex flags).
  // Empty / all-non-ASCII inputs degrade to 'item' — the caller pairs
  // this with shortHash() to keep the final URL unique.
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'item'
  )
}

function shortHash(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex').slice(0, 8)
}

/**
 * Extract first calendar date from JYP-style text, e.g.
 *   "2025.06.15", "2025-06-15", "2025. 06. 15", "2025년 6월 15일".
 * Returns YYYY-MM-DD or null.
 */
export function extractFirstIsoDate(text: string): string | null {
  // Numeric pattern first.
  const numeric = text.match(/(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/)
  if (numeric) {
    const iso = makeIsoDate(numeric[1], numeric[2], numeric[3])
    if (iso) return iso
  }
  return null
}

function makeIsoDate(y: string, mo: string, d: string): string | null {
  const yi = Number(y)
  const moi = Number(mo)
  const di = Number(d)
  if (!Number.isFinite(yi) || !Number.isFinite(moi) || !Number.isFinite(di)) return null
  if (moi < 1 || moi > 12 || di < 1 || di > 31) return null
  const dt = new Date(Date.UTC(yi, moi - 1, di))
  if (
    dt.getUTCFullYear() !== yi ||
    dt.getUTCMonth() !== moi - 1 ||
    dt.getUTCDate() !== di
  ) {
    return null
  }
  return `${yi}-${String(moi).padStart(2, '0')}-${String(di).padStart(2, '0')}`
}

/**
 * Conservative mapping from JYP category text to event_type enum.
 * Returns null when the code is ambiguous — admin will classify.
 */
export type EventTypeEnum =
  | 'concert'
  | 'ticketing'
  | 'livestream'
  | 'streaming'
  | 'media'
  | 'brand'
  | 'official'

export function mapCategoryToEventType(raw: string): EventTypeEnum | null {
  const t = raw.trim().toUpperCase()
  if (!t) return null
  // Single-letter codes used by JYP schedule.
  if (t === 'S' || t.startsWith('SHOW')) return 'media'
  if (t === 'E' || t.startsWith('EVENT')) return 'official'
  if (t === 'R' || t.startsWith('RELEASE')) return 'official'
  if (t === 'T' || t.startsWith('ETC') || t === 'TV') return 'official'
  return null
}

/**
 * Source context resolved from crawler_sources, passed through to payload
 * builder so the fetcher owns the mapping in one place.
 */
export interface TwiceSourceContext {
  crawlerSourceId: string
  sourceKey: string
  sourceName: string
  sourceType: SourceTypeEnum
  parserType: string
  pageUrl: string
  idolId: string | null
}

export interface TwiceCandidatePayload {
  raw_title: string
  raw_content: string
  detected_idol_id: string | null
  detected_event_type: EventTypeEnum | null
  detected_date: string | null
  source_url: string
  source_name: string
  source_type: SourceTypeEnum
  ai_confidence: null
  reviewer_note: string
  source_hash: string
  raw_data: {
    source: 'twice-jyp-schedule'
    crawler_source_id: string
    source_key: string
    parser_type: string
    parser_version: number
    title: string
    original_date_text: string
    original_type_text: string
    page_url: string
    own_url: boolean
  }
}

export function entryToCandidatePayload(
  entry: ParsedTwiceEntry,
  source: TwiceSourceContext,
): TwiceCandidatePayload {
  const raw_title = `TWICE 官方行程 - ${entry.title}`

  const lines: string[] = [
    `Title: ${entry.title}`,
    `Date (raw): ${entry.rawDateText}`,
    entry.rawTypeText ? `Category: ${entry.rawTypeText}` : null,
    `Source: ${source.pageUrl}`,
  ].filter((x): x is string => x !== null)

  // entry.sourceUrl is always present (own link or synthesized), so the URL
  // branch of computeSourceHash fires and the return is guaranteed non-null.
  const source_hash = computeSourceHash({ sourceUrl: entry.sourceUrl })!

  return {
    raw_title,
    raw_content: lines.join('\n'),
    detected_idol_id: source.idolId,
    detected_event_type: mapCategoryToEventType(entry.rawTypeText),
    detected_date: entry.detectedDate,
    source_url: entry.sourceUrl,
    source_name: source.sourceName,
    source_type: source.sourceType,
    ai_confidence: null,
    reviewer_note: `auto-crawled from crawler source: ${source.sourceName}`,
    source_hash,
    raw_data: {
      source: 'twice-jyp-schedule',
      crawler_source_id: source.crawlerSourceId,
      source_key: source.sourceKey,
      parser_type: source.parserType,
      parser_version: TWICE_PARSER_VERSION,
      title: entry.title,
      original_date_text: entry.rawDateText,
      original_type_text: entry.rawTypeText,
      page_url: source.pageUrl,
      own_url: entry.hasOwnUrl,
    },
  }
}

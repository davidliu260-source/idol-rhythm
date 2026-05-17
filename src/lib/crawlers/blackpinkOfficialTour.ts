/**
 * BLACKPINK official tour page parser.
 *
 * Source: registered in crawler_sources where source_key =
 *         'blackpink-official-tour'. As of J6b, the URL is read from
 *         crawler_sources.source_url and passed in — no longer hard-coded
 *         in this module.
 *
 * The page is a static HTML document with a highly regular structure:
 *
 *   <div id="<cityslug>" class="<cityslug> info buy">
 *     <div class="nation">
 *       <p class="city">GOYANG</p>
 *       <p class="place">GOYANG STADIUM</p>
 *     </div>
 *     <div class="more">
 *       <a href="https://weverse.io/blackpink/notice/26203" class="btn-info">
 *         <span>+MORE INFO</span>
 *       </a>
 *     </div>
 *     <div class="date">
 *       <p class="date1">2025. 07. 05. SAT 8PM / 2025. 07. 06. SUN 7PM</p>
 *     </div>
 *     <div class="ticket"> ... </div>
 *   </div>
 *
 * Parsing is intentionally conservative:
 *   - Skip a row if either city name or date raw text is missing.
 *   - "more info" hrefs are NOT used as source_url because multiple cities
 *     share the same Weverse notice URL — that breaks dedup. Instead we
 *     synthesize a per-row source_url from the page URL + #cityslug, which
 *     is stable across runs and unique per row.
 *   - Date parsing extracts the FIRST `YYYY. MM. DD` token only; if it
 *     can't be parsed, detected_date stays null and raw text is kept in
 *     raw_content for the admin to read.
 */

import * as cheerio from 'cheerio'
import { computeSourceHash } from './sourceHash'

/** Bump when the parser output shape changes meaningfully. */
export const BLACKPINK_PARSER_VERSION = 2

export interface ParsedTourEntry {
  cityId: string // div id (e.g. 'goyang') — used for #fragment
  city: string // 'GOYANG'
  place: string | null // 'GOYANG STADIUM'
  moreInfoUrl: string | null // weverse notice link, informational only
  rawDateText: string | null // '2025. 07. 05. SAT 8PM / 2025. 07. 06. SUN 7PM'
  /** First parsed calendar date in YYYY-MM-DD, or null if not parseable. */
  detectedDate: string | null
  /** Synthesized stable URL: pageUrl + '#' + cityId. */
  sourceUrl: string
}

/**
 * Parse the BLACKPINK tour page HTML into structured entries.
 * `pageUrl` is the URL used to fetch the HTML (from crawler_sources.source_url)
 * and is used to synthesize a stable per-row source URL.
 */
export function parseBlackpinkTourHtml(
  html: string,
  pageUrl: string,
): ParsedTourEntry[] {
  const $ = cheerio.load(html)
  const entries: ParsedTourEntry[] = []

  // Each schedule row has class="info buy" plus the city slug class.
  $('#info > div.info').each((_, el) => {
    const $el = $(el)

    const cityId = ($el.attr('id') ?? '').trim()
    const city = $el.find('p.city').first().text().trim()
    const place = $el.find('p.place').first().text().trim() || null
    const rawDateText =
      $el.find('p.date1').first().text().trim() || null
    const moreInfoUrl =
      $el.find('div.more a').first().attr('href')?.trim() || null

    // Skip rows missing essentials.
    if (!cityId || !city) return
    if (!rawDateText) return

    entries.push({
      cityId,
      city,
      place,
      moreInfoUrl,
      rawDateText,
      detectedDate: extractFirstIsoDate(rawDateText),
      sourceUrl: `${pageUrl}#${cityId}`,
    })
  })

  return entries
}

/**
 * Extracts the first calendar date from strings like:
 *   "2025. 07. 05. SAT 8PM / 2025. 07. 06. SUN 7PM"
 *   "2025.08.06 WED 8PM"
 * Returns YYYY-MM-DD or null.
 */
export function extractFirstIsoDate(text: string): string | null {
  const m = text.match(/(\d{4})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})/)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  // Cross-check via Date roundtrip (catches e.g. 2025-02-30).
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== mo - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null
  }
  return `${m[1]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * Source context resolved from crawler_sources, passed through to the payload
 * builder so the fetcher controls the mapping in one place.
 */
export interface BlackpinkSourceContext {
  crawlerSourceId: string
  sourceKey: string
  sourceName: string
  sourceType:
    | 'official_sns'
    | 'official_website'
    | 'media_outlet'
    | 'fan_account'
    | 'community'
    | 'unknown'
  parserType: string
  pageUrl: string
  idolId: string | null
}

export interface BlackpinkCandidatePayload {
  raw_title: string
  raw_content: string
  detected_idol_id: string | null
  detected_event_type: 'concert'
  detected_date: string | null
  source_url: string
  source_name: string
  source_type: BlackpinkSourceContext['sourceType']
  ai_confidence: null
  reviewer_note: string
  /** SHA-256 hex; required field for J4 dedupe. */
  source_hash: string
  /** Structured parsed payload, kept for future J3 / J6 re-processing. */
  raw_data: {
    source: 'blackpink-official-tour'
    crawler_source_id: string
    source_key: string
    parser_type: string
    parser_version: number
    city: string
    city_id: string
    venue: string | null
    original_date_text: string | null
    more_info_url: string | null
    page_url: string
  }
}

export function entryToCandidatePayload(
  entry: ParsedTourEntry,
  source: BlackpinkSourceContext,
): BlackpinkCandidatePayload {
  const titleSuffix = entry.place ? ` @ ${entry.place}` : ''
  const raw_title = `BLACKPINK 2025 WORLD TOUR — ${entry.city}${titleSuffix}`

  const lines: string[] = [
    `City: ${entry.city}`,
    entry.place ? `Venue: ${entry.place}` : null,
    entry.rawDateText ? `Date (raw): ${entry.rawDateText}` : null,
    entry.moreInfoUrl ? `More info: ${entry.moreInfoUrl}` : null,
    `Source: ${source.pageUrl}`,
  ].filter((x): x is string => x !== null)

  // entry.sourceUrl is always present (page URL + #cityId), so the URL branch
  // of computeSourceHash will fire and the return is guaranteed non-null.
  const source_hash = computeSourceHash({ sourceUrl: entry.sourceUrl })!

  return {
    raw_title,
    raw_content: lines.join('\n'),
    detected_idol_id: source.idolId,
    detected_event_type: 'concert',
    detected_date: entry.detectedDate,
    source_url: entry.sourceUrl,
    source_name: source.sourceName,
    source_type: source.sourceType,
    ai_confidence: null,
    reviewer_note: `auto-crawled from crawler source: ${source.sourceName}`,
    source_hash,
    raw_data: {
      source: 'blackpink-official-tour',
      crawler_source_id: source.crawlerSourceId,
      source_key: source.sourceKey,
      parser_type: source.parserType,
      parser_version: BLACKPINK_PARSER_VERSION,
      city: entry.city,
      city_id: entry.cityId,
      venue: entry.place,
      original_date_text: entry.rawDateText,
      more_info_url: entry.moreInfoUrl,
      page_url: source.pageUrl,
    },
  }
}

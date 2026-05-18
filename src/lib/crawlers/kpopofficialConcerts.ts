/**
 * kpopofficial.com aggregator parser (M1a-B).
 *
 * Source: kpopofficial.com/kpop-concerts/ — a WordPress page that lists
 * every upcoming K-pop concert across many artists in <li class="...
 * type-event"> cards rendered by the GreenShift Gutenberg blocks plugin.
 *
 * Sample card markup (abridged):
 *
 *   <li class="gspbgrid_item swiper-slide  post-100150 type-event">
 *     <a class="gspbgrid_item_link" title="IVE – ..." href=".../event/.../"></a>
 *     <div class="...gspb-dynamic-post-image..."><img ...></div>
 *     <div class="...gsbp-...">
 *       <div class="gspb_meta"><span class="gspb_meta_value">May 23, 2026</span></div>
 *       <div class="...gspb-dynamic-post-title...">
 *         <h2><a href=".../event/.../">IVE – "SHOW WHAT I AM" World Tour 2026 – Macao</a></h2>
 *       </div>
 *       <div class="gspb_meta">
 *         <span class="gspb_meta_prefix_icon"><img src=".../icon-location-4kb.png" ...></span>
 *         <span class="gspb_meta_value">The Venetian Arena, Macao</span>
 *       </div>
 *       <div class="gspb_meta">
 *         <span class="gspb_meta_value">1,201</span>
 *         <span class="gspb_meta_postfix">Views</span>
 *       </div>
 *     </div>
 *   </li>
 *
 * Two meta blocks with class="gspb_meta" appear: the first carries the
 * date (no prefix icon), the second carries the venue (preceded by the
 * location pin icon). We pick them positionally rather than by id —
 * GreenShift ids (gspb_id-gsbp-*) are stable enough but the parser tier
 * stays robust against id churn by relying on order + presence of the
 * `gspb_meta_prefix_icon` marker for venue.
 *
 * Artist-name extraction lives in `idolMatcher.ts` (longest-prefix exact
 * match against idols.name + idols.alt_names). When no match is found the
 * fetcher skips the event entirely — aggregator results MUST attribute
 * to a known idol per the M1a ruling.
 *
 * Date strings on this site are free-text English with mixed formats
 * (e.g. "May 23, 2026" / "May 23, 24, 27, 28, 2026" / "March 13–14, 2027"
 * / "June 6 (SAT) – 7 (SUN), 2026"). We parse the first month/day token
 * we can find and pair it with the 4-digit year we can also find anywhere
 * in the string. Multi-day events therefore land on their FIRST calendar
 * date; admin can refine on approval.
 */

import * as cheerio from 'cheerio'
import { computeSourceHash } from './sourceHash'
import { computeContentHash } from './contentHash'
import type { SourceTypeEnum } from './crawlerSource'

/** Bump when the parser output shape changes meaningfully. */
export const KPOPOFFICIAL_PARSER_VERSION = 1

// ── Raw entry shape produced by the parser ──────────────────────────────────

export interface ParsedKpopOfficialEntry {
  /** Anchor title text, e.g. "IVE – "SHOW WHAT I AM" World Tour 2026 – Macao" */
  title: string
  /** Free-text date string from the date meta, e.g. "May 23, 2026" */
  rawDateText: string | null
  /** First parseable calendar date in YYYY-MM-DD, or null. */
  detectedDate: string | null
  /** Free-text venue/location from the location meta, may be null. */
  location: string | null
  /** Per-event permalink, used as the stable source_url. */
  sourceUrl: string
}

/** Parse the listing-page HTML into entries. `pageUrl` is informational. */
export function parseKpopofficialConcertsHtml(
  html: string,
  _pageUrl: string,
): ParsedKpopOfficialEntry[] {
  const $ = cheerio.load(html)
  const entries: ParsedKpopOfficialEntry[] = []
  const seenUrls = new Set<string>()

  $('li.type-event').each((_, el) => {
    const $el = $(el)

    // Title comes from the inner <h2> anchor; the wrapper <a> title attribute
    // is identical and serves as a fallback when the h2 ever changes shape.
    const titleNode = $el.find('.gspb-dynamic-post-title a').first()
    const title =
      titleNode.text().trim() ||
      $el.find('a.gspbgrid_item_link').first().attr('title')?.trim() ||
      ''

    const eventUrl =
      titleNode.attr('href')?.trim() ||
      $el.find('a.gspbgrid_item_link').first().attr('href')?.trim() ||
      ''

    if (!title || !eventUrl) return
    if (seenUrls.has(eventUrl)) return
    seenUrls.add(eventUrl)

    // Date = first .gspb_meta WITHOUT a prefix icon (icon distinguishes
    // location-pin meta blocks). Falls back to the very first meta block
    // if no unmarked one exists (defensive against markup tweaks).
    const metas = $el.find('.gspb_meta')
    let rawDateText: string | null = null
    let location: string | null = null
    metas.each((_i, m) => {
      const $m = $(m)
      const hasIcon = $m.find('.gspb_meta_prefix_icon').length > 0
      const hasViewsLabel =
        $m.find('.gspb_meta_postfix').text().trim().toLowerCase() === 'views'
      const value = $m.find('.gspb_meta_value').first().text().trim()
      if (!value) return
      if (hasViewsLabel) return
      if (hasIcon) {
        if (!location) location = value
      } else {
        if (!rawDateText) rawDateText = value
      }
    })

    entries.push({
      title,
      rawDateText,
      detectedDate: rawDateText ? extractFirstIsoDate(rawDateText) : null,
      location,
      sourceUrl: eventUrl,
    })
  })

  return entries
}

// ── Date parsing ────────────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9,
  sept: 9, oct: 10, nov: 11, dec: 12,
}

/**
 * Extract the first calendar date from a kpopofficial date string.
 *
 * Strategy:
 *   1. Find the FIRST `<MonthName> <Day>` token (Jan…December, full or short).
 *   2. Find the FIRST 4-digit year anywhere in the string.
 *   3. Combine + validate via UTC Date round-trip.
 *
 * Returns YYYY-MM-DD or null when either piece is missing / invalid.
 */
export function extractFirstIsoDate(text: string): string | null {
  const monthMatch = text.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec)\b[^\d]*(\d{1,2})\b/i,
  )
  if (!monthMatch) return null
  const month = MONTHS[monthMatch[1].toLowerCase()]
  const day = Number(monthMatch[2])
  if (!month || !Number.isFinite(day) || day < 1 || day > 31) return null

  const yearMatch = text.match(/\b(\d{4})\b/)
  if (!yearMatch) return null
  const year = Number(yearMatch[1])
  if (!Number.isFinite(year) || year < 1970 || year > 9999) return null

  const dt = new Date(Date.UTC(year, month - 1, day))
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// ── Payload builder ─────────────────────────────────────────────────────────

export interface KpopOfficialSourceContext {
  crawlerSourceId: string
  sourceKey: string
  sourceName: string
  sourceType: SourceTypeEnum
  parserType: string
  pageUrl: string
}

export interface KpopOfficialCandidatePayload {
  raw_title: string
  raw_content: string
  detected_idol_id: string
  detected_event_type: null
  detected_date: string | null
  source_url: string
  source_name: string
  source_type: SourceTypeEnum
  ai_confidence: null
  reviewer_note: string
  source_hash: string
  content_hash: string
  raw_data: {
    source: 'kpopofficial-concerts'
    crawler_source_id: string
    source_key: string
    parser_type: string
    parser_version: number
    title: string
    original_date_text: string | null
    location: string | null
    page_url: string
    matched_via: 'name' | 'alt_name'
    matched_idol_name: string
  }
}

export interface BuildPayloadInput {
  entry: ParsedKpopOfficialEntry
  source: KpopOfficialSourceContext
  matchedIdolId: string
  /** Display name of the matched idol — only used for raw_data debugging. */
  matchedIdolName: string
  matchedVia: 'name' | 'alt_name'
}

const AGGREGATOR_REVIEWER_NOTE =
  'third-party aggregator source — verify against official source before approval'

export function entryToCandidatePayload(
  input: BuildPayloadInput,
): KpopOfficialCandidatePayload {
  const { entry, source, matchedIdolId, matchedIdolName, matchedVia } = input

  const raw_title = entry.title

  const lines: string[] = [
    `Title: ${entry.title}`,
    entry.rawDateText ? `Date (raw): ${entry.rawDateText}` : null,
    entry.location ? `Location: ${entry.location}` : null,
    `Matched idol: ${matchedIdolName} (via ${matchedVia})`,
    `Source: ${entry.sourceUrl}`,
  ].filter((x): x is string => x !== null)
  const raw_content = lines.join('\n')

  const source_hash = computeSourceHash({ sourceUrl: entry.sourceUrl })!

  const content_hash = computeContentHash({
    rawTitle: raw_title,
    rawContent: raw_content,
    detectedDate: entry.detectedDate,
    detectedEventType: null,
    detectedIdolId: matchedIdolId,
    sourceUrl: entry.sourceUrl,
    sourceName: source.sourceName,
    sourceType: source.sourceType,
  })

  return {
    raw_title,
    raw_content,
    detected_idol_id: matchedIdolId,
    detected_event_type: null,
    detected_date: entry.detectedDate,
    source_url: entry.sourceUrl,
    source_name: source.sourceName,
    source_type: source.sourceType,
    ai_confidence: null,
    reviewer_note: AGGREGATOR_REVIEWER_NOTE,
    source_hash,
    content_hash,
    raw_data: {
      source: 'kpopofficial-concerts',
      crawler_source_id: source.crawlerSourceId,
      source_key: source.sourceKey,
      parser_type: source.parserType,
      parser_version: KPOPOFFICIAL_PARSER_VERSION,
      title: entry.title,
      original_date_text: entry.rawDateText,
      location: entry.location,
      page_url: source.pageUrl,
      matched_via: matchedVia,
      matched_idol_name: matchedIdolName,
    },
  }
}

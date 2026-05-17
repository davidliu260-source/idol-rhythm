/**
 * TWICE official JYP Schedule parser.
 *
 * Source: registered in crawler_sources where source_key = 'twice-jyp-schedule'.
 *
 * The JYP site is a Next.js SPA — the Mobile/Schedule page renders client-side
 * and has no useful static HTML. Schedule data comes from a JSON API:
 *
 *   GET /api/groups/twice
 *     → { groupId: "9", fansKey: "twice" }
 *
 *   GET /api/schedules?groupId=9&startDate=<ISO8601>&endDate=<ISO8601>
 *     → { schedules: JypApiScheduleItem[] }
 *
 * Each item carries a stable `slug` (used as per-entry URL anchor), a
 * `scheduledDate` (YYYY-MM-DD), and a `category` string
 * (ANNIVERSARY | SHOW | EVENT | RELEASE | ETC).
 *
 * No HTML parsing. No cheerio. No new dependencies.
 */

import { computeSourceHash } from './sourceHash'
import type { SourceTypeEnum } from './crawlerSource'

export const TWICE_PARSER_VERSION = 2

// ── Raw API shapes ────────────────────────────────────────────────────────────

export interface JypApiScheduleItem {
  id: string
  slug: string
  title: string
  body: string
  category: string
  isAllDay: boolean
  scheduledAt: string
  scheduledDate: string
  location: string | null
  artists: { name: string; __typename?: string }[]
}

// ── Parsed entry (normalised, used by fetcher) ────────────────────────────────

export interface ParsedTwiceEntry {
  title: string
  /** scheduledDate from API: always YYYY-MM-DD. */
  rawDateText: string
  /** Same as rawDateText — always set for API items. */
  detectedDate: string | null
  /** API category string: ANNIVERSARY | SHOW | EVENT | RELEASE | ETC */
  rawTypeText: string
  /** https://{pageUrl}#{slug} — stable, unique per item. */
  sourceUrl: string
  hasOwnUrl: boolean
  location: string | null
  artists: string[]
}

/**
 * Convert raw JYP API schedule items to ParsedTwiceEntry[].
 * `pageUrl` is the display URL from crawler_sources (used as anchor base).
 */
export function parseTwiceScheduleApiItems(
  items: JypApiScheduleItem[],
  pageUrl: string,
): ParsedTwiceEntry[] {
  const entries: ParsedTwiceEntry[] = []
  const seenSlugs = new Set<string>()

  for (const item of items) {
    if (!item.title || !item.scheduledDate) continue
    if (seenSlugs.has(item.slug)) continue
    seenSlugs.add(item.slug)

    entries.push({
      title: item.title,
      rawDateText: item.scheduledDate,
      detectedDate: item.scheduledDate,
      rawTypeText: item.category ?? '',
      sourceUrl: `${pageUrl}#${item.slug}`,
      hasOwnUrl: true,
      location: item.location ?? null,
      artists: (item.artists ?? []).map((a) => a.name).filter(Boolean),
    })
  }

  return entries
}

// ── Category → event_type mapping ────────────────────────────────────────────

export type EventTypeEnum =
  | 'concert'
  | 'ticketing'
  | 'livestream'
  | 'streaming'
  | 'media'
  | 'brand'
  | 'official'

export function mapCategoryToEventType(raw: string): EventTypeEnum | null {
  switch (raw.trim().toUpperCase()) {
    case 'SHOW':
      return 'media'
    case 'ANNIVERSARY':
    case 'EVENT':
    case 'RELEASE':
    case 'ETC':
      return 'official'
    default:
      return null
  }
}

// ── Payload builder ───────────────────────────────────────────────────────────

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
    location: string | null
    artists: string[]
  }
}

export function entryToCandidatePayload(
  entry: ParsedTwiceEntry,
  source: TwiceSourceContext,
): TwiceCandidatePayload {
  const raw_title = `TWICE 官方行程 - ${entry.title}`

  const lines: string[] = [
    `Title: ${entry.title}`,
    `Date: ${entry.rawDateText}`,
    entry.rawTypeText ? `Category: ${entry.rawTypeText}` : null,
    entry.location ? `Location: ${entry.location}` : null,
    entry.artists.length > 0 ? `Artists: ${entry.artists.join(', ')}` : null,
    `Source: ${source.pageUrl}`,
  ].filter((x): x is string => x !== null)

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
      location: entry.location,
      artists: entry.artists,
    },
  }
}

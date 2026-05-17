/**
 * JYP Schedule platform parser.
 *
 * Sources that use this parser are registered in crawler_sources with
 * parser_type = 'jyp_schedule'. Each source row carries:
 *   - source_url: the public Mobile/Schedule page for that artist
 *   - config.groupId: the JYP internal group id used by the JSON API
 *   - config.artistSlug: subdomain slug, used only as fallback to resolve
 *     groupId via /api/groups/{slug} when config.groupId is missing
 *   - idol_id: links the source back to an Idol Rhythm idol row
 *
 * Same parser can be reused for any JYP-managed group (TWICE, Stray Kids,
 * ITZY, NMIXX …) — adding a new artist only requires inserting a new
 * crawler_sources row with the right groupId.
 *
 * Schedule items come from the JYP JSON API (not HTML):
 *
 *   GET {origin}/api/schedules?groupId=<id>&startDate=<ISO8601>&endDate=<ISO8601>
 *     → { schedules: JypApiScheduleItem[] }
 *
 *   (fallback) GET {origin}/api/groups/{artistSlug} → { groupId, fansKey }
 *
 * Each item carries a stable `slug` (used as per-entry URL anchor) and
 * `scheduledDate` (YYYY-MM-DD). No HTML parsing, no cheerio, no new deps.
 */

import { computeSourceHash } from './sourceHash'
import type { SourceTypeEnum } from './crawlerSource'

export const JYP_PARSER_VERSION = 1

// ── Raw API shapes ───────────────────────────────────────────────────────────

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

// ── Parsed entry (normalised, used by fetcher) ───────────────────────────────

export interface ParsedJypEntry {
  title: string
  /** scheduledDate from API: always YYYY-MM-DD. */
  rawDateText: string
  /** Same as rawDateText — always set for API items. */
  detectedDate: string | null
  /** API category string: ANNIVERSARY | SHOW | EVENT | RELEASE | ETC */
  rawTypeText: string
  /** `{pageUrl}#{slug}` — stable, unique per item. */
  sourceUrl: string
  hasOwnUrl: boolean
  location: string | null
  artists: string[]
}

/**
 * Convert raw JYP API schedule items to ParsedJypEntry[].
 * `pageUrl` is the display URL from crawler_sources (used as anchor base).
 */
export function parseJypScheduleApiItems(
  items: JypApiScheduleItem[],
  pageUrl: string,
): ParsedJypEntry[] {
  const entries: ParsedJypEntry[] = []
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

// ── Payload builder ──────────────────────────────────────────────────────────

export interface JypSourceContext {
  crawlerSourceId: string
  sourceKey: string
  sourceName: string
  sourceType: SourceTypeEnum
  parserType: string
  pageUrl: string
  idolId: string | null
  groupId: string
  artistSlug: string | null
}

export interface JypCandidatePayload {
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
    source: 'jyp-schedule'
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
    group_id: string
    artist_slug: string | null
  }
}

export function entryToCandidatePayload(
  entry: ParsedJypEntry,
  source: JypSourceContext,
): JypCandidatePayload {
  const raw_title = `${source.sourceName} - ${entry.title}`

  const lines: string[] = [
    `Title: ${entry.title}`,
    `Date: ${entry.rawDateText}`,
    entry.rawTypeText ? `Category: ${entry.rawTypeText}` : null,
    entry.location ? `Location: ${entry.location}` : null,
    entry.artists.length > 0 ? `Artists: ${entry.artists.join(', ')}` : null,
    `Source: ${source.pageUrl}`,
    `JYP groupId: ${source.groupId}`,
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
      source: 'jyp-schedule',
      crawler_source_id: source.crawlerSourceId,
      source_key: source.sourceKey,
      parser_type: source.parserType,
      parser_version: JYP_PARSER_VERSION,
      title: entry.title,
      original_date_text: entry.rawDateText,
      original_type_text: entry.rawTypeText,
      page_url: source.pageUrl,
      own_url: entry.hasOwnUrl,
      location: entry.location,
      artists: entry.artists,
      group_id: source.groupId,
      artist_slug: source.artistSlug,
    },
  }
}

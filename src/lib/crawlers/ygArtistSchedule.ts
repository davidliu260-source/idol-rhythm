/**
 * YG artist schedule parser.
 *
 * YG artist schedule pages render initial HTML and use this JSON endpoint for
 * month navigation:
 *   /api/artist/schedule/list/{artistId}/{year}/{month}
 *
 * crawler_sources rows using parser_type = 'yg_artist_schedule' carry:
 *   - source_url: public artist schedule page
 *   - idol_id: the Idol Rhythm artist row
 *   - config.artistId: YG internal artist id from the schedule page
 *   - config.artistSlug: local slug fallback / raw metadata
 */

import { computeSourceHash } from './sourceHash'
import { computeContentHash } from './contentHash'
import type { SourceTypeEnum } from './crawlerSource'

export const YG_ARTIST_SCHEDULE_PARSER_VERSION = 1

export interface YgApiScheduleItem {
  id: number
  artistId: number
  title: string
  place: string | null
  type: string
  date: string
  time: string | null
  isDisplay: boolean
  created: string | null
  updated: string | null
}

export interface ParsedYgScheduleEntry {
  id: number
  title: string
  rawDateText: string
  detectedDate: string | null
  time: string | null
  rawTypeText: string
  place: string | null
  sourceUrl: string
  hasOwnUrl: boolean
}

export type EventTypeEnum =
  | 'concert'
  | 'ticketing'
  | 'livestream'
  | 'streaming'
  | 'media'
  | 'brand'
  | 'official'

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function normalizePart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function mapYgScheduleTypeToEventType(
  rawType: string,
  title: string,
): EventTypeEnum | null {
  const haystack = `${rawType} ${title}`.toLowerCase()
  if (
    haystack.includes('concert') ||
    haystack.includes('tour') ||
    haystack.includes('fan concert') ||
    haystack.includes('팬콘') ||
    haystack.includes('콘서트')
  ) {
    return 'concert'
  }
  if (haystack.includes('ticket') || haystack.includes('티켓')) return 'ticketing'
  if (haystack.includes('radio') || haystack.includes('tv') || haystack.includes('stage')) {
    return 'media'
  }
  switch (rawType.trim().toLowerCase()) {
    case 'tv':
    case 'radio':
    case 'stage':
      return 'media'
    default:
      return null
  }
}

export function parseYgScheduleItems(
  items: YgApiScheduleItem[],
  pageUrl: string,
): ParsedYgScheduleEntry[] {
  const entries: ParsedYgScheduleEntry[] = []
  const seenIds = new Set<number>()

  for (const item of items) {
    if (!item.isDisplay || !item.title || seenIds.has(item.id)) continue
    seenIds.add(item.id)

    const detectedDate = isIsoDate(item.date) ? item.date : null
    const stablePart =
      item.id > 0
        ? String(item.id)
        : normalizePart(`${item.date}-${item.type}-${item.title}`)

    entries.push({
      id: item.id,
      title: item.title.trim(),
      rawDateText: item.date ?? '',
      detectedDate,
      time: item.time || null,
      rawTypeText: item.type ?? '',
      place: item.place?.trim() || null,
      sourceUrl: `${pageUrl}#schedule-${stablePart}`,
      hasOwnUrl: false,
    })
  }

  return entries
}

export interface YgSourceContext {
  crawlerSourceId: string
  sourceKey: string
  sourceName: string
  sourceType: SourceTypeEnum
  parserType: string
  pageUrl: string
  idolId: string | null
  artistId: number
  artistSlug: string | null
}

export interface YgCandidatePayload {
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
  content_hash: string
  raw_data: {
    source: 'yg-artist-schedule'
    crawler_source_id: string
    source_key: string
    parser_type: string
    parser_version: number
    schedule_id: number
    title: string
    original_date_text: string
    original_type_text: string
    time: string | null
    place: string | null
    page_url: string
    own_url: boolean
    artist_id: number
    artist_slug: string | null
  }
}

export function entryToCandidatePayload(
  entry: ParsedYgScheduleEntry,
  source: YgSourceContext,
): YgCandidatePayload {
  const raw_title = `${source.sourceName} - ${entry.title}`
  const detected_event_type = mapYgScheduleTypeToEventType(
    entry.rawTypeText,
    entry.title,
  )

  const lines: string[] = [
    `Title: ${entry.title}`,
    `Date: ${entry.rawDateText}`,
    entry.time ? `Time: ${entry.time}` : null,
    entry.rawTypeText ? `Category: ${entry.rawTypeText}` : null,
    entry.place ? `Place: ${entry.place}` : null,
    `Source: ${source.pageUrl}`,
    `YG artistId: ${source.artistId}`,
  ].filter((x): x is string => x !== null)

  const raw_content = lines.join('\n')
  const source_hash = computeSourceHash({ sourceUrl: entry.sourceUrl })!
  const content_hash = computeContentHash({
    rawTitle: raw_title,
    rawContent: raw_content,
    detectedDate: entry.detectedDate,
    detectedEventType: detected_event_type,
    detectedIdolId: source.idolId,
    sourceUrl: entry.sourceUrl,
    sourceName: source.sourceName,
    sourceType: source.sourceType,
  })

  return {
    raw_title,
    raw_content,
    detected_idol_id: source.idolId,
    detected_event_type,
    detected_date: entry.detectedDate,
    source_url: entry.sourceUrl,
    source_name: source.sourceName,
    source_type: source.sourceType,
    ai_confidence: null,
    reviewer_note: `auto-crawled from crawler source: ${source.sourceName}`,
    source_hash,
    content_hash,
    raw_data: {
      source: 'yg-artist-schedule',
      crawler_source_id: source.crawlerSourceId,
      source_key: source.sourceKey,
      parser_type: source.parserType,
      parser_version: YG_ARTIST_SCHEDULE_PARSER_VERSION,
      schedule_id: entry.id,
      title: entry.title,
      original_date_text: entry.rawDateText,
      original_type_text: entry.rawTypeText,
      time: entry.time,
      place: entry.place,
      page_url: source.pageUrl,
      own_url: entry.hasOwnUrl,
      artist_id: source.artistId,
      artist_slug: source.artistSlug,
    },
  }
}

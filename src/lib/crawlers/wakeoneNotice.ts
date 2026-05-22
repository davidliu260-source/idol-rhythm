/**
 * WAKEONE notice board parser.
 *
 * Source: https://wake-one.com/notice/ — a WordPress site with a
 * server-rendered notice list. Covers the shared WAKEONE label feed
 * used for ZEROBASEONE, Kep1er, and izna (first-pass targets).
 *
 * Phase A probe findings (2026-05-22):
 *   - HTML is fully server-rendered. Cheerio parsing is stable.
 *   - List structure: div.notice-list > div.notice-item
 *   - Each item: a.post-link[href] containing h5.title + span.date
 *   - Date format: "YYYY. MM. DD" (e.g., "2026. 05. 21")
 *   - URL pagination: /notice/page/N/ (WordPress standard)
 *   - max_page = 2 at probe time (grows over time)
 *   - Current notices are administrative (legal, contracts). Conservative
 *     event filter will skip most — by design.
 *
 * Source-hash uniqueness:
 *   Because multiple per-idol source rows share the same notice feed,
 *   source_url stored in candidates uses a `#wakeone-{idolSlug}` fragment
 *   to differentiate (notice, idol) pairs. This prevents cross-idol hash
 *   collisions and incorrect recheck triggers in the dedup flow.
 *
 * parser_type: wakeone_notice
 * parser_version: 1
 */

import * as cheerio from 'cheerio'
import { computeSourceHash } from './sourceHash'
import { computeContentHash } from './contentHash'
import type { SourceTypeEnum } from './crawlerSource'

export const WAKEONE_NOTICE_PARSER_VERSION = 1
export const WAKEONE_NOTICE_PARSER_TYPE = 'wakeone_notice'

// ── Raw entry shape produced by the HTML parser ──────────────────────────────

export interface ParsedWakeoneEntry {
  /** Title text from h5.title */
  title: string
  /** Raw date string from span.date, e.g. "2026. 05. 21" */
  rawDateText: string | null
  /** ISO date YYYY-MM-DD, or null when parsing fails */
  detectedDate: string | null
  /** Canonical notice permalink (clean URL, no fragment) */
  noticeUrl: string
}

// ── HTML parser ──────────────────────────────────────────────────────────────

export function parseWakeoneNoticeHtml(
  html: string,
  _pageUrl: string,
): ParsedWakeoneEntry[] {
  const $ = cheerio.load(html)
  const entries: ParsedWakeoneEntry[] = []
  const seenUrls = new Set<string>()

  $('.notice-item').each((_, el) => {
    const $el = $(el)
    const $link = $el.find('a.post-link').first()

    const title = $el.find('h5.title').first().text().trim()
    const rawDateText = $el.find('span.date').first().text().trim() || null
    const href = $link.attr('href')?.trim() ?? ''

    if (!title || !href) return

    // Normalize URL: ensure absolute and strip trailing slash
    let noticeUrl = href
    try {
      const u = new URL(href)
      // Remove trailing slash from pathname for stable dedup
      u.pathname = u.pathname.replace(/\/+$/, '')
      noticeUrl = u.toString()
    } catch {
      // href was already absolute from probe; keep as-is
    }

    if (seenUrls.has(noticeUrl)) return
    seenUrls.add(noticeUrl)

    entries.push({
      title,
      rawDateText,
      detectedDate: rawDateText ? parseWakeoneDate(rawDateText) : null,
      noticeUrl,
    })
  })

  return entries
}

// ── Date parsing ─────────────────────────────────────────────────────────────

/**
 * Parse WAKEONE date format "YYYY. MM. DD" → "YYYY-MM-DD".
 * Handles extra whitespace between parts. Returns null on failure.
 */
export function parseWakeoneDate(raw: string): string | null {
  // Match "YYYY. MM. DD" with optional whitespace around dots
  const m = raw.trim().match(/^(\d{4})\s*\.\s*(\d{1,2})\s*\.\s*(\d{1,2})\s*$/)
  if (!m) return null

  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])

  if (
    !Number.isFinite(year) || year < 2000 || year > 2099 ||
    !Number.isFinite(month) || month < 1 || month > 12 ||
    !Number.isFinite(day) || day < 1 || day > 31
  ) {
    return null
  }

  // Round-trip validation
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

// ── Conservative event keyword filter ────────────────────────────────────────

/**
 * Returns true if the notice title clearly describes a user-facing
 * scheduled event. Conservative — ambiguous titles are excluded.
 *
 * Work order preference: include concert / fan meeting / showcase / tour /
 * festival / broadcast appearance / popup+exhibition tied to offline
 * attendance. Skip legal notices, contracts, membership, merch, general
 * admin announcements.
 */
const EVENT_KEYWORD_INCLUDE = [
  // Korean event terms
  '콘서트',   // concert
  '공연',     // performance/show
  '팬미팅',   // fan meeting
  '팬콘',     // fan concert
  '팬사인회', // fan sign
  '쇼케이스', // showcase
  '투어',     // tour
  '페스티벌', // festival
  '방송',     // broadcast
  '음악방송', // music broadcast
  '컴백',     // comeback
  '팝업',     // popup
  '전시',     // exhibition
  // English event terms
  'concert',
  'tour',
  'fan meet',
  'fanmeet',
  'fan meeting',
  'showcase',
  'festival',
  'popup',
  'pop-up',
  'exhibition',
  'broadcast',
  'comeback',
  'live',
] as const

// Explicit exclusion terms that override keyword matches (prevent false positives)
const EVENT_KEYWORD_EXCLUDE = [
  '계약',     // contract
  '법적',     // legal
  '소송',     // lawsuit
  '권익',     // rights
  '사생활',   // privacy
  '팬 문화',  // fan culture
  '구인',     // recruitment
  '오디션',   // audition (standalone — not a fan-facing event)
  '안내문',   // notice document
  '종료',     // termination
  '탈퇴',     // withdrawal
  '군입대',   // military enlistment
] as const

export function isEventNotice(title: string): boolean {
  const lower = title.toLowerCase()

  // Check exclusion first — safety override
  for (const kw of EVENT_KEYWORD_EXCLUDE) {
    if (lower.includes(kw)) return false
  }

  // Must have at least one inclusion keyword
  for (const kw of EVENT_KEYWORD_INCLUDE) {
    if (lower.includes(kw.toLowerCase())) return true
  }

  return false
}

// ── Event type mapping ────────────────────────────────────────────────────────

/**
 * Map notice title to event_type enum values from the DB schema:
 *   concert | ticketing | livestream | streaming | media | brand | official
 */
export type WakeoneEventType = 'concert' | 'ticketing' | 'media' | 'brand' | 'official'

export function mapNoticeToEventType(title: string): WakeoneEventType | null {
  const lower = title.toLowerCase()

  if (
    lower.includes('콘서트') || lower.includes('공연') ||
    lower.includes('팬미팅') || lower.includes('팬콘') ||
    lower.includes('팬사인회') || lower.includes('쇼케이스') ||
    lower.includes('투어') || lower.includes('페스티벌') ||
    lower.includes('concert') || lower.includes('tour') ||
    lower.includes('fan meet') || lower.includes('fanmeet') ||
    lower.includes('showcase') || lower.includes('festival') ||
    lower.includes('live')
  ) {
    return 'concert'
  }

  if (
    lower.includes('팝업') || lower.includes('전시') ||
    lower.includes('popup') || lower.includes('pop-up') ||
    lower.includes('exhibition')
  ) {
    return 'brand'
  }

  if (
    lower.includes('방송') || lower.includes('broadcast') ||
    lower.includes('음악방송')
  ) {
    return 'media'
  }

  return null
}

// ── Candidate payload builder ─────────────────────────────────────────────────

export interface WakeoneSourceContext {
  crawlerSourceId: string
  sourceKey: string
  sourceName: string
  sourceType: SourceTypeEnum
  parserType: string
  pageUrl: string
  idolId: string
  idolSlug: string
}

export interface WakeoneCandidatePayload {
  raw_title: string
  raw_content: string
  detected_idol_id: string
  detected_event_type: WakeoneEventType | null
  detected_date: string | null
  source_url: string
  source_name: string
  source_type: SourceTypeEnum
  ai_confidence: null
  reviewer_note: string
  source_hash: string
  content_hash: string
  raw_data: {
    source: 'wakeone-notice'
    crawler_source_id: string
    source_key: string
    parser_type: string
    parser_version: number
    notice_url: string
    title: string
    original_date_text: string | null
    page_url: string
    idol_slug: string
  }
}

export function entryToCandidatePayload(
  entry: ParsedWakeoneEntry,
  source: WakeoneSourceContext,
): WakeoneCandidatePayload {
  const raw_title = entry.title
  const detected_event_type = mapNoticeToEventType(entry.title)

  const lines: string[] = [
    `Title: ${entry.title}`,
    entry.rawDateText ? `Date (raw): ${entry.rawDateText}` : null,
    `Artist: ${source.idolSlug}`,
    `Notice URL: ${entry.noticeUrl}`,
    `Source: ${source.pageUrl}`,
  ].filter((x): x is string => x !== null)

  const raw_content = lines.join('\n')

  // Source URL includes idol slug fragment to ensure uniqueness per (notice, idol).
  // Multiple per-idol source rows share the same feed; the fragment prevents
  // cross-idol dedup collisions.
  const source_url = `${entry.noticeUrl}#wakeone-${source.idolSlug}`

  const source_hash = computeSourceHash({ sourceUrl: source_url })!

  const content_hash = computeContentHash({
    rawTitle: raw_title,
    rawContent: raw_content,
    detectedDate: entry.detectedDate,
    detectedEventType: detected_event_type,
    detectedIdolId: source.idolId,
    sourceUrl: source_url,
    sourceName: source.sourceName,
    sourceType: source.sourceType,
  })

  return {
    raw_title,
    raw_content,
    detected_idol_id: source.idolId,
    detected_event_type,
    detected_date: entry.detectedDate,
    source_url,
    source_name: source.sourceName,
    source_type: source.sourceType,
    ai_confidence: null,
    reviewer_note: `auto-crawled from crawler source: ${source.sourceName}`,
    source_hash,
    content_hash,
    raw_data: {
      source: 'wakeone-notice',
      crawler_source_id: source.crawlerSourceId,
      source_key: source.sourceKey,
      parser_type: source.parserType,
      parser_version: WAKEONE_NOTICE_PARSER_VERSION,
      notice_url: entry.noticeUrl,
      title: entry.title,
      original_date_text: entry.rawDateText,
      page_url: source.pageUrl,
      idol_slug: source.idolSlug,
    },
  }
}

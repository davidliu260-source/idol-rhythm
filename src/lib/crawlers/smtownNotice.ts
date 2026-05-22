/**
 * SMTOWN notice board parser.
 *
 * Source: https://www.smtown.com/notice — a server-rendered notice list
 * for the SM family. Covers the shared label notice feed used (in first
 * pass) for aespa, RIIZE, Red Velvet, EXO, NCT root.
 *
 * Phase A probe findings (2026-05-22):
 *   - HTML is fully server-rendered. Cheerio parsing is stable.
 *   - List structure: each notice = `div.noticeTop` containing
 *     `span.number` (id) + subject text + `span.day` (date).
 *     The body sits in the adjacent sibling `div.noticeBox` and is
 *     included on the listing page (no separate detail URL needed).
 *   - Date format: "YYYY/MM/DD" (e.g., "2026/03/23")
 *   - Pinned notices have `span.number` text == "Notice" / "공지" instead
 *     of a numeric id. Numeric notices count down (e.g., 364, 363, ...).
 *   - Pagination: `?page=N` (0-indexed; ?page=0 == page 1 == base URL).
 *     Probe time: max page param = 36 (≈ 37 pages × ~16 items).
 *   - Most current notices are administrative (privacy policy, app
 *     maintenance, digital stamp issuance, SEASON'S GREETINGS merch).
 *     Conservative event filter will skip most — by design.
 *
 * Source-hash uniqueness:
 *   SMTOWN notices have no per-notice permalink — they all expand inline
 *   on the same `/notice` URL. We synthesize a stable per-notice id from
 *   `span.number` (or a short title-derived slug for pinned items), and
 *   build:
 *     source_url = `${pageUrl}#smtown-${noticeId}-${idolSlug}`
 *   The `#smtown-{idolSlug}` fragment also ensures per-(notice, idol)
 *   uniqueness across the multiple per-idol source rows sharing the same
 *   feed (mirrors the wakeoneNotice pattern).
 *
 * parser_type: smtown_notice
 * parser_version: 1
 */

import * as cheerio from 'cheerio'
import { computeSourceHash } from './sourceHash'
import { computeContentHash } from './contentHash'
import type { SourceTypeEnum } from './crawlerSource'

export const SMTOWN_NOTICE_PARSER_VERSION = 1
export const SMTOWN_NOTICE_PARSER_TYPE = 'smtown_notice'

// ── Raw entry shape produced by the HTML parser ──────────────────────────────

export interface ParsedSmtownEntry {
  /** Stable notice id derived from `span.number`. Numeric for normal
   *  notices, or `pinned-{slug}` for pinned ("Notice"/"공지") items. */
  noticeId: string
  /** Subject text from between `span.number` and `span.day`. */
  title: string
  /** Raw date string from `span.day`, e.g. "2026/03/23". */
  rawDateText: string | null
  /** ISO date YYYY-MM-DD, or null when parsing fails. */
  detectedDate: string | null
  /** Body text from sibling `div.noticeBox`. May be empty. */
  bodyText: string
}

// ── HTML parser ──────────────────────────────────────────────────────────────

function shortTitleSlug(title: string): string {
  // Lowercase ASCII letters/digits only, max 24 chars; used to give pinned
  // ("Notice") rows a stable id distinct from each other.
  const ascii = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
  return ascii || 'item'
}

export function parseSmtownNoticeHtml(
  html: string,
  _pageUrl: string,
): ParsedSmtownEntry[] {
  const $ = cheerio.load(html)
  const entries: ParsedSmtownEntry[] = []
  const seenIds = new Set<string>()

  $('.noticeTop').each((_, el) => {
    const $top = $(el)
    const numberRaw = $top.find('span.number').first().text().trim()
    const dayRaw = $top.find('span.day').first().text().trim()

    // The subject is the text node between the two spans. Clone and
    // remove the spans, then take whatever text remains.
    const $clone = $top.clone()
    $clone.find('span.number').remove()
    $clone.find('span.day').remove()
    const title = $clone.text().replace(/\s+/g, ' ').trim()

    if (!title) return

    // Body is the next sibling `div.noticeBox` (per probe).
    const $box = $top.next('.noticeBox')
    const bodyText = $box.length
      ? $box.text().replace(/\s+/g, ' ').trim()
      : ''

    // Build a stable noticeId. Numeric → use as-is; non-numeric (pinned)
    // → derive from title slug so multiple pinned items don't collide.
    let noticeId: string
    if (/^\d+$/.test(numberRaw)) {
      noticeId = numberRaw
    } else {
      noticeId = `pinned-${shortTitleSlug(title)}`
    }

    if (seenIds.has(noticeId)) return
    seenIds.add(noticeId)

    entries.push({
      noticeId,
      title,
      rawDateText: dayRaw || null,
      detectedDate: dayRaw ? parseSmtownDate(dayRaw) : null,
      bodyText,
    })
  })

  return entries
}

// ── Date parsing ─────────────────────────────────────────────────────────────

/**
 * Parse SMTOWN date format "YYYY/MM/DD" → "YYYY-MM-DD".
 * Handles extra whitespace around separators. Returns null on failure.
 */
export function parseSmtownDate(raw: string): string | null {
  const m = raw.trim().match(/^(\d{4})\s*\/\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*$/)
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
 * SMTOWN-specific tuning vs WAKEONE:
 *   - Exclude DIGITAL STAMP issuance follow-ups (reference past events
 *     but are not new schedule announcements).
 *   - Exclude SEASON'S GREETINGS / character interactive merch launches.
 *   - Exclude SM AUDITION / app maintenance / privacy policy notices.
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
  '음악방송', // music broadcast
  '컴백',     // comeback
  '팝업',     // popup
  '전시',     // exhibition
  // English event terms
  'concert',
  'tour',
  'world tour',
  'live tour',
  'fan meet',
  'fanmeet',
  'fan meeting',
  'showcase',
  'festival',
  'popup',
  'pop-up',
  'exhibition',
  'comeback',
  'super show',  // SM-specific (SUPER JUNIOR SUPER SHOW series)
] as const

// Explicit exclusion terms override inclusion matches (prevent false positives)
const EVENT_KEYWORD_EXCLUDE = [
  // Korean admin
  '개인정보',     // personal information / privacy
  '처리방침',     // privacy policy
  '약관',         // terms of service
  '점검',         // maintenance
  '오디션',       // audition
  '모집',         // recruitment
  '계약',         // contract
  '법적',         // legal
  '권익',         // rights
  '안내문',       // notice document
  '시즌그리팅',   // season's greetings (merch)
  // English admin / merch / app
  'privacy policy',
  'terms of service',
  'maintenance',
  'audition',
  'recruitment',
  'membership',
  'fanclub',
  'fan club',
  "season's greetings",
  'season s greetings',
  'character interactive',
  'digital stamp',
  'stamp issuance',
  'stamp schedule',
  'app support',
  'website renewal',
  'announcement] end of',
  'login service',
  'service maintenance',
  'service termination',
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
export type SmtownEventType = 'concert' | 'ticketing' | 'media' | 'brand' | 'official'

export function mapNoticeToEventType(title: string): SmtownEventType | null {
  const lower = title.toLowerCase()

  if (
    lower.includes('콘서트') || lower.includes('공연') ||
    lower.includes('팬미팅') || lower.includes('팬콘') ||
    lower.includes('팬사인회') || lower.includes('쇼케이스') ||
    lower.includes('투어') || lower.includes('페스티벌') ||
    lower.includes('concert') || lower.includes('tour') ||
    lower.includes('fan meet') || lower.includes('fanmeet') ||
    lower.includes('showcase') || lower.includes('festival') ||
    lower.includes('super show')
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

  if (lower.includes('음악방송') || lower.includes('broadcast')) {
    return 'media'
  }

  return null
}

// ── Candidate payload builder ─────────────────────────────────────────────────

export interface SmtownSourceContext {
  crawlerSourceId: string
  sourceKey: string
  sourceName: string
  sourceType: SourceTypeEnum
  parserType: string
  pageUrl: string
  idolId: string
  idolSlug: string
}

export interface SmtownCandidatePayload {
  raw_title: string
  raw_content: string
  detected_idol_id: string
  detected_event_type: SmtownEventType | null
  detected_date: string | null
  source_url: string
  source_name: string
  source_type: SourceTypeEnum
  ai_confidence: null
  reviewer_note: string
  source_hash: string
  content_hash: string
  raw_data: {
    source: 'smtown-notice'
    crawler_source_id: string
    source_key: string
    parser_type: string
    parser_version: number
    notice_id: string
    title: string
    original_date_text: string | null
    page_url: string
    idol_slug: string
  }
}

/** Soft cap for body text in raw_content to keep candidate rows small. */
const BODY_PREVIEW_MAX = 600

export function entryToCandidatePayload(
  entry: ParsedSmtownEntry,
  source: SmtownSourceContext,
): SmtownCandidatePayload {
  const raw_title = entry.title
  const detected_event_type = mapNoticeToEventType(entry.title)

  const bodyPreview = entry.bodyText.length > BODY_PREVIEW_MAX
    ? `${entry.bodyText.slice(0, BODY_PREVIEW_MAX).trim()} …`
    : entry.bodyText

  const lines: string[] = [
    `Title: ${entry.title}`,
    entry.rawDateText ? `Date (raw): ${entry.rawDateText}` : null,
    `Artist: ${source.idolSlug}`,
    `Notice ID: ${entry.noticeId}`,
    `Source: ${source.pageUrl}`,
    bodyPreview ? `Body: ${bodyPreview}` : null,
  ].filter((x): x is string => x !== null)

  const raw_content = lines.join('\n')

  // Per (notice, idol) uniqueness: notices have no permalink, so we encode
  // both noticeId and idolSlug in a fragment. The base URL stays the same
  // listing URL for all 5 first-pass source rows.
  const source_url = `${source.pageUrl}#smtown-${entry.noticeId}-${source.idolSlug}`

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
      source: 'smtown-notice',
      crawler_source_id: source.crawlerSourceId,
      source_key: source.sourceKey,
      parser_type: source.parserType,
      parser_version: SMTOWN_NOTICE_PARSER_VERSION,
      notice_id: entry.noticeId,
      title: entry.title,
      original_date_text: entry.rawDateText,
      page_url: source.pageUrl,
      idol_slug: source.idolSlug,
    },
  }
}

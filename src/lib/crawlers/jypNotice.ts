/**
 * JYP 各藝人官網公告（/notice）解析。MUST #10，取代 jyp_schedule。
 *
 * 背景：各藝人站 robots.txt 明文 `Disallow: /api/`、`Disallow: /_next/`，
 * 舊的 jyp_schedule 打 `/api/schedules` 已停用。改抓 robots 允許的 /notice HTML。
 * 見 /workspace/meetings/idol/需求單_JYP改用公告頁_2026-11-24.md。
 *
 * 2026-11-24 fixture（scripts/fixtures/jyp-notice/）：
 *   - 列表在初次 HTML 就有（Next.js 串流的 `<div hidden id="S:…">` 內），
 *     結構：`.noticeList li > a[href="/notice/{id}?NoticeNumber={n}"]`，
 *     內含 `p.cate`（編號）、`span.tit`（標題）、`span.date`（YYYY-MM-DD，公告發布日）。
 *   - 分頁：`/notice?PgIndex=N`（1 起算）。
 *   - 列表沒有地點，也沒有活動日。
 *
 * 只留事實：標題、發布日（只存 raw_data.notice_date，不當成 detected_date）、
 * 從標題或詳情明確抽到的活動日與地點、官方詳情連結。
 *
 * parser_type: jyp_notice
 * parser_version: 1
 */

import * as cheerio from 'cheerio'
import { computeSourceHash } from './sourceHash'
import { computeContentHash } from './contentHash'
import type { SourceTypeEnum } from './crawlerSource'

export const JYP_NOTICE_PARSER_TYPE = 'jyp_notice'
export const JYP_NOTICE_PARSER_VERSION = 1
export const JYP_NOTICE_USER_AGENT = 'IdolRhythm-Bot/0.1 (+https://idol-rhythm.vercel.app)'

// ── 允許的請求路徑 ───────────────────────────────────────────────────────────

const JYP_HOST = /^[a-z0-9-]+\.jype\.com$/i

/**
 * 只允許 https://{sub}.jype.com 的 /robots.txt、/notice、/notice?PgIndex=N、
 * /notice/{id}?NoticeNumber=N。其他（含 /api/、/_next/）一律拒絕。
 */
export function isAllowedJypRequestUrl(url: string): boolean {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return false
  }
  if (u.protocol !== 'https:' || !JYP_HOST.test(u.hostname) || u.username || u.password || u.port) return false
  const path = u.pathname
  if (/^\/(?:api|_next)(?:\/|$)/i.test(path)) return false
  const keys = [...u.searchParams.keys()]
  if (path === '/robots.txt') return keys.length === 0
  if (path === '/notice') {
    return keys.length === 0 || (keys.length === 1 && keys[0] === 'PgIndex' && /^\d+$/.test(u.searchParams.get('PgIndex') ?? ''))
  }
  if (/^\/notice\/[a-z0-9]+$/i.test(path)) {
    return keys.length === 1 && keys[0] === 'NoticeNumber' && /^\d+$/.test(u.searchParams.get('NoticeNumber') ?? '')
  }
  return false
}

/** 來源網址必須是 https://{sub}.jype.com/notice（不接受 /schedule、/Mobile/Schedule）。 */
export function jypNoticeListUrl(sourceUrl: string): string | null {
  try {
    const u = new URL(sourceUrl)
    if (u.protocol !== 'https:' || !JYP_HOST.test(u.hostname)) return null
    if (u.pathname.replace(/\/+$/, '') !== '/notice' || u.search) return null
    return `${u.origin}/notice`
  } catch {
    return null
  }
}

export function jypNoticePageUrl(listUrl: string, page: number): string {
  return page <= 1 ? listUrl : `${listUrl}?PgIndex=${page}`
}

// ── robots.txt ───────────────────────────────────────────────────────────────

export interface RobotsRules {
  allow: string[]
  disallow: string[]
  crawlDelaySeconds: number | null
}

/**
 * 解析 robots.txt，回傳適用於本 bot 的規則（優先找 IdolRhythm-Bot 群組，否則 `*`）。
 */
export function parseRobotsTxt(text: string, userAgent = 'IdolRhythm-Bot'): RobotsRules {
  type Group = { agents: string[]; allow: string[]; disallow: string[]; crawlDelay: number | null }
  const groups: Group[] = []
  let current: Group | null = null
  let lastWasAgent = false
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim()
    if (!line) continue
    const idx = line.indexOf(':')
    if (idx < 0) continue
    const key = line.slice(0, idx).trim().toLowerCase()
    const value = line.slice(idx + 1).trim()
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], allow: [], disallow: [], crawlDelay: null }
        groups.push(current)
      }
      current.agents.push(value.toLowerCase())
      lastWasAgent = true
      continue
    }
    lastWasAgent = false
    if (!current) continue
    if (key === 'allow' && value) current.allow.push(value)
    else if (key === 'disallow' && value) current.disallow.push(value)
    else if (key === 'crawl-delay') {
      const n = Number(value)
      if (Number.isFinite(n) && n >= 0) current.crawlDelay = n
    }
  }
  const ua = userAgent.toLowerCase()
  const specific = groups.filter((g) => g.agents.some((a) => a !== '*' && ua.includes(a)))
  const chosen = specific.length > 0 ? specific : groups.filter((g) => g.agents.includes('*'))
  return {
    allow: chosen.flatMap((g) => g.allow),
    disallow: chosen.flatMap((g) => g.disallow),
    crawlDelaySeconds: chosen.reduce<number | null>(
      (max, g) => (g.crawlDelay === null ? max : Math.max(max ?? 0, g.crawlDelay)),
      null,
    ),
  }
}

function ruleMatches(rule: string, path: string): number {
  // 支援 `*` 與結尾 `$`；回傳命中長度，-1 為不命中。
  const anchored = rule.endsWith('$')
  const body = anchored ? rule.slice(0, -1) : rule
  const pattern = body.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')
  return new RegExp(`^${pattern}${anchored ? '$' : ''}`).test(path) ? body.length : -1
}

/** 最長規則優先；同長度 Allow 勝。 */
export function robotsAllowsPath(rules: RobotsRules, pathWithQuery: string): boolean {
  let best = -1
  let allowed = true
  for (const rule of rules.disallow) {
    const len = ruleMatches(rule, pathWithQuery)
    if (len > best) { best = len; allowed = false }
  }
  for (const rule of rules.allow) {
    const len = ruleMatches(rule, pathWithQuery)
    if (len >= best && len >= 0) { best = len; allowed = true }
  }
  return allowed
}

/** 本爬蟲會用到的三種公告路徑都必須被允許。 */
export const JYP_NOTICE_ROBOTS_PROBE_PATHS = ['/notice', '/notice?PgIndex=2', '/notice/x?NoticeNumber=1'] as const

export function robotsAllowsNotice(rules: RobotsRules): boolean {
  return JYP_NOTICE_ROBOTS_PROBE_PATHS.every((p) => robotsAllowsPath(rules, p))
}

// ── 列表解析 ─────────────────────────────────────────────────────────────────

export interface ParsedJypNoticeEntry {
  /** NoticeNumber（字串）。 */
  noticeNumber: string
  /** 詳情路徑 id，例如 clzqjhdo。 */
  noticeId: string
  title: string
  /** 列表上的日期（公告發布日），YYYY-MM-DD；不是演出日。 */
  noticeDate: string | null
  /** 官方詳情網址（絕對）。 */
  detailUrl: string
}

function isoDate(y: number, m: number, d: number): string | null {
  if (!(y >= 2000 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCMonth() !== m - 1) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function parseJypNoticeListHtml(html: string, origin: string): ParsedJypNoticeEntry[] {
  const $ = cheerio.load(html)
  const entries: ParsedJypNoticeEntry[] = []
  const seen = new Set<string>()
  $('.noticeList li a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? ''
    const m = href.match(/^\/notice\/([a-z0-9]+)\?NoticeNumber=(\d+)$/i)
    if (!m) return
    const [, noticeId, noticeNumber] = m
    if (seen.has(noticeNumber)) return
    const title = $(el).find('.tit').first().text().replace(/\s+/g, ' ').trim()
    if (!title) return
    const dateText = $(el).find('.date').first().text().trim()
    const dm = dateText.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/)
    seen.add(noticeNumber)
    entries.push({
      noticeNumber,
      noticeId,
      title,
      noticeDate: dm ? isoDate(Number(dm[1]), Number(dm[2]), Number(dm[3])) : null,
      detailUrl: `${origin}/notice/${noticeId}?NoticeNumber=${noticeNumber}`,
    })
  })
  return entries
}

// ── 活動日與地點（只取明確寫出的） ────────────────────────────────────────────

const FULL_DATE = /(20\d{2})\s*(?:[-./]\s*(\d{1,2})\s*[-./]\s*(\d{1,2})|년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일)/g

function fullDates(text: string): string[] {
  const out: string[] = []
  for (const m of text.matchAll(FULL_DATE)) {
    const d = isoDate(Number(m[1]), Number(m[2] ?? m[4]), Number(m[3] ?? m[5]))
    if (d) out.push(d)
  }
  return out
}

/** 標題提到售票／預購／開放等，日期多半不是活動日。 */
const NON_EVENT_DATE_HINT = /티켓|예매|오픈|선예매|ticket|open|presale|pre-sale|발매|release|선공개|티저|teaser|m\/v|mv\b|応募|販売|발표/i

/**
 * 只有標題寫出含年份的完整日期，且不是售票／發行類公告，才當成活動日。
 * 「10/6(화) 티켓 오픈」這類不算。
 */
export function extractEventDateFromTitle(title: string): { start: string; end: string | null } | null {
  if (NON_EVENT_DATE_HINT.test(title)) return null
  const dates = fullDates(title)
  if (dates.length === 0) return null
  const start = dates[0]
  const end = dates.length > 1 && dates[dates.length - 1] > start ? dates[dates.length - 1] : null
  return { start, end }
}

const DATE_LABEL = /^(?:[-•·*▶■□◆◇※\s]*)(?:공연\s*일시|공연\s*일자|행사\s*일시|일시|일정|날짜|DATE|Date|日時|日程|開催日|公演日)\s*[:：]?\s*(.+)$/
const VENUE_LABEL = /^(?:[-•·*▶■□◆◇※\s]*)(?:공연\s*장소|행사\s*장소|장소|VENUE|Venue|PLACE|Place|会場|場所)\s*[:：]?\s*(.+)$/
const VENUE_MAX_LEN = 80

export interface ParsedJypNoticeDetail {
  bodyText: string
  eventDate: string | null
  eventEndDate: string | null
  venue: string | null
}

/**
 * 詳情頁：取正文文字，只從「일시／DATE／장소／VENUE」這類標籤行抽活動日與地點。
 * 沒有標籤就不抽（不猜）。
 */
export function parseJypNoticeDetailHtml(html: string): ParsedJypNoticeDetail {
  const $ = cheerio.load(html)
  $('script, style, noscript, template, header, footer, #footer, #footer-m, nav').remove()
  const selectors = ['.noticeView', '.notice_view', '.view_cont', '.viewCont', '.n_view', '.board_view', '.noticeDetail', '.n_right', '.container']
  let root = null as ReturnType<typeof $> | null
  for (const sel of selectors) {
    const found = $(sel).first()
    if (found.length && found.text().trim()) { root = found; break }
  }
  const target = root ?? $('body')
  target.find('br').replaceWith('\n')
  target.find('p, div, li, tr, h1, h2, h3, h4').each((_, el) => { $(el).append('\n') })
  const bodyText = target.text().split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n')

  let eventDate: string | null = null
  let eventEndDate: string | null = null
  let venue: string | null = null
  for (const line of bodyText.split('\n')) {
    if (!eventDate) {
      const dm = line.match(DATE_LABEL)
      if (dm) {
        const dates = fullDates(dm[1])
        if (dates.length) {
          eventDate = dates[0]
          const last = dates[dates.length - 1]
          eventEndDate = dates.length > 1 && last > eventDate ? last : null
        }
      }
    }
    if (!venue) {
      const vm = line.match(VENUE_LABEL)
      const v = vm?.[1].trim()
      if (v && v.length <= VENUE_MAX_LEN && !/^https?:\/\//i.test(v)) venue = v
    }
    if (eventDate && venue) break
  }
  return { bodyText, eventDate, eventEndDate, venue }
}

/** 標題看起來是活動（演唱會、粉絲見面會等），才值得花一次請求看詳情。 */
const EVENT_TITLE_HINT = /콘서트|투어|팬미팅|팬\s*미팅|팬콘|쇼케이스|공연|페스티벌|페스타|concert|\btour\b|fan\s*meeting|fanmeeting|fan-con|fancon|showcase|festival|\blive\b|티켓|ticket/i

export function looksLikeEventNotice(title: string): boolean {
  return EVENT_TITLE_HINT.test(title)
}

// ── 候選 payload ─────────────────────────────────────────────────────────────

export interface JypNoticeSourceContext {
  crawlerSourceId: string
  sourceKey: string
  sourceName: string
  sourceType: SourceTypeEnum
  parserType: string
  listUrl: string
  idolId: string
  idolSlug: string
}

export interface JypNoticeCandidatePayload {
  raw_title: string
  raw_content: string
  detected_idol_id: string
  detected_event_type: null
  detected_date: string | null
  detected_start_date: string | null
  detected_end_date: string | null
  detected_venue_name: string | null
  source_url: string
  source_name: string
  source_type: SourceTypeEnum
  ai_confidence: null
  reviewer_note: string
  source_hash: string
  content_hash: string
  raw_data: {
    source: 'jyp-notice'
    crawler_source_id: string
    source_key: string
    parser_type: string
    parser_version: number
    notice_number: string
    notice_id: string
    title: string
    /** 公告發布日（列表日期）。不是演出日。 */
    notice_date: string | null
    event_date_origin: 'title' | 'detail' | null
    detail_fetched: boolean
    page_url: string
    idol_slug: string
  }
}

const BODY_PREVIEW_MAX = 600

/** 只用列表事實算 content_hash，避免「這輪有看詳情、下輪沒看」被誤判成內容變更。 */
export function jypNoticeListContentHash(entry: ParsedJypNoticeEntry, source: JypNoticeSourceContext): string {
  const titleDate = extractEventDateFromTitle(entry.title)
  return computeContentHash({
    rawTitle: entry.title,
    rawContent: `Notice date: ${entry.noticeDate ?? ''}`,
    detectedDate: titleDate?.start ?? null,
    detectedEventType: null,
    detectedIdolId: source.idolId,
    sourceUrl: entry.detailUrl,
    sourceName: source.sourceName,
    sourceType: source.sourceType,
  })
}

export function entryToCandidatePayload(
  entry: ParsedJypNoticeEntry,
  source: JypNoticeSourceContext,
  detail: ParsedJypNoticeDetail | null = null,
): JypNoticeCandidatePayload {
  const titleDate = extractEventDateFromTitle(entry.title)
  const detailDate = detail?.eventDate ? { start: detail.eventDate, end: detail.eventEndDate } : null
  const eventDate = titleDate ?? detailDate
  const venue = detail?.venue ?? null

  const bodyPreview = detail?.bodyText
    ? detail.bodyText.length > BODY_PREVIEW_MAX
      ? `${detail.bodyText.slice(0, BODY_PREVIEW_MAX).trim()} …`
      : detail.bodyText
    : null

  // raw_content 只留在候選內部核對；facts-only 路徑不會把它寫進 events.description。
  const raw_content = [
    `Title: ${entry.title}`,
    `Notice date (posted, not event date): ${entry.noticeDate ?? 'unknown'}`,
    `Notice number: ${entry.noticeNumber}`,
    `URL: ${entry.detailUrl}`,
    venue ? `Venue: ${venue}` : null,
    bodyPreview ? `Body: ${bodyPreview}` : null,
  ].filter((x): x is string => x !== null).join('\n')

  return {
    raw_title: entry.title,
    raw_content,
    detected_idol_id: source.idolId,
    detected_event_type: null,
    detected_date: eventDate?.start ?? null,
    detected_start_date: eventDate?.start ?? null,
    detected_end_date: eventDate?.end ?? null,
    detected_venue_name: venue,
    source_url: entry.detailUrl,
    source_name: source.sourceName,
    source_type: source.sourceType,
    ai_confidence: null,
    reviewer_note: `auto-crawled from crawler source: ${source.sourceName}`,
    source_hash: computeSourceHash({ sourceUrl: entry.detailUrl })!,
    content_hash: jypNoticeListContentHash(entry, source),
    raw_data: {
      source: 'jyp-notice',
      crawler_source_id: source.crawlerSourceId,
      source_key: source.sourceKey,
      parser_type: source.parserType,
      parser_version: JYP_NOTICE_PARSER_VERSION,
      notice_number: entry.noticeNumber,
      notice_id: entry.noticeId,
      title: entry.title,
      notice_date: entry.noticeDate,
      event_date_origin: titleDate ? 'title' : detailDate ? 'detail' : null,
      detail_fetched: detail !== null,
      page_url: source.listUrl,
      idol_slug: source.idolSlug,
    },
  }
}

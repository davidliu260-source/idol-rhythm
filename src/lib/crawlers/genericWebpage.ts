/**
 * Generic webpage parser (P1-B1).
 *
 * Three pure-ish helpers used by runGenericWebpageFetcher:
 *
 *   1. fetchPublicHtml(url)         — public-only HTTP GET with strict limits
 *                                     (timeout / max bytes / fail on
 *                                     403/429/Cloudflare). No cookie / token /
 *                                     login / headless / bot bypass.
 *
 *   2. cleanHtmlToText(html)        — cheerio-based: strip script/style/nav/
 *                                     footer/header/aside, extract title +
 *                                     meta description + main/body text,
 *                                     compress whitespace, truncate.
 *
 *   3. parseWebpageWithClaude(...)  — Claude Haiku JSON-only call with strict
 *                                     schema validation. Returns events array
 *                                     plus pageRelevance + parserNote. Never
 *                                     fabricates fields; defensive parse,
 *                                     clamp, whitelist throughout.
 *
 * Trust boundary: this module never writes to DB and never decides whether
 * the result should be committed. The orchestrator
 * (runGenericWebpageFetcher) does. P1-B1 is preview-only.
 */

import Anthropic from '@anthropic-ai/sdk'
import { load as cheerioLoad } from 'cheerio'
import { lookup as dnsLookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { resolveAnthropicModel } from '@/lib/ai/parseCandidate'

// ── Limits (kept as exported constants for visibility) ─────────────────────

export const FETCH_TIMEOUT_MS = 10_000
export const MAX_HTML_BYTES = 500 * 1024 // 500 KB
export const MAX_TEXT_LENGTH = 8_000 // chars sent to Claude
export const MAX_EVENTS_PER_PAGE = 10
export const USER_AGENT = 'IdolRhythm-Bot/0.1 (+https://idol-rhythm.vercel.app)'

// ── Event type whitelist (P1-B1 preview only) ───────────────────────────────
// Wider than EVENT_TYPES in parseCandidate.ts on purpose: this is the set of
// labels Claude is allowed to suggest in preview. DB write (P1-B2) will map
// the broader set down to the schema's enum.

export const PREVIEW_EVENT_TYPES = [
  'concert',
  'tour',
  'fan_meeting',
  'showcase',
  'ticketing',
  'livestream',
  'streaming',
  'media',
  'brand',
  'popup_store',
  'exhibition',
  'official',
] as const
export type PreviewEventType = (typeof PREVIEW_EVENT_TYPES)[number]

export const PAGE_RELEVANCE_VALUES = ['high', 'medium', 'low', 'none'] as const
export type PageRelevance = (typeof PAGE_RELEVANCE_VALUES)[number]

// ── Public types ────────────────────────────────────────────────────────────

export interface FetchResult {
  ok: boolean
  html: string | null
  status: number
  finalUrl: string
  bytesRead: number
  wasByteTruncated: boolean
  error: string | null
}

export interface CleanedPage {
  pageTitle: string
  metaDescription: string
  bodyText: string
  wasTruncated: boolean
}

export interface PreviewEvent {
  rawTitle: string
  eventType: PreviewEventType | null
  idolHint: string | null
  dateHint: string | null
  locationHint: string | null
  confidence: number
  rawSnippet: string
}

export interface ClaudeParseResult {
  events: PreviewEvent[]
  pageRelevance: PageRelevance
  parserNote: string | null
  model: string
  truncatedEvents: number
}

// ── 0. SSRF / internal URL guard ───────────────────────────────────────────

/**
 * Returns true if `ip` (a literal IPv4 or IPv6 address) belongs to a
 * loopback, link-local, broadcast, or RFC1918 private range.
 *
 * Block list (P1-B1):
 *   IPv4:
 *     0.0.0.0/8          "this network" / wildcard
 *     10.0.0.0/8         private (RFC 1918)
 *     127.0.0.0/8        loopback
 *     169.254.0.0/16     link-local (RFC 3927)
 *     172.16.0.0/12      private (RFC 1918)
 *     192.168.0.0/16     private (RFC 1918)
 *   IPv6:
 *     ::1                loopback
 *     ::                 unspecified
 *     ::ffff:a.b.c.d     IPv4-mapped — re-check via IPv4 rules
 *     fc00::/7           unique local (RFC 4193)
 *     fe80::/10          link-local (RFC 4291)
 *
 * Intentionally NOT in scope (returns false):
 *   IPv4 multicast (224/4) and reserved (240/4) — these are not typical SSRF
 *   pivots and blocking them adds little value beyond the loopback / private
 *   set above. Re-evaluate if a future probe shows otherwise.
 */
function isPrivateOrLoopbackIp(ip: string): boolean {
  const lower = ip.toLowerCase()

  // IPv6 paths
  if (lower === '::1' || lower === '::') return true
  if (lower.startsWith('::ffff:')) {
    const v4 = lower.slice(7)
    if (isIP(v4) === 4) return isPrivateOrLoopbackIp(v4)
    return true // malformed mapped — refuse out of caution
  }
  if (lower.startsWith('fe80:') || /^f[cd][0-9a-f]{2}:/.test(lower)) return true

  // IPv4 paths
  if (isIP(ip) !== 4) return false
  const octets = ip.split('.').map((s) => Number(s))
  if (octets.length !== 4 || octets.some((n) => !Number.isInteger(n))) {
    return true // unparseable — refuse out of caution
  }
  const [a, b] = octets
  if (a === 0) return true
  if (a === 10) return true
  if (a === 127) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  return false
}

export interface UrlGuardResult {
  ok: boolean
  /** Reason for rejection (Chinese-friendly). null when ok. */
  error: string | null
}

/**
 * SSRF guard. Run before any fetch.
 *
 * Rejects:
 *   - non-http/https schemes (file:, javascript:, data:, ftp:, gopher:, …)
 *   - non-standard ports (P1-B1: only 80 and 443; the default empty port
 *     string passes because URL omits it for the scheme's standard port)
 *   - literal blocklist hostnames: localhost, *.localhost, *.local
 *   - literal IP in URL that is private/loopback/link-local
 *   - DNS-resolved IP (any address returned by lookup) that is
 *     private/loopback/link-local
 *
 * Caveats:
 *   - This is a TOCTOU check: the IP could change between this guard and
 *     the actual fetch. For P1-B1 the source URLs are admin-curated via
 *     migration so the attack surface is defense-in-depth, not user-input.
 *     A future hardening pass can pin the resolved IP and pass it to fetch
 *     via a custom Agent / Undici dispatcher.
 */
export async function assertUrlIsPublic(rawUrl: string): Promise<UrlGuardResult> {
  let u: URL
  try {
    u = new URL(rawUrl)
  } catch {
    return { ok: false, error: `URL 解析失敗：${rawUrl}` }
  }

  // Scheme
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { ok: false, error: `不支援的 protocol：${u.protocol}（只允許 http / https）` }
  }

  // Port (only allow default 80 / 443; URL.port is '' when implicit)
  if (u.port !== '' && u.port !== '80' && u.port !== '443') {
    return { ok: false, error: `P1-B1 拒絕非標準 port：${u.port}` }
  }

  // Hostname literal blocklist
  let host = u.hostname.toLowerCase()
  // Strip IPv6 brackets if present (URL.hostname keeps them off, but be safe)
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1)

  if (host === '' || host === 'localhost' || host.endsWith('.localhost')) {
    return { ok: false, error: `禁止的 hostname：${host || '(empty)'}` }
  }
  if (host.endsWith('.local')) {
    return { ok: false, error: `禁止 mDNS / .local hostname：${host}` }
  }

  // If hostname is a literal IP, check directly.
  const ipKind = isIP(host)
  if (ipKind === 4 || ipKind === 6) {
    if (isPrivateOrLoopbackIp(host)) {
      return { ok: false, error: `禁止內網 / 回環 IP：${host}` }
    }
    return { ok: true, error: null }
  }

  // Otherwise DNS-resolve and check every returned address.
  try {
    const addrs = await dnsLookup(host, { all: true })
    if (!addrs || addrs.length === 0) {
      return { ok: false, error: `DNS 解析無結果：${host}` }
    }
    for (const a of addrs) {
      if (isPrivateOrLoopbackIp(a.address)) {
        return {
          ok: false,
          error: `${host} 解析到內網 / 回環 IP：${a.address}`,
        }
      }
    }
    return { ok: true, error: null }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `DNS lookup 失敗：${msg}` }
  }
}

// ── 1. fetchPublicHtml ─────────────────────────────────────────────────────

/**
 * Public-only HTTP GET. Fails gracefully on:
 *   - non-2xx (including 403 / 429 / 5xx — no retry)
 *   - Cloudflare challenge pages (server: cloudflare AND status in {403, 503})
 *   - bytes over MAX_HTML_BYTES (truncates body, keeps response)
 *   - AbortSignal timeout
 *
 * Returns FetchResult with `ok=false` and an error message rather than
 * throwing. Caller appends the error to errors[] and continues.
 *
 * No cookie, no Authorization, no Referer, no headless browser. User-Agent
 * identifies the bot.
 */
export async function fetchPublicHtml(url: string): Promise<FetchResult> {
  // SSRF / internal-URL guard — must run BEFORE any network I/O.
  // Failing this also means we never call Claude / never touch the page.
  const guard = await assertUrlIsPublic(url)
  if (!guard.ok) {
    return {
      ok: false,
      html: null,
      status: 0,
      finalUrl: url,
      bytesRead: 0,
      wasByteTruncated: false,
      error: `URL 拒絕（SSRF guard）：${guard.error}`,
    }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en, ko, zh',
      },
      signal: controller.signal,
      cache: 'no-store',
      redirect: 'follow',
    })

    if (!res.ok) {
      const cfHeader = res.headers.get('server')?.toLowerCase() ?? ''
      const looksLikeCloudflare =
        cfHeader.includes('cloudflare') &&
        (res.status === 403 || res.status === 503)
      const msg = looksLikeCloudflare
        ? `Cloudflare/bot protection (status ${res.status})`
        : `HTTP ${res.status}`
      return {
        ok: false,
        html: null,
        status: res.status,
        finalUrl: res.url,
        bytesRead: 0,
        wasByteTruncated: false,
        error: msg,
      }
    }

    // Read with byte cap.
    const reader = res.body?.getReader()
    if (!reader) {
      const text = await res.text()
      const bytes = new TextEncoder().encode(text).length
      return {
        ok: true,
        html: text.slice(0, MAX_HTML_BYTES),
        status: res.status,
        finalUrl: res.url,
        bytesRead: bytes,
        wasByteTruncated: bytes > MAX_HTML_BYTES,
        error: null,
      }
    }

    const chunks: Uint8Array[] = []
    let total = 0
    let truncated = false
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        total += value.byteLength
        if (total > MAX_HTML_BYTES) {
          // Keep only up to the cap, drop the overflow tail.
          const allowed = MAX_HTML_BYTES - (total - value.byteLength)
          if (allowed > 0) chunks.push(value.subarray(0, allowed))
          truncated = true
          try {
            await reader.cancel()
          } catch {
            /* ignore */
          }
          break
        }
        chunks.push(value)
      }
    }

    const merged = new Uint8Array(Math.min(total, MAX_HTML_BYTES))
    let offset = 0
    for (const chunk of chunks) {
      merged.set(chunk, offset)
      offset += chunk.byteLength
    }
    const html = new TextDecoder('utf-8', { fatal: false }).decode(merged)

    return {
      ok: true,
      html,
      status: res.status,
      finalUrl: res.url,
      bytesRead: total,
      wasByteTruncated: truncated,
      error: null,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const isAbort = msg.includes('aborted') || msg.includes('abort')
    return {
      ok: false,
      html: null,
      status: 0,
      finalUrl: url,
      bytesRead: 0,
      wasByteTruncated: false,
      error: isAbort ? `fetch timeout (${FETCH_TIMEOUT_MS}ms)` : `fetch failed: ${msg}`,
    }
  } finally {
    clearTimeout(timer)
  }
}

// ── 2. cleanHtmlToText ─────────────────────────────────────────────────────

const STRIP_SELECTORS = [
  'script',
  'style',
  'noscript',
  'nav',
  'footer',
  'header',
  'aside',
  'iframe',
  'svg',
  'form',
  'button',
]

function normaliseWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

export function cleanHtmlToText(html: string): CleanedPage {
  const $ = cheerioLoad(html)

  // Strip non-content nodes first.
  for (const sel of STRIP_SELECTORS) {
    $(sel).remove()
  }

  const pageTitle = normaliseWhitespace($('title').first().text() ?? '')
  const metaDescription = normaliseWhitespace(
    $('meta[name="description"]').attr('content') ??
      $('meta[property="og:description"]').attr('content') ??
      '',
  )

  // Prefer <main> / <article>, fall back to body.
  let bodyHtml = $('main').first().text()
  if (!bodyHtml || bodyHtml.trim().length < 50) {
    bodyHtml = $('article').first().text()
  }
  if (!bodyHtml || bodyHtml.trim().length < 50) {
    bodyHtml = $('body').first().text()
  }
  if (!bodyHtml) bodyHtml = $.root().text()

  let bodyText = normaliseWhitespace(bodyHtml)
  let wasTruncated = false
  if (bodyText.length > MAX_TEXT_LENGTH) {
    bodyText = bodyText.slice(0, MAX_TEXT_LENGTH) + ' [TRUNCATED]'
    wasTruncated = true
  }

  return {
    pageTitle: pageTitle.slice(0, 500),
    metaDescription: metaDescription.slice(0, 1000),
    bodyText,
    wasTruncated,
  }
}

// ── 3. parseWebpageWithClaude ──────────────────────────────────────────────

function isPreviewEventType(v: unknown): v is PreviewEventType {
  return (
    typeof v === 'string' &&
    (PREVIEW_EVENT_TYPES as readonly string[]).includes(v)
  )
}

function isPageRelevance(v: unknown): v is PageRelevance {
  return (
    typeof v === 'string' &&
    (PAGE_RELEVANCE_VALUES as readonly string[]).includes(v)
  )
}

function clampConfidence(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 0
  if (v < 0) return 0
  if (v > 1) return 1
  return Math.round(v * 100) / 100
}

function asOptionalString(v: unknown, maxLen: number): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  if (!t) return null
  return t.slice(0, maxLen)
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim()
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  const body = fenceMatch ? fenceMatch[1] : trimmed
  const firstBrace = body.indexOf('{')
  const lastBrace = body.lastIndexOf('}')
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    throw new Error('LLM 回傳格式錯誤：找不到 JSON 物件')
  }
  return JSON.parse(body.slice(firstBrace, lastBrace + 1))
}

function buildSystemPrompt(): string {
  return [
    'You analyse a single public webpage to determine whether it contains explicit K-pop / idol activity announcements.',
    'Your output MUST be a single JSON object — no markdown, no commentary, no code fences.',
    '',
    'Output schema (all keys required):',
    '{',
    '  "events": [',
    '    {',
    '      "rawTitle": string,                     // required, non-empty',
    '      "eventType": one of the listed enum values OR null,',
    '      "idolHint": string | null,              // artist name as it appears on the page',
    '      "dateHint": string | null,              // raw date phrase as it appears',
    '      "locationHint": string | null,          // raw venue / city phrase',
    '      "confidence": number between 0.0 and 1.0,',
    '      "rawSnippet": string                    // required, original text supporting this',
    '    }',
    '  ],',
    `  "pageRelevance": one of "high" | "medium" | "low" | "none",`,
    '  "parserNote": string | null                 // optional one-line note',
    '}',
    '',
    `Allowed eventType values: ${PREVIEW_EVENT_TYPES.join(', ')}`,
    '',
    'Rules:',
    '- Only extract events that are explicitly stated on the page. Do not infer or guess.',
    '- If the page is not about K-pop / idol activities, return pageRelevance="none" and events=[].',
    '- rawTitle and rawSnippet are REQUIRED. If you cannot copy supporting text from the page, do not emit that event.',
    '- Use null (not empty string, not "unknown") when a field is genuinely absent.',
    '- Set confidence honestly: < 0.5 means low confidence / guess.',
    '- eventType MUST be one of the listed enum values or null. Do not invent new types.',
    '- Maximum events: 10. If the page lists more, return the 10 highest-confidence ones.',
    '- Do not output UUIDs or DB ids. Do not output extra top-level keys.',
  ].join('\n')
}

function buildUserPrompt(
  sourceUrl: string,
  page: CleanedPage,
  hintIdolName: string | null,
): string {
  const hint = hintIdolName
    ? `Admin says this source is mainly about: ${hintIdolName}. Use this as a hint only; do not invent if not present on the page.`
    : 'No specific idol hint from admin.'
  return [
    `source_url: ${sourceUrl}`,
    hint,
    '',
    `page_title: ${page.pageTitle || '(empty)'}`,
    `meta_description: ${page.metaDescription || '(empty)'}`,
    `page_was_truncated: ${page.wasTruncated}`,
    '',
    'body_text:',
    '"""',
    page.bodyText,
    '"""',
    '',
    'Return the JSON object now.',
  ].join('\n')
}

export interface ClaudeParseInput {
  sourceUrl: string
  page: CleanedPage
  hintIdolName?: string | null
}

/**
 * Calls Claude Haiku with strict JSON output. Throws on:
 *   - missing ANTHROPIC_API_KEY
 *   - SDK / network failure
 *   - non-JSON response
 *   - response missing required top-level keys
 *
 * Per-event validation is non-throwing: an invalid event entry is dropped
 * (not the whole call). Result.events is capped at MAX_EVENTS_PER_PAGE.
 */
export async function parseWebpageWithClaude(
  input: ClaudeParseInput,
): Promise<ClaudeParseResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY 未設定（請至 Vercel env vars 補上）')
  }

  const model = resolveAnthropicModel()
  const client = new Anthropic({ apiKey })

  let responseText: string
  try {
    const resp = await client.messages.create({
      model,
      max_tokens: 1500,
      system: buildSystemPrompt(),
      messages: [
        {
          role: 'user',
          content: buildUserPrompt(
            input.sourceUrl,
            input.page,
            input.hintIdolName ?? null,
          ),
        },
      ],
    })
    const textBlock = resp.content.find((c) => c.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('LLM 沒有回傳文字內容')
    }
    responseText = textBlock.text
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`AI 呼叫失敗：${msg}`)
  }

  let parsed: Record<string, unknown>
  try {
    const obj = extractJsonObject(responseText)
    if (!obj || typeof obj !== 'object') {
      throw new Error('LLM 回傳不是 JSON 物件')
    }
    parsed = obj as Record<string, unknown>
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`AI 回傳格式錯誤：${msg}`)
  }

  if (!('events' in parsed) || !('pageRelevance' in parsed)) {
    throw new Error('AI 回傳缺少必要欄位（events / pageRelevance）')
  }

  const rawEvents = Array.isArray(parsed.events) ? parsed.events : []
  const events: PreviewEvent[] = []
  for (const raw of rawEvents) {
    if (!raw || typeof raw !== 'object') continue
    const e = raw as Record<string, unknown>
    const rawTitle = asOptionalString(e.rawTitle, 300)
    const rawSnippet = asOptionalString(e.rawSnippet, 800)
    if (!rawTitle || !rawSnippet) continue
    events.push({
      rawTitle,
      eventType: isPreviewEventType(e.eventType) ? e.eventType : null,
      idolHint: asOptionalString(e.idolHint, 200),
      dateHint: asOptionalString(e.dateHint, 100),
      locationHint: asOptionalString(e.locationHint, 200),
      confidence: clampConfidence(e.confidence),
      rawSnippet,
    })
  }

  let pageRelevance: PageRelevance = isPageRelevance(parsed.pageRelevance)
    ? parsed.pageRelevance
    : 'none'

  // Coherence: if page is "none", drop any events the model still emitted.
  // (Defensive: the prompt asks for [], but trust no LLM.)
  let finalEvents = events
  let truncatedEvents = 0
  if (pageRelevance === 'none') {
    truncatedEvents = events.length
    finalEvents = []
  } else if (events.length > MAX_EVENTS_PER_PAGE) {
    finalEvents = events
      .slice()
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, MAX_EVENTS_PER_PAGE)
    truncatedEvents = events.length - MAX_EVENTS_PER_PAGE
  }

  // If we have no events but model said something other than "none",
  // demote to "low" — keeps the contract that "none" means empty.
  if (finalEvents.length === 0 && pageRelevance !== 'none') {
    pageRelevance = 'none'
  }

  const parserNote = asOptionalString(parsed.parserNote, 500)

  return {
    events: finalEvents,
    pageRelevance,
    parserNote,
    model,
    truncatedEvents,
  }
}

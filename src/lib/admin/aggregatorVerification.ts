import 'server-only'

import Anthropic from '@anthropic-ai/sdk'

export const VERIFICATION_CONFIG = {
  model: 'claude-sonnet-4-6',
  toolType: 'web_search_20260209',
  allowedCallers: ['direct'] as const,
  maxUses: 3,
  maxTokens: 16384,
  blockedDomains: ['kpopofficial.com'] as const,
  timeoutMs: 90_000,
}

export const VERIFICATION_SOURCE_DOMAINS = {
  venue: [
    'kaitaksportspark.com.hk',
    'sofistadium.com',
    'gillettestadium.com',
    'galaxymacau.com',
    'tokyo-dome.co.jp',
    'msg.com',
    'rosemont.com',
    'wamutheater.com',
    'thekiaforum.com',
    'greatcanadian.com',
  ],
} as const

type CandidateRow = {
  id: string
  raw_title: string
  detected_idol_id: string | null
  detected_date: string | null
  detected_start_date: string | null
  detected_end_date: string | null
  detected_date_label: string | null
  detected_city: string | null
  detected_venue_name: string | null
  source_name: string | null
  source_type: string | null
  source_url: string | null
}

type Citation = { url: string; title: string; cited_text: string | null }

export type VerificationEvidence = {
  url: string
  canonicalUrl?: string
  title: string
  citedText: string
  sourceClass: string
  fieldMatches: { artist: boolean; dates: boolean; venueOrCity: boolean }
  confidence: 'high' | 'medium' | 'low'
}

export type VerificationResult = {
  status:
    | 'confirmed'
    | 'unconfirmed'
    | 'contradicted'
    | 'citation_unbound'
    | 'field_mismatch'
    | 'no_match'
    | 'provider_error'
  evidence: VerificationEvidence[]
  providerMeta: Record<string, unknown>
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function normalize(value: string | null | undefined): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function canonicalizeUrl(value: string): string {
  try {
    const url = new URL(value)
    url.hash = ''
    for (const key of Array.from(url.searchParams.keys())) {
      if (/^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$)/i.test(key)) url.searchParams.delete(key)
    }
    return url.toString().replace(/\/$/, '')
  } catch {
    return value
  }
}

function parseIsoDate(value: string | null): Date | null {
  if (!value) return null
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return null
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
}

function candidateDates(candidate: CandidateRow): Date[] {
  const start = parseIsoDate(candidate.detected_start_date ?? candidate.detected_date)
  const end = parseIsoDate(candidate.detected_end_date ?? candidate.detected_start_date ?? candidate.detected_date)
  if (!start) return []
  if (!end || end <= start) return [start]
  const dates: Date[] = []
  for (let date = new Date(start); date <= end && dates.length < 31; date.setUTCDate(date.getUTCDate() + 1)) {
    dates.push(new Date(date))
  }
  return dates
}

function dateLiteral(date: Date, text: string): boolean {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + 1
  const day = date.getUTCDate()
  const monthNames = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
  ]
  const monthName = monthNames[month - 1]
  const abbreviated = monthName.slice(0, 3)
  const lower = text.toLowerCase()
  return (
    new RegExp(`\\b${year}[-/.]0?${month}[-/.]0?${day}\\b`).test(lower) ||
    new RegExp(`\\b${month}[/.-]0?${day}[/.-]${String(year).slice(2)}\\b`).test(lower) ||
    new RegExp(`\\b${monthName}\\s+0?${day}(?:st|nd|rd|th)?[ ,]+${year}\\b`).test(lower) ||
    new RegExp(`\\b${abbreviated}\\.?\\s+0?${day}(?:st|nd|rd|th)?[ ,]+${year}\\b`).test(lower) ||
    new RegExp(`\\b0?${day}\\s+${monthName}\\s+${year}\\b`).test(lower) ||
    new RegExp(`\\b${monthName}\\s+0?${day}(?:st|nd|rd|th)?\\b`).test(lower) ||
    new RegExp(`\\b${abbreviated}\\.?\\s+0?${day}(?:st|nd|rd|th)?\\b`).test(lower) ||
    new RegExp(`\\b0?${month}[/.-]0?${day}\\b`).test(lower)
  )
}

function datesMatch(candidate: CandidateRow, text: string): boolean {
  const dates = candidateDates(candidate)
  return dates.length > 0 && dates.every((date) => dateLiteral(date, text))
}

function venueLiteralMatch(venue: string | null, text: string): boolean {
  const expected = normalize(venue).replace(/^the /, '')
  const actual = normalize(text)
  if (!expected) return false
  if (actual.includes(expected)) return true
  const tokens = expected.split(' ').filter((token) => !['at', 'the', 'in'].includes(token))
  for (let size = Math.min(4, tokens.length); size >= 2; size -= 1) {
    for (let index = 0; index <= tokens.length - size; index += 1) {
      const fragment = tokens.slice(index, index + size).join(' ')
      if (fragment.length >= 8 && actual.includes(fragment)) return true
    }
  }
  return false
}

function artistMatch(artist: string | null, text: string): boolean {
  return Boolean(artist) && normalize(text).includes(normalize(artist))
}

function sourceClass(url: string): string {
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return 'unknown'
  }
  if (VERIFICATION_SOURCE_DOMAINS.venue.some((domain) => host === domain || host.endsWith(`.${domain}`))) return 'venue'
  if (/ticketmaster|livenation|axs\.com|ticketweb|seatgeek|eventbrite/.test(host)) return 'ticketing'
  if (/billboard|koreajoongangdaily|koreatimes|soompi|consequence|complex/.test(host)) return 'reliable_media'
  if (/smtown|ygfamily|jype|jypent|hybecorp|bighitmusic|beliftlab|cubeent|fncent|wmentertainment/.test(host)) return 'official_artist_company'
  return 'unknown'
}

const VENUE_DOMAIN_ALIASES: Record<string, string[]> = {
  'kaitaksportspark.com.hk': ['kai tak', 'kai tak sports park'],
  'sofistadium.com': ['sofi'],
  'gillettestadium.com': ['gillette'],
  'galaxymacau.com': ['galaxy arena', 'galaxy macau'],
  'tokyo-dome.co.jp': ['tokyo dome'],
  'msg.com': ['madison square garden', 'msg'],
  'rosemont.com': ['rosemont'],
  'wamutheater.com': ['wamu'],
  'thekiaforum.com': ['kia forum'],
  'greatcanadian.com': ['great canadian'],
}

function venueDomainSelfMatch(candidate: CandidateRow, citation: Citation): boolean {
  try {
    const host = new URL(citation.url).hostname.toLowerCase().replace(/^www\./, '')
    const domain = VERIFICATION_SOURCE_DOMAINS.venue.find((item) => host === item || host.endsWith(`.${item}`))
    if (!domain) return false
    const expectedVenue = normalize(candidate.detected_venue_name)
    const aliases = VENUE_DOMAIN_ALIASES[domain] ?? []
    return aliases.some((alias) => expectedVenue.includes(normalize(alias)))
  } catch {
    return false
  }
}

function parseVerdict(text: string): 'CONFIRMED' | 'UNCONFIRMED' | 'CONTRADICTED' | 'UNPARSED' {
  return (text.match(/VERDICT\s*:\s*\**\s*(CONFIRMED|UNCONFIRMED|CONTRADICTED)/i)?.[1]?.toUpperCase() ?? 'UNPARSED') as
    | 'CONFIRMED' | 'UNCONFIRMED' | 'CONTRADICTED' | 'UNPARSED'
}

function promptFor(candidate: CandidateRow, artist: string): string {
  return `Verify exactly one K-pop event candidate using web search. Do not bundle another event.

Candidate ID: ${candidate.id}
Artist: ${artist}
Claimed dates: ${candidate.detected_date_label ?? candidate.detected_start_date ?? candidate.detected_date ?? 'unknown'}
Claimed venue: ${candidate.detected_venue_name ?? 'unknown'}
Claimed city/country: ${candidate.detected_city ?? 'unknown'}
Raw candidate title: ${candidate.raw_title}

Strict evidence rules (do not relax): exclude kpopofficial.com and all other event aggregators as evidence; accept only an official artist/company, promoter, venue, ticketing, or reliable media source; artist AND exact date(s) must match (timezone tolerance only ±1 day); venue/city must not conflict; a general tour announcement without this stop/date is not a match. Return UNCONFIRMED if no qualifying source is found and CONTRADICTED if reliable evidence conflicts.

Return only these compact fields, in this order. Cite factual claims with the web-search citation mechanism:
VERDICT: CONFIRMED | UNCONFIRMED | CONTRADICTED
ARTIST_MATCH: true | false
DATE_MATCH: true | false
VENUE_OR_CITY_MATCH: true | false
MATCHED_DATES: ...
SOURCE_QUALITY: official_artist_company | promoter | venue | ticketing | reliable_media | none
SOURCE_URLS: ...
REASON: one short factual sentence`
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('verification timeout')), ms)),
  ])
}

async function callProvider(candidate: CandidateRow, artist: string) {
  const prompt = promptFor(candidate, artist)
  const tool = {
    type: VERIFICATION_CONFIG.toolType,
    name: 'web_search',
    max_uses: VERIFICATION_CONFIG.maxUses,
    blocked_domains: [...VERIFICATION_CONFIG.blockedDomains],
    allowed_callers: [...VERIFICATION_CONFIG.allowedCallers],
  }
  const started = Date.now()
  const deadline = started + VERIFICATION_CONFIG.timeoutMs
  let response: Awaited<ReturnType<typeof anthropic.messages.create>> | null = null
  let messages: Array<{ role: 'user' | 'assistant'; content: string | unknown }> = [{ role: 'user', content: prompt }]
  const usageTotals = { input_tokens: 0, output_tokens: 0, web_search_requests: 0 }
  try {
    for (let turn = 0; turn < 4; turn += 1) {
      const remainingMs = deadline - Date.now()
      if (remainingMs <= 0) throw new Error('verification timeout')
      response = await withTimeout(anthropic.messages.create({
        model: VERIFICATION_CONFIG.model,
        max_tokens: VERIFICATION_CONFIG.maxTokens,
        temperature: 0,
        messages: messages as never,
        // SDK 0.96.0 predates the web_search_20260209 type; preserve the
        // provider payload while keeping the rest of the request typed.
        tools: [tool as never],
      }), remainingMs)
      usageTotals.input_tokens += response.usage.input_tokens ?? 0
      usageTotals.output_tokens += response.usage.output_tokens ?? 0
      usageTotals.web_search_requests += response.usage.server_tool_use?.web_search_requests ?? 0
      if (response.stop_reason !== 'pause_turn') break
      messages = [...messages, { role: 'assistant', content: response.content }]
    }
    if (!response) throw new Error('empty provider response')
    const incomplete = response.stop_reason === 'pause_turn'
    const blocks = response.content ?? []
    const text = blocks.filter((block) => block.type === 'text').map((block) => block.text).join('\n')
    const citations = blocks
      .flatMap((block) => ('citations' in block && Array.isArray(block.citations) ? block.citations : []))
      .filter((citation) => citation.type === 'web_search_result_location')
      .map((citation) => {
        const item = citation as unknown as { url: string; title: string; cited_text?: string }
        return { url: item.url, title: item.title, cited_text: item.cited_text ?? null }
      })
    const toolResults = blocks.filter((block) => block.type === 'web_search_tool_result')
    const providerError = toolResults.some((block) => 'content' in block && !Array.isArray(block.content))
    const noMatch = toolResults.length > 0 && toolResults.every((block) => 'content' in block && Array.isArray(block.content) && block.content.length === 0)
    return {
      text,
      citations,
      verdict: parseVerdict(text),
      classification: incomplete || providerError ? 'provider_error' : noMatch ? 'no_match' : 'completed_with_results',
      stopReason: response.stop_reason,
      latencyMs: Date.now() - started,
      usage: usageTotals,
      searches: usageTotals.web_search_requests,
    }
  } catch (error) {
    return {
      text: '', citations: [], verdict: 'UNPARSED' as const, classification: 'provider_error' as const,
      stopReason: null, latencyMs: Date.now() - started, usage: null, searches: 0,
      error: error instanceof Error ? error.message : 'provider request failed',
    }
  }
}

export function evaluateCitationBindings(candidate: CandidateRow, artist: string, citations: Citation) {
  const artistOk = artistMatch(artist, citations.cited_text ?? '')
  const datesOk = datesMatch(candidate, citations.cited_text ?? '')
  const venueLiteral = venueLiteralMatch(candidate.detected_venue_name, citations.cited_text ?? '')
  const domainOk = venueDomainSelfMatch(candidate, citations)
  const source = sourceClass(citations.url)
  const qualifyingSource = source !== 'unknown'
  return { citation: citations, artistOk, datesOk, venueOk: venueLiteral || domainOk, domainOk, qualifyingSource, bound: artistOk && datesOk && (venueLiteral || domainOk) && qualifyingSource }
}

export async function verifyCandidate(candidate: CandidateRow, artist: string): Promise<VerificationResult> {
  const attempts = [await callProvider(candidate, artist)]
  const first = attempts[0]
  const firstChecks = first.citations.map((citation) => evaluateCitationBindings(candidate, artist, citation))
  if (first.verdict === 'CONFIRMED' && first.classification === 'completed_with_results' && !firstChecks.some((check) => check.bound)) {
    attempts.push(await callProvider(candidate, artist))
  }
  const final = attempts[attempts.length - 1]
  const checks = final.citations.map((citation) => evaluateCitationBindings(candidate, artist, citation))
  const bound = checks.filter((check) => check.bound)
  const providerMeta = {
    provider: 'anthropic', model: VERIFICATION_CONFIG.model, tool: VERIFICATION_CONFIG.toolType,
    allowed_callers: VERIFICATION_CONFIG.allowedCallers, max_uses: VERIFICATION_CONFIG.maxUses,
    max_tokens: VERIFICATION_CONFIG.maxTokens, blocked_domains: VERIFICATION_CONFIG.blockedDomains,
    query: { artist, city: candidate.detected_city, venue: candidate.detected_venue_name, dates: candidate.detected_date_label ?? candidate.detected_date },
    venueDomainSelfIdentification: checks.filter((check) => check.domainOk).map((check) => new URL(check.citation.url).hostname),
    attempts: attempts.map((attempt) => ({ classification: attempt.classification, verdict: attempt.verdict, stopReason: attempt.stopReason, latencyMs: attempt.latencyMs, usage: attempt.usage, webSearchRequests: attempt.searches, error: 'error' in attempt ? attempt.error : undefined })),
    observedAt: new Date().toISOString(),
  }
  let status: VerificationResult['status']
  if (final.classification === 'provider_error') status = 'provider_error'
  else if (final.classification === 'no_match') status = 'no_match'
  else if (final.verdict === 'UNCONFIRMED') status = 'unconfirmed'
  else if (final.verdict === 'CONTRADICTED') status = 'contradicted'
  else if (final.verdict !== 'CONFIRMED') status = 'provider_error'
  else if (bound.length === 0 && checks.some((check) => check.artistOk) && checks.some((check) => check.datesOk) && checks.some((check) => check.venueOk)) status = 'citation_unbound'
  else if (bound.length === 0) status = 'field_mismatch'
  else status = 'confirmed'
  const evidence = bound.map((check) => ({
    url: check.citation.url, canonicalUrl: canonicalizeUrl(check.citation.url), title: check.citation.title,
    citedText: check.citation.cited_text ?? '', sourceClass: sourceClass(check.citation.url),
    fieldMatches: { artist: check.artistOk, dates: check.datesOk, venueOrCity: check.venueOk },
    confidence: sourceClass(check.citation.url) === 'venue' || sourceClass(check.citation.url) === 'ticketing' ? 'high' as const : 'medium' as const,
  }))
  return { status, evidence, providerMeta }
}

export type { CandidateRow }

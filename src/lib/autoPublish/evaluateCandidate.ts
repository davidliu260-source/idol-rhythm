import { getReviewSourceInfo, matchesAggregatorPattern } from '../admin/sourceReview'
import { isEventEnded, toDateKey } from '../taipeiDate'
import { locationFromRawData, locationFromRawContent } from '../crawlers/candidateLocation'

export const AUTO_PUBLISH_RULE_VERSION = 't34-v2'

/** 與 runGenericWebpageFetcher.COMMIT_CONFIDENCE_THRESHOLD 同值；不要 import 那支檔（會帶入 supabase/anthropic）。 */
export const LOW_CONFIDENCE_THRESHOLD = 0.65

/** ai_confidence 為 null 時視為信心通過的已知 parser（現況爬蟲不呼叫 AI）。 */
export const NULL_CONFIDENCE_OK_PARSERS = [
  'jyp_schedule', 'jyp_notice', 'yg_artist_schedule', 'smtown_notice', 'wakeone_notice',
  'blackpink_official_tour', 'kpopofficial_concerts', 'youtube_official_channel',
] as const

/** 允許自動上架的非官方整理站（以 parser_type 判斷）。 */
export const AGGREGATOR_PARSER_ALLOWLIST = ['kpopofficial_concerts'] as const

export type AutoPublishAction = 'publish_official' | 'publish_aggregator' | 'park' | 'skip'
export type PublishTrustLevel = 'official' | 'media' | 'aggregator'
export type LocationStatus = 'has_location' | 'location_pending'

/** 順序即優先序：parkReason 取第一個命中的。不得加入任何「缺地點」類代碼。 */
export const PARK_REASONS = [
  'fan_account',
  'unknown_source',
  'aggregator_not_allowlisted',
  'missing_title',
  'missing_idol',
  'unmatched_idol',
  'inactive_idol',
  'missing_date',
  'expired',
  'low_confidence',
  'unknown_parser',
  'duplicate',
] as const
export type ParkReason = (typeof PARK_REASONS)[number]

export const SKIP_REASONS = [
  'not_in_scope',
  'auto_publish_blocked',
  'linked_event_cancelled',
  'already_published',
  'source_url_matches_published_event',
] as const
export type SkipReason = (typeof SKIP_REASONS)[number]
export interface CandidateInput {
  id: string
  review_status: string
  raw_title: string | null
  raw_content?: string | null
  raw_data?: unknown
  detected_idol_id: string | null
  detected_event_type?: string | null
  detected_date: string | null
  detected_start_date?: string | null
  detected_end_date?: string | null
  detected_city?: string | null
  detected_venue_name?: string | null
  detected_address?: string | null
  location_name_zh?: string | null
  display_title_zh?: string | null
  source_url: string | null
  source_name: string | null
  source_type: string | null
  source_hash?: string | null
  ai_confidence: number | string | null
  approved_event_id?: string | null
  created_at?: string | null
}

export interface CrawlerSourceInput {
  id: string
  source_key: string
  name: string
  parser_type: string
  source_type: string
  source_url?: string | null
  is_active?: boolean
}

export interface IdolInput { id: string; name?: string | null; is_active: boolean }

export interface ExistingEventInput {
  id: string
  idol_id: string
  title: string
  display_title_zh?: string | null
  date: string
  start_date?: string | null
  end_date?: string | null
  is_published: boolean
  trust_level: string
  status: string
  auto_publish_blocked?: boolean | null
  auto_publish_blocked_reason?: string | null
  time?: string | null
  description?: string | null
  display_summary_zh?: string | null
  ticket_url?: string | null
  stream_url?: string | null
  city?: string | null
  venue_name?: string | null
  address?: string | null
  location_name_zh?: string | null
  location?: string | null
}

export interface EventSourceInput { event_id: string; url: string | null }

export interface EvaluationContext {
  now: Date
  idols: ReadonlyArray<IdolInput>
  crawlerSources: ReadonlyArray<CrawlerSourceInput>
  events: ReadonlyArray<ExistingEventInput>
  eventSources: ReadonlyArray<EventSourceInput>
}
export interface DetectedLocation {
  detected_city: string | null
  detected_venue_name: string | null
  detected_address: string | null
}

interface DecisionBase {
  ruleVersion: typeof AUTO_PUBLISH_RULE_VERSION
  candidateId: string
  crawlerSourceId: string | null
  parserType: string | null
}

export type AutoPublishDecision =
  | (DecisionBase & {
      action: 'publish_official' | 'publish_aggregator'
      trustLevel: PublishTrustLevel           // publish_aggregator 時必為 'aggregator'
      target: 'create_event' | 'publish_existing_event'
      existingEventId: string | null          // target = publish_existing_event 時為連結活動 id
      locationStatus: LocationStatus
      rawLocation: DetectedLocation | null     // 僅在 location_pending 且 raw 有地點時非 null
      rawLocationOrigin: 'raw_data' | 'raw_content' | null
      eventType: string | null                // detected_event_type；null 由 PR-3 決定預設，本票不臆造
    })
  | (DecisionBase & { action: 'park'; parkReason: ParkReason; allReasons: ParkReason[] })
  | (DecisionBase & { action: 'skip'; skipReason: SkipReason; existingEventId: string | null })

const text = (v: unknown): string | null => typeof v === 'string' ? v.trim() || null : null
const raw = (c: CandidateInput): Record<string, unknown> => c.raw_data && typeof c.raw_data === 'object' && !Array.isArray(c.raw_data) ? c.raw_data as Record<string, unknown> : {}
function source(c: CandidateInput, ctx: EvaluationContext) {
  const r = raw(c)
  const crawlerSourceId = text(r.crawler_source_id ?? r.crawlerSourceId)
  const cs = ctx.crawlerSources.find(s => s.id === crawlerSourceId)
  const parserType = cs?.parser_type ?? text(r.parser_type) ?? (r.provider === 'generic_webpage' ? 'generic_webpage' : null)
  return { crawlerSourceId, parserType, input: { sourceName: c.source_name ?? cs?.name, sourceType: c.source_type ?? cs?.source_type, sourceUrl: c.source_url ?? cs?.source_url } }
}
export function resolveSourceTier(c: CandidateInput, ctx: EvaluationContext): { tier: PublishTrustLevel } | { parkReason: 'fan_account' | 'unknown_source' | 'aggregator_not_allowlisted' } {
  const { input, parserType } = source(c, ctx)
  if (input.sourceType?.toLowerCase() === 'fan_account') return { parkReason: 'fan_account' }
  const info = getReviewSourceInfo(input)
  if (info.risk === 'official') return { tier: 'official' }
  if (info.risk === 'unknown') return { parkReason: 'unknown_source' }
  if (info.risk === 'media' && !matchesAggregatorPattern(input)) return { tier: 'media' }
  return AGGREGATOR_PARSER_ALLOWLIST.some(p => p === parserType) ? { tier: 'aggregator' } : { parkReason: 'aggregator_not_allowlisted' }
}
export function normalizeTitleKey(value: string | null | undefined): string {
  return String(value ?? '').normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ')
}
const titles = (c: CandidateInput) => [c.raw_title, text(raw(c).title), c.display_title_zh].map(normalizeTitleKey).filter(Boolean)
const dateKey = (c: CandidateInput) => toDateKey(c.detected_start_date ?? c.detected_date)
const visible = (e: ExistingEventInput) => e.is_published === true && ['official', 'media', 'aggregator'].includes(e.trust_level) && e.status !== 'cancelled'
export function evaluateCandidate(c: CandidateInput, ctx: EvaluationContext): AutoPublishDecision {
  const { crawlerSourceId, parserType } = source(c, ctx)
  const base: DecisionBase = { ruleVersion: AUTO_PUBLISH_RULE_VERSION, candidateId: c.id, crawlerSourceId, parserType }
  const skip = (skipReason: SkipReason, existingEventId: string | null = null): AutoPublishDecision => ({ ...base, action: 'skip', skipReason, existingEventId })
  if (!['pending', 'approved'].includes(c.review_status)) return skip('not_in_scope')
  const linked = ctx.events.find(e => e.id === c.approved_event_id)
  if (linked?.auto_publish_blocked) return skip('auto_publish_blocked', linked.id)
  if (linked?.status === 'cancelled') return skip('linked_event_cancelled', linked.id)
  if (linked && visible(linked)) return skip('already_published', linked.id)
  let urlDuplicate = false
  if (!linked && text(c.source_url)) {
    const matches = ctx.eventSources.filter(s => text(s.url) === text(c.source_url)).flatMap(s => ctx.events.filter(e => e.id === s.event_id))
    const blocked = matches.find(e => e.auto_publish_blocked)
    if (blocked) return skip('auto_publish_blocked', blocked.id)
    const published = matches.find(visible)
    if (published) return skip('source_url_matches_published_event', published.id)
    urlDuplicate = matches.length > 0
  }
  const reasons = new Set<ParkReason>()
  const tier = resolveSourceTier(c, ctx)
  if ('parkReason' in tier) reasons.add(tier.parkReason)
  if (!text(c.raw_title)) reasons.add('missing_title')
  const idol = ctx.idols.find(i => i.id === c.detected_idol_id)
  if (!text(c.detected_idol_id)) reasons.add('missing_idol')
  else if (!idol) reasons.add('unmatched_idol')
  else if (!idol.is_active) reasons.add('inactive_idol')
  if (!dateKey(c)) reasons.add('missing_date')
  else if (isEventEnded({ date: c.detected_start_date ?? c.detected_date!, endDate: c.detected_end_date }, ctx.now) === true) reasons.add('expired')
  const n = c.ai_confidence === null ? NaN : Number(c.ai_confidence)
  if (Number.isFinite(n)) { if (n < LOW_CONFIDENCE_THRESHOLD) reasons.add('low_confidence') }
  else if (!NULL_CONFIDENCE_OK_PARSERS.some(p => p === parserType)) reasons.add('unknown_parser')
  if (!reasons.size && (urlDuplicate || ctx.events.some(e => e.id !== linked?.id && e.idol_id === c.detected_idol_id && toDateKey(e.start_date ?? e.date) === dateKey(c) && [e.title, e.display_title_zh].map(normalizeTitleKey).some(t => t && titles(c).includes(t))))) reasons.add('duplicate')
  const allReasons = PARK_REASONS.filter(r => reasons.has(r))
  if (allReasons.length) return { ...base, action: 'park', parkReason: allReasons[0], allReasons }
  if (!('tier' in tier)) throw new Error('Unresolved source tier')
  const hasLocation = [c.detected_city, c.detected_venue_name, c.detected_address, c.location_name_zh, ...(linked ? [linked.city, linked.venue_name, linked.address, linked.location_name_zh, linked.location] : [])].some(v => text(v))
  const dataLocation = hasLocation ? null : locationFromRawData(c.raw_data)
  const contentLocation = hasLocation || dataLocation ? null : locationFromRawContent(c.raw_content)
  return { ...base, action: tier.tier === 'aggregator' ? 'publish_aggregator' : 'publish_official', trustLevel: tier.tier, target: linked ? 'publish_existing_event' : 'create_event', existingEventId: linked?.id ?? null, locationStatus: hasLocation ? 'has_location' : 'location_pending', rawLocation: dataLocation ?? contentLocation, rawLocationOrigin: dataLocation ? 'raw_data' : contentLocation ? 'raw_content' : null, eventType: c.detected_event_type ?? null }
}
const lexical = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0

export function evaluateCandidates(candidates: ReadonlyArray<CandidateInput>, ctx: EvaluationContext): AutoPublishDecision[] {
  const results = new Map<CandidateInput, AutoPublishDecision>()
  const published: CandidateInput[] = []
  for (const c of [...candidates].sort((a, b) => lexical(a.created_at ?? '', b.created_at ?? '') || lexical(a.id, b.id))) {
    let d = evaluateCandidate(c, ctx)
    if (d.action.startsWith('publish')) {
      if (published.some(p => p.detected_idol_id === c.detected_idol_id && dateKey(p) === dateKey(c) && titles(p).some(t => titles(c).includes(t)))) d = { ruleVersion: d.ruleVersion, candidateId: d.candidateId, crawlerSourceId: d.crawlerSourceId, parserType: d.parserType, action: 'park', parkReason: 'duplicate', allReasons: ['duplicate'] }
      else published.push(c)
    }
    results.set(c, d)
  }
  return candidates.map(c => results.get(c)!)
}

import { evaluateCandidates, AUTO_PUBLISH_RULE_VERSION } from './evaluateCandidate'
import type { CandidateInput, EvaluationContext, ExistingEventInput, PublishTrustLevel, ParkReason } from './evaluateCandidate'
import { inferEventType } from './inferEventType'
import type { InferRule } from './inferEventType'
import { resolveCandidateLocation, planLocationFill, buildAutofillMetaEntry, appendAutofillMeta } from './locationFill'
import type { FillColumn, LocationGuards, AutofillMetaEntry } from './locationFill'
import { normalizeCrawledEvent } from '../crawlers/taiwanEventCleanup'
import type { TouchedCandidate } from '../crawlers/touchedCandidate'

export interface CandidateRow extends CandidateInput {
  detected_event_sub_type?: string | null
  display_summary_zh?: string | null
  translation_status?: string | null
  translation_source?: string | null
  translation_updated_at?: string | null
  detected_date_label?: string | null
  detected_map_url?: string | null
}
export interface EventRow extends ExistingEventInput { location_autofill_meta?: unknown }
export type LocationPatch = Partial<Record<FillColumn, string>> & { location_autofilled_at: string; location_autofill_meta: AutofillMetaEntry[] }
export type PublishPatch = Partial<LocationPatch> & { is_published: true; published_at: string; auto_published_at: string; auto_publish_rule_version: 't34-v1'; trust_level: PublishTrustLevel }
export interface DraftEventInsert {
  idol_id: string; idol_name: string; title: string; type: string; sub_type: string | null
  status: 'confirmed'; trust_level: PublishTrustLevel
  date: string; start_date: string; end_date: string | null; date_label: string | null
  time: null; country: ''; country_flag: ''; location: null; description: null
  display_title_zh: string | null; display_summary_zh: string | null; location_name_zh: string | null
  translation_status: string; translation_source: string | null; translation_updated_at: string | null
  city: string | null; venue_name: string | null; address: string | null; map_url: string | null
  tags: string[]; ticket_url: null; stream_url: null; is_published: false; published_at: null
  auto_publish_rule_version: 't34-v1'; auto_published_at: null; auto_publish_blocked: false
  location_autofilled_at: string | null; location_autofill_meta: AutofillMetaEntry[] | null
}
export interface EventSourceInsert { event_id: string; level: PublishTrustLevel; label: string; type: string; url: string | null }
type Failure = { error: string }
type Updated = { updated: number } | Failure
export interface AutoPublishStore {
  readAutoPublishEnabled(): Promise<{ enabled: boolean } | Failure>
  loadContext(candidateIds: string[]): Promise<{ candidates: CandidateRow[]; ctx: EvaluationContext; idolNames: Map<string, string> } | Failure>
  getEvent(eventId: string): Promise<EventRow | null | Failure>
  insertDraftEvent(row: DraftEventInsert): Promise<{ id: string } | Failure>
  linkCandidate(candidateId: string, eventId: string): Promise<Updated>
  hasEventSourceUrl(eventId: string, url: string): Promise<boolean | Failure>
  insertEventSource(row: EventSourceInsert): Promise<{ ok: true } | Failure>
  publishEvent(eventId: string, patch: PublishPatch, guards: LocationGuards): Promise<Updated>
  fillEventLocation(eventId: string, patch: LocationPatch, guards: LocationGuards): Promise<Updated>
  markCandidateApproved(candidateId: string): Promise<Updated>
  parkCandidate(candidateId: string, reason: ParkReason): Promise<Updated>
}
export interface AutoPublishRunReport {
  ran: boolean; switch: 'on' | 'off' | 'read_error'
  reason?: 'switch_off' | 'switch_read_error' | 'context_error' | 'crawler_dry_run' | 'exception'
  ruleVersion: 't34-v1'; touched: number; evaluated: number
  created: Array<{ candidateId: string; eventId: string; trustLevel: PublishTrustLevel; locationPending: boolean; typeRule: InferRule; cleanupRules?: string[] }>
  publishedExisting: Array<{ candidateId: string; eventId: string; trustLevel: PublishTrustLevel; filledFields: FillColumn[] }>
  locationFilled: Array<{ candidateId: string; eventId: string; fields: Partial<Record<FillColumn, string>> }>
  parked: Partial<Record<ParkReason, number>>; skipped: Record<string, number>
  errors: Array<{ candidateId: string; eventId: string | null; step: string; message: string }>
}
export function emptyAutoPublishReport(): AutoPublishRunReport {
  return { ran: false, switch: 'off', ruleVersion: AUTO_PUBLISH_RULE_VERSION, touched: 0, evaluated: 0, created: [], publishedExisting: [], locationFilled: [], parked: {}, skipped: {}, errors: [] }
}
const message = (e: unknown) => e instanceof Error ? e.message : String(e)
async function safe<T>(call: () => Promise<T>): Promise<T | Failure> {
  try { return await call() } catch (e) { return { error: message(e) } }
}
const failed = (value: unknown): value is Failure => !!value && typeof value === 'object' && 'error' in value
const visible = (e: ExistingEventInput) => e.is_published && ['official','media','aggregator'].includes(e.trust_level) && e.status !== 'cancelled'
export async function runAutoPublish(store: AutoPublishStore, input: { touched: TouchedCandidate[]; now: Date }): Promise<AutoPublishRunReport> {
  const report = emptyAutoPublishReport()
  const touched = new Map<string, TouchedCandidate>()
  for (const item of input.touched) if (!touched.has(item.candidateId)) touched.set(item.candidateId, item)
  report.touched = touched.size
  const enabled = await safe(() => store.readAutoPublishEnabled())
  if (failed(enabled)) { report.switch = 'read_error'; report.reason = 'switch_read_error'; return report }
  if (!enabled.enabled) { report.reason = 'switch_off'; return report }
  report.switch = 'on'; report.ran = true
  if (!touched.size) return report
  const loaded = await safe(() => store.loadContext(Array.from(touched.keys())))
  if (failed(loaded)) {
    report.ran = false; report.reason = 'context_error'
    report.errors.push({ candidateId: '', eventId: null, step: 'context', message: loaded.error })
    return report
  }
  const { candidates, ctx, idolNames } = loaded
  const decisions = evaluateCandidates(candidates, { ...ctx, now: input.now })
  const handledEventIds = new Set<string>()
  const at = input.now.toISOString()
  const skip = (reason: string) => { report.skipped[reason] = (report.skipped[reason] ?? 0) + 1 }
  for (const d of decisions) {
    report.evaluated++
    const c = candidates.find(c => c.id === d.candidateId)!
    let eventId: string | null = null
    let step = 'evaluate'
    const error = (s: string, text: string) => { report.errors.push({ candidateId: c.id, eventId, step: s, message: text }) }
    const requireResult = <T>(v: T | Failure): T => { if (failed(v)) throw new Error(v.error); return v }
    const location = () => resolveCandidateLocation({ candidate: c, freshLocation: touched.get(c.id)?.freshLocation ?? null })
    const fill = (e: EventRow): { patch: LocationPatch; guards: LocationGuards; fields: Partial<Record<FillColumn, string>> } | null => {
      const resolved = location()
      const plan = resolved && planLocationFill(e, resolved.location)
      if (!plan) return null
      const meta = appendAutofillMeta(e.location_autofill_meta, buildAutofillMetaEntry({ filledAt: at, candidateId: c.id, crawlerSourceId: d.crawlerSourceId, fields: plan.fields }))
      if (failed(meta)) { error('location_meta', meta.error); return null }
      return { fields: plan.fields, guards: plan.guards, patch: { ...plan.fields, location_autofilled_at: at, location_autofill_meta: meta } }
    }
    const sourceRow = (id: string, trustLevel: PublishTrustLevel): EventSourceInsert => ({ event_id: id, level: trustLevel, label: c.source_name ?? ctx.crawlerSources.find(s => s.id === d.crawlerSourceId)?.name ?? '候選來源', type: c.source_type ?? 'unknown', url: c.source_url })
    try {
      if (d.action === 'park') {
        if (c.review_status !== 'pending') { skip('approved_not_parked'); continue }
        step = 'park'
        const r = requireResult(await safe(() => store.parkCandidate(c.id, d.parkReason)))
        if (r.updated) report.parked[d.parkReason] = (report.parked[d.parkReason] ?? 0) + 1
        continue
      }
      if (d.action === 'skip') {
        skip(d.skipReason)
        if (!['already_published','source_url_matches_published_event'].includes(d.skipReason)) continue
        eventId = d.existingEventId
        if (d.skipReason === 'source_url_matches_published_event') {
          const ids = new Set(ctx.eventSources.filter(s => s.url?.trim() === c.source_url?.trim()).flatMap(s => ctx.events.filter(e => e.id === s.event_id && visible(e)).map(e => e.id)))
          if (ids.size !== 1) { skip('location_ambiguous'); continue }
          eventId = Array.from(ids)[0]
        }
        if (!eventId) continue
        if (handledEventIds.has(eventId)) { skip('duplicate_event_in_run'); continue }
        step = 'get_event'
        const e = requireResult(await safe(() => store.getEvent(eventId!)))
        if (!e || !visible(e)) { skip('event_state_changed'); continue }
        const planned = fill(e)
        if (!planned) { skip('location.no_fill'); continue }
        step = 'location'
        const r = requireResult(await safe(() => store.fillEventLocation(eventId!, planned.patch, planned.guards)))
        if (!r.updated) { skip('location_conflict'); continue }
        handledEventIds.add(eventId)
        report.locationFilled.push({ candidateId: c.id, eventId, fields: planned.fields })
        continue
      }
      const publishBase = (trust: PublishTrustLevel): PublishPatch => ({ is_published: true, published_at: at, auto_published_at: at, auto_publish_rule_version: AUTO_PUBLISH_RULE_VERSION, trust_level: trust })
      if (d.target === 'create_event') {
        const inferred = inferEventType(c, d.parserType)
        if (!inferred.type) { error('event_type', inferred.rule); continue }
        const resolved = location()
        const fields = resolved ? planLocationFill({}, resolved.location)?.fields ?? {} : {}
        const normalized = normalizeCrawledEvent({
          rawTitle: c.raw_title!,
          sourceName: c.source_name ?? ctx.crawlerSources.find(s => s.id === d.crawlerSourceId)?.name,
          venueName: fields.venue_name ?? c.detected_venue_name,
          locationText: c.location_name_zh,
          city: fields.city,
          type: inferred.type,
          subType: inferred.subType,
        })
        if (!fields.city && normalized.city) fields.city = normalized.city
        const hasLocation = Object.keys(fields).length > 0
        const row: DraftEventInsert = {
          idol_id: c.detected_idol_id!, idol_name: idolNames.get(c.detected_idol_id!) ?? '', title: normalized.title, type: normalized.type ?? inferred.type, sub_type: normalized.subType,
          status: 'confirmed', trust_level: d.trustLevel,
          date: (c.detected_start_date ?? c.detected_date)!, start_date: (c.detected_start_date ?? c.detected_date)!, end_date: c.detected_end_date ?? null, date_label: c.detected_date_label ?? null,
          time: null, country: '', country_flag: '', location: null, description: null,
          display_title_zh: c.display_title_zh ?? null, display_summary_zh: c.display_summary_zh ?? null, location_name_zh: c.location_name_zh ?? null,
          translation_status: c.translation_status ?? 'none', translation_source: c.translation_source ?? null, translation_updated_at: c.translation_updated_at ?? null,
          city: fields.city ?? null, venue_name: fields.venue_name ?? null, address: fields.address ?? null, map_url: c.detected_map_url ?? null,
          tags: [], ticket_url: null, stream_url: null, is_published: false, published_at: null, auto_publish_rule_version: AUTO_PUBLISH_RULE_VERSION, auto_published_at: null, auto_publish_blocked: false,
          location_autofilled_at: hasLocation ? at : null,
          location_autofill_meta: hasLocation ? [buildAutofillMetaEntry({ filledAt: at, candidateId: c.id, crawlerSourceId: d.crawlerSourceId, fields })] : null,
        }
        step = 'insert_draft'
        eventId = requireResult(await safe(() => store.insertDraftEvent(row))).id
        step = 'link'
        if (!requireResult(await safe(() => store.linkCandidate(c.id, eventId!))).updated) { error(step, 'candidate link conflict'); continue }
        step = 'event_source'
        requireResult(await safe(() => store.insertEventSource(sourceRow(eventId!, d.trustLevel))))
        step = 'publish'
        if (!requireResult(await safe(() => store.publishEvent(eventId!, publishBase(d.trustLevel), {}))).updated) { error(step, 'event state changed'); continue }
        handledEventIds.add(eventId)
        report.created.push({ candidateId: c.id, eventId, trustLevel: d.trustLevel, locationPending: !hasLocation && !c.location_name_zh?.trim(), typeRule: inferred.rule, cleanupRules: normalized.rules })
      } else {
        eventId = d.existingEventId
        if (!eventId) { error('get_event', 'missing existing event id'); continue }
        if (handledEventIds.has(eventId)) { skip('duplicate_event_in_run'); continue }
        step = 'get_event'
        const e = requireResult(await safe(() => store.getEvent(eventId!)))
        if (!e || e.is_published !== false || e.auto_publish_blocked !== false || e.status === 'cancelled') { skip('event_state_changed'); continue }
        step = 'event_source'
        if (c.source_url && !requireResult(await safe(() => store.hasEventSourceUrl(eventId!, c.source_url!)))) requireResult(await safe(() => store.insertEventSource(sourceRow(eventId!, d.trustLevel))))
        const levels: PublishTrustLevel[] = ['official', 'media', 'aggregator']
        const old = levels.indexOf(e.trust_level as PublishTrustLevel)
        const trust = old >= 0 && old < levels.indexOf(d.trustLevel) ? e.trust_level as PublishTrustLevel : d.trustLevel
        const planned = fill(e)
        step = 'publish'
        const r = requireResult(await safe(() => store.publishEvent(eventId!, { ...publishBase(trust), ...planned?.patch }, planned?.guards ?? {})))
        if (!r.updated) { skip('event_state_changed'); continue }
        handledEventIds.add(eventId)
        report.publishedExisting.push({ candidateId: c.id, eventId, trustLevel: trust, filledFields: Object.keys(planned?.fields ?? {}) as FillColumn[] })
        step = 'approve'
        requireResult(await safe(() => store.markCandidateApproved(c.id)))
      }
    } catch (e) { error(step, message(e)) }
  }
  return report
}

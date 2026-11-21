import { hasAnyLocation, locationFromRawData, toDetectedLocation } from '../crawlers/candidateLocation'
import { AUTO_PUBLISH_RULE_VERSION } from './evaluateCandidate'
import type { DetectedLocation } from '../crawlers/candidateLocation'

export type LocationOrigin = 'fresh_payload' | 'detected' | 'raw_data'
export type FillColumn = 'city' | 'venue_name' | 'address'
export type LocationGuards = Partial<Record<FillColumn, string | null>>
export interface LocationFillPlan { fields: Partial<Record<FillColumn, string>>; guards: LocationGuards }
export interface AutofillMetaEntry {
  filled_at: string
  candidate_id: string
  crawler_source_id: string | null
  fields: Partial<Record<FillColumn, string>>
  rule_version: typeof AUTO_PUBLISH_RULE_VERSION
}
export function resolveCandidateLocation(input: { freshLocation: DetectedLocation | null; candidate: { detected_city?: string | null; detected_venue_name?: string | null; detected_address?: string | null; raw_data?: unknown } }): { location: DetectedLocation; origin: LocationOrigin } | null {
  if (hasAnyLocation(input.freshLocation)) return { location: toDetectedLocation({ city: input.freshLocation!.detected_city, venueName: input.freshLocation!.detected_venue_name, address: input.freshLocation!.detected_address }), origin: 'fresh_payload' }
  const c = input.candidate
  const detected = toDetectedLocation({ city: c.detected_city, venueName: c.detected_venue_name, address: c.detected_address })
  if (hasAnyLocation(detected)) return { location: detected, origin: 'detected' }
  const location = locationFromRawData(c.raw_data)
  return location ? { location, origin: 'raw_data' } : null
}
export function planLocationFill(event: { city?: string | null; venue_name?: string | null; address?: string | null }, location: DetectedLocation): LocationFillPlan | null {
  const fields: LocationFillPlan['fields'] = {}, guards: LocationGuards = {}
  for (const col of ['city', 'venue_name', 'address'] as const) {
    const value = location[`detected_${col}`]?.trim()
    if (!event[col]?.trim() && value) { fields[col] = value; guards[col] = event[col] ?? null }
  }
  return Object.keys(fields).length ? { fields, guards } : null
}
export function buildAutofillMetaEntry(input: { filledAt: string; candidateId: string; crawlerSourceId: string | null; fields: Partial<Record<FillColumn, string>> }): AutofillMetaEntry {
  return { filled_at: input.filledAt, candidate_id: input.candidateId, crawler_source_id: input.crawlerSourceId, fields: input.fields, rule_version: AUTO_PUBLISH_RULE_VERSION }
}
export function appendAutofillMeta(existing: unknown, entry: AutofillMetaEntry): AutofillMetaEntry[] | { error: 'meta_malformed' } {
  if (existing == null) return [entry]
  if (!Array.isArray(existing)) return { error: 'meta_malformed' }
  return [...existing, entry]
}

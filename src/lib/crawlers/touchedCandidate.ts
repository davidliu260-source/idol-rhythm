import { hasAnyLocation, toDetectedLocation } from './candidateLocation'
import type { DetectedLocation } from './candidateLocation'
export type TouchedOutcome = 'inserted' | 'unchanged' | 'backfilled_hash' | 'drift'
export interface TouchedCandidate { candidateId: string; crawlerSourceId: string; outcome: TouchedOutcome; freshLocation: DetectedLocation | null }
export function touchedFromPayload(candidateId: string, crawlerSourceId: string, outcome: TouchedOutcome, payload: Record<string, unknown>): TouchedCandidate {
  const text = (v: unknown) => typeof v === 'string' ? v.trim() || null : null
  const loc = toDetectedLocation({ city: text(payload.detected_city), venueName: text(payload.detected_venue_name), address: text(payload.detected_address) })
  return { candidateId, crawlerSourceId, outcome, freshLocation: hasAnyLocation(loc) ? loc : null }
}

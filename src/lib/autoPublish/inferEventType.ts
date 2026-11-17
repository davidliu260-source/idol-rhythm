import type { EventType, EventSubType } from '../types'

export const EVENT_TYPE_VALUES = ['concert','ticketing','livestream','streaming','media','brand','official'] as const
export const EVENT_SUB_TYPE_VALUES = ['fanmeet','fansign','musicshow','variety','interview','award','release','announcement','magazine','popup_store','exhibition','brand_event'] as const
export type InferRule = 'kept' | 'kpop_fanmeeting' | 'kpop_festival' | 'kpop_default' | 'missing_type' | 'invalid_type'
export interface InferredEventType { type: EventType | null; subType: EventSubType | null; rule: InferRule }
export function inferEventType(candidate: { raw_title: string | null; detected_event_type?: string | null; detected_event_sub_type?: string | null }, parserType: string | null): InferredEventType {
  const type = candidate.detected_event_type?.trim() || null
  const subType = candidate.detected_event_sub_type?.trim() || null
  if ((type && !EVENT_TYPE_VALUES.some(v => v === type)) || (subType && !EVENT_SUB_TYPE_VALUES.some(v => v === subType))) return { type: null, subType: null, rule: 'invalid_type' }
  if (type) return { type: type as EventType, subType: subType as EventSubType | null, rule: 'kept' }
  if (parserType !== 'kpopofficial_concerts') return { type: null, subType: null, rule: 'missing_type' }
  if (/fan\s*meeting/i.test(candidate.raw_title ?? '')) return { type: 'concert', subType: 'fanmeet', rule: 'kpop_fanmeeting' }
  return { type: 'concert', subType: null, rule: /festival/i.test(candidate.raw_title ?? '') ? 'kpop_festival' : 'kpop_default' }
}

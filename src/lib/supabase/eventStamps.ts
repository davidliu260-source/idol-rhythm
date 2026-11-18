import { classifyStampError, isStampableId, normalizeStampIds } from '@/lib/eventStamps'
import { getBrowserSupabaseClient } from './browserClient'

type StampLoadResult = { kind: 'ok'; ids: string[] } | { kind: 'unavailable' }
type StampWriteResult = 'ok' | 'rejected' | 'unavailable' | 'other'

let unavailable = false
let warned = false
const loading = new Map<string, Promise<StampLoadResult>>()

export function isEventStampsUnavailable(): boolean {
  return unavailable
}

function warnOnce(code: string) {
  if (unavailable || warned) return
  warned = true
  console.warn('[event-stamps] unavailable', code)
}

async function readEventStamps(userId: string): Promise<StampLoadResult> {
  try {
    const supabase = getBrowserSupabaseClient()
    if (!supabase) return { kind: 'unavailable' }
    const { data, error } = await supabase.from('event_stamps').select('event_id').eq('user_id', userId)
    const kind = classifyStampError(error)
    if (kind === 'missing') unavailable = true
    if (kind === 'other') warnOnce(error?.code ?? 'unknown')
    if (!unavailable && !kind) {
      return { kind: 'ok', ids: normalizeStampIds((data ?? []).map(row => row.event_id)) }
    }
  } catch {
    warnOnce('unknown')
  }
  return { kind: 'unavailable' }
}

export function loadEventStamps(userId: string): Promise<StampLoadResult> {
  if (unavailable) return Promise.resolve({ kind: 'unavailable' })
  const pending = loading.get(userId)
  if (pending) return pending
  const request = readEventStamps(userId).finally(() => { loading.delete(userId) })
  loading.set(userId, request)
  return request
}

async function writeEventStamp(userId: string, eventId: string, add: boolean): Promise<StampWriteResult> {
  if (!isStampableId(eventId)) return 'rejected'
  if (unavailable) return 'unavailable'
  try {
    const supabase = getBrowserSupabaseClient()
    if (!supabase) return 'unavailable'
    const { error } = add
      ? await supabase.from('event_stamps').insert({ user_id: userId, event_id: eventId })
      : await supabase.from('event_stamps').delete().eq('user_id', userId).eq('event_id', eventId)
    const kind = classifyStampError(error)
    if (kind === 'missing') unavailable = true
    if (unavailable) return 'unavailable'
    if (kind === 'other') warnOnce(error?.code ?? 'unknown')
    if (kind === 'other' || kind === 'rejected') return kind
    return 'ok'
  } catch {
    warnOnce('unknown')
    return unavailable ? 'unavailable' : 'other'
  }
}

export function addEventStamp(userId: string, eventId: string): Promise<StampWriteResult> {
  return writeEventStamp(userId, eventId, true)
}

export function removeEventStamp(userId: string, eventId: string): Promise<StampWriteResult> {
  return writeEventStamp(userId, eventId, false)
}

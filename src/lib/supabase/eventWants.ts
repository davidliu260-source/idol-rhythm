import {
  chunkIds, classifyWantRpcError, normalizeEventIds, resolveWantResult,
  type WantState,
} from '@/lib/eventWants'
import { getBrowserSupabaseClient } from './browserClient'

type PendingRead = { id: string; resolve: (state: WantState | null) => void }
type Batch = { scope: string; deviceId: string | null; reads: PendingRead[] }

let unavailable = false
let warned = false
const listeners = new Set<() => void>()
const cache = new Map<string, WantState>()
const batches = new Map<string, Batch>()
let timer: ReturnType<typeof setTimeout> | undefined

export function isEventWantUnavailable() {
  return unavailable
}

export function subscribeEventWantUnavailable(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

function reportError(error: { code?: string | null; message?: string | null }) {
  if (classifyWantRpcError(error) === 'missing') {
    unavailable = true
    cache.clear()
    listeners.forEach(listener => listener())
  } else if (!unavailable && !warned) {
    warned = true
    console.warn('[event-wants] unavailable', error.code ?? 'unknown')
  }
}

async function readBatch({ scope, deviceId, reads }: Batch) {
  const ids = normalizeEventIds(reads.map(read => read.id))
  const states = new Map<string, WantState>()
  try {
    const client = unavailable ? null : getBrowserSupabaseClient()
    if (client) {
      for (const chunk of chunkIds(ids)) {
        if (unavailable) break
        const { data, error } = await client.rpc('get_event_wants', {
          p_event_ids: chunk,
          p_device_id: deviceId,
        })
        if (error) {
          reportError(error)
          break
        }
        for (const row of data ?? []) {
          const { event_id: id, want_count: count, is_wanted: wanted } = row
          if (chunk.includes(id) && Number.isInteger(count) && count >= 0 && typeof wanted === 'boolean') {
            states.set(id, { count, wanted })
          }
        }
      }
    }
  } catch {
    reportError({})
  } finally {
    for (const { id, resolve } of reads) {
      const state = unavailable ? null : states.get(id) ?? null
      if (state) cache.set(`${scope}|${id}`, state)
      resolve(state)
    }
  }
}

export function loadEventWant(eventId: string, scope: string, deviceId: string | null): Promise<WantState | null> {
  const [id] = normalizeEventIds([eventId])
  if (unavailable || !id) return Promise.resolve(null)
  const cached = cache.get(`${scope}|${id}`)
  if (cached) return Promise.resolve(cached)

  const rpcDeviceId = scope === 'anon' ? deviceId : null
  const key = `${scope}|${rpcDeviceId ?? ''}`
  let batch = batches.get(key)
  if (!batch) {
    batch = { scope, deviceId: rpcDeviceId, reads: [] }
    batches.set(key, batch)
  }
  if (timer === undefined) {
    timer = setTimeout(() => {
      timer = undefined
      const queued = Array.from(batches.values())
      batches.clear()
      for (const batch of queued) void readBatch(batch)
    }, 0)
  }
  const reads = batch.reads
  return new Promise(resolve => { reads.push({ id, resolve }) })
}

export async function submitEventWant(eventId: string, want: boolean, scope: string, deviceId: string | null) {
  const [id] = normalizeEventIds([eventId])
  if (unavailable || !id) return { kind: 'unavailable' } as const
  const key = `${scope}|${id}`
  try {
    const client = getBrowserSupabaseClient()
    if (!client) return { kind: 'unavailable' } as const
    const { data, error } = await client.rpc('set_event_want', {
      p_event_id: id,
      p_want: want,
      p_device_id: scope === 'anon' ? deviceId : null,
    })
    if (error) {
      reportError(error)
      cache.delete(key)
      return { kind: 'unavailable' } as const
    }
    if (unavailable) return { kind: 'unavailable' } as const
    const result = resolveWantResult(cache.get(key) ?? { count: 0, wanted: false }, data?.[0])
    if (result.kind === 'gone') cache.delete(key)
    else cache.set(key, result.state)
    return result
  } catch {
    reportError({})
    cache.delete(key)
    return { kind: 'unavailable' } as const
  }
}

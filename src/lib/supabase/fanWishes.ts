import { classifyWishRpcError, resolveWishResult, type WishKind, type WishResult } from '@/lib/fanWishes'
import { getBrowserSupabaseClient } from './browserClient'

let unavailable = false
let warned = false
let availability: Promise<boolean> | undefined

function reportError(error: { code?: string | null; message?: string | null }) {
  if (classifyWishRpcError(error) === 'missing') {
    unavailable = true
  } else if (!unavailable && !warned) {
    warned = true
    console.warn('[fan-wishes] unavailable', error.code ?? 'unknown')
  }
}

async function probe(): Promise<boolean> {
  try {
    const client = getBrowserSupabaseClient()
    if (!client) return false
    const { data, error } = await client.rpc('fan_wishes_enabled')
    if (error) {
      reportError(error)
      return false
    }
    return !unavailable && data === true
  } catch {
    reportError({})
    return false
  }
}

export function checkFanWishesAvailable(): Promise<boolean> {
  if (unavailable) return Promise.resolve(false)
  availability ??= probe()
  return availability
}

export async function submitFanWish(
  kind: WishKind,
  name: string,
  scope: string,
  deviceId: string | null,
): Promise<WishResult> {
  if (unavailable) return { kind: 'gone' }
  try {
    const client = getBrowserSupabaseClient()
    if (!client) return { kind: 'gone' }
    const { data, error } = await client.rpc('submit_fan_wish', {
      p_kind: kind,
      p_name: name,
      p_device_id: scope === 'anon' ? deviceId : null,
    })
    if (error) {
      reportError(error)
      return { kind: 'gone' }
    }
    return unavailable ? { kind: 'gone' } : resolveWishResult(data?.[0])
  } catch {
    reportError({})
    return { kind: 'gone' }
  }
}

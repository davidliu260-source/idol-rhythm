'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Users } from 'lucide-react'
import { useAppState } from '@/lib/appState'
import { ensureDeviceId, formatWantCount, getStoredDeviceId, optimisticWant, WANT_COPY, type WantState } from '@/lib/eventWants'
import {
  isEventWantUnavailable, loadEventWant, submitEventWant, subscribeEventWantUnavailable,
} from '@/lib/supabase/eventWants'

function getStorage() {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function useWantScope() {
  const { user, isUserLoading } = useAppState()
  const unavailable = useSyncExternalStore(subscribeEventWantUnavailable, isEventWantUnavailable, () => false)
  return isUserLoading || unavailable ? null : user?.id ?? 'anon'
}

function useEventWant(eventId: string, scope: string | null) {
  const [loaded, setLoaded] = useState<{ eventId: string; scope: string; state: WantState | null } | null>(null)
  useEffect(() => {
    if (scope === null) {
      setLoaded(null)
      return
    }
    let active = true
    const deviceId = scope === 'anon' ? getStoredDeviceId(getStorage()) : null
    void loadEventWant(eventId, scope, deviceId).then(state => {
      if (active) setLoaded({ eventId, scope, state })
    })
    return () => { active = false }
  }, [eventId, scope])
  return loaded?.eventId === eventId && loaded.scope === scope ? loaded.state : null
}

export function EventWantCount({ eventId, className }: { eventId: string; className?: string }) {
  const state = useEventWant(eventId, useWantScope())
  if (!state || state.count < 1) return null
  return <span className={className}>{formatWantCount(state.count)}</span>
}

export function EventWantButton({ eventId }: { eventId: string }) {
  const scope = useWantScope()
  if (scope === null) return null
  return <WantButtonForScope key={`${scope}|${eventId}`} eventId={eventId} scope={scope} />
}

function WantButtonForScope({ eventId, scope }: { eventId: string; scope: string }) {
  const loaded = useEventWant(eventId, scope)
  const [updated, setUpdated] = useState<WantState | null | undefined>(undefined)
  const [pending, setPending] = useState(false)
  const inFlight = useRef(false)
  const [notice, setNotice] = useState('')
  useEffect(() => {
    if (notice !== WANT_COPY.rateLimited) return
    const timer = setTimeout(() => setNotice(''), 3000)
    return () => clearTimeout(timer)
  }, [notice, pending])

  const state = updated === undefined ? loaded : updated
  if (!state) return null
  const { wanted, count } = state
  const label = wanted ? WANT_COPY.active : WANT_COPY.idle

  async function toggle(before: WantState) {
    if (inFlight.current) return
    const deviceId = scope === 'anon' ? ensureDeviceId(getStorage(), window.crypto) : null
    if (scope === 'anon' && !deviceId) {
      setNotice(WANT_COPY.storageBlocked)
      return
    }
    const want = !before.wanted
    inFlight.current = true
    setPending(true)
    setNotice('')
    setUpdated(optimisticWant(before, want))
    const result = await submitEventWant(eventId, want, scope, deviceId)
    setUpdated('state' in result ? result.state : null)
    if (result.kind === 'rate_limited') setNotice(WANT_COPY.rateLimited)
    inFlight.current = false
    setPending(false)
  }

  return (
    <section className="rounded-[22px] border border-white/8 bg-white/[0.035] p-4">
      <button
        type="button"
        disabled={pending}
        aria-pressed={wanted}
        aria-label={`${label}，目前 ${count} 人`}
        onClick={() => void toggle(state)}
        className={`flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium disabled:opacity-60 ${
          wanted ? 'border-[#ff86c4]/40 bg-[#ff86c4]/10 text-[#ff86c4]' : 'border-white/10 bg-white/5'
        }`}
      >
        <Users className="h-4 w-4" aria-hidden="true" />
        {label}
      </button>
      <p className="mt-2 text-center text-xs text-muted">
        {count > 0 ? `${formatWantCount(count)} · 匿名計數` : WANT_COPY.zero}
      </p>
      <p className={notice ? 'mt-2 text-center text-xs text-muted' : 'sr-only'} aria-live="polite">{notice}</p>
    </section>
  )
}

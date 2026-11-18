'use client'

import { useEffect, useRef, useState } from 'react'
import {
  isStampableId, normalizeStampIds, readStampIds, toggleStampId, writeStampIds,
} from './eventStamps'
import {
  addEventStamp, isEventStampsUnavailable, loadEventStamps, removeEventStamp,
} from './supabase/eventStamps'

export interface EventStampsController {
  status: 'loading' | 'ready' | 'unavailable'
  mode: 'cloud' | 'local'
  ids: string[]
  has: (id: string) => boolean
  isPending: (id: string) => boolean
  toggle: (id: string) => void
}

interface StampSession {
  userId: string | null
  status: EventStampsController['status']
  ids: string[]
  pending: Set<string>
}

function getLocalStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function useEventStamps(user: { id: string } | null, isUserLoading: boolean): EventStampsController {
  const userId = user?.id ?? null
  const mode = userId === null ? 'local' : 'cloud'
  const sessionRef = useRef<StampSession | null>(null)
  const [snapshot, setSnapshot] = useState<StampSession | null>(null)

  function publish(session: StampSession) {
    setSnapshot({ ...session, pending: new Set(session.pending) })
  }

  useEffect(() => {
    if (isUserLoading) {
      setSnapshot(null)
      return
    }

    const session: StampSession = { userId, status: 'loading', ids: [], pending: new Set() }
    sessionRef.current = session
    if (userId === null) {
      session.ids = readStampIds(getLocalStorage())
      session.status = 'ready'
    } else if (isEventStampsUnavailable()) {
      session.status = 'unavailable'
    } else {
      void loadEventStamps(userId).then(result => {
        if (sessionRef.current !== session) return
        session.status = result.kind === 'ok' ? 'ready' : 'unavailable'
        session.ids = result.kind === 'ok' ? result.ids : []
        publish(session)
      })
    }
    publish(session)

    return () => { sessionRef.current = null }
  }, [userId, isUserLoading])

  const visible = !isUserLoading && snapshot?.userId === userId ? snapshot : null
  const status = visible?.status ?? 'loading'
  const ids = status === 'ready' ? visible?.ids ?? [] : []

  async function toggleStamp(id: string) {
    const session = sessionRef.current
    if (status !== 'ready' || !session || session.userId !== userId || session.status !== 'ready' || !isStampableId(id)) return
    const key = id.toLowerCase()
    if (session.pending.has(key)) return

    if (userId === null) {
      session.ids = normalizeStampIds(toggleStampId(session.ids, key))
      writeStampIds(getLocalStorage(), session.ids)
      publish(session)
      return
    }

    const wasStamped = session.ids.includes(key)
    session.pending.add(key)
    session.ids = wasStamped ? session.ids.filter(value => value !== key) : [...session.ids, key]
    publish(session)

    const result = wasStamped ? await removeEventStamp(userId, key) : await addEventStamp(userId, key)
    if (sessionRef.current !== session) return
    if (result !== 'ok') {
      session.ids = wasStamped ? [...session.ids, key] : session.ids.filter(value => value !== key)
    }
    if (result === 'unavailable') session.status = 'unavailable'
    session.pending.delete(key)
    publish(session)
  }

  return {
    status,
    mode,
    ids,
    has: id => ids.includes(id.toLowerCase()),
    isPending: id => visible?.pending.has(id.toLowerCase()) ?? false,
    toggle: id => { void toggleStamp(id) },
  }
}

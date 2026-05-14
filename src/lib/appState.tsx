'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import { MOCK_IDOLS } from './mockIdols'
import { MOCK_EVENTS } from './mockEvents'

const DEFAULT_FOLLOWING = MOCK_IDOLS.filter((i) => i.following).map((i) => i.id)
const DEFAULT_FAVORITES = MOCK_EVENTS.filter((e) => e.isFavorited).map((e) => e.id)

function useStoredSet(key: string, defaultIds: string[]) {
  const [ids, setIds] = useState<string[]>(defaultIds)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(key)
      if (stored !== null) setIds(JSON.parse(stored) as string[])
    } catch {}
  }, [key])

  const toggle = useCallback(
    (id: string) => {
      setIds((prev) => {
        const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        try {
          localStorage.setItem(key, JSON.stringify(next))
        } catch {}
        return next
      })
    },
    [key],
  )

  const has = useCallback((id: string) => ids.includes(id), [ids])

  return { ids, has, toggle }
}

type StoredSet = ReturnType<typeof useStoredSet>

interface AppState {
  following: StoredSet
  favorites: StoredSet
  reminders: StoredSet
}

const AppStateContext = createContext<AppState | null>(null)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const following = useStoredSet('idol-rhythm:following', DEFAULT_FOLLOWING)
  const favorites = useStoredSet('idol-rhythm:favorites', DEFAULT_FAVORITES)
  const reminders = useStoredSet('idol-rhythm:reminders', [])

  return (
    <AppStateContext.Provider value={{ following, favorites, reminders }}>
      {children}
    </AppStateContext.Provider>
  )
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext)
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider')
  return ctx
}

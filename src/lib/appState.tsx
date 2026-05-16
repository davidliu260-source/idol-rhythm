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
import { getBrowserSupabaseClient } from './supabase/browserClient'

const DEFAULT_FOLLOWING = MOCK_IDOLS.filter((i) => i.following).map((i) => i.id)
const DEFAULT_FAVORITES = MOCK_EVENTS.filter((e) => e.isFavorited).map((e) => e.id)

// ─────────────────────────────────────────────────────────────────────────────
// localStorage-backed Set helper
// Used for `following` and `reminders` (Milestone 1 keeps these as local-only).
// Also used as the anon fallback for `favorites`.
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Auth user — tracked via Supabase auth state
// ─────────────────────────────────────────────────────────────────────────────

interface AuthUser {
  id: string
  email: string | null
}

function useAuthUser(): { user: AuthUser | null; isLoading: boolean } {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const supabase = getBrowserSupabaseClient()
    if (!supabase) {
      setIsLoading(false)
      return
    }

    let cancelled = false

    // Initial fetch
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (cancelled) return
      setUser(u ? { id: u.id, email: u.email ?? null } : null)
      setIsLoading(false)
    })

    // Subscribe to subsequent changes (sign in / sign out / token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user
      setUser(u ? { id: u.id, email: u.email ?? null } : null)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  return { user, isLoading }
}

// ─────────────────────────────────────────────────────────────────────────────
// Favorites controller
//
//   mode = 'cloud' when logged in  → reads/writes Supabase saved_events
//   mode = 'local' when anonymous  → reads/writes localStorage
//
// The `toggle` and `has` API is identical in both modes so EventCard and
// EventDetailActions don't need to know which mode is active.
// ─────────────────────────────────────────────────────────────────────────────

interface FavoritesController {
  ids: string[]
  has: (id: string) => boolean
  toggle: (id: string) => Promise<void> | void
  mode: 'cloud' | 'local'
  isLoading: boolean
}

function useFavorites(
  user: AuthUser | null,
  isUserLoading: boolean,
): FavoritesController {
  const local = useStoredSet('idol-rhythm:favorites', DEFAULT_FAVORITES)
  const [cloudIds, setCloudIds] = useState<string[]>([])
  const [isCloudLoading, setIsCloudLoading] = useState(false)

  // Fetch the user's saved_events whenever the auth user changes.
  useEffect(() => {
    if (!user) {
      setCloudIds([])
      setIsCloudLoading(false)
      return
    }

    const supabase = getBrowserSupabaseClient()
    if (!supabase) return

    let cancelled = false
    setIsCloudLoading(true)

    supabase
      .from('saved_events')
      .select('event_id')
      .eq('user_id', user.id)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          // RLS denial / missing GRANT — leave cloudIds empty, log for diagnosis.
          console.error('Failed to load saved_events:', error)
          setCloudIds([])
        } else if (data) {
          setCloudIds(data.map((row) => row.event_id as string))
        }
        setIsCloudLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user])

  const cloudHas = useCallback(
    (id: string) => cloudIds.includes(id),
    [cloudIds],
  )

  const cloudToggle = useCallback(
    async (id: string) => {
      if (!user) return
      const supabase = getBrowserSupabaseClient()
      if (!supabase) return

      const isSaved = cloudIds.includes(id)

      // Optimistic update
      setCloudIds((prev) =>
        isSaved ? prev.filter((x) => x !== id) : [...prev, id],
      )

      if (isSaved) {
        const { error } = await supabase
          .from('saved_events')
          .delete()
          .eq('user_id', user.id)
          .eq('event_id', id)

        if (error) {
          // Rollback
          setCloudIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
          console.error('Failed to delete saved_event:', error)
        }
      } else {
        const { error } = await supabase
          .from('saved_events')
          .insert({ user_id: user.id, event_id: id })

        if (error) {
          // Rollback
          setCloudIds((prev) => prev.filter((x) => x !== id))
          console.error('Failed to insert saved_event:', error)
        }
      }
    },
    [user, cloudIds],
  )

  const mode: 'cloud' | 'local' = user ? 'cloud' : 'local'

  if (mode === 'local') {
    return {
      ids: local.ids,
      has: local.has,
      toggle: local.toggle,
      mode,
      isLoading: isUserLoading,
    }
  }

  return {
    ids: cloudIds,
    has: cloudHas,
    toggle: cloudToggle,
    mode,
    isLoading: isUserLoading || isCloudLoading,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reminders controller (mirrors FavoritesController, backed by reminders table)
//
//   mode = 'cloud' when logged in  → reads/writes Supabase reminders
//   mode = 'local' when anonymous  → reads/writes localStorage
//
// Reminders rows have a `type` column ('day_before' / 'week_before' / 'hour_before')
// with UNIQUE(user_id, event_id, type). The current UI is a simple on/off toggle
// per event, so we always insert with the DB default ('day_before') and dedupe
// event_ids on read. A future milestone can expose reminder-type selection.
// ─────────────────────────────────────────────────────────────────────────────

interface RemindersController {
  ids: string[]
  has: (id: string) => boolean
  toggle: (id: string) => Promise<void> | void
  mode: 'cloud' | 'local'
  isLoading: boolean
}

function useReminders(
  user: AuthUser | null,
  isUserLoading: boolean,
): RemindersController {
  const local = useStoredSet('idol-rhythm:reminders', [])
  const [cloudIds, setCloudIds] = useState<string[]>([])
  const [isCloudLoading, setIsCloudLoading] = useState(false)

  // Fetch the user's reminders whenever the auth user changes.
  useEffect(() => {
    if (!user) {
      setCloudIds([])
      setIsCloudLoading(false)
      return
    }

    const supabase = getBrowserSupabaseClient()
    if (!supabase) return

    let cancelled = false
    setIsCloudLoading(true)

    supabase
      .from('reminders')
      .select('event_id')
      .eq('user_id', user.id)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('Failed to load reminders:', error)
          setCloudIds([])
        } else if (data) {
          // Dedupe in case the same event has multiple reminder_type rows.
          const unique = Array.from(
            new Set(data.map((row) => row.event_id as string)),
          )
          setCloudIds(unique)
        }
        setIsCloudLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user])

  const cloudHas = useCallback(
    (id: string) => cloudIds.includes(id),
    [cloudIds],
  )

  const cloudToggle = useCallback(
    async (id: string) => {
      if (!user) return
      const supabase = getBrowserSupabaseClient()
      if (!supabase) return

      const isSet = cloudIds.includes(id)

      // Optimistic update
      setCloudIds((prev) =>
        isSet ? prev.filter((x) => x !== id) : [...prev, id],
      )

      if (isSet) {
        // Delete ALL reminder rows for this event (any type). Matches the
        // current toggle UI semantics: "turn off reminder for this event".
        const { error } = await supabase
          .from('reminders')
          .delete()
          .eq('user_id', user.id)
          .eq('event_id', id)

        if (error) {
          setCloudIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
          console.error('Failed to delete reminder:', error)
        }
      } else {
        // INSERT with DB default type = 'day_before'. The UNIQUE constraint
        // (user_id, event_id, type) prevents duplicates on rapid double-click.
        const { error } = await supabase
          .from('reminders')
          .insert({ user_id: user.id, event_id: id })

        if (error) {
          setCloudIds((prev) => prev.filter((x) => x !== id))
          console.error('Failed to insert reminder:', error)
        }
      }
    },
    [user, cloudIds],
  )

  const mode: 'cloud' | 'local' = user ? 'cloud' : 'local'

  if (mode === 'local') {
    return {
      ids: local.ids,
      has: local.has,
      toggle: local.toggle,
      mode,
      isLoading: isUserLoading,
    }
  }

  return {
    ids: cloudIds,
    has: cloudHas,
    toggle: cloudToggle,
    mode,
    isLoading: isUserLoading || isCloudLoading,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

interface AppState {
  user: AuthUser | null
  isUserLoading: boolean
  following: StoredSet
  favorites: FavoritesController
  reminders: RemindersController
}

const AppStateContext = createContext<AppState | null>(null)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: isUserLoading } = useAuthUser()
  const following = useStoredSet('idol-rhythm:following', DEFAULT_FOLLOWING)
  const favorites = useFavorites(user, isUserLoading)
  const reminders = useReminders(user, isUserLoading)

  return (
    <AppStateContext.Provider
      value={{ user, isUserLoading, following, favorites, reminders }}
    >
      {children}
    </AppStateContext.Provider>
  )
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext)
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider')
  return ctx
}

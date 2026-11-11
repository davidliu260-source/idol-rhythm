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

const LEGACY_DEFAULT_FOLLOWING = MOCK_IDOLS.filter((i) => i.following)
  .map((i) => i.id)
  .sort()
const FOLLOWING_STORAGE_KEY = 'idol-rhythm:following:v2'
const DEFAULT_FOLLOWING: string[] = []
const DEFAULT_FAVORITES = MOCK_EVENTS.filter((e) => e.isFavorited).map((e) => e.id)

// Matches Postgres uuid_generate_v4() output (eight-four-four-four-twelve hex digits).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
      if (stored !== null) {
        const parsed = JSON.parse(stored) as string[]

        if (
          key === 'idol-rhythm:following' &&
          parsed.length === LEGACY_DEFAULT_FOLLOWING.length &&
          [...parsed].sort().every((id, index) => id === LEGACY_DEFAULT_FOLLOWING[index])
        ) {
          localStorage.setItem(key, JSON.stringify([]))
          setIds([])
          return
        }

        setIds(parsed)
      }
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

    // Use getSession() instead of getUser().
    //
    // - getUser() calls Supabase's /auth/v1/user endpoint to re-verify the
    //   JWT on every page mount. Under bad network / expired refresh tokens
    //   it can silent-hang forever (not resolve, not reject), which is what
    //   was breaking /me and /favorites for an actually-logged-in user.
    // - getSession() reads the session from local cookies/storage. No
    //   network call. Returns instantly. Good enough for "do we have a
    //   logged-in user and what's their id/email?" — which is all we use
    //   it for in this app.
    //
    // If the cached session's JWT is expired the SDK will attempt a silent
    // refresh in the background; onAuthStateChange (subscribed below) picks
    // up the new session when that completes.
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (cancelled) return
        const u = session?.user
        setUser(u ? { id: u.id, email: u.email ?? null } : null)
      })
      .catch((err) => {
        if (cancelled) return
        // eslint-disable-next-line no-console
        console.error('useAuthUser: getSession() failed, treating as anonymous:', err)
        setUser(null)
      })
      .finally(() => {
        if (cancelled) return
        setIsLoading(false)
      })

    // Subscribe to sign in / sign out / token refresh so future auth changes
    // (including the SDK's background refresh of an expired token) land in
    // state without forcing the user to reload.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user
      setUser(u ? { id: u.id, email: u.email ?? null } : null)
      setIsLoading(false)
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

      // Skip Supabase write for non-UUID event IDs (mock data fallback).
      // Optimistic local-only update keeps the heart UI responsive even when
      // the page is rendering mock events (e.g. when Supabase has no
      // published events yet). Without this guard PostgreSQL throws 22P02
      // (invalid_text_representation) because event_id expects a uuid.
      if (!UUID_RE.test(id)) {
        setCloudIds((prev) =>
          prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        )
        return
      }

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
// Following controller (idols followed by the user)
//
//   mode = 'cloud' when logged in  → reads/writes Supabase user_follows
//   mode = 'local' when anonymous  → reads/writes localStorage
//
// IMPORTANT — slug vs UUID translation:
//   The frontend uses `idol.slug` as the user-facing identifier everywhere
//   (e.g. EventCard, IdolsClient, MeClient all call following.has(idol.id)
//   where idol.id is actually the slug — see rowToIdol in lib/supabase/events.ts).
//   But user_follows.idol_id stores idols.id which is a UUID.
//
//   This hook therefore maintains a slug ↔ UUID map for the active idols and
//   translates internally:
//     - reads from user_follows (UUIDs)  → expose as slugs
//     - writes to   user_follows         → translate slug → UUID before insert
//   Consumer API stays slug-based; the rest of the app sees no difference.
//
//   If a slug cannot be mapped to a UUID (e.g. inactive idol, mock-only slug),
//   the toggle is rejected with console.error and UI rolls back.
// ─────────────────────────────────────────────────────────────────────────────

interface FollowingController {
  ids: string[]  // slugs
  has: (slug: string) => boolean
  toggle: (slug: string) => Promise<void> | void
  mode: 'cloud' | 'local'
  isLoading: boolean
}

function useFollowing(
  user: AuthUser | null,
  isUserLoading: boolean,
): FollowingController {
  const local = useStoredSet(FOLLOWING_STORAGE_KEY, DEFAULT_FOLLOWING)
  const [cloudSlugs, setCloudSlugs] = useState<string[]>([])
  const [slugToUuid, setSlugToUuid] = useState<Record<string, string>>({})
  const [isCloudLoading, setIsCloudLoading] = useState(false)

  // Fetch idols mapping + user_follows whenever auth user changes.
  useEffect(() => {
    if (!user) {
      setCloudSlugs([])
      setSlugToUuid({})
      setIsCloudLoading(false)
      return
    }

    const supabase = getBrowserSupabaseClient()
    if (!supabase) return

    let cancelled = false
    setIsCloudLoading(true)

    Promise.all([
      // Only active idols — matches what the frontend ever displays. Rows in
      // user_follows that point to disabled idols are silently dropped on
      // read; the underlying DB row is preserved.
      supabase.from('idols').select('id, slug').eq('is_active', true),
      supabase.from('user_follows').select('idol_id').eq('user_id', user.id),
    ]).then(([idolsRes, followsRes]) => {
      if (cancelled) return

      if (idolsRes.error) {
        console.error('Failed to load idols slug map:', idolsRes.error)
      }
      if (followsRes.error) {
        console.error('Failed to load user_follows:', followsRes.error)
      }

      const idols = (idolsRes.data ?? []) as Array<{ id: string; slug: string }>
      const slugMap: Record<string, string> = {} // slug → uuid
      const uuidMap: Record<string, string> = {} // uuid → slug
      for (const i of idols) {
        slugMap[i.slug] = i.id
        uuidMap[i.id] = i.slug
      }

      const followRows = (followsRes.data ?? []) as Array<{ idol_id: string }>
      const slugs = followRows
        .map((r) => uuidMap[r.idol_id])
        // Drop rows whose UUID isn't in the active idols map.
        .filter((s): s is string => Boolean(s))

      setSlugToUuid(slugMap)
      setCloudSlugs(slugs)
      setIsCloudLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [user])

  const cloudHas = useCallback(
    (slug: string) => cloudSlugs.includes(slug),
    [cloudSlugs],
  )

  const cloudToggle = useCallback(
    async (slug: string) => {
      if (!user) return
      const supabase = getBrowserSupabaseClient()
      if (!supabase) return

      const uuid = slugToUuid[slug]
      if (!uuid) {
        console.error(
          `useFollowing: cannot map slug "${slug}" to idol UUID — skip write. ` +
            'This usually means the idol is inactive or only exists in mock data.',
        )
        return
      }

      const isFollowing = cloudSlugs.includes(slug)

      // Optimistic update
      setCloudSlugs((prev) =>
        isFollowing ? prev.filter((x) => x !== slug) : [...prev, slug],
      )

      if (isFollowing) {
        const { error } = await supabase
          .from('user_follows')
          .delete()
          .eq('user_id', user.id)
          .eq('idol_id', uuid)
        if (error) {
          setCloudSlugs((prev) => (prev.includes(slug) ? prev : [...prev, slug]))
          console.error('Failed to delete user_follow:', error)
        }
      } else {
        const { error } = await supabase
          .from('user_follows')
          .insert({ user_id: user.id, idol_id: uuid })
        if (error) {
          setCloudSlugs((prev) => prev.filter((x) => x !== slug))
          console.error('Failed to insert user_follow:', error)
        }
      }
    },
    [user, cloudSlugs, slugToUuid],
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
    ids: cloudSlugs,
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
  following: FollowingController
  favorites: FavoritesController
  reminders: RemindersController
}

const AppStateContext = createContext<AppState | null>(null)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: isUserLoading } = useAuthUser()
  const following = useFollowing(user, isUserLoading)
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

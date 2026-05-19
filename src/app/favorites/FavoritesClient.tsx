'use client'

import { useMemo, useState } from 'react'
import { Heart, LogIn, Loader2, Search, X } from 'lucide-react'
import Link from 'next/link'
import { useAppState } from '@/lib/appState'
import EventCard from '@/components/EventCard'
import type { Event } from '@/lib/mockEvents'

function matchSearch(e: Event, q: string): boolean {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  return (
    e.title.toLowerCase().includes(needle) ||
    e.idolName.toLowerCase().includes(needle) ||
    (e.location ?? '').toLowerCase().includes(needle)
  )
}

export default function FavoritesClient({ events }: { events: Event[] }) {
  const { favorites, user, isUserLoading } = useAppState()
  const [query, setQuery] = useState('')

  // ── Loading auth state ──────────────────────────────────────────────────
  if (isUserLoading) {
    return (
      <div className="flex flex-col px-4 pt-12 pb-6 gap-6">
        <Header count={null} />
        <div className="py-16 flex flex-col items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          載入中…
        </div>
      </div>
    )
  }

  // ── Anonymous: login prompt ─────────────────────────────────────────────
  if (!user) {
    return (
      <div className="flex flex-col px-4 pt-12 pb-6 gap-6">
        <Header count={null} />

        <div className="rounded-2xl border border-card-border bg-card p-6 flex flex-col items-center gap-3 text-center">
          <Heart className="h-10 w-10 text-card-border" />
          <p className="text-sm font-semibold text-text-base">登入後同步收藏</p>
          <p className="text-xs text-muted leading-relaxed max-w-xs">
            收藏的活動會儲存在你的帳號，
            <br />
            更換裝置也找得到。
          </p>
          <Link
            href="/login?next=/favorites"
            className="mt-1 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white"
          >
            <LogIn className="h-4 w-4" />
            登入 / 註冊
          </Link>
        </div>
      </div>
    )
  }

  // ── Logged in: show Supabase saved_events ───────────────────────────────
  const now = useMemo(() => new Date(), [])
  const favorited = useMemo(
    () => events.filter((e) => favorites.has(e.id)),
    [events, favorites],
  )
  // F4: apply search filter on top of the favorited set so counts in the
  // section headers reflect the visible (post-search) totals.
  const visible = useMemo(
    () => favorited.filter((e) => matchSearch(e, query)),
    [favorited, query],
  )
  const upcoming = useMemo(
    () =>
      visible
        .filter((e) => new Date(e.date) >= now)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [visible, now],
  )
  const past = useMemo(
    () =>
      visible
        .filter((e) => new Date(e.date) < now)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [visible, now],
  )

  return (
    <div className="flex flex-col px-4 pt-12 pb-6 gap-6">
      <Header count={favorited.length} />

      {favorites.isLoading && (
        <div className="flex items-center justify-center gap-2 text-xs text-muted py-4">
          <Loader2 className="h-3 w-3 animate-spin" />
          同步收藏中…
        </div>
      )}

      {!favorites.isLoading && favorited.length === 0 ? (
        <div className="py-16 flex flex-col items-center gap-3 text-center">
          <Heart className="h-12 w-12 text-card-border" />
          <p className="text-sm text-muted">還沒有收藏的活動</p>
          <Link href="/schedule" className="text-xs text-primary">
            去瀏覽行程 →
          </Link>
        </div>
      ) : (
        <>
          {/* F4: search box — only shown once there's something to search through. */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜尋活動標題 / 偶像 / 地點"
              className="w-full rounded-xl bg-card border border-card-border pl-9 pr-9 py-2.5 text-sm text-text-base placeholder:text-muted focus:outline-none focus:border-violet/40"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="清除搜尋"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-text-base"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {visible.length === 0 ? (
            <div className="py-12 flex flex-col items-center gap-2 text-center">
              <p className="text-sm text-muted">沒有符合搜尋的收藏</p>
              <button
                type="button"
                onClick={() => setQuery('')}
                className="text-xs text-primary"
              >
                清除搜尋條件
              </button>
            </div>
          ) : (
            <>
              {upcoming.length > 0 && (
                <section>
                  <h2 className="text-xs font-semibold text-muted mb-3">
                    即將到來 · {upcoming.length} 場
                  </h2>
                  <div className="flex flex-col gap-2">
                    {upcoming.map((event) => (
                      <EventCard key={event.id} event={event} />
                    ))}
                  </div>
                </section>
              )}

              {past.length > 0 && (
                <section>
                  <h2 className="text-xs font-semibold text-muted mb-3">
                    已結束 · {past.length} 場
                  </h2>
                  <div className="flex flex-col gap-2 opacity-60">
                    {past.map((event) => (
                      <EventCard key={event.id} event={event} />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

function Header({ count }: { count: number | null }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <Heart className="h-5 w-5 text-primary fill-primary" />
        <h1 className="text-xl font-bold text-text-base">收藏活動</h1>
      </div>
      {count !== null && (
        <p className="text-xs text-muted mt-1">共收藏 {count} 場</p>
      )}
    </div>
  )
}

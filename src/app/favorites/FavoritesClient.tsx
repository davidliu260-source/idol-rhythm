'use client'

import { Heart, LogIn, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useAppState } from '@/lib/appState'
import EventCard from '@/components/EventCard'
import type { Event } from '@/lib/mockEvents'

export default function FavoritesClient({ events }: { events: Event[] }) {
  const { favorites, user, isUserLoading } = useAppState()

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
  const now = new Date()
  const favorited = events.filter((e) => favorites.has(e.id))
  const upcoming = favorited
    .filter((e) => new Date(e.date) >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const past = favorited
    .filter((e) => new Date(e.date) < now)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

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

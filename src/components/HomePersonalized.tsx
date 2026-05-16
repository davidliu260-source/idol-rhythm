'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Sparkles, Star, Heart, Bell, ChevronRight, LogIn } from 'lucide-react'
import { type Event } from '@/lib/mockEvents'
import { getIdolById, type Idol } from '@/lib/mockIdols'
import { useAppState } from '@/lib/appState'

// Display caps (per work order)
const MAX_FOLLOWING = 5
const MAX_REMINDERS = 3
const MAX_FAVORITES = 3

/**
 * Personalized home dashboard ("我的星動時刻").
 *
 * Surfaces three pieces of user state on the homepage:
 *   1. Followed idols           — from useAppState().following
 *   2. Upcoming reminded events — from useAppState().reminders
 *   3. Upcoming saved events    — from useAppState().favorites
 *
 * Both reminders and favorites are UI-only countdowns (per the explicit
 * product decision recorded in AGENTS.md section 14: no Email/Push/cron
 * dispatch is implemented or planned).
 *
 * Anonymous users still see the section with login encouragement.
 * Stat tiles render zeros during SSR, then update once the client picks up
 * localStorage / Supabase state — keeps server HTML stable.
 */
export default function HomePersonalized({
  events,
  idols,
}: {
  events: Event[]
  idols: Idol[]
}) {
  const { user, isUserLoading, following, favorites, reminders } = useAppState()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // ── Derived data (gated on mount to avoid SSR/CSR hydration mismatch) ──
  // useStoredSet reads localStorage on client only; cloud-mode sets fetch
  // async after auth resolves. Server-render with zeros, hydrate to real
  // counts once mounted.

  const followingIdols = mounted
    ? idols.filter((i) => following.has(i.id)).slice(0, MAX_FOLLOWING)
    : []

  const now = new Date()

  const upcomingReminders = mounted
    ? events
        .filter((e) => reminders.has(e.id) && new Date(e.date) >= now)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, MAX_REMINDERS)
    : []

  const upcomingFavorites = mounted
    ? events
        .filter((e) => favorites.has(e.id) && new Date(e.date) >= now)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, MAX_FAVORITES)
    : []

  const counts = {
    following: mounted ? following.ids.length : 0,
    favorites: mounted ? favorites.ids.length : 0,
    reminders: mounted ? reminders.ids.length : 0,
  }

  const hasAnyData =
    counts.following > 0 || counts.favorites > 0 || counts.reminders > 0

  // Login prompt: only for confirmed anonymous (don't flash on initial mount
  // while auth is still resolving)
  const showLoginPrompt = mounted && !isUserLoading && !user

  return (
    <section className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="text-base font-bold text-text-base">我的星動時刻</h2>
      </div>

      {/* Three-stat summary */}
      <div className="grid grid-cols-3 gap-2">
        <StatTile
          icon={<Star className="h-3.5 w-3.5" />}
          label="追蹤"
          value={counts.following}
          color="text-primary"
        />
        <StatTile
          icon={<Heart className="h-3.5 w-3.5" />}
          label="收藏"
          value={counts.favorites}
          color="text-rose-400"
        />
        <StatTile
          icon={<Bell className="h-3.5 w-3.5" />}
          label="提醒"
          value={counts.reminders}
          color="text-violet-400"
        />
      </div>

      {/* Login prompt for anon (with localStorage hint when there's local data) */}
      {showLoginPrompt && (
        <div className="rounded-xl bg-violet/10 border border-violet/25 px-3 py-2.5 flex items-start gap-2">
          <LogIn className="h-3.5 w-3.5 text-violet-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 flex flex-col gap-1.5">
            <p className="text-xs text-muted leading-snug">
              {hasAnyData
                ? '目前以本機儲存，登入後可同步收藏、提醒與追蹤偶像到你的帳號'
                : '登入後可同步你的收藏、提醒與追蹤偶像'}
            </p>
            <Link
              href="/login?next=/"
              className="self-start text-xs font-semibold text-primary underline underline-offset-2"
            >
              登入 / 註冊 →
            </Link>
          </div>
        </div>
      )}

      {/* Following idols */}
      <Subsection
        title="已追蹤偶像"
        count={counts.following}
        href="/idols"
        icon={<Star className="h-3.5 w-3.5 text-primary" />}
      >
        {followingIdols.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1 -mx-1 px-1">
            {followingIdols.map((idol) => (
              <Link
                key={idol.id}
                href="/idols"
                className="flex flex-col items-center gap-1.5 flex-shrink-0"
              >
                <div
                  className="h-14 w-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white ring-2 ring-primary/30"
                  style={{ background: `linear-gradient(135deg, ${idol.color}88, ${idol.color})` }}
                >
                  {idol.name.charAt(0)}
                </div>
                <span className="text-xs text-muted max-w-[56px] truncate text-center">
                  {idol.name}
                </span>
              </Link>
            ))}
            <Link
              href="/idols"
              className="flex flex-col items-center gap-1.5 flex-shrink-0"
            >
              <div className="h-14 w-14 rounded-2xl border-2 border-dashed border-card-border flex items-center justify-center text-muted text-xl">
                +
              </div>
              <span className="text-xs text-muted">追蹤</span>
            </Link>
          </div>
        ) : (
          <EmptyHint
            text="還沒追蹤偶像，先到偶像頁選擇你關注的人"
            linkText="去選偶像"
            href="/idols"
          />
        )}
      </Subsection>

      {/* Upcoming reminders — UI countdown only */}
      <Subsection
        title="近期提醒"
        count={counts.reminders}
        href="/schedule"
        icon={<Bell className="h-3.5 w-3.5 text-violet-400" />}
      >
        {upcomingReminders.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1 -mx-1 px-1">
            {upcomingReminders.map((event) => (
              <CountdownCard key={event.id} event={event} now={now} />
            ))}
          </div>
        ) : (
          <EmptyHint
            text="還沒設定提醒，可以在活動卡片上開啟提醒"
            linkText="瀏覽行程"
            href="/schedule"
          />
        )}
      </Subsection>

      {/* Upcoming favorites */}
      <Subsection
        title="我的收藏"
        count={counts.favorites}
        href="/favorites"
        icon={<Heart className="h-3.5 w-3.5 text-rose-400" />}
      >
        {upcomingFavorites.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1 -mx-1 px-1">
            {upcomingFavorites.map((event) => (
              <CountdownCard key={event.id} event={event} now={now} />
            ))}
          </div>
        ) : (
          <EmptyHint
            text="還沒收藏活動，可以先收藏想追的行程"
            linkText="去收藏"
            href="/favorites"
          />
        )}
      </Subsection>
    </section>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatTile({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: number
  color: string
}) {
  return (
    <div className="rounded-xl border border-card-border bg-card px-2 py-2.5 flex flex-col items-center gap-1">
      <span className={color}>{icon}</span>
      <p className="text-base font-bold text-text-base leading-none tabular-nums">
        {value}
      </p>
      <p className="text-[10px] text-muted leading-none">{label}</p>
    </div>
  )
}

function Subsection({
  title,
  count,
  href,
  icon,
  children,
}: {
  title: string
  count: number
  href: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h3 className="text-xs font-semibold text-text-base">{title}</h3>
        {count > 0 && <span className="text-xs text-muted">· {count}</span>}
        <Link
          href={href}
          className="ml-auto flex items-center gap-0.5 text-[10px] text-muted"
        >
          全部 <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
      {children}
    </section>
  )
}

function EmptyHint({
  text,
  linkText,
  href,
}: {
  text: string
  linkText: string
  href: string
}) {
  return (
    <div className="rounded-xl border border-card-border bg-card px-3 py-3 flex flex-col items-start gap-1.5">
      <p className="text-xs text-muted leading-snug">{text}</p>
      <Link href={href} className="text-xs text-primary font-semibold">
        {linkText} →
      </Link>
    </div>
  )
}

function CountdownCard({ event, now }: { event: Event; now: Date }) {
  // getIdolById expects slug. rowToEvent (lib/supabase/events.ts) sets
  // event.idolId = slug, and mock events use 'bts' / 'blackpink' etc. So
  // both data sources match. Unknown slugs fall back to a generic gradient.
  const idol = getIdolById(event.idolId)
  const bgStyle = idol
    ? `linear-gradient(135deg, ${idol.color}88, ${idol.color})`
    : 'linear-gradient(135deg, #4c1d95, #6366f1)'

  const label = getCountdownLabel(new Date(event.date), now)

  return (
    <Link href={`/events/${event.id}`} className="flex-shrink-0 w-40">
      <div className="rounded-2xl border border-card-border bg-card p-3 flex flex-col gap-2 active:scale-[0.98] transition-transform h-full">
        <div className="flex items-center gap-2">
          <div
            className="h-8 w-8 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
            style={{ background: bgStyle }}
          >
            {event.idolName.charAt(0)}
          </div>
          <span className="text-xs font-semibold text-primary truncate">
            {event.idolName}
          </span>
        </div>
        <p className="text-xs text-text-base line-clamp-2 leading-snug flex-1">
          {event.title}
        </p>
        <p className="text-sm font-bold text-primary leading-none">{label}</p>
      </div>
    </Link>
  )
}

/**
 * Date-only countdown label:
 *   same day → "今天"
 *   next day → "明天"
 *   2+ days  → "剩 N 天"
 *
 * Compares calendar dates (not datetimes), so an event at any hour today
 * counts as 「今天」regardless of clock time.
 */
function getCountdownLabel(eventDate: Date, now: Date): string {
  const eventDay = new Date(eventDate)
  eventDay.setHours(0, 0, 0, 0)
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round(
    (eventDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  )
  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '明天'
  return `剩 ${diffDays} 天`
}

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Bell, ChevronRight, Heart, LibraryBig, LogIn, Sparkles, Star } from 'lucide-react'
import { type Event } from '@/lib/mockEvents'
import { getIdolById, type Idol } from '@/lib/mockIdols'
import { useAppState } from '@/lib/appState'
import IdolAvatar from './IdolAvatar'

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
 * Both reminders and favorites are UI-only countdowns: no Email/Push/cron
 * dispatch is implemented here.
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
    <section className="rounded-[26px] border border-white/8 bg-white/[0.035] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/8 bg-white/[0.045] text-[#ff8bc8]">
            <LibraryBig className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-white/36">
              PRIVATE DECK
            </p>
            <h2 className="mt-1 text-xl font-black leading-none text-white">
              我的星動時刻
            </h2>
          </div>
        </div>
        <Sparkles className="h-4 w-4 text-[#ff8bc8]" />
      </div>

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
        <div className="mt-4 flex items-start gap-3 rounded-[20px] border border-violet-300/18 bg-violet-400/10 px-3 py-3">
          <LogIn className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#b7a7ff]" />
          <div className="flex-1 flex flex-col gap-1.5">
            <p className="text-xs leading-5 text-white/58">
              {hasAnyData
                ? '目前以本機儲存，登入後可同步收藏、提醒與追蹤偶像到你的帳號'
                : '登入後可同步你的收藏、提醒與追蹤偶像'}
            </p>
            <Link
              href="/login?next=/"
              className="self-start text-xs font-semibold text-[#ff8bc8]"
            >
              登入 / 註冊 →
            </Link>
          </div>
        </div>
      )}

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
                <IdolAvatar
                  name={idol.name}
                  avatarUrl={idol.avatarUrl}
                  color={idol.color}
                  size="lg"
                  className="!h-14 !w-14 !text-xl ring-2 ring-[#ff6cb7]/30"
                />
                <span className="max-w-[56px] truncate text-center text-xs text-white/54">
                  {idol.name}
                </span>
              </Link>
            ))}
            <Link
              href="/idols"
              className="flex flex-col items-center gap-1.5 flex-shrink-0"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-white/16 text-xl text-white/42">
                +
              </div>
              <span className="text-xs text-white/42">追蹤</span>
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
    <div className="flex flex-col items-center gap-1 rounded-[18px] border border-white/8 bg-white/[0.035] px-2 py-3">
      <span className={color}>{icon}</span>
      <p className="text-lg font-black leading-none text-white tabular-nums">
        {value}
      </p>
      <p className="text-[10px] leading-none text-white/42">{label}</p>
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
    <section className="mt-4">
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <h3 className="text-xs font-semibold text-white">{title}</h3>
        {count > 0 && <span className="text-xs text-white/42">· {count}</span>}
        <Link
          href={href}
          className="ml-auto flex items-center gap-0.5 text-[10px] font-medium text-white/42"
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
    <div className="flex flex-col items-start gap-1.5 rounded-[18px] border border-white/8 bg-white/[0.035] px-3 py-3">
      <p className="text-xs leading-5 text-white/48">{text}</p>
      <Link href={href} className="text-xs font-semibold text-[#ff8bc8]">
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
  const label = getCountdownLabel(new Date(event.date), now)

  return (
    <Link href={`/events/${event.id}`} className="flex-shrink-0 w-40">
      <div className="flex h-full flex-col gap-2 rounded-[20px] border border-white/8 bg-white/[0.04] p-3 transition-transform active:scale-[0.98]">
        <div className="flex items-center gap-2">
          <IdolAvatar
            name={event.idolName}
            avatarUrl={event.idolAvatarUrl}
            color={idol?.color ?? '#6366f1'}
            size="xs"
          />
          <span className="truncate text-xs font-semibold text-[#ff8bc8]">
            {event.idolName}
          </span>
        </div>
        <p className="line-clamp-2 flex-1 text-xs leading-snug text-white/76">
          {event.title}
        </p>
        <p className="text-sm font-black leading-none text-white">{label}</p>
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

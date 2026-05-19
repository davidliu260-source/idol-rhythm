'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ChevronRight,
  Newspaper,
  Play,
  Sparkles,
  Star,
  UserPlus,
  Zap,
} from 'lucide-react'
import { type Event } from '@/lib/mockEvents'
import { type Idol } from '@/lib/mockIdols'
import { useAppState } from '@/lib/appState'
import EventCard from './EventCard'

const MAX_FOLLOWED = 8
const MAX_MORE = 6

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

function isUpcomingWithin(dateStr: string, days: number): boolean {
  const d = new Date(dateStr)
  const now = new Date()
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() + days)
  return d >= now && d <= cutoff
}

function isFutureOrToday(dateStr: string): boolean {
  const d = new Date(dateStr)
  d.setHours(23, 59, 59, 999)
  return d.getTime() >= Date.now()
}

/**
 * Home timeline that personalizes by followed idols.
 *
 * SSR-stable: before mount we render the default 4-section view (same shape
 * the server emits), then re-render once the client knows which idols the
 * user follows. Avoids hydration mismatches while still surfacing
 * personalized content as soon as state is available.
 */
export default function HomeTimeline({
  events,
  idols: _idols,
}: {
  events: Event[]
  idols: Idol[]
}) {
  const { following } = useAppState()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const hasFollows = mounted && following.ids.length > 0

  if (hasFollows) {
    return <FollowedView events={events} followedSlugs={following.ids} />
  }

  return <DefaultView events={events} showFollowHint={mounted} />
}

// ── Followed-idol view (2 sections) ─────────────────────────────────────────

function FollowedView({
  events,
  followedSlugs,
}: {
  events: Event[]
  followedSlugs: string[]
}) {
  const followedSet = new Set(followedSlugs)

  // F2: keep the totals so we can show "查看全部 N 場 →" footers when truncated.
  const followedSorted = events
    .filter((e) => followedSet.has(e.idolId) && isFutureOrToday(e.date))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const followedTotal = followedSorted.length
  const followedEvents = followedSorted.slice(0, MAX_FOLLOWED)

  const followedIds = new Set(followedEvents.map((e) => e.id))
  const otherSorted = events
    .filter(
      (e) =>
        !followedSet.has(e.idolId) &&
        !followedIds.has(e.id) &&
        isFutureOrToday(e.date),
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const otherTotal = otherSorted.length
  const otherEvents = otherSorted.slice(0, MAX_MORE)

  return (
    <div className="flex flex-col gap-6">
      <section>
        <SectionHeader
          icon={<Sparkles className="h-4 w-4 text-primary" />}
          title="我追蹤的近期行程"
          count={followedTotal}
          href="/schedule"
        />
        {followedEvents.length > 0 ? (
          <div className="flex flex-col gap-2">
            {followedEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
            <SeeAllFooter
              shown={followedEvents.length}
              total={followedTotal}
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-card-border bg-card px-4 py-5 text-center">
            <p className="text-sm text-muted">追蹤的偶像目前沒有公開行程</p>
            <Link
              href="/schedule"
              className="mt-1 inline-block text-xs text-primary"
            >
              查看完整行程 →
            </Link>
          </div>
        )}
      </section>

      {otherEvents.length > 0 && (
        <section>
          <SectionHeader
            icon={<Star className="h-4 w-4 text-yellow-400" />}
            title="更多星動行程"
            count={otherTotal}
            href="/schedule"
          />
          <div className="flex flex-col gap-2">
            {otherEvents.map((event) => (
              <EventCard key={event.id} event={event} compact />
            ))}
            <SeeAllFooter shown={otherEvents.length} total={otherTotal} />
          </div>
        </section>
      )}
    </div>
  )
}

// ── Default view (4 sections, with optional follow-hint) ────────────────────

function DefaultView({
  events,
  showFollowHint,
}: {
  events: Event[]
  showFollowHint: boolean
}) {
  const todayEvents = events.filter((e) => isToday(e.date))
  const weekHighlights = events.filter(
    (e) => ['concert', 'brand'].includes(e.type) && isUpcomingWithin(e.date, 7),
  )
  const streamableEvents = events.filter(
    (e) =>
      ['livestream', 'streaming'].includes(e.type) &&
      isUpcomingWithin(e.date, 14),
  )
  const newsEvents = events.filter(
    (e) => ['official', 'media'].includes(e.type) && isUpcomingWithin(e.date, 14),
  )

  return (
    <div className="flex flex-col gap-6">
      {showFollowHint && (
        <div className="rounded-xl bg-primary-dim border border-primary/30 px-3 py-2.5 flex items-start gap-2">
          <UserPlus className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1 flex flex-col gap-1">
            <p className="text-xs text-text-base leading-snug">
              追蹤偶像後，這裡會優先顯示你的專屬行程
            </p>
            <Link
              href="/idols"
              className="self-start text-xs font-semibold text-primary"
            >
              去選偶像 →
            </Link>
          </div>
        </div>
      )}

      <section>
        <SectionHeader
          icon={<Zap className="h-4 w-4 text-primary" />}
          title="今日不能錯過"
          count={todayEvents.length}
          href="/schedule"
        />
        {todayEvents.length > 0 ? (
          <div className="flex flex-col gap-2">
            {todayEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-card-border bg-card px-4 py-5 text-center">
            <p className="text-sm text-muted">今天沒有公開確認的活動</p>
            <Link
              href="/schedule"
              className="mt-1 inline-block text-xs text-primary"
            >
              查看完整行程 →
            </Link>
          </div>
        )}
      </section>

      {weekHighlights.length > 0 && (
        <section>
          <SectionHeader
            icon={<Star className="h-4 w-4 text-yellow-400" />}
            title="本週重點"
            count={weekHighlights.length}
            href="/schedule"
          />
          <div className="flex flex-col gap-2">
            {weekHighlights.slice(0, 3).map((event) => (
              <EventCard key={event.id} event={event} compact />
            ))}
            <SeeAllFooter shown={Math.min(3, weekHighlights.length)} total={weekHighlights.length} />
          </div>
        </section>
      )}

      {streamableEvents.length > 0 && (
        <section>
          <SectionHeader
            icon={<Play className="h-4 w-4 text-red-400" />}
            title="最近可看"
            count={streamableEvents.length}
            href="/schedule"
          />
          <div className="flex flex-col gap-2">
            {streamableEvents.slice(0, 3).map((event) => (
              <EventCard key={event.id} event={event} compact />
            ))}
            <SeeAllFooter shown={Math.min(3, streamableEvents.length)} total={streamableEvents.length} />
          </div>
        </section>
      )}

      {newsEvents.length > 0 && (
        <section>
          <SectionHeader
            icon={<Newspaper className="h-4 w-4 text-sky-400" />}
            title="最新情報"
            count={newsEvents.length}
            href="/schedule"
          />
          <div className="flex flex-col gap-2">
            {newsEvents.slice(0, 3).map((event) => (
              <EventCard key={event.id} event={event} compact />
            ))}
            <SeeAllFooter shown={Math.min(3, newsEvents.length)} total={newsEvents.length} />
          </div>
        </section>
      )}
    </div>
  )
}

/**
 * F2: footer CTA shown under a truncated section. Renders nothing when the
 * full list fits inside the displayed slice (shown >= total) — keeps the
 * homepage uncluttered when traffic is low.
 */
function SeeAllFooter({ shown, total }: { shown: number; total: number }) {
  if (shown >= total) return null
  return (
    <Link
      href="/schedule"
      className="rounded-2xl border border-card-border bg-card/60 px-4 py-2.5 text-xs font-medium text-primary text-center hover:bg-card transition-colors"
    >
      查看全部 {total} 場 →
    </Link>
  )
}

function SectionHeader({
  icon,
  title,
  count,
  href,
}: {
  icon: React.ReactNode
  title: string
  count?: number
  href: string
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {icon}
      <h2 className="text-sm font-semibold text-text-base">{title}</h2>
      {count !== undefined && count > 0 && (
        <span className="text-xs text-primary font-medium">{count} 場</span>
      )}
      <Link
        href={href}
        className="ml-auto flex items-center gap-0.5 text-xs text-muted"
      >
        全部 <ChevronRight className="h-3 w-3" />
      </Link>
    </div>
  )
}

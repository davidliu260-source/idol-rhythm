'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import clsx from 'clsx'
import {
  CalendarDays,
  ChevronRight,
  Clock3,
  Heart,
  MapPin,
  Newspaper,
  Play,
  Sparkles,
  Star,
  UserPlus,
  Zap,
} from 'lucide-react'
import {
  EVENT_SUBTYPE_LABELS,
  EVENT_TYPE_LABELS,
  SOURCE_CONFIG,
  type Event,
} from '@/lib/mockEvents'
import { type Idol } from '@/lib/mockIdols'
import { useAppState } from '@/lib/appState'
import { getEventDateLabel } from '@/lib/eventDisplay'
import IdolAvatar from './IdolAvatar'
import ScheduleTrackCard from '@/app/schedule/ScheduleTrackCard'

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
    <div className="flex flex-col gap-5">
      <section className="rounded-[26px] border border-white/8 bg-white/[0.035] p-4">
        <SectionHeader
          icon={<Sparkles className="h-4 w-4 text-primary" />}
          title="我追蹤的近期行程"
          count={followedTotal}
          href="/favorites"
        />
        {followedEvents.length > 0 ? (
          <div className="flex flex-col gap-3">
            {followedEvents.map((event, index) => (
              <HomeTrackDisclosure key={event.id} event={event} trackNumber={index + 1} />
            ))}
            <SeeAllFooter
              shown={followedEvents.length}
              total={followedTotal}
              href="/favorites"
            />
          </div>
        ) : (
          <div className="rounded-[22px] border border-white/8 bg-white/[0.035] px-4 py-5 text-center">
            <p className="text-sm text-white/54">追蹤的偶像目前沒有公開行程</p>
            <Link
              href="/schedule"
              className="mt-2 inline-block text-xs font-semibold text-[#ff8bc8]"
            >
              查看完整行程 →
            </Link>
          </div>
        )}
      </section>

      {otherEvents.length > 0 && (
        <section className="rounded-[26px] border border-white/8 bg-white/[0.035] p-4">
          <SectionHeader
            icon={<Star className="h-4 w-4 text-yellow-400" />}
            title="更多星動行程"
            count={otherTotal}
            href="/schedule"
          />
          <div className="flex flex-col gap-3">
            {otherEvents.map((event, index) => (
              <HomeTrackDisclosure key={event.id} event={event} trackNumber={index + 1} />
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
    <div className="flex flex-col gap-5">
      {showFollowHint && (
        <div className="flex items-start gap-3 rounded-[22px] border border-[#ff6cb7]/18 bg-[#ff4ca1]/10 px-3 py-3">
          <UserPlus className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#ff8bc8]" />
          <div className="flex-1 flex flex-col gap-1">
            <p className="text-xs leading-5 text-white/68">
              追蹤偶像後，這裡會優先顯示你的專屬行程
            </p>
            <Link
              href="/idols"
              className="self-start text-xs font-semibold text-[#ff8bc8]"
            >
              去選偶像 →
            </Link>
          </div>
        </div>
      )}

      <section className="rounded-[26px] border border-white/8 bg-white/[0.035] p-4">
        <SectionHeader
          icon={<Zap className="h-4 w-4 text-primary" />}
          title="今日不能錯過"
          count={todayEvents.length}
          href="/schedule"
        />
        {todayEvents.length > 0 ? (
          <div className="flex flex-col gap-3">
            {todayEvents.map((event, index) => (
              <HomeTrackDisclosure key={event.id} event={event} trackNumber={index + 1} />
            ))}
          </div>
        ) : (
          <div className="rounded-[22px] border border-white/8 bg-white/[0.035] px-4 py-5 text-center">
            <p className="text-sm text-white/54">今天沒有公開確認的活動</p>
            <Link
              href="/schedule"
              className="mt-2 inline-block text-xs font-semibold text-[#ff8bc8]"
            >
              查看完整行程 →
            </Link>
          </div>
        )}
      </section>

      {weekHighlights.length > 0 && (
        <section className="rounded-[26px] border border-white/8 bg-white/[0.035] p-4">
          <SectionHeader
            icon={<Star className="h-4 w-4 text-yellow-400" />}
            title="本週重點"
            count={weekHighlights.length}
            href="/schedule"
          />
          <div className="flex flex-col gap-3">
            {weekHighlights.slice(0, 3).map((event, index) => (
              <HomeTrackDisclosure key={event.id} event={event} trackNumber={index + 1} />
            ))}
            <SeeAllFooter shown={Math.min(3, weekHighlights.length)} total={weekHighlights.length} />
          </div>
        </section>
      )}

      {streamableEvents.length > 0 && (
        <section className="rounded-[26px] border border-white/8 bg-white/[0.035] p-4">
          <SectionHeader
            icon={<Play className="h-4 w-4 text-red-400" />}
            title="最近可看"
            count={streamableEvents.length}
            href="/schedule"
          />
          <div className="flex flex-col gap-3">
            {streamableEvents.slice(0, 3).map((event, index) => (
              <HomeTrackDisclosure key={event.id} event={event} trackNumber={index + 1} />
            ))}
            <SeeAllFooter shown={Math.min(3, streamableEvents.length)} total={streamableEvents.length} />
          </div>
        </section>
      )}

      {newsEvents.length > 0 && (
        <section className="rounded-[26px] border border-white/8 bg-white/[0.035] p-4">
          <SectionHeader
            icon={<Newspaper className="h-4 w-4 text-sky-400" />}
            title="最新情報"
            count={newsEvents.length}
            href="/schedule"
          />
          <div className="flex flex-col gap-3">
            {newsEvents.slice(0, 3).map((event, index) => (
              <HomeTrackDisclosure key={event.id} event={event} trackNumber={index + 1} />
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
function SeeAllFooter({
  shown,
  total,
  href = '/schedule',
}: {
  shown: number
  total: number
  href?: string
}) {
  if (shown >= total) return null
  return (
    <Link
      href={href}
      className="rounded-[18px] border border-white/8 bg-white/[0.035] px-4 py-2.5 text-center text-xs font-semibold text-[#ff8bc8] transition-colors hover:bg-white/[0.055]"
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
    <div className="mb-3 flex items-center gap-2">
      {icon}
      <h2 className="text-sm font-bold text-white">{title}</h2>
      {count !== undefined && count > 0 && (
        <span className="text-xs font-medium text-[#ff8bc8]">{count} 場</span>
      )}
      <Link
        href={href}
        className="ml-auto flex items-center gap-0.5 text-xs font-medium text-white/42"
      >
        全部 <ChevronRight className="h-3 w-3" />
      </Link>
    </div>
  )
}

function HomeTrackDisclosure({
  event,
  trackNumber,
}: {
  event: Event
  trackNumber: number
}) {
  const { favorites } = useAppState()
  const [expanded, setExpanded] = useState(false)
  const [expandedVisible, setExpandedVisible] = useState(false)
  const collapseTimerRef = useRef<number | null>(null)
  const isFavorited = favorites.has(event.id)
  const dateLabel = getEventDateLabel(event)
  const locationLabel = event.venueName || event.location || event.city || event.country

  useEffect(() => {
    return () => {
      if (collapseTimerRef.current !== null) {
        window.clearTimeout(collapseTimerRef.current)
      }
    }
  }, [])

  function toggleFavorite(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation()
    favorites.toggle(event.id)
  }

  function openExpandedCard() {
    if (collapseTimerRef.current !== null) {
      window.clearTimeout(collapseTimerRef.current)
      collapseTimerRef.current = null
    }
    setExpanded(true)
    window.requestAnimationFrame(() => {
      setExpandedVisible(true)
    })
  }

  function collapseExpandedCard() {
    setExpandedVisible(false)
    collapseTimerRef.current = window.setTimeout(() => {
      setExpanded(false)
      collapseTimerRef.current = null
    }, 180)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openExpandedCard()
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {expanded ? (
        <div
          className={clsx(
            'origin-top transition-all duration-200 ease-out',
            expandedVisible ? 'scale-100 opacity-100' : 'scale-[0.98] opacity-0',
          )}
        >
          <ScheduleTrackCard
            event={event}
            trackNumber={trackNumber}
            onCollapse={collapseExpandedCard}
          />
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={openExpandedCard}
          onKeyDown={handleKeyDown}
          className="group flex w-full cursor-pointer items-center gap-3 rounded-[18px] border border-white/8 bg-white/[0.028] px-3 py-2.5 text-left transition-all hover:border-[#ff63bd]/18 hover:bg-white/[0.045] active:scale-[0.99]"
        >
          <div className="rounded-[14px] border border-white/8 bg-white/[0.035] p-1">
            <IdolAvatar
              name={event.idolName}
              avatarUrl={event.idolAvatarUrl}
              color={idolPrimaryColor(event.idolId)}
              size="sm"
              className="rounded-[10px]"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-[12px] font-semibold text-[#ff73c1]">
                {event.idolName}
              </span>
              <span className="rounded-full border border-white/8 bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.16em] text-white/38">
                TRK {String(trackNumber).padStart(2, '0')}
              </span>
            </div>
            <p className="mt-0.5 line-clamp-1 text-[14px] font-semibold leading-5 text-white/88">
              {event.title}
            </p>
            <div className="mt-1 flex min-w-0 items-center gap-2 text-[10px] text-white/42">
              <span className="inline-flex items-center gap-1">
                <Clock3 className="h-3 w-3 text-[#ff92c7]" />
                {dateLabel}
              </span>
              {locationLabel && (
                <span className="inline-flex min-w-0 items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate">{locationLabel}</span>
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={toggleFavorite}
            aria-label={isFavorited ? '取消收藏' : '收藏'}
            className={clsx(
              'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border transition-all',
              isFavorited
                ? 'border-[#ff5db7]/30 bg-[#ff5db7]/18 text-[#ff78c4] shadow-[0_0_18px_rgba(255,93,183,0.22)]'
                : 'border-white/8 bg-white/[0.03] text-white/36 group-hover:text-white/65',
            )}
          >
            <Heart className={clsx('h-4 w-4', isFavorited && 'fill-current')} />
          </button>
        </div>
      )}
    </div>
  )
}

function idolPrimaryColor(idolId: string): string {
  const palette = ['#6d4cff', '#ff5fae', '#00c2ff', '#7a5cff', '#4fd1a5', '#ff8d4d']
  const hash = Array.from(idolId).reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return palette[hash % palette.length]
}

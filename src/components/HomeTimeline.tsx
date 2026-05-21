'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  CalendarDays,
  ChevronRight,
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
          href="/schedule"
        />
        {followedEvents.length > 0 ? (
          <div className="flex flex-col gap-3">
            {followedEvents.map((event, index) => (
              <HomeEventRow key={event.id} event={event} trackNumber={index + 1} />
            ))}
            <SeeAllFooter
              shown={followedEvents.length}
              total={followedTotal}
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
              <HomeEventRow key={event.id} event={event} trackNumber={index + 1} compact />
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
              <HomeEventRow key={event.id} event={event} trackNumber={index + 1} />
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
              <HomeEventRow key={event.id} event={event} trackNumber={index + 1} compact />
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
              <HomeEventRow key={event.id} event={event} trackNumber={index + 1} compact />
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
              <HomeEventRow key={event.id} event={event} trackNumber={index + 1} compact />
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

function HomeEventRow({
  event,
  trackNumber,
  compact = false,
}: {
  event: Event
  trackNumber: number
  compact?: boolean
}) {
  const dateLabel = getEventDateLabel(event)
  const typeLabel = event.subType
    ? EVENT_SUBTYPE_LABELS[event.subType]
    : EVENT_TYPE_LABELS[event.type]
  const sourceConfig = SOURCE_CONFIG[event.source.level]
  const locationLabel = event.venueName || event.location || event.city || event.country

  return (
    <Link
      href={`/events/${event.id}`}
      className="group relative overflow-hidden rounded-[22px] border border-[#ff6cb7]/14 bg-[linear-gradient(180deg,rgba(44,33,54,0.9),rgba(24,18,31,0.96))] p-3 transition-transform active:scale-[0.99]"
    >
      <div className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-[linear-gradient(180deg,rgba(255,108,183,0.9),rgba(130,94,255,0.72))]" />
      <div className="relative flex items-start gap-3 pl-3">
        <IdolAvatar
          name={event.idolName}
          avatarUrl={event.idolAvatarUrl}
          color="#6366f1"
          size={compact ? 'sm' : 'md'}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-normal text-[#ff6cb7]">
                {event.idolName}
              </p>
              <h3 className={compact ? 'mt-1 line-clamp-1 text-sm font-black leading-snug text-white' : 'mt-1 line-clamp-2 text-base font-black leading-snug text-white'}>
                {event.title}
              </h3>
            </div>
            <span className="flex-shrink-0 rounded-full border border-white/16 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/48">
              TRK {String(trackNumber).padStart(2, '0')}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[#ff6cb7]/18 bg-[#ff4ca1]/10 px-2.5 py-1 text-[11px] font-semibold text-[#ff93ca]">
              {typeLabel}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/14 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
              <span className={event.source.level === 'official' ? 'h-1.5 w-1.5 rounded-full bg-emerald-300' : 'h-1.5 w-1.5 rounded-full bg-sky-300'} />
              {sourceConfig.label}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/50">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-[#ff8bc8]" />
              {dateLabel}{event.time ? ` · ${event.time}` : ''}
            </span>
            {locationLabel && (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-[#b7a7ff]" />
                <span className="truncate">{locationLabel}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

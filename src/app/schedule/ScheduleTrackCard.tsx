'use client'

import { type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Clock3, Heart, MapPin, Radio, Sparkles } from 'lucide-react'
import clsx from 'clsx'
import IdolAvatar from '@/components/IdolAvatar'
import { useAppState } from '@/lib/appState'
import { getEventDateLabel } from '@/lib/eventDisplay'
import { EVENT_SUBTYPE_LABELS, EVENT_TYPE_LABELS, type Event } from '@/lib/mockEvents'

interface ScheduleTrackCardProps {
  event: Event
  trackNumber: number
  compact?: boolean
}

export default function ScheduleTrackCard({
  event,
  trackNumber,
  compact = false,
}: ScheduleTrackCardProps) {
  const router = useRouter()
  const { favorites, reminders } = useAppState()
  const isFavorited = favorites.has(event.id)
  const hasReminder = reminders.has(event.id)
  const dateLabel = getEventDateLabel(event)
  const timeVenueText = [dateLabel, event.time, event.venueName || event.location, event.country]
    .filter(Boolean)
    .join('  ·  ')

  function navigateToDetail() {
    router.push(`/events/${event.id}`)
  }

  function onCardKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      navigateToDetail()
    }
  }

  function handleFavorite(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation()
    favorites.toggle(event.id)
  }

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={navigateToDetail}
      onKeyDown={onCardKeyDown}
      className={clsx(
        'group relative overflow-hidden rounded-[22px] border px-4 py-4 transition-all active:scale-[0.985] cursor-pointer',
        'border-[#ff4fa826] bg-[linear-gradient(180deg,rgba(46,35,54,0.94),rgba(31,24,38,0.98))] shadow-[0_10px_40px_rgba(0,0,0,0.25)]',
        'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[linear-gradient(90deg,transparent,rgba(255,115,196,0.65),transparent)]',
        compact ? 'min-h-[168px]' : 'min-h-[184px]',
      )}
    >
      <div className="pointer-events-none absolute inset-y-4 left-0 w-[4px] rounded-r-full bg-[linear-gradient(180deg,rgba(255,96,174,0.85),rgba(137,89,255,0.55))]" />

      <div className="relative flex items-start gap-3">
        <div className="relative pt-0.5">
          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <IdolAvatar
              name={event.idolName}
              avatarUrl={event.idolAvatarUrl}
              color={idolPrimaryColor(event.idolId)}
              size="md"
              className="rounded-[14px]"
            />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-[13px] font-semibold tracking-[0.02em] text-[#ff61b7]">
                  {event.idolName}
                </span>
                {event.originalTitle && (
                  <span className="hidden text-[10px] uppercase tracking-[0.24em] text-white/30 sm:inline">
                    archive
                  </span>
                )}
              </div>
              <h3 className="mt-1 text-[17px] font-semibold leading-[1.26] text-white">
                {event.title}
              </h3>
            </div>

            <TrackCode trackNumber={trackNumber} />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <KindPill event={event} />
            <StatusPill level={event.source.level} />
            {hasReminder && (
              <MetaPill icon={<Bell className="h-3 w-3" />} label="提醒中" tone="violet" />
            )}
          </div>

          <div className="mt-3 rounded-2xl border border-white/8 bg-white/[0.035] px-3.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-white/72">
              <span className="inline-flex items-center gap-1.5 font-medium text-white/88">
                <Clock3 className="h-3.5 w-3.5 text-[#ff92c7]" />
                {dateLabel}
                {event.time ? ` · ${event.time}` : ''}
              </span>
              {(event.venueName || event.location) && (
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-white/45" />
                  <span className="truncate">
                    {event.venueName || event.location}
                    {event.country ? ` · ${event.country}` : ''}
                  </span>
                </span>
              )}
            </div>
          </div>

          {!compact && event.description && (
            <p className="mt-3 line-clamp-2 text-[12px] leading-5 text-white/58">
              {event.description}
            </p>
          )}
        </div>

        <HeartButton active={isFavorited} onClick={handleFavorite} />
      </div>

      <div className="relative mt-3 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.2em] text-white/28">
        <span className="truncate">cassette archive</span>
        <span className="truncate text-right">{timeVenueText}</span>
      </div>
    </div>
  )
}

function KindPill({ event }: { event: Event }) {
  const label =
    (event.subType && EVENT_SUBTYPE_LABELS[event.subType]) ||
    EVENT_TYPE_LABELS[event.type] ||
    event.type

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#ff79bd2e] bg-[#ff5eb314] px-2.5 py-1 text-[11px] font-medium text-[#ff9cd0]">
      <Radio className="h-3 w-3" />
      {label}
    </span>
  )
}

function StatusPill({ level }: { level: Event['source']['level'] }) {
  const config = {
    official: {
      label: '官方確認',
      className: 'border-emerald-400/25 bg-emerald-400/12 text-emerald-300',
    },
    media: {
      label: '媒體確認',
      className: 'border-sky-400/25 bg-sky-400/12 text-sky-300',
    },
    pending: {
      label: 'Community',
      className: 'border-white/10 bg-white/[0.07] text-white/70',
    },
  }[level]

  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium', config.className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {config.label}
    </span>
  )
}

function MetaPill({
  icon,
  label,
  tone,
}: {
  icon: ReactNode
  label: string
  tone: 'violet'
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium',
        tone === 'violet' && 'border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-200',
      )}
    >
      {icon}
      {label}
    </span>
  )
}

function HeartButton({
  active,
  onClick,
}: {
  active: boolean
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={active ? '取消收藏' : '收藏'}
      className={clsx(
        'mt-auto flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border transition-all',
        active
          ? 'border-[#ff5db7]/30 bg-[#ff5db7]/18 text-[#ff78c4] shadow-[0_0_24px_rgba(255,93,183,0.28)]'
          : 'border-white/10 bg-white/[0.035] text-white/38 hover:text-white/70',
      )}
    >
      <Heart className={clsx('h-4.5 w-4.5', active && 'fill-current')} />
    </button>
  )
}

function TrackCode({ trackNumber }: { trackNumber: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/8 bg-white/[0.045] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.22em] text-white/45">
      <Sparkles className="h-2.5 w-2.5" />
      {`TRK ${String(trackNumber).padStart(2, '0')}`}
    </span>
  )
}

function idolPrimaryColor(idolId: string): string {
  switch (idolId) {
    case 'bts':
      return '#8b5cf6'
    case 'blackpink':
      return '#ec4899'
    case 'aespa':
      return '#7c3aed'
    case 'newjeans':
      return '#14b8a6'
    case 'stray-kids':
      return '#ef4444'
    case 'ive':
      return '#f43f5e'
    case 'twice':
      return '#fb7185'
    case 'lesserafim':
      return '#f59e0b'
    case 'txt':
      return '#3b82f6'
    case 'exo':
      return '#6366f1'
    default:
      return '#7c3aed'
  }
}

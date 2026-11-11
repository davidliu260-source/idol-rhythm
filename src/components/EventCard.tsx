'use client'

import { useRouter } from 'next/navigation'
import { MapPin, Clock, Heart, Bell, Share2, ExternalLink } from 'lucide-react'
import { type Event, formatEventDate } from '@/lib/mockEvents'
import { getEventDateLabel } from '@/lib/eventDisplay'
import { useAppState } from '@/lib/appState'
import SourceBadge from './SourceBadge'
import EventTypeBadge from './EventTypeBadge'
import IdolAvatar from './IdolAvatar'
import clsx from 'clsx'

interface EventCardProps {
  event: Event
  compact?: boolean
}

export default function EventCard({ event, compact = false }: EventCardProps) {
  const router = useRouter()
  const { favorites, reminders } = useAppState()
  const isFavorited = favorites.has(event.id)
  const hasReminder = reminders.has(event.id)
  const dateLabel = getEventDateLabel(event)
  const isToday = dateLabel.startsWith('今天')

  const navigateToDetail = () => router.push(`/events/${event.id}`)
  const onCardKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      navigateToDetail()
    }
  }

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation()
    favorites.toggle(event.id)
  }
  const handleReminder = (e: React.MouseEvent) => {
    e.stopPropagation()
    reminders.toggle(event.id)
  }
  const handleNoop = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  if (compact) {
    return (
      <div
        role="link"
        tabIndex={0}
        onClick={navigateToDetail}
        onKeyDown={onCardKeyDown}
        className={clsx(
          'group relative rounded-2xl border border-card-border bg-card transition-all active:scale-[0.98] p-3 cursor-pointer',
          isToday && 'border-primary/40 bg-primary-dim',
        )}
      >
        {isToday && (
          <div className="absolute -top-px left-4 h-0.5 w-12 rounded-full bg-primary" />
        )}
        <div className="flex items-center gap-3">
          <IdolAvatar
            name={event.idolName}
            avatarUrl={event.idolAvatarUrl}
            color={idolPrimaryColor(event.idolId)}
            size="sm"
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-xs font-semibold text-primary truncate max-w-[72px]">
                {event.idolName}
              </span>
              <EventTypeBadge type={event.type} subType={event.subType} />
            </div>
            <p className="text-sm font-semibold text-text-base leading-snug line-clamp-1">
              {event.title}
            </p>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <span
                className={clsx(
                  'text-xs font-medium',
                  isToday ? 'text-primary' : 'text-muted',
                )}
              >
                {event.countryFlag} {dateLabel}
              </span>
              {event.time && (
                <span className="flex items-center gap-0.5 text-xs text-muted">
                  <Clock className="h-3 w-3" />
                  {event.time}
                </span>
              )}
              <span className="ml-auto">
                <SourceBadge source={event.source.level} size="sm" />
              </span>
            </div>
          </div>

          <button
            type="button"
            className="flex-shrink-0 p-1.5 -mr-1"
            onClick={handleFavorite}
            aria-label={isFavorited ? '取消收藏' : '收藏'}
          >
            <Heart
              className={clsx(
                'h-4 w-4 transition-colors',
                isFavorited ? 'fill-primary text-primary' : 'text-muted/50',
              )}
            />
          </button>
        </div>
      </div>
    )
  }

  // Full card
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={navigateToDetail}
      onKeyDown={onCardKeyDown}
      className={clsx(
        'group relative rounded-2xl border border-card-border bg-card transition-all active:scale-[0.98] p-4 cursor-pointer',
        isToday && 'border-primary/40 bg-primary-dim',
      )}
    >
      {isToday && (
        <div className="absolute -top-px left-4 h-0.5 w-12 rounded-full bg-primary" />
      )}

      {/* Top row: avatar + meta + favorite */}
      <div className="flex items-start gap-3">
        <IdolAvatar
          name={event.idolName}
          avatarUrl={event.idolAvatarUrl}
          color={idolPrimaryColor(event.idolId)}
          size="md"
        />

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className="text-xs font-semibold text-primary">{event.idolName}</span>
            <EventTypeBadge type={event.type} subType={event.subType} />
          </div>
          <h3 className="text-base font-semibold text-text-base leading-snug line-clamp-2">
            {event.title}
          </h3>
        </div>

        <button
          type="button"
          className="flex-shrink-0 p-1 -mt-0.5 -mr-0.5"
          onClick={handleFavorite}
          aria-label={isFavorited ? '取消收藏' : '收藏'}
        >
          <Heart
            className={clsx(
              'h-4 w-4 transition-colors',
              isFavorited ? 'fill-primary text-primary' : 'text-muted/50',
            )}
          />
        </button>
      </div>

      {/* Date / time / location row */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={clsx('text-xs font-medium', isToday ? 'text-primary' : 'text-muted')}>
          {event.countryFlag} {dateLabel}
        </span>
        {event.time && (
          <span className="flex items-center gap-0.5 text-xs text-muted">
            <Clock className="h-3 w-3" />
            {event.time}
          </span>
        )}
        {event.location && (
          <span className="flex items-center gap-0.5 text-xs text-muted">
            <MapPin className="h-3 w-3" />
            {event.location}
          </span>
        )}
      </div>

      {/* Source */}
      <div className="mt-2">
        <SourceBadge source={event.source.level} label={event.source.label} />
      </div>

      {/* Action bar */}
      <div className="mt-3 pt-3 border-t border-card-border flex items-center gap-0.5">
        <ActionBtn
          icon={
            <Heart className={clsx('h-3.5 w-3.5', isFavorited && 'fill-primary text-primary')} />
          }
          label="收藏"
          active={isFavorited}
          onClick={handleFavorite}
        />
        <ActionBtn
          icon={
            <Bell className={clsx('h-3.5 w-3.5', hasReminder && 'text-primary')} />
          }
          label="提醒"
          active={hasReminder}
          onClick={handleReminder}
        />
        {(event.source.url || event.ticketUrl || event.streamUrl) && (
          <ActionBtn
            icon={<ExternalLink className="h-3.5 w-3.5" />}
            label="來源"
            onClick={handleNoop}
          />
        )}
        <ActionBtn
          icon={<Share2 className="h-3.5 w-3.5" />}
          label="分享"
          onClick={handleNoop}
        />
      </div>
    </div>
  )
}

function ActionBtn({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
  onClick: (e: React.MouseEvent) => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
        active
          ? 'text-primary bg-primary/10'
          : 'text-muted hover:text-text-base hover:bg-card-border/40',
      )}
    >
      {icon}
      {label}
    </button>
  )
}

/**
 * Per-idol primary brand color, used as the IdolAvatar fallback when the
 * idol has no uploaded photo. Returns a single hex; IdolAvatar derives the
 * gradient (`color88 → color`) from it. Mock-data idol slugs are hardcoded
 * for parity with the pre-I1a visual; unknown ids fall back to indigo.
 */
function idolPrimaryColor(idolId: string): string {
  const colorMap: Record<string, string> = {
    bts: '#7c3aed',
    blackpink: '#ec4899',
    aespa: '#06b6d4',
    newjeans: '#3b82f6',
    'stray-kids': '#f59e0b',
    ive: '#10b981',
    twice: '#f97316',
    'le-sserafim': '#eab308',
    txt: '#a855f7',
    exo: '#ef4444',
  }
  return colorMap[idolId] ?? '#6366f1'
}

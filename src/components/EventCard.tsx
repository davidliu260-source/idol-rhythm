'use client'

import Link from 'next/link'
import { MapPin, Clock, Heart, Bell, Share2, ExternalLink } from 'lucide-react'
import { type Event, formatEventDate } from '@/lib/mockEvents'
import SourceBadge from './SourceBadge'
import EventTypeBadge from './EventTypeBadge'
import clsx from 'clsx'

interface EventCardProps {
  event: Event
  compact?: boolean
}

export default function EventCard({ event, compact = false }: EventCardProps) {
  const dateLabel = formatEventDate(event.date)
  const isToday = dateLabel.startsWith('今天')

  if (compact) {
    return (
      <Link href={`/events/${event.id}`} className="block">
        <div
          className={clsx(
            'group relative rounded-2xl border border-card-border bg-card transition-all active:scale-[0.98] p-3',
            isToday && 'border-primary/40 bg-primary-dim',
          )}
        >
          {isToday && (
            <div className="absolute -top-px left-4 h-0.5 w-12 rounded-full bg-primary" />
          )}
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center text-base font-bold text-white"
              style={{ background: `linear-gradient(135deg, ${idolColor(event.idolId)})` }}
            >
              {event.idolName.charAt(0)}
            </div>

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
              className="flex-shrink-0 p-1.5 -mr-1"
              onClick={(e) => e.preventDefault()}
              aria-label="收藏"
            >
              <Heart
                className={clsx(
                  'h-4 w-4 transition-colors',
                  event.isFavorited ? 'fill-primary text-primary' : 'text-muted/50',
                )}
              />
            </button>
          </div>
        </div>
      </Link>
    )
  }

  // Full card
  return (
    <Link href={`/events/${event.id}`} className="block">
      <div
        className={clsx(
          'group relative rounded-2xl border border-card-border bg-card transition-all active:scale-[0.98] p-4',
          isToday && 'border-primary/40 bg-primary-dim',
        )}
      >
        {isToday && (
          <div className="absolute -top-px left-4 h-0.5 w-12 rounded-full bg-primary" />
        )}

        {/* Top row: avatar + meta + favorite */}
        <div className="flex items-start gap-3">
          <div
            className="h-12 w-12 flex-shrink-0 rounded-xl flex items-center justify-center text-lg font-bold text-white"
            style={{ background: `linear-gradient(135deg, ${idolColor(event.idolId)})` }}
          >
            {event.idolName.charAt(0)}
          </div>

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
            className="flex-shrink-0 p-1 -mt-0.5 -mr-0.5"
            onClick={(e) => e.preventDefault()}
            aria-label="收藏"
          >
            <Heart
              className={clsx(
                'h-4 w-4 transition-colors',
                event.isFavorited ? 'fill-primary text-primary' : 'text-muted/50',
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
              <Heart
                className={clsx(
                  'h-3.5 w-3.5',
                  event.isFavorited && 'fill-primary text-primary',
                )}
              />
            }
            label="收藏"
            active={event.isFavorited}
            onClick={(e) => e.preventDefault()}
          />
          <ActionBtn
            icon={<Bell className="h-3.5 w-3.5" />}
            label="提醒"
            onClick={(e) => e.preventDefault()}
          />
          {(event.source.url || event.ticketUrl || event.streamUrl) && (
            <ActionBtn
              icon={<ExternalLink className="h-3.5 w-3.5" />}
              label="來源"
              onClick={(e) => e.preventDefault()}
            />
          )}
          <ActionBtn
            icon={<Share2 className="h-3.5 w-3.5" />}
            label="分享"
            onClick={(e) => e.preventDefault()}
          />
        </div>
      </div>
    </Link>
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

function idolColor(idolId: string): string {
  const colorMap: Record<string, string> = {
    bts: '#4c1d95, #7c3aed',
    blackpink: '#9d174d, #ec4899',
    aespa: '#164e63, #06b6d4',
    newjeans: '#1e3a8a, #3b82f6',
    'stray-kids': '#78350f, #f59e0b',
    ive: '#064e3b, #10b981',
    twice: '#7c2d12, #f97316',
    'le-sserafim': '#713f12, #eab308',
    txt: '#4a1d96, #a855f7',
    exo: '#7f1d1d, #ef4444',
  }
  return colorMap[idolId] ?? '#1e1b4b, #6366f1'
}

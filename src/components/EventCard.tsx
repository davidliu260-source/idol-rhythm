'use client'

import Link from 'next/link'
import { MapPin, Clock, Heart } from 'lucide-react'
import { type IdolEvent, formatEventDate } from '@/lib/mockEvents'
import SourceBadge from './SourceBadge'
import EventTypeBadge from './EventTypeBadge'
import clsx from 'clsx'

interface EventCardProps {
  event: IdolEvent
  compact?: boolean
}

export default function EventCard({ event, compact = false }: EventCardProps) {
  const dateLabel = formatEventDate(event.date)
  const isToday = dateLabel.startsWith('今天')

  return (
    <Link href={`/events/${event.id}`} className="block">
      <div
        className={clsx(
          'group relative rounded-2xl border border-card-border bg-card transition-all active:scale-[0.98]',
          compact ? 'p-3' : 'p-4',
          isToday && 'border-primary/40 bg-primary-dim',
        )}
      >
        {/* Today indicator */}
        {isToday && (
          <div className="absolute -top-px left-4 h-0.5 w-12 rounded-full bg-primary" />
        )}

        <div className="flex items-start justify-between gap-3">
          {/* Left: idol avatar placeholder */}
          <div
            className={clsx(
              'flex-shrink-0 rounded-xl flex items-center justify-center text-lg font-bold text-white',
              compact ? 'h-10 w-10 text-base' : 'h-12 w-12',
            )}
            style={{
              background: `linear-gradient(135deg, ${idolColor(event.idolId)})`,
            }}
          >
            {event.idolName.charAt(0)}
          </div>

          {/* Center: main info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <span className="text-xs font-semibold text-primary">{event.idolName}</span>
              <EventTypeBadge type={event.type} />
              {!event.confirmed && (
                <span className="text-xs text-amber-400/80 font-medium">待確認</span>
              )}
            </div>

            <h3
              className={clsx(
                'font-semibold text-text-base leading-snug line-clamp-2',
                compact ? 'text-sm' : 'text-base',
              )}
            >
              {event.title}
            </h3>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className={clsx('font-medium', isToday ? 'text-primary' : 'text-muted', 'text-xs')}>
                {event.countryFlag} {dateLabel}
              </span>
              {event.time && (
                <span className="flex items-center gap-0.5 text-xs text-muted">
                  <Clock className="h-3 w-3" />
                  {event.time}
                </span>
              )}
              {event.location && !compact && (
                <span className="flex items-center gap-0.5 text-xs text-muted">
                  <MapPin className="h-3 w-3" />
                  {event.location}
                </span>
              )}
            </div>

            {!compact && (
              <div className="mt-2">
                <SourceBadge source={event.source} label={event.sourceLabel} />
              </div>
            )}
          </div>

          {/* Right: favorite */}
          <button
            className="flex-shrink-0 p-1"
            onClick={(e) => e.preventDefault()}
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

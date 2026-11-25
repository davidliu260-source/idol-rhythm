'use client'

import Link from 'next/link'
import { Bell, Clock3, Heart, MapPin } from 'lucide-react'
import clsx from 'clsx'
import EventTypeBadge from '@/components/EventTypeBadge'
import IdolAvatar from '@/components/IdolAvatar'
import SourceBadge from '@/components/SourceBadge'
import TicketSaleBadge from '@/components/TicketSaleBadge'
import { useAppState } from '@/lib/appState'
import { getEventDateLabel } from '@/lib/eventDisplay'
import { getEventLocationLabel, hasAnyEventLocation } from '@/lib/eventLocation'
import { getIdolMarkSrc, resolveIdolColor } from '@/lib/idolMarks'
import type { Event } from '@/lib/types'

export default function ScheduleTrackCard({ events }: { events: readonly [Event, ...Event[]] }) {
  const [idol] = events
  const markSrc = getIdolMarkSrc(idol.idolId)
  const color = resolveIdolColor({ slug: idol.idolId, color: idol.idolColor, name: idol.idolName })

  return (
    <article className="relative rounded-[22px] border border-[#ff4fa826] bg-gradient-to-b from-[#2e2336] to-[#1f1826] p-3 pl-4">
      <div aria-hidden="true" className="absolute inset-y-4 left-0 w-1 rounded-r-full" style={{ backgroundColor: color }} />
      <header className="mb-2 flex items-center gap-2.5">
        <IdolAvatar name={idol.idolName} markSrc={markSrc} color={color} decorative />
        <div className="min-w-0">
          <h3>
            <Link href={`/idols/${encodeURIComponent(idol.idolId)}`} className="flex min-h-11 min-w-11 items-center break-words text-xl font-bold leading-tight text-white hover:underline">
              {idol.idolName}
            </Link>
          </h3>
          <p className="text-xs text-white/70">{events.length} 場</p>
        </div>
      </header>

      <ul className="space-y-2">
        {events.map(event => <ScheduleEventRow key={event.id} event={event} />)}
      </ul>
    </article>
  )
}

function ScheduleEventRow({ event }: { event: Event }) {
  const { favorites, reminders } = useAppState()
  const isFavorited = favorites.has(event.id)
  const hasReminder = reminders.has(event.id)
  const place = hasAnyEventLocation(event) ? getEventLocationLabel(event) : null

  return (
    <li className="flex items-start gap-1 rounded-2xl border border-white/10 bg-white/[0.04] pr-1.5 transition-colors hover:bg-white/[0.07]">
      <Link href={`/events/${event.id}`} className="min-h-11 min-w-0 flex-1 self-stretch rounded-2xl px-2.5 py-2.5">
        <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <EventTypeBadge type={event.type} subType={event.subType} />
          <SourceBadge source={event.source.level} />
          <TicketSaleBadge startsAt={event.ticketSaleStartsAt} />
        </div>
        <h4 className="break-words text-sm font-semibold leading-snug text-white">{event.title}</h4>
        {event.originalTitle && <p className="mt-0.5 truncate text-xs text-white/70">{event.originalTitle}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/75">
          <span className="inline-flex items-center gap-1">
            <Clock3 aria-hidden="true" className="h-3 w-3 shrink-0 text-[#ff92c7]" />
            {getEventDateLabel(event)}{event.time ? ` · ${event.time}` : ''}
          </span>
          {place && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin aria-hidden="true" className="h-3 w-3 shrink-0" />
              <span className="break-words">{place}{event.country ? ` · ${event.country}` : ''}</span>
            </span>
          )}
        </div>
      </Link>
      <div className="flex shrink-0 flex-col gap-1 py-1.5 sm:flex-row">
        <button
          type="button"
          onClick={() => favorites.toggle(event.id)}
          aria-label={`收藏：${event.title}`}
          aria-pressed={isFavorited}
          className={clsx(
            'grid h-11 w-11 place-items-center rounded-full border',
            isFavorited ? 'border-pink-300/30 bg-pink-400/15 text-pink-300' : 'border-white/15 text-white/70 hover:text-white',
          )}
        >
          <Heart aria-hidden="true" className={clsx('h-4 w-4', isFavorited && 'fill-current')} />
        </button>
        {hasReminder && (
          <span
            role="img"
            aria-label={`已設提醒：${event.title}`}
            title="提醒中"
            className="grid h-11 w-11 place-items-center rounded-full border border-violet-300/30 bg-violet-400/15 text-violet-200"
          >
            <Bell aria-hidden="true" className="h-4 w-4 fill-current" />
          </span>
        )}
      </div>
    </li>
  )
}

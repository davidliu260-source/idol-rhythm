'use client'

import { useState } from 'react'
import type { Event } from '@/lib/mockEvents'
import type { Idol } from '@/lib/types'
import EventCard from '@/components/EventCard'
import { formatEventDate } from '@/lib/mockEvents'

interface Props {
  events: Event[]
  idols: Idol[]
}

export default function ScheduleClient({ events, idols }: Props) {
  const [activeIdolId, setActiveIdolId] = useState<string | null>(null)

  const filtered =
    activeIdolId === null ? events : events.filter((e) => e.idolId === activeIdolId)

  const now = new Date()

  const groups: Record<string, Event[]> = {}
  for (const event of filtered) {
    const key = formatEventDate(event.date)
    if (!groups[key]) groups[key] = []
    groups[key].push(event)
  }

  const upcomingGroups = Object.entries(groups).filter(([, evs]) =>
    evs.some((e) => new Date(e.date) >= now),
  )
  const pastGroups = Object.entries(groups).filter(([, evs]) =>
    evs.every((e) => new Date(e.date) < now),
  )

  return (
    <>
      {/* Idol filter */}
      <div className="px-4 mb-4 overflow-x-auto scrollbar-none">
        <div className="flex gap-2 pb-1">
          <button
            onClick={() => setActiveIdolId(null)}
            className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              activeIdolId === null
                ? 'bg-primary text-white'
                : 'border border-card-border bg-card text-muted'
            }`}
          >
            全部
          </button>
          {idols.map((idol) => (
            <button
              key={idol.id}
              onClick={() => setActiveIdolId(idol.id === activeIdolId ? null : idol.id)}
              className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                activeIdolId === idol.id
                  ? 'bg-primary text-white'
                  : 'border border-card-border bg-card text-muted'
              }`}
            >
              {idol.name}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="px-4 flex flex-col gap-6">
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-muted">
            {activeIdolId !== null ? '該偶像目前沒有公開活動' : '尚無活動資料'}
          </div>
        )}

        {upcomingGroups.map(([label, evs]) => (
          <DateGroup key={label} label={label} events={evs} isToday={label.startsWith('今天')} />
        ))}

        {pastGroups.length > 0 && (
          <>
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-card-border" />
              <span className="text-xs text-muted">已結束</span>
              <div className="h-px flex-1 bg-card-border" />
            </div>
            {pastGroups.map(([label, evs]) => (
              <DateGroup key={label} label={label} events={evs} isPast />
            ))}
          </>
        )}
      </div>
    </>
  )
}

function DateGroup({
  label,
  events,
  isToday = false,
  isPast = false,
}: {
  label: string
  events: Event[]
  isToday?: boolean
  isPast?: boolean
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center pt-1">
        <div
          className={`h-3 w-3 rounded-full flex-shrink-0 ${
            isToday ? 'bg-primary ring-4 ring-primary/20' : isPast ? 'bg-card-border' : 'bg-muted'
          }`}
        />
        <div className="w-px flex-1 bg-card-border mt-1" />
      </div>
      <div className="flex-1 pb-2">
        <p
          className={`text-xs font-semibold mb-2 ${
            isToday ? 'text-primary' : isPast ? 'text-muted/50' : 'text-muted'
          }`}
        >
          {label}
        </p>
        <div className={`flex flex-col gap-2 ${isPast ? 'opacity-50' : ''}`}>
          {events.map((event) => (
            <EventCard key={event.id} event={event} compact />
          ))}
        </div>
      </div>
    </div>
  )
}

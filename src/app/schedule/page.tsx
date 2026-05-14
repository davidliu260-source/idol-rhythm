import { Calendar } from 'lucide-react'
import { getVisibleEvents, formatEventDate } from '@/lib/mockEvents'
import { MOCK_IDOLS } from '@/lib/mockIdols'
import EventCard from '@/components/EventCard'

export default function SchedulePage() {
  const now = new Date()
  const visibleEvents = getVisibleEvents()

  const sorted = [...visibleEvents].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  )

  const groups: Record<string, typeof sorted> = {}
  for (const event of sorted) {
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
    <div className="flex flex-col gap-0 pt-12 pb-6">
      {/* Header */}
      <div className="px-4 mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold text-text-base">行程時間軸</h1>
        </div>
        <p className="text-xs text-muted mt-1">
          共 {visibleEvents.length} 筆已確認活動
        </p>
      </div>

      {/* Demo banner */}
      <div className="px-4 mb-4">
        <div className="flex items-start gap-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 px-3 py-2.5">
          <span className="text-amber-400 text-sm leading-none mt-0.5">⚠️</span>
          <p className="text-xs text-amber-300 leading-snug">
            <span className="font-semibold">Demo 展示資料</span>
            ｜僅顯示官方確認與媒體確認的活動，非真實官方行程
          </p>
        </div>
      </div>

      {/* Idol filter (mock — not functional) */}
      <div className="px-4 mb-4 overflow-x-auto scrollbar-none">
        <div className="flex gap-2 pb-1">
          <button className="flex-shrink-0 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">
            全部
          </button>
          {MOCK_IDOLS.slice(0, 6).map((idol) => (
            <button
              key={idol.id}
              className="flex-shrink-0 rounded-full border border-card-border bg-card px-3 py-1 text-xs text-muted"
            >
              {idol.name}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="px-4 flex flex-col gap-6">
        {upcomingGroups.map(([label, events]) => (
          <DateGroup key={label} label={label} events={events} isToday={label.startsWith('今天')} />
        ))}

        {pastGroups.length > 0 && (
          <>
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-card-border" />
              <span className="text-xs text-muted">已結束</span>
              <div className="h-px flex-1 bg-card-border" />
            </div>
            {pastGroups.map(([label, events]) => (
              <DateGroup key={label} label={label} events={events} isPast />
            ))}
          </>
        )}
      </div>
    </div>
  )
}

function DateGroup({
  label,
  events,
  isToday = false,
  isPast = false,
}: {
  label: string
  events: ReturnType<typeof getVisibleEvents>
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

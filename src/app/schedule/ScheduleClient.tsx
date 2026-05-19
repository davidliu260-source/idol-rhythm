'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, List, CalendarDays, Heart } from 'lucide-react'
import type { Event } from '@/lib/mockEvents'
import type { Idol } from '@/lib/types'
import EventCard from '@/components/EventCard'
import { formatEventDate } from '@/lib/mockEvents'
import { useAppState } from '@/lib/appState'

interface Props {
  events: Event[]
  idols: Idol[]
}

type ViewMode = 'timeline' | 'calendar'

export default function ScheduleClient({ events, idols }: Props) {
  const [activeIdolId, setActiveIdolId] = useState<string | null>(null)
  const [view, setView] = useState<ViewMode>('timeline')

  const filtered = useMemo(
    () => (activeIdolId === null ? events : events.filter((e) => e.idolId === activeIdolId)),
    [events, activeIdolId],
  )

  return (
    <>
      {/* View toggle */}
      <div className="px-4 mb-3">
        <div className="inline-flex rounded-xl border border-card-border bg-card p-0.5">
          <ViewToggleButton
            active={view === 'timeline'}
            onClick={() => setView('timeline')}
            icon={<List className="h-3.5 w-3.5" />}
            label="時間軸"
          />
          <ViewToggleButton
            active={view === 'calendar'}
            onClick={() => setView('calendar')}
            icon={<CalendarDays className="h-3.5 w-3.5" />}
            label="月曆"
          />
        </div>
      </div>

      {/* Idol filter (F-scroll): horizontal scroller with desktop arrow
          buttons + mouse-wheel-to-horizontal + edge fade indicators. */}
      <IdolFilterBar
        idols={idols}
        activeIdolId={activeIdolId}
        onSelect={(id) =>
          setActiveIdolId(id === activeIdolId ? null : id)
        }
      />

      {view === 'timeline' ? (
        <TimelineView events={filtered} activeIdolId={activeIdolId} />
      ) : (
        <CalendarView events={filtered} activeIdolId={activeIdolId} />
      )}
    </>
  )
}

function ViewToggleButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
        active ? 'bg-primary text-white' : 'text-muted'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeline view (unchanged from S1)
// ─────────────────────────────────────────────────────────────────────────────

function TimelineView({
  events,
  activeIdolId,
}: {
  events: Event[]
  activeIdolId: string | null
}) {
  const now = new Date()

  const groups: Record<string, Event[]> = {}
  for (const event of events) {
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
    <div className="px-4 flex flex-col gap-6">
      {events.length === 0 && (
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

// ─────────────────────────────────────────────────────────────────────────────
// Calendar (month grid) view — C1
// ─────────────────────────────────────────────────────────────────────────────

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

function CalendarView({
  events,
  activeIdolId,
}: {
  events: Event[]
  activeIdolId: string | null
}) {
  const { favorites, user } = useAppState()
  const today = useMemo(() => new Date(), [])
  const [cursor, setCursor] = useState<Date>(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  // Bucket events by yyyy-mm-dd local key
  const eventsByDay = useMemo(() => {
    const map = new Map<string, Event[]>()
    for (const e of events) {
      const d = new Date(e.date)
      const key = dayKey(d)
      const arr = map.get(key)
      if (arr) arr.push(e)
      else map.set(key, [e])
    }
    return map
  }, [events])

  // Build 6×7 grid cells for the current cursor month
  const cells = useMemo(() => buildMonthCells(cursor), [cursor])

  const monthLabel = `${cursor.getFullYear()} 年 ${cursor.getMonth() + 1} 月`

  const goPrev = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
  const goNext = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
  const goToday = () => {
    setCursor(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelectedDate(today)
  }

  const selectedEvents = selectedDate
    ? (eventsByDay.get(dayKey(selectedDate)) ?? [])
    : []

  return (
    <div className="px-4 flex flex-col gap-3">
      {/* Month header */}
      <div className="flex items-center justify-between">
        <button
          onClick={goPrev}
          className="rounded-lg border border-card-border bg-card p-1.5 active:opacity-70 transition-opacity"
          aria-label="上一個月"
        >
          <ChevronLeft className="h-4 w-4 text-muted" />
        </button>
        <button
          onClick={goToday}
          className="text-sm font-semibold text-text-base hover:text-primary transition-colors"
        >
          {monthLabel}
        </button>
        <button
          onClick={goNext}
          className="rounded-lg border border-card-border bg-card p-1.5 active:opacity-70 transition-opacity"
          aria-label="下一個月"
        >
          <ChevronRight className="h-4 w-4 text-muted" />
        </button>
      </div>

      {/* Legend (only when logged in) */}
      {user && (
        <div className="flex items-center gap-3 text-[10px] text-muted">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            收藏
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-muted" />
            其他活動
          </span>
        </div>
      )}

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_LABELS.map((w, i) => (
          <span
            key={w}
            className={`text-[10px] font-semibold ${
              i === 0 || i === 6 ? 'text-primary/70' : 'text-muted'
            }`}
          >
            {w}
          </span>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          const key = dayKey(cell.date)
          const dayEvents = eventsByDay.get(key) ?? []
          const savedCount = dayEvents.filter((e) => favorites.has(e.id)).length
          const isSelected = selectedDate ? sameDay(selectedDate, cell.date) : false
          const isToday = sameDay(today, cell.date)
          const hasEvents = dayEvents.length > 0

          return (
            <button
              key={key}
              onClick={() => setSelectedDate(cell.date)}
              className={`relative aspect-square rounded-lg border flex flex-col items-center justify-center gap-1 transition-colors ${
                isSelected
                  ? 'border-primary bg-primary/10'
                  : isToday
                    ? 'border-primary/50 bg-card'
                    : 'border-card-border bg-card'
              } ${cell.isCurrentMonth ? '' : 'opacity-30'} active:opacity-70`}
            >
              <span
                className={`text-xs font-semibold tabular-nums ${
                  isToday ? 'text-primary' : 'text-text-base'
                }`}
              >
                {cell.date.getDate()}
              </span>
              {hasEvents && (
                <div className="flex items-center gap-0.5">
                  {savedCount > 0 && (
                    <span className="h-1 w-1 rounded-full bg-primary" />
                  )}
                  {dayEvents.length > savedCount && (
                    <span className="h-1 w-1 rounded-full bg-muted" />
                  )}
                  {dayEvents.length > 2 && (
                    <span className="text-[8px] text-muted leading-none ml-0.5">
                      +{dayEvents.length}
                    </span>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Selected day events */}
      <div className="mt-2 flex flex-col gap-2">
        {selectedDate && (
          <p className="text-xs font-semibold text-muted">
            {formatEventDate(selectedDate.toISOString())}
            {selectedEvents.length > 0 && `（${selectedEvents.length} 筆）`}
          </p>
        )}
        {selectedDate && selectedEvents.length === 0 && (
          <p className="text-xs text-muted/60 py-4 text-center">該日無活動</p>
        )}
        {selectedEvents.map((event) => (
          <div key={event.id} className="relative">
            {favorites.has(event.id) && (
              <div className="absolute -left-1 top-3 z-10">
                <Heart className="h-3 w-3 text-primary fill-primary" />
              </div>
            )}
            <EventCard event={event} compact />
          </div>
        ))}
        {!selectedDate && (
          <p className="text-xs text-muted/60 py-4 text-center">
            {activeIdolId !== null && events.length === 0
              ? '該偶像目前沒有公開活動'
              : '點選日期查看當天活動'}
          </p>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Date utils (local-time, no UTC conversion)
// ─────────────────────────────────────────────────────────────────────────────

interface DayCell {
  date: Date
  isCurrentMonth: boolean
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function buildMonthCells(monthStart: Date): DayCell[] {
  const year = monthStart.getFullYear()
  const month = monthStart.getMonth()

  const firstWeekday = new Date(year, month, 1).getDay() // 0 = Sun
  const startDate = new Date(year, month, 1 - firstWeekday)

  const cells: DayCell[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(startDate)
    d.setDate(startDate.getDate() + i)
    cells.push({ date: d, isCurrentMonth: d.getMonth() === month })
  }
  return cells
}

// ── F-scroll: idol filter chip bar with scroll affordances ────────────────
//
// The chip row is horizontally scrollable but a plain `overflow-x-auto` gives
// the user no visual cue on desktop (the trackpad / wheel scrolls vertically
// only, and the scrollbar can be invisible). This component adds:
//
//   - Left / right chevron buttons that appear only when more chips exist
//     in that direction. On click they scroll the row by 60% of the viewport
//     width — enough to feel snappy but not skip past visible chips.
//   - Edge fade gradients that intensify when content extends past the visible
//     area, mirroring the chevron state.
//   - Wheel handler that translates vertical scroll into horizontal so a
//     trackpad swipe / mouse wheel feels native on desktop.
//
// Mobile is unaffected: touch-drag scrolling on the inner container still
// works the same, and the chevron buttons are hidden when they'd overlap a
// small viewport (>= sm: breakpoint).

function IdolFilterBar({
  idols,
  activeIdolId,
  onSelect,
}: {
  idols: Idol[]
  activeIdolId: string | null
  onSelect: (idolId: string | null) => void
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  function refreshAffordances() {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(
      el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    )
  }

  useEffect(() => {
    refreshAffordances()
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', refreshAffordances, { passive: true })
    window.addEventListener('resize', refreshAffordances)
    return () => {
      el.removeEventListener('scroll', refreshAffordances)
      window.removeEventListener('resize', refreshAffordances)
    }
  }, [idols.length])

  function scrollByPage(direction: 1 | -1) {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({
      left: direction * Math.round(el.clientWidth * 0.6),
      behavior: 'smooth',
    })
  }

  // Convert vertical wheel deltas to horizontal scroll so mouse-wheel users
  // can navigate. We don't preventDefault when the user IS holding shift /
  // already scrolling horizontally — let the browser's native behavior win.
  function handleWheel(e: React.WheelEvent<HTMLDivElement>) {
    const el = scrollRef.current
    if (!el) return
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
    el.scrollLeft += e.deltaY
  }

  return (
    <div className="relative px-4 mb-4">
      {/* Left chevron — visible only when scrollable left + desktop */}
      {canScrollLeft && (
        <button
          type="button"
          aria-label="向左捲動"
          onClick={() => scrollByPage(-1)}
          className="hidden sm:flex absolute left-1 top-1/2 -translate-y-1/2 z-10 h-7 w-7 items-center justify-center rounded-full bg-card border border-card-border text-muted hover:text-text-base shadow-sm"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}

      {/* Edge fade gradients */}
      <div
        className={`pointer-events-none absolute left-4 top-0 bottom-0 w-6 bg-gradient-to-r from-bg to-transparent transition-opacity ${
          canScrollLeft ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        className={`pointer-events-none absolute right-4 top-0 bottom-0 w-6 bg-gradient-to-l from-bg to-transparent transition-opacity ${
          canScrollRight ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <div
        ref={scrollRef}
        onWheel={handleWheel}
        className="overflow-x-auto scrollbar-none"
      >
        <div className="flex gap-2 pb-1">
          <button
            onClick={() => onSelect(null)}
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
              onClick={() => onSelect(idol.id)}
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

      {/* Right chevron */}
      {canScrollRight && (
        <button
          type="button"
          aria-label="向右捲動"
          onClick={() => scrollByPage(1)}
          className="hidden sm:flex absolute right-1 top-1/2 -translate-y-1/2 z-10 h-7 w-7 items-center justify-center rounded-full bg-card border border-card-border text-muted hover:text-text-base shadow-sm"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

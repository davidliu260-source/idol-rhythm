'use client'

import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays, Waves } from 'lucide-react'
import clsx from 'clsx'
import type { Event } from '@/lib/mockEvents'
import type { Idol } from '@/lib/types'
import { formatEventDate } from '@/lib/mockEvents'
import { useAppState } from '@/lib/appState'
import ScheduleTrackCard from './ScheduleTrackCard'

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
    <div className="pb-4">
      {/* View toggle */}
      <div className="px-4 mb-4">
        <div className="inline-flex w-full rounded-2xl border border-white/8 bg-white/[0.035] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <ViewToggleButton
            active={view === 'timeline'}
            onClick={() => setView('timeline')}
            icon={<Waves className="h-3.5 w-3.5" />}
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
    </div>
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
  icon: ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'inline-flex flex-1 items-center justify-center gap-1.5 rounded-[14px] px-3 py-2.5 text-xs font-semibold transition-all',
        active
          ? 'bg-[#ff4fa8] text-white shadow-[0_8px_30px_rgba(255,79,168,0.35)]'
          : 'text-white/46 hover:text-white/76',
      )}
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

  const orderedGroups = Object.entries(groups).sort(
    (a, b) => new Date(a[1][0]?.date ?? '').getTime() - new Date(b[1][0]?.date ?? '').getTime(),
  )
  const upcomingGroups = orderedGroups.filter(([, evs]) =>
    evs.some((e) => new Date(e.date) >= now),
  )
  const pastGroups = orderedGroups.filter(([, evs]) =>
    evs.every((e) => new Date(e.date) < now),
  )

  let trackCounter = 1

  return (
    <div className="px-4 flex flex-col gap-5">
      {events.length === 0 && (
        <div className="rounded-[22px] border border-white/8 bg-white/[0.03] py-12 text-center text-sm text-white/52">
          {activeIdolId !== null ? '該偶像目前沒有公開活動' : '尚無活動資料'}
        </div>
      )}

      {upcomingGroups.map(([label, evs], index) => {
        const startTrack = trackCounter
        trackCounter += evs.length
        return (
          <DateGroup
            key={label}
            label={label}
            events={evs}
            startTrack={startTrack}
            sideLabel={index % 2 === 0 ? 'SIDE A' : 'SIDE B'}
            isToday={label.startsWith('今天')}
          />
        )
      })}

      {pastGroups.length > 0 && (
        <>
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-white/8" />
            <span className="text-[10px] font-medium uppercase tracking-[0.28em] text-white/28">archive closed</span>
            <div className="h-px flex-1 bg-white/8" />
          </div>
          {pastGroups.map(([label, evs], index) => {
            const startTrack = trackCounter
            trackCounter += evs.length
            return (
              <DateGroup
                key={label}
                label={label}
                events={evs}
                startTrack={startTrack}
                sideLabel={index % 2 === 0 ? 'SIDE B' : 'SIDE A'}
                isPast
              />
            )
          })}
        </>
      )}
    </div>
  )
}

function DateGroup({
  label,
  events,
  startTrack,
  sideLabel,
  isToday = false,
  isPast = false,
}: {
  label: string
  events: Event[]
  startTrack: number
  sideLabel: string
  isToday?: boolean
  isPast?: boolean
}) {
  return (
    <section className={clsx('pb-1', isPast && 'opacity-55')}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="flex min-w-0 items-end gap-3">
          <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/46">
            {sideLabel}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className={clsx('text-[24px] font-bold leading-none', isToday ? 'text-white' : 'text-white/88')}>
                {label}
              </p>
              {isToday && <span className="rounded-full bg-[#ff5db8]/14 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#ff88cc]">now spinning</span>}
            </div>
          </div>
        </div>
        <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/26">
          {events.length} tracks
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {events.map((event, index) => (
          <ScheduleTrackCard
            key={event.id}
            event={event}
            compact
            trackNumber={startTrack + index}
          />
        ))}
      </div>
    </section>
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
      <div className="flex items-center justify-between rounded-[22px] border border-white/8 bg-white/[0.03] px-3 py-3">
        <button
          onClick={goPrev}
          className="rounded-full border border-white/8 bg-white/[0.03] p-2 text-white/56 active:opacity-70 transition-opacity"
          aria-label="上一個月"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={goToday}
          className="text-sm font-semibold text-white hover:text-[#ff8fd1] transition-colors"
        >
          {monthLabel}
        </button>
        <button
          onClick={goNext}
          className="rounded-full border border-white/8 bg-white/[0.03] p-2 text-white/56 active:opacity-70 transition-opacity"
          aria-label="下一個月"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Legend (only when logged in) */}
      {user && (
        <div className="flex items-center gap-3 text-[10px] text-white/44">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#ff63bd]" />
            收藏
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-white/30" />
            其他活動
          </span>
        </div>
      )}

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_LABELS.map((w, i) => (
          <span
            key={w}
            className={clsx(
              'text-[10px] font-semibold',
              i === 0 || i === 6 ? 'text-[#ff8dce]/65' : 'text-white/38',
            )}
          >
            {w}
          </span>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1 rounded-[24px] border border-white/8 bg-white/[0.025] p-2">
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
              className={clsx(
                'relative aspect-square rounded-[16px] border flex flex-col items-center justify-center gap-1 transition-colors active:opacity-70',
                isSelected
                  ? 'border-[#ff63bd]/45 bg-[#ff63bd]/14 shadow-[0_0_18px_rgba(255,99,189,0.15)]'
                  : isToday
                    ? 'border-[#ff63bd]/28 bg-white/[0.05]'
                    : 'border-white/6 bg-white/[0.02]',
                cell.isCurrentMonth ? '' : 'opacity-30',
              )}
            >
              <span
                className={clsx(
                  'text-xs font-semibold tabular-nums',
                  isToday ? 'text-[#ff94d3]' : 'text-white',
                )}
              >
                {cell.date.getDate()}
              </span>
              {hasEvents && (
                <div className="flex items-center gap-0.5">
                  {savedCount > 0 && (
                    <span className="h-1 w-1 rounded-full bg-[#ff63bd]" />
                  )}
                  {dayEvents.length > savedCount && (
                    <span className="h-1 w-1 rounded-full bg-white/36" />
                  )}
                  {dayEvents.length > 2 && (
                    <span className="ml-0.5 text-[8px] leading-none text-white/45">
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
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-white/58">
              {formatEventDate(selectedDate.toISOString())}
              {selectedEvents.length > 0 && `（${selectedEvents.length} 筆）`}
            </p>
            <span className="rounded-full border border-white/8 bg-white/[0.035] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.22em] text-white/34">
              day select
            </span>
          </div>
        )}
        {selectedDate && selectedEvents.length === 0 && (
          <p className="rounded-[18px] border border-white/8 bg-white/[0.02] py-4 text-center text-xs text-white/38">該日無活動</p>
        )}
        {selectedEvents.map((event, index) => (
          <ScheduleTrackCard
            key={event.id}
            event={event}
            compact
            trackNumber={index + 1}
          />
        ))}
        {!selectedDate && (
          <p className="rounded-[18px] border border-white/8 bg-white/[0.02] py-4 text-center text-xs text-white/38">
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

  const firstWeekday = new Date(year, month, 1).getDay()
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

  function handleWheel(e: React.WheelEvent<HTMLDivElement>) {
    const el = scrollRef.current
    if (!el) return
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
    el.scrollLeft += e.deltaY
  }

  return (
    <div className="relative px-4 mb-5">
      {canScrollLeft && (
        <button
          type="button"
          aria-label="向左捲動"
          onClick={() => scrollByPage(-1)}
          className="hidden sm:flex absolute left-1 top-1/2 -translate-y-1/2 z-10 h-8 w-8 items-center justify-center rounded-full border border-white/8 bg-white/[0.04] text-white/42 hover:text-white/82 shadow-sm"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}

      <div
        className={clsx(
          'pointer-events-none absolute left-4 top-0 bottom-0 w-8 bg-gradient-to-r from-[rgba(19,14,23,0.98)] to-transparent transition-opacity',
          canScrollLeft ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        className={clsx(
          'pointer-events-none absolute right-4 top-0 bottom-0 w-8 bg-gradient-to-l from-[rgba(19,14,23,0.98)] to-transparent transition-opacity',
          canScrollRight ? 'opacity-100' : 'opacity-0',
        )}
      />

      <div
        ref={scrollRef}
        onWheel={handleWheel}
        className="overflow-x-auto scrollbar-none"
      >
        <div className="flex gap-2 pb-1">
          <button
            onClick={() => onSelect(null)}
            className={clsx(
              'flex-shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all',
              activeIdolId === null
                ? 'border-[#ff63bd]/30 bg-[#ff63bd]/16 text-[#ff94d3] shadow-[0_0_20px_rgba(255,99,189,0.12)]'
                : 'border-white/8 bg-white/[0.03] text-white/52',
            )}
          >
            全部
          </button>
          {idols.map((idol) => (
            <button
              key={idol.id}
              onClick={() => onSelect(idol.id)}
              className={clsx(
                'flex-shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all',
                activeIdolId === idol.id
                  ? 'border-[#ff63bd]/30 bg-[#ff63bd]/16 text-[#ff94d3] shadow-[0_0_20px_rgba(255,99,189,0.12)]'
                  : 'border-white/8 bg-white/[0.03] text-white/52',
              )}
            >
              {idol.name}
            </button>
          ))}
        </div>
      </div>

      {canScrollRight && (
        <button
          type="button"
          aria-label="向右捲動"
          onClick={() => scrollByPage(1)}
          className="hidden sm:flex absolute right-1 top-1/2 -translate-y-1/2 z-10 h-8 w-8 items-center justify-center rounded-full border border-white/8 bg-white/[0.04] text-white/42 hover:text-white/82 shadow-sm"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

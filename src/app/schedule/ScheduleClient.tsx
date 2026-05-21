'use client'

import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock3, Heart, MapPin, Music2, Search, Waves, X } from 'lucide-react'
import clsx from 'clsx'
import IdolAvatar from '@/components/IdolAvatar'
import type { Event } from '@/lib/mockEvents'
import type { Idol } from '@/lib/types'
import { formatEventDate } from '@/lib/mockEvents'
import { getEventDateLabel } from '@/lib/eventDisplay'
import { useAppState } from '@/lib/appState'
import ScheduleTrackCard from './ScheduleTrackCard'

interface Props {
  events: Event[]
  idols: Idol[]
}

type ViewMode = 'timeline' | 'calendar'

export default function ScheduleClient({ events, idols }: Props) {
  const [activeIdolId, setActiveIdolId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [view, setView] = useState<ViewMode>('timeline')

  const availableIdols = useMemo(() => {
    const eventIdolIds = new Set(events.map((event) => event.idolId))
    return idols.filter((idol) => eventIdolIds.has(idol.id))
  }, [events, idols])

  const filtered = useMemo(() => {
    const normalizedSearch = normalizeSearch(searchQuery)
    return events.filter((event) => {
      if (activeIdolId !== null && event.idolId !== activeIdolId) return false
      if (!normalizedSearch) return true
      return getSearchHaystack(event).includes(normalizedSearch)
    })
  }, [events, activeIdolId, searchQuery])

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

      <ScheduleSearchPanel
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        idols={availableIdols}
        activeIdolId={activeIdolId}
        onSelect={(id) =>
          setActiveIdolId(id === activeIdolId ? null : id)
        }
        resultCount={filtered.length}
        totalCount={events.length}
      />

      {view === 'timeline' ? (
        <TimelineView events={filtered} activeIdolId={activeIdolId} searchQuery={searchQuery} />
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
// Timeline view
// ─────────────────────────────────────────────────────────────────────────────

function TimelineView({
  events,
  activeIdolId,
  searchQuery,
}: {
  events: Event[]
  activeIdolId: string | null
  searchQuery: string
}) {
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())
  const monthGroups = useMemo(() => buildFutureMonthGroups(events), [events])
  const monthKeys = monthGroups.map((group) => group.key).join('|')

  useEffect(() => {
    if (monthGroups.length === 0) return
    setExpandedMonths((current) => {
      if (monthGroups.some((group) => current.has(group.key))) return current
      return new Set([monthGroups[0].key])
    })
  }, [monthGroups, monthKeys])

  function toggleMonth(monthKey: string) {
    setExpandedMonths((current) => {
      const next = new Set(current)
      if (next.has(monthKey)) next.delete(monthKey)
      else next.add(monthKey)
      return next
    })
  }

  return (
    <div className="px-4 flex flex-col gap-5">
      {monthGroups.length === 0 && (
        <div className="rounded-[22px] border border-white/8 bg-white/[0.03] py-12 text-center text-sm text-white/52">
          {activeIdolId !== null || searchQuery.trim()
            ? '沒有符合條件的未來活動'
            : '尚無未來活動資料'}
        </div>
      )}

      {monthGroups.map((group, index) => {
        const previousCount = monthGroups
          .slice(0, index)
          .reduce((sum, item) => sum + item.events.length, 0)
        return (
          <MonthGroup
            key={group.key}
            group={group}
            startTrack={previousCount + 1}
            sideLabel={index % 2 === 0 ? 'SIDE A' : 'SIDE B'}
            expanded={expandedMonths.has(group.key)}
            onToggle={() => toggleMonth(group.key)}
          />
        )
      })}
    </div>
  )
}

function MonthGroup({
  group,
  startTrack,
  sideLabel,
  expanded,
  onToggle,
}: {
  group: MonthArchiveGroup
  startTrack: number
  sideLabel: string
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <section className="pb-1">
      <button
        type="button"
        onClick={onToggle}
        className="mb-3 flex w-full items-center justify-between gap-3 rounded-[22px] border border-white/8 bg-white/[0.035] px-3 py-3 text-left transition-colors hover:bg-white/[0.055]"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/50">
            {sideLabel}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[20px] font-bold leading-none text-white/90">{group.label}</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.24em] text-[#ff88cc]/70">future archive</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-[#ff6dbd24] bg-[#ff63bd10] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#ff8ecf]">
            {group.events.length} tracks
          </span>
          <ChevronDown className={clsx('h-4 w-4 text-white/45 transition-transform', expanded && 'rotate-180')} />
        </div>
      </button>
      {expanded && (
        <div className="flex flex-col gap-2">
          {group.events.map((event, index) => (
            <TrackDisclosure
            key={event.id}
            event={event}
            trackNumber={startTrack + index}
          />
          ))}
        </div>
      )}
    </section>
  )
}

function TrackDisclosure({
  event,
  trackNumber,
}: {
  event: Event
  trackNumber: number
}) {
  const { favorites } = useAppState()
  const [expanded, setExpanded] = useState(false)
  const isFavorited = favorites.has(event.id)
  const dateLabel = getEventDateLabel(event)
  const placeLabel = event.venueName || event.location || event.city || event.country

  function toggleFavorite(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation()
    favorites.toggle(event.id)
  }

  function toggleExpanded() {
    setExpanded((value) => !value)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggleExpanded()
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        role="button"
        tabIndex={0}
        onClick={toggleExpanded}
        onKeyDown={handleKeyDown}
        className={clsx(
          'group flex w-full cursor-pointer items-center gap-3 rounded-[18px] border px-3 py-2.5 text-left transition-all active:scale-[0.99]',
          expanded
            ? 'border-[#ff63bd]/26 bg-[#ff63bd]/10 shadow-[0_0_22px_rgba(255,99,189,0.08)]'
            : 'border-white/8 bg-white/[0.028] hover:border-[#ff63bd]/18 hover:bg-white/[0.045]',
        )}
      >
        <div className="rounded-[14px] border border-white/8 bg-white/[0.035] p-1">
          <IdolAvatar
            name={event.idolName}
            avatarUrl={event.idolAvatarUrl}
            color={idolPrimaryColor(event.idolId)}
            size="sm"
            className="rounded-[10px]"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[12px] font-semibold text-[#ff73c1]">{event.idolName}</span>
            <span className="rounded-full border border-white/8 bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.16em] text-white/38">
              TRK {String(trackNumber).padStart(2, '0')}
            </span>
          </div>
          <p className="mt-0.5 line-clamp-1 text-[14px] font-semibold leading-5 text-white/88">
            {event.title}
          </p>
          <div className="mt-1 flex min-w-0 items-center gap-2 text-[10px] text-white/42">
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3 w-3 text-[#ff92c7]" />
              {dateLabel}
            </span>
            {placeLabel && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <MapPin className="h-3 w-3" />
                <span className="truncate">{placeLabel}</span>
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={toggleFavorite}
          aria-label={isFavorited ? '取消收藏' : '收藏'}
          className={clsx(
            'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border transition-all',
            isFavorited
              ? 'border-[#ff5db7]/30 bg-[#ff5db7]/18 text-[#ff78c4] shadow-[0_0_18px_rgba(255,93,183,0.22)]'
              : 'border-white/8 bg-white/[0.03] text-white/36 group-hover:text-white/65',
          )}
        >
          <Heart className={clsx('h-4 w-4', isFavorited && 'fill-current')} />
        </button>
      </div>

      {expanded && (
        <ScheduleTrackCard event={event} trackNumber={trackNumber} />
      )}
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

function ScheduleSearchPanel({
  searchQuery,
  onSearchChange,
  idols,
  activeIdolId,
  onSelect,
  resultCount,
  totalCount,
}: {
  searchQuery: string
  onSearchChange: (value: string) => void
  idols: Idol[]
  activeIdolId: string | null
  onSelect: (idolId: string | null) => void
  resultCount: number
  totalCount: number
}) {
  const quickIdols = useMemo(() => {
    const selected = activeIdolId ? idols.find((idol) => idol.id === activeIdolId) : null
    const firstIdols = idols.slice(0, 8)
    if (selected && !firstIdols.some((idol) => idol.id === selected.id)) {
      return [selected, ...firstIdols.slice(0, 7)]
    }
    return firstIdols
  }, [activeIdolId, idols])

  return (
    <div className="px-4 mb-5 space-y-3">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#ff8ecf]/70" />
        <input
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="搜尋藝人、活動、場地、城市"
          className="h-11 w-full rounded-[18px] border border-white/8 bg-white/[0.04] pl-9 pr-10 text-sm font-medium text-white outline-none transition-colors placeholder:text-white/30 focus:border-[#ff63bd]/38 focus:bg-white/[0.06]"
        />
        {searchQuery.trim() && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label="清除搜尋"
            className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/8 bg-white/[0.04] text-white/45"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </label>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.22em] text-white/34">
            <Music2 className="h-3 w-3 text-[#ff8ecf]" />
            quick idols
          </div>
          <div className="text-[10px] font-medium text-white/32">
            {resultCount} / {totalCount} 筆
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onSelect(null)}
            className={clsx(
              'rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all',
              activeIdolId === null
                ? 'border-[#ff63bd]/30 bg-[#ff63bd]/16 text-[#ff94d3] shadow-[0_0_20px_rgba(255,99,189,0.12)]'
                : 'border-white/8 bg-white/[0.03] text-white/52',
            )}
          >
            全部
          </button>
          {quickIdols.map((idol) => (
            <button
              key={idol.id}
              onClick={() => onSelect(idol.id)}
              className={clsx(
                'rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all',
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
    </div>
  )
}

interface MonthArchiveGroup {
  key: string
  label: string
  events: Event[]
}

function buildFutureMonthGroups(events: Event[]): MonthArchiveGroup[] {
  const today = startOfToday()
  const groups = new Map<string, MonthArchiveGroup>()

  for (const event of events) {
    const date = new Date(event.date)
    if (date < today) continue
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const label = `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`
    const group = groups.get(key)
    if (group) group.events.push(event)
    else groups.set(key, { key, label, events: [event] })
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      events: [...group.events].sort(sortEventsByDate),
    }))
    .sort((a, b) => sortEventsByDate(a.events[0], b.events[0]))
}

function sortEventsByDate(a: Event, b: Event): number {
  return new Date(a.date).getTime() - new Date(b.date).getTime()
}

function startOfToday(): Date {
  const today = new Date()
  return new Date(today.getFullYear(), today.getMonth(), today.getDate())
}

function getSearchHaystack(event: Event): string {
  return normalizeSearch(
    [
      event.title,
      event.originalTitle,
      event.idolName,
      event.location,
      event.originalLocation,
      event.venueName,
      event.city,
      event.country,
      event.source.label,
      event.tags?.join(' '),
    ]
      .filter(Boolean)
      .join(' '),
  )
}

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase()
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

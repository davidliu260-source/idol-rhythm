'use client'

import { isEventOnDay, taipeiToday } from '@/lib/taipeiDate'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ListFilter, Search, Waves, X } from 'lucide-react'
import clsx from 'clsx'
import type { Event } from '@/lib/mockEvents'
import { formatEventDate, EVENT_SUBTYPE_LABELS } from '@/lib/mockEvents'
import type { EventSubType } from '@/lib/types'
import { groupScheduleEvents } from '@/lib/scheduleGroups'
import { listCurrentEvents } from '@/lib/upcomingEvents'
import { useAppState } from '@/lib/appState'
import ScheduleTrackCard from './ScheduleTrackCard'

interface Props {
  events: Event[]
}

type ViewMode = 'timeline' | 'calendar'
type ScheduleCategory =
  | 'all'
  | 'concert'
  | 'musicshow'
  | 'media'
  | 'popup_store'
  | 'exhibition'
  | 'brand_event'
  | 'youtube'
  | 'netflix'
  | 'other'

const SCHEDULE_CATEGORIES: Array<{ id: ScheduleCategory; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'concert', label: '演唱會' },
  { id: 'musicshow', label: '音樂節目' },
  { id: 'media', label: '媒體雜誌' },
  { id: 'popup_store', label: '快閃店' },
  { id: 'exhibition', label: '展覽' },
  { id: 'brand_event', label: '品牌活動' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'netflix', label: 'Netflix' },
  { id: 'other', label: '其他行程' },
]

// ── Subtype keyword aliases for search (中英文關鍵字補充) ─────────────────────
// Included in getSearchHaystack so "pop-up / popup / 快閃店 / 展覽 / 品牌活動"
// all correctly match events by sub_type even when the title doesn't contain them.
const SUBTYPE_SEARCH_KEYWORDS: Partial<Record<string, string>> = {
  popup_store: '快閃店 快閃 pop-up popup pop up',
  exhibition: '展覽 展 exhibition exhibit',
  brand_event: '品牌活動 品牌 brand event brand_event',
}

export default function ScheduleClient({ events: publishedEvents }: Props) {
  const events = useMemo(() => listCurrentEvents(publishedEvents), [publishedEvents])
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<ScheduleCategory>('all')
  const [view, setView] = useState<ViewMode>('timeline')

  const filtered = useMemo(() => {
    const normalizedSearch = normalizeSearch(searchQuery)
    return events.filter((event) => {
      if (!matchesScheduleCategory(event, activeCategory)) return false
      if (!normalizedSearch) return true
      return getSearchHaystack(event).includes(normalizedSearch)
    })
  }, [events, activeCategory, searchQuery])

  const categoryCounts = useMemo(() => {
    const counts = new Map<ScheduleCategory, number>()
    for (const category of SCHEDULE_CATEGORIES) {
      counts.set(category.id, events.filter((event) => matchesScheduleCategory(event, category.id)).length)
    }
    return counts
  }, [events])

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
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        categoryCounts={categoryCounts}
        resultCount={filtered.length}
        totalCount={events.length}
      />

      {view === 'timeline' ? (
        <TimelineView events={filtered} searchQuery={searchQuery} activeCategory={activeCategory} />
      ) : (
        <CalendarView events={filtered} />
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
        'inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-[14px] px-3 py-2.5 text-xs font-semibold transition-all',
        active
          ? 'bg-[#ff4fa8] text-[#230e1c] shadow-[0_8px_30px_rgba(255,79,168,0.35)]'
          : 'text-white/70 hover:text-white',
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
  searchQuery,
  activeCategory,
}: {
  events: Event[]
  searchQuery: string
  activeCategory: ScheduleCategory
}) {
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())
  const monthGroups = useMemo(() => buildMonthGroups(events), [events])
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
          {getEmptyStateMessage(activeCategory, searchQuery)}
        </div>
      )}

      {monthGroups.map((group) => (
        <MonthGroup
          key={group.key}
          group={group}
          expanded={expandedMonths.has(group.key)}
          onToggle={() => toggleMonth(group.key)}
        />
      ))}
    </div>
  )
}

function MonthGroup({
  group,
  expanded,
  onToggle,
}: {
  group: MonthEventGroup
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <section className="pb-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="mb-3 flex min-h-11 w-full items-center justify-between gap-3 rounded-[22px] border border-white/8 bg-white/[0.035] px-3 py-3 text-left transition-colors hover:bg-white/[0.055]"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            <p className="truncate text-[20px] font-bold leading-none text-white/90">{group.label}</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.24em] text-[#ff88cc]/70">即將舉行</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-[#ff6dbd24] bg-[#ff63bd10] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#ff8ecf]">
            {group.count} 場
          </span>
          <ChevronDown className={clsx('h-4 w-4 text-white/45 transition-transform', expanded && 'rotate-180')} />
        </div>
      </button>
      {expanded && (
        <div className="flex flex-col gap-2">
          {group.days.map(day => (
            <div key={day.date} className="space-y-2">
              <div className="flex items-center justify-between px-1 pt-1 text-sm font-semibold text-white/85">
                <time dateTime={day.date}>{formatEventDate(day.date)}</time>
                <span className="text-xs text-[#ff9ad4]">{day.count} 場</span>
              </div>
              {day.groups.map(group => <ScheduleTrackCard key={group.idolId} events={group.events} />)}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Calendar (month grid) view — C1
// ─────────────────────────────────────────────────────────────────────────────

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

function CalendarView({
  events,
}: {
  events: Event[]
}) {
  const { favorites, user } = useAppState()
  const today = useMemo(() => dateFromKey(taipeiToday()), [])
  const [cursor, setCursor] = useState<Date>(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  // Build 6×7 grid cells for the current cursor month
  const cells = useMemo(() => buildMonthCells(cursor), [cursor])
  const eventsByDay = useMemo(() => new Map(cells.map(({ date }) => {
    const key = dayKey(date)
    return [key, events.filter(event => isEventOnDay(event, key))]
  })), [cells, events])

  const monthLabel = `${cursor.getFullYear()} 年 ${cursor.getMonth() + 1} 月`

  const goPrev = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
  const goNext = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
  const goToday = () => {
    setCursor(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelectedDate(today)
  }

  const selectedKey = selectedDate ? dayKey(selectedDate) : null
  const selectedEvents = selectedKey
    ? eventsByDay.get(selectedKey) ?? events.filter(event => isEventOnDay(event, selectedKey))
    : []

  return (
    <div className="px-4 flex flex-col gap-3">
      {/* Month header */}
      <div className="flex items-center justify-between rounded-[22px] border border-white/8 bg-white/[0.03] px-3 py-3">
        <button
          onClick={goPrev}
          className="rounded-full border border-white/8 bg-white/[0.03] grid h-11 w-11 place-items-center text-white/70 active:opacity-70 transition-opacity"
          aria-label="上一個月"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={goToday}
          className="min-h-11 px-3 text-sm font-semibold text-white hover:text-[#ff8fd1] transition-colors"
        >
          {monthLabel}
        </button>
        <button
          onClick={goNext}
          className="rounded-full border border-white/8 bg-white/[0.03] grid h-11 w-11 place-items-center text-white/70 active:opacity-70 transition-opacity"
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

      <div className="overflow-x-auto">
        <div className="min-w-[322px]">
          {/* Weekday header */}
          <div className="mb-1 grid grid-cols-7 gap-0.5 px-px text-center">
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
          <div className="grid grid-cols-7 gap-0.5 rounded-2xl border border-white/8 bg-white/[0.025]">
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
                    'relative min-h-11 min-w-11 aspect-square rounded-[16px] border flex flex-col items-center justify-center gap-1 transition-colors active:opacity-70',
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
        </div>
      </div>

      {/* Selected day events */}
      <div className="mt-2 flex flex-col gap-2">
        {selectedDate && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-white/58">
              {formatEventDate(dayKey(selectedDate))}
              {selectedEvents.length > 0 && `（${selectedEvents.length} 筆）`}
            </p>
          </div>
        )}
        {selectedDate && selectedEvents.length === 0 && (
          <p className="rounded-[18px] border border-white/8 bg-white/[0.02] py-4 text-center text-xs text-white/38">該日無活動</p>
        )}
        {groupScheduleEvents(selectedEvents).flatMap(day =>
          day.groups.map(group => <ScheduleTrackCard key={`${day.date}/${group.idolId}`} events={group.events} />),
        )}
        {!selectedDate && (
          <p className="rounded-[18px] border border-white/8 bg-white/[0.02] py-4 text-center text-xs text-white/38">
            {events.length === 0 ? '沒有符合條件的活動' : '點選日期查看當天活動'}
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
  activeCategory,
  onCategoryChange,
  categoryCounts,
  resultCount,
  totalCount,
}: {
  searchQuery: string
  onSearchChange: (value: string) => void
  activeCategory: ScheduleCategory
  onCategoryChange: (category: ScheduleCategory) => void
  categoryCounts: Map<ScheduleCategory, number>
  resultCount: number
  totalCount: number
}) {
  const visibleCategories = SCHEDULE_CATEGORIES.filter((category) => {
    if (category.id === 'all' || category.id === activeCategory) return true
    return (categoryCounts.get(category.id) ?? 0) > 0
  })

  return (
    <div className="px-4 mb-5 space-y-3">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#ff8ecf]/70" />
        <input
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="搜尋藝人、活動、場地、城市"
          className="h-11 w-full rounded-[18px] border border-white/8 bg-white/[0.04] pl-9 pr-12 text-sm font-medium text-white outline-none transition-colors placeholder:text-white/30 focus:border-[#ff63bd]/38 focus:bg-white/[0.06]"
        />
        {searchQuery.trim() && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label="清除搜尋"
            className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/8 bg-white/[0.04] text-white/45"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </label>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.22em] text-white/34">
            <ListFilter className="h-3 w-3 text-[#ff8ecf]" />
            活動篩選
          </div>
          <div className="text-[10px] font-medium text-white/32">
            {resultCount} / {totalCount} 筆
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {visibleCategories.map((category) => (
            <button
              key={category.id}
              onClick={() => onCategoryChange(category.id)}
              className={clsx(
                'min-h-11 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all',
                activeCategory === category.id
                  ? 'border-[#ff63bd]/30 bg-[#ff63bd]/16 text-[#ff94d3] shadow-[0_0_20px_rgba(255,99,189,0.12)]'
                  : 'border-white/8 bg-white/[0.03] text-white/52',
              )}
            >
              {category.label}
              {category.id !== 'all' && (
                <span className="ml-1.5 text-[10px] text-white/34">
                  {categoryCounts.get(category.id) ?? 0}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

interface MonthEventGroup {
  key: string
  label: string
  days: ReturnType<typeof groupScheduleEvents<Event>>
  count: number
}

function matchesScheduleCategory(event: Event, category: ScheduleCategory): boolean {
  switch (category) {
    case 'all':
      return true
    case 'concert':
      return (
        event.type === 'concert' ||
        event.subType === 'fanmeet' ||
        event.subType === 'fansign' ||
        event.subType === 'award'
      )
    case 'musicshow':
      return event.subType === 'musicshow'
    case 'media':
      return (
        event.type === 'media' &&
        event.subType !== 'musicshow'
      )
    case 'popup_store':
      return event.subType === 'popup_store'
    case 'exhibition':
      return event.subType === 'exhibition'
    case 'brand_event':
      // Legacy fallback: type=brand without a sub_type stays in this chip.
      // type=brand WITH a sub_type (popup_store / exhibition) belongs to those chips,
      // not here — otherwise the three chips would overlap.
      return event.subType === 'brand_event' || (event.type === 'brand' && !event.subType)
    case 'youtube':
      return matchesPlatformKeyword(event, 'youtube')
    case 'netflix':
      return matchesPlatformKeyword(event, 'netflix')
    case 'other':
      return (
        !matchesScheduleCategory(event, 'concert') &&
        !matchesScheduleCategory(event, 'musicshow') &&
        !matchesScheduleCategory(event, 'media') &&
        !matchesScheduleCategory(event, 'popup_store') &&
        !matchesScheduleCategory(event, 'exhibition') &&
        !matchesScheduleCategory(event, 'brand_event') &&
        !matchesScheduleCategory(event, 'youtube') &&
        !matchesScheduleCategory(event, 'netflix')
      )
  }
}

function buildMonthGroups(events: Event[]): MonthEventGroup[] {
  const groups = new Map<string, MonthEventGroup>()

  for (const day of groupScheduleEvents(events)) {
    const key = day.date.slice(0, 7)
    const [year, month] = key.split('-')
    const group = groups.get(key)
    if (group) {
      group.days.push(day)
      group.count += day.count
    } else {
      groups.set(key, { key, label: `${year} 年 ${Number(month)} 月`, days: [day], count: day.count })
    }
  }

  return Array.from(groups.values())
}

function getEmptyStateMessage(category: ScheduleCategory, searchQuery: string): string {
  if (searchQuery.trim()) return '沒有符合搜尋條件的活動'
  switch (category) {
    case 'popup_store':  return '目前沒有收錄快閃店活動'
    case 'exhibition':   return '目前沒有收錄展覽活動'
    case 'brand_event':  return '目前沒有收錄品牌活動'
    case 'concert':      return '目前沒有演唱會行程'
    case 'musicshow':    return '目前沒有音樂節目行程'
    case 'media':        return '目前沒有媒體雜誌行程'
    case 'youtube':      return '目前沒有 YouTube 相關行程'
    case 'netflix':      return '目前沒有 Netflix 相關行程'
    case 'other':        return '目前沒有其他行程'
    default:             return '尚無未來活動資料'
  }
}

function dateFromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function getSearchHaystack(event: Event): string {
  const subTypeLabel = event.subType
    ? (EVENT_SUBTYPE_LABELS[event.subType as EventSubType] ?? '')
    : ''
  const subTypeKeywords = event.subType
    ? (SUBTYPE_SEARCH_KEYWORDS[event.subType] ?? '')
    : ''

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
      event.description,
      event.tags?.join(' '),
      // Subtype label (e.g. '快閃店') + keyword aliases (e.g. 'pop-up popup')
      // lets users search "快閃店" or "popup" and match the correct events
      // even when the event title itself doesn't contain those words.
      subTypeLabel,
      subTypeKeywords,
    ]
      .filter(Boolean)
      .join(' '),
  )
}

function matchesPlatformKeyword(event: Event, keyword: 'youtube' | 'netflix'): boolean {
  return getSearchHaystack(event).includes(keyword)
}

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase()
}

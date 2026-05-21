'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import clsx from 'clsx'
import {
  ChevronDown,
  ArrowUpRight,
  CalendarDays,
  Disc3,
  Heart,
  LibraryBig,
  Loader2,
  LogIn,
  MapPin,
  Search,
  Sparkles,
  X,
} from 'lucide-react'
import IdolAvatar from '@/components/IdolAvatar'
import { useAppState } from '@/lib/appState'
import { getEventDateLabel } from '@/lib/eventDisplay'
import {
  EVENT_SUBTYPE_LABELS,
  EVENT_TYPE_LABELS,
  SOURCE_CONFIG,
  type Event,
} from '@/lib/mockEvents'
import { SCHEDULE_ARCHIVE_SHELL } from '../schedule/scheduleTheme'

function matchSearch(event: Event, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true

  return (
    event.title.toLowerCase().includes(needle) ||
    event.idolName.toLowerCase().includes(needle) ||
    (event.location ?? '').toLowerCase().includes(needle) ||
    (event.city ?? '').toLowerCase().includes(needle) ||
    (event.country ?? '').toLowerCase().includes(needle)
  )
}

export default function FavoritesClient({ events }: { events: Event[] }) {
  const { favorites, user, isUserLoading } = useAppState()
  const [query, setQuery] = useState('')
  const [openArchivedMonths, setOpenArchivedMonths] = useState<string[]>([])
  const now = useMemo(() => new Date(), [])

  const favorited = useMemo(
    () => events.filter((event) => favorites.has(event.id)),
    [events, favorites],
  )
  const visible = useMemo(
    () => favorited.filter((event) => matchSearch(event, query)),
    [favorited, query],
  )
  const upcoming = useMemo(
    () =>
      visible
        .filter((event) => new Date(event.date) >= now)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [visible, now],
  )
  const past = useMemo(
    () =>
      visible
        .filter((event) => new Date(event.date) < now)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [visible, now],
  )

  const upcomingCount = upcoming.length
  const pastCount = past.length
  const upcomingGroups = useMemo(() => groupEventsByMonth(upcoming, 'asc'), [upcoming])
  const pastGroups = useMemo(() => groupEventsByMonth(past, 'desc'), [past])
  const latestArchivedMonthKey = pastGroups[0]?.key ?? null
  const hasQuery = query.trim().length > 0

  useEffect(() => {
    if (!latestArchivedMonthKey || hasQuery) return

    setOpenArchivedMonths((current) => {
      if (current.length > 0) return current
      return [latestArchivedMonthKey]
    })
  }, [latestArchivedMonthKey, hasQuery])

  if (isUserLoading) {
    return (
      <FavoritesShell count={null} upcomingCount={null} pastCount={null}>
        <LoadingState />
      </FavoritesShell>
    )
  }

  if (!user) {
    return (
      <FavoritesShell count={null} upcomingCount={null} pastCount={null}>
        <LoginPrompt />
      </FavoritesShell>
    )
  }

  return (
    <FavoritesShell
      count={favorited.length}
      upcomingCount={upcomingCount}
      pastCount={pastCount}
    >
      {favorites.isLoading && (
        <div className="flex items-center justify-center gap-2 rounded-full border border-white/8 bg-white/[0.045] px-3 py-2 text-xs text-white/58">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          同步收藏中…
        </div>
      )}

      {!favorites.isLoading && favorited.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <SearchField query={query} onChange={setQuery} />

          {visible.length === 0 ? (
            <NoSearchResult onClear={() => setQuery('')} />
          ) : (
            <div className="space-y-4">
              {upcoming.length > 0 && (
                <ShelfSection
                  side="SIDE A"
                  title="即將到來"
                  subtitle="READY TO SPIN"
                  count={upcoming.length}
                  groups={upcomingGroups}
                >
                  {(group) => (
                    <MonthGroupBlock
                      label={group.label}
                      count={group.events.length}
                      events={group.events}
                    />
                  )}
                </ShelfSection>
              )}

              {past.length > 0 && (
                <ShelfSection
                  side="SIDE B"
                  title="已歸檔"
                  subtitle="ARCHIVED CUTS"
                  count={past.length}
                  dimmed
                  groups={pastGroups}
                >
                  {(group) => {
                    const isOpen = hasQuery || openArchivedMonths.includes(group.key)
                    return (
                      <ArchivedMonthBlock
                        key={group.key}
                        label={group.label}
                        count={group.events.length}
                        events={group.events}
                        isOpen={isOpen}
                        onToggle={() =>
                          setOpenArchivedMonths((current) =>
                            current.includes(group.key)
                              ? current.filter((key) => key !== group.key)
                              : [...current, group.key],
                          )
                        }
                      />
                    )
                  }}
                </ShelfSection>
              )}
            </div>
          )}
        </>
      )}
    </FavoritesShell>
  )
}

function FavoritesShell({
  count,
  upcomingCount,
  pastCount,
  children,
}: {
  count: number | null
  upcomingCount: number | null
  pastCount: number | null
  children: React.ReactNode
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_12%_0%,rgba(255,98,171,0.16),transparent_24%),linear-gradient(180deg,#17111d_0%,#09070d_100%)] pb-28 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:34px_34px] opacity-25" />

      <div className="relative mx-auto flex w-full max-w-[520px] flex-col gap-4 px-4 pt-8">
        <section className={clsx(SCHEDULE_ARCHIVE_SHELL, 'px-5 py-5')}>
          <div className="pointer-events-none absolute inset-0 rounded-[28px] border border-white/6" />

          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-white/34">
                IDOL · RHYTHM
              </p>
              <div className="mt-4 flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#ff6cb7]/25 bg-[#ff4ca1]/12 text-[#ff6cb7]">
                  <Heart className="h-5 w-5 fill-current" />
                </span>
                <div>
                  <h1 className="text-[34px] font-black leading-none tracking-normal text-white">
                    收藏檔案櫃
                  </h1>
                  <p className="mt-2 text-sm text-white/58">
                    把想追的活動收進你的 cassette shelf
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/52">
              VOL.05
            </div>
          </div>

          <div className="relative mt-5 grid grid-cols-3 gap-2">
            <StatTile label="全部收藏" value={count === null ? '—' : `${count}`} accent="pink" />
            <StatTile
              label="即將到來"
              value={upcomingCount === null ? '—' : `${upcomingCount}`}
              accent="violet"
            />
            <StatTile
              label="已歸檔"
              value={pastCount === null ? '—' : `${pastCount}`}
              accent="slate"
            />
          </div>
        </section>

        {children}
      </div>
    </div>
  )
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent: 'pink' | 'violet' | 'slate'
}) {
  return (
    <div
      className={clsx(
        'rounded-[18px] border px-3 py-3',
        accent === 'pink' && 'border-[#ff6cb7]/20 bg-[#ff4ca1]/10',
        accent === 'violet' && 'border-violet-300/16 bg-violet-400/10',
        accent === 'slate' && 'border-white/8 bg-white/[0.035]',
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/40">{label}</p>
      <p className="mt-2 text-2xl font-black leading-none text-white">{value}</p>
    </div>
  )
}

function SearchField({
  query,
  onChange,
}: {
  query: string
  onChange: (value: string) => void
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#ff8bc8]" />
      <input
        type="text"
        value={query}
        onChange={(event) => onChange(event.target.value)}
        placeholder="搜尋藝人、活動、場地、城市"
        className="w-full rounded-[22px] border border-white/10 bg-white/[0.04] py-3 pl-11 pr-11 text-sm text-white placeholder:text-white/28 focus:border-[#ff6cb7]/40 focus:outline-none"
      />
      {query && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="清除搜尋"
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/42 transition-colors hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

function ShelfSection({
  side,
  title,
  subtitle,
  count,
  groups,
  children,
  dimmed = false,
}: {
  side: string
  title: string
  subtitle: string
  count: number
  groups: MonthGroup[]
  children: (group: MonthGroup) => React.ReactNode
  dimmed?: boolean
}) {
  return (
    <section className="rounded-[26px] border border-white/8 bg-white/[0.035] p-4">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/52">
          {side}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black leading-none text-white">{title}</h2>
              <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.3em] text-[#ff8bc8]">
                {subtitle}
              </p>
            </div>
            <div className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/52">
              {count} TRACKS
            </div>
          </div>
        </div>
      </div>

      <div className={clsx('space-y-3', dimmed && 'opacity-70')}>
        {groups.map((group) => (
          <div key={group.key}>{children(group)}</div>
        ))}
      </div>
    </section>
  )
}

function MonthGroupBlock({
  label,
  count,
  events,
}: {
  label: string
  count: number
  events: Event[]
}) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-black/10 p-3">
      <div className="mb-3 flex items-center justify-between gap-3 rounded-[18px] border border-white/8 bg-white/[0.035] px-3 py-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/40">
            MONTH INDEX
          </p>
          <h3 className="mt-1 text-xl font-black leading-none text-white">{label}</h3>
        </div>
        <div className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/52">
          {count} TRACKS
        </div>
      </div>

      <div className="space-y-3">
        {events.map((event, index) => (
          <FavoriteShelfCard key={event.id} event={event} trackNumber={index + 1} />
        ))}
      </div>
    </div>
  )
}

function ArchivedMonthBlock({
  label,
  count,
  events,
  isOpen,
  onToggle,
}: {
  label: string
  count: number
  events: Event[]
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-black/10 p-3">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 rounded-[18px] border border-white/8 bg-white/[0.035] px-3 py-3 text-left"
      >
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/40">
            MONTH INDEX
          </p>
          <h3 className="mt-1 text-xl font-black leading-none text-white">{label}</h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/52">
            {count} TRACKS
          </div>
          <span
            className={clsx(
              'flex h-10 w-10 items-center justify-center rounded-full border border-white/8 bg-white/[0.04] text-white/60 transition-transform duration-200',
              isOpen && 'rotate-180',
            )}
          >
            <ChevronDown className="h-4 w-4" />
          </span>
        </div>
      </button>

      {isOpen && (
        <div className="mt-3 space-y-3">
          {events.map((event, index) => (
            <FavoriteShelfCard key={event.id} event={event} trackNumber={index + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

function FavoriteShelfCard({
  event,
  trackNumber,
}: {
  event: Event
  trackNumber: number
}) {
  const router = useRouter()
  const { favorites } = useAppState()
  const isFavorited = favorites.has(event.id)
  const dateLabel = getEventDateLabel(event)
  const typeLabel = event.subType
    ? EVENT_SUBTYPE_LABELS[event.subType]
    : EVENT_TYPE_LABELS[event.type]
  const sourceConfig = SOURCE_CONFIG[event.source.level]
  const locationLabel = event.venueName || event.location || event.city || event.country

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/events/${event.id}`)}
      onKeyDown={(eventKey) => {
        if (eventKey.key === 'Enter' || eventKey.key === ' ') {
          eventKey.preventDefault()
          router.push(`/events/${event.id}`)
        }
      }}
      className="group relative overflow-hidden rounded-[24px] border border-[#ff6cb7]/16 bg-[linear-gradient(180deg,rgba(44,33,54,0.96),rgba(24,18,31,0.98))] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.24)] transition-transform duration-200 active:scale-[0.985]"
    >
      <div className="absolute inset-y-4 left-0 w-1 rounded-r-full bg-[linear-gradient(180deg,rgba(255,108,183,0.92),rgba(130,94,255,0.75))]" />

      <div className="relative flex items-start gap-3 pl-3">
        <IdolAvatar
          name={event.idolName}
          avatarUrl={event.idolAvatarUrl}
          color={idolPrimaryColor(event.idolId)}
          size="md"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold uppercase tracking-normal text-[#ff6cb7]">
                {event.idolName}
              </p>
              <h3 className="mt-1 text-xl font-black leading-tight tracking-normal text-white">
                {event.title}
              </h3>
            </div>

            <TrackCode trackNumber={trackNumber} />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <KindPill label={typeLabel} />
            <StatusPill label={sourceConfig.label} tone={event.source.level} />
          </div>

          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-3">
            <div className="rounded-[18px] border border-white/10 bg-white/[0.035] px-3 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <CalendarDays className="h-4 w-4 text-[#ff8bc8]" />
                <span>{dateLabel}{event.time ? ` · ${event.time}` : ''}</span>
              </div>
              {locationLabel && (
                <div className="mt-2 flex items-center gap-2 text-xs text-white/52">
                  <MapPin className="h-3.5 w-3.5 text-[#b7a7ff]" />
                  <span className="truncate">{locationLabel}</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={(clickEvent) => {
                clickEvent.stopPropagation()
                favorites.toggle(event.id)
              }}
              aria-label={isFavorited ? '取消收藏' : '收藏'}
              className={clsx(
                'flex h-[68px] w-[68px] items-center justify-center self-end rounded-full border transition-all',
                isFavorited
                  ? 'border-[#ff5fae]/45 bg-[#ff4ca1]/16 text-[#ff7bbd] shadow-[0_0_24px_rgba(255,76,161,0.28)]'
                  : 'border-white/10 bg-white/[0.04] text-white/72 hover:border-white/18 hover:text-white',
              )}
            >
              <Heart className={clsx('h-7 w-7', isFavorited && 'fill-current')} />
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/8 pt-3">
            <div className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.26em] text-white/40">
              <Disc3 className="h-3.5 w-3.5 text-[#ff8bc8]" />
              FAVORITE ARCHIVE
            </div>
            <div className="inline-flex items-center gap-1 text-xs font-semibold text-white/52 transition-colors group-hover:text-white/78">
              查看詳情
              <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

function TrackCode({ trackNumber }: { trackNumber: number }) {
  return (
    <div className="rounded-full border border-white/20 px-3 py-1.5 text-right">
      <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-white/38">TRK</p>
      <p className="mt-0.5 text-xl font-black leading-none text-white/72">
        {String(trackNumber).padStart(2, '0')}
      </p>
    </div>
  )
}

function KindPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[#ff6cb7]/18 bg-[#ff4ca1]/10 px-3 py-1 text-xs font-semibold text-[#ff93ca]">
      {label}
    </span>
  )
}

function StatusPill({
  label,
  tone,
}: {
  label: string
  tone: 'official' | 'media' | 'pending'
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold',
        tone === 'official' && 'border-emerald-300/18 bg-emerald-400/10 text-emerald-300',
        tone === 'media' && 'border-sky-300/18 bg-sky-400/10 text-sky-300',
        tone === 'pending' && 'border-white/12 bg-white/[0.06] text-white/56',
      )}
    >
      <span
        className={clsx(
          'h-2 w-2 rounded-full',
          tone === 'official' && 'bg-emerald-300',
          tone === 'media' && 'bg-sky-300',
          tone === 'pending' && 'bg-white/50',
        )}
      />
      {label}
    </span>
  )
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[24px] border border-white/8 bg-white/[0.035] px-6 py-16 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-[#ff8bc8]" />
      <p className="text-sm font-semibold text-white">正在整理你的收藏卡帶</p>
      <p className="text-xs leading-5 text-white/48">同步帳號與收藏列表中…</p>
    </div>
  )
}

function LoginPrompt() {
  return (
    <div className="overflow-hidden rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(34,26,43,0.96),rgba(18,14,24,0.98))] p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-[#ff8bc8]">
          <LibraryBig className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-xl font-black leading-none text-white">登入後同步收藏</h2>
          <p className="mt-1 text-sm text-white/52">把喜歡的活動收進你的私人 archive shelf</p>
        </div>
      </div>

      <div className="rounded-[22px] border border-white/8 bg-white/[0.035] p-4">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-4 w-4 text-[#ff8bc8]" />
          <div className="text-sm leading-6 text-white/74">
            收藏的活動會綁定到你的帳號，更換裝置也能接續追蹤，不會把想看的行程弄丟。
          </div>
        </div>
      </div>

      <Link
        href="/login?next=/favorites"
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[18px] bg-[#ff4ca1] px-4 py-3 text-sm font-bold text-white shadow-[0_14px_34px_rgba(255,76,161,0.22)] transition-transform active:scale-[0.99]"
      >
        <LogIn className="h-4 w-4" />
        登入 / 註冊
      </Link>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-[26px] border border-white/8 bg-white/[0.035] px-5 py-14 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-[#ff8bc8]">
        <Heart className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-2xl font-black text-white">還沒有收藏的活動</h2>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-white/52">
        先去行程頁把想追的活動收進來，這裡之後就會像你的私人卡帶櫃一樣慢慢長滿。
      </p>
      <Link
        href="/schedule"
        className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white/76"
      >
        去瀏覽行程
        <ArrowUpRight className="h-4 w-4" />
      </Link>
    </div>
  )
}

function NoSearchResult({ onClear }: { onClear: () => void }) {
  return (
    <div className="rounded-[24px] border border-white/8 bg-white/[0.035] px-5 py-12 text-center">
      <p className="text-lg font-bold text-white">沒有符合搜尋的收藏</p>
      <p className="mt-2 text-sm text-white/48">試試別的藝人、活動名稱，或直接清除條件。</p>
      <button
        type="button"
        onClick={onClear}
        className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/72"
      >
        清除搜尋條件
      </button>
    </div>
  )
}

function idolPrimaryColor(idolId: string): string {
  const colorMap: Record<string, string> = {
    bts: '#7c3aed',
    blackpink: '#ec4899',
    aespa: '#06b6d4',
    newjeans: '#3b82f6',
    'stray-kids': '#f59e0b',
    ive: '#ef4444',
    twice: '#fb7185',
    'le-sserafim': '#eab308',
    txt: '#a855f7',
    exo: '#ef4444',
  }

  return colorMap[idolId] ?? '#6366f1'
}

interface MonthGroup {
  key: string
  label: string
  events: Event[]
}

function groupEventsByMonth(events: Event[], direction: 'asc' | 'desc'): MonthGroup[] {
  const groups = new Map<string, MonthGroup>()

  for (const event of events) {
    const date = new Date(event.date)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const existing = groups.get(key)

    if (existing) {
      existing.events.push(event)
      continue
    }

    groups.set(key, {
      key,
      label: `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`,
      events: [event],
    })
  }

  return Array.from(groups.values()).sort((a, b) =>
    direction === 'asc' ? a.key.localeCompare(b.key) : b.key.localeCompare(a.key),
  )
}

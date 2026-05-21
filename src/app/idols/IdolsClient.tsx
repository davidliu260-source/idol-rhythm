'use client'

import { useState } from 'react'
import Link from 'next/link'
import clsx from 'clsx'
import {
  Check,
  ChevronRight,
  Search,
  Sparkles,
  Star,
  Users,
} from 'lucide-react'
import IdolAvatar from '@/components/IdolAvatar'
import { useAppState } from '@/lib/appState'
import type { Idol } from '@/lib/mockIdols'
import { SCHEDULE_ARCHIVE_SHELL } from '../schedule/scheduleTheme'

const AGENCY_FILTERS = [
  { id: 'all', label: '全部' },
  { id: 'jyp', label: 'JYP' },
  { id: 'hybe', label: 'HYBE' },
  { id: 'sm', label: 'SM' },
  { id: 'yg', label: 'YG' },
  { id: 'other', label: '其他' },
] as const

type AgencyFilterId = (typeof AGENCY_FILTERS)[number]['id']
const BIG_FOUR: AgencyFilterId[] = ['jyp', 'hybe', 'sm', 'yg']

function agencyContains(agency: string, label: string): boolean {
  return agency.toLowerCase().includes(label)
}

function matchAgency(agency: string, filter: AgencyFilterId): boolean {
  if (filter === 'all') return true
  if (filter === 'other') {
    return !BIG_FOUR.some((key) => agencyContains(agency, key))
  }
  return agencyContains(agency, filter)
}

export default function IdolsClient({ idols }: { idols: Idol[] }) {
  const { following } = useAppState()
  const [query, setQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<AgencyFilterId>('all')

  const normalizedQuery = query.trim().toLowerCase()
  const filtered = idols
    .filter((idol) => {
      const matchesQuery =
        !normalizedQuery ||
        idol.name.toLowerCase().includes(normalizedQuery) ||
        idol.koreanName.toLowerCase().includes(normalizedQuery) ||
        idol.agency.toLowerCase().includes(normalizedQuery)
      const matchesAgency = matchAgency(idol.agency ?? '', activeFilter)
      return matchesQuery && matchesAgency
    })
    .sort((a, b) => {
      const aFollowed = following.has(a.id)
      const bFollowed = following.has(b.id)
      if (aFollowed !== bFollowed) return aFollowed ? -1 : 1
      return a.name.localeCompare(b.name)
    })

  const followed = filtered.filter((idol) => following.has(idol.id))
  const unfollowed = filtered.filter((idol) => !following.has(idol.id))

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_12%_0%,rgba(255,90,174,0.16),transparent_24%),linear-gradient(180deg,#17111d_0%,#09070d_100%)] pb-28 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:34px_34px] opacity-24" />

      <div className="relative mx-auto flex w-full max-w-[520px] flex-col gap-4 px-4 pb-6 pt-8">
        <section className={clsx(SCHEDULE_ARCHIVE_SHELL, 'px-5 py-5')}>
          <div className="pointer-events-none absolute inset-0 rounded-[28px] border border-white/6" />

          <div className="relative">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#ff6cb7]/25 bg-[#ff4ca1]/12 text-[#ff6cb7]">
                <Star className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-white/34">
                  ARCHIVE ROSTER
                </p>
                <h1 className="mt-2 text-[34px] font-black leading-none text-white">
                  偶像名冊
                </h1>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-white/58">
              從這裡管理你的追蹤名單，之後首頁、行程與提醒都會圍繞這份 roster 展開。
            </p>
          </div>

          <div className="relative mt-5 grid grid-cols-3 gap-2">
            <RosterStat label="全部" value={`${idols.length}`} accent="pink" />
            <RosterStat label="已追蹤" value={`${following.ids.length}`} accent="violet" />
            <RosterStat label="結果" value={`${filtered.length}`} accent="slate" />
          </div>
        </section>

        <section className="rounded-[26px] border border-white/8 bg-white/[0.035] p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#ff8bc8]" />
            <input
              type="text"
              placeholder="搜尋偶像、韓文名、經紀公司"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full rounded-[22px] border border-white/10 bg-white/[0.04] py-3 pl-11 pr-4 text-sm text-white placeholder:text-white/28 focus:border-[#ff6cb7]/40 focus:outline-none"
            />
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {AGENCY_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setActiveFilter(filter.id)}
                className={clsx(
                  'flex-shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                  activeFilter === filter.id
                    ? 'border-[#ff6cb7]/28 bg-[#ff4ca1]/16 text-[#ff9cd0]'
                    : 'border-white/8 bg-white/[0.04] text-white/52',
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </section>

        {filtered.length === 0 ? (
          <section className="rounded-[26px] border border-white/8 bg-white/[0.035] px-4 py-12 text-center">
            <p className="text-lg font-bold text-white">找不到符合條件的偶像</p>
            <p className="mt-2 text-sm text-white/52">換個關鍵字或公司分類試試看。</p>
          </section>
        ) : (
          <>
            {followed.length > 0 && (
              <RosterSection
                icon={<Sparkles className="h-4 w-4 text-[#ff8bc8]" />}
                title="已追蹤名單"
                count={followed.length}
              >
                {followed.map((idol) => (
                  <IdolRosterCard
                    key={idol.id}
                    idol={idol}
                    isFollowing
                    onToggle={following.toggle}
                  />
                ))}
              </RosterSection>
            )}

            {unfollowed.length > 0 && (
              <RosterSection
                icon={<Users className="h-4 w-4 text-white/72" />}
                title={followed.length > 0 ? '繼續探索' : '全部名冊'}
                count={unfollowed.length}
              >
                {unfollowed.map((idol) => (
                  <IdolRosterCard
                    key={idol.id}
                    idol={idol}
                    isFollowing={false}
                    onToggle={following.toggle}
                  />
                ))}
              </RosterSection>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function RosterStat({
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
      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/40">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black leading-none text-white">{value}</p>
    </div>
  )
}

function RosterSection({
  icon,
  title,
  count,
  children,
}: {
  icon: React.ReactNode
  title: string
  count: number
  children: React.ReactNode
}) {
  return (
    <section className="rounded-[26px] border border-white/8 bg-white/[0.035] p-4">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-bold text-white">{title}</h2>
        <span className="text-xs font-medium text-[#ff8bc8]">{count}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  )
}

function IdolRosterCard({
  idol,
  isFollowing,
  onToggle,
}: {
  idol: Idol
  isFollowing: boolean
  onToggle: (id: string) => void
}) {
  return (
    <article
      className={clsx(
        'relative overflow-hidden rounded-[24px] border p-4',
        isFollowing
          ? 'border-[#ff6cb7]/22 bg-[linear-gradient(180deg,rgba(52,34,57,0.96),rgba(28,20,34,0.98))]'
          : 'border-white/8 bg-[linear-gradient(180deg,rgba(36,28,43,0.94),rgba(21,16,26,0.98))]',
      )}
    >
      <div
        className="absolute inset-y-4 left-0 w-1 rounded-r-full opacity-90"
        style={{
          background: `linear-gradient(180deg, ${idol.color}, rgba(255,255,255,0.35))`,
        }}
      />

      <div className="relative pl-3">
        <span className="absolute right-0 top-0 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/42">
          roster
        </span>

        <Link href={`/idols/${idol.id}`} className="block">
          <div className="flex items-start gap-3">
            <IdolAvatar
              name={idol.name}
              avatarUrl={idol.avatarUrl}
              color={idol.color}
              size="md"
            />
            <div className="min-w-0 flex-1">
              <div className="pr-[74px]">
                <h3 className="text-[18px] font-black leading-[1.12] text-white break-words">
                  {idol.name}
                </h3>
                {idol.koreanName && (
                  <p className="mt-1 text-xs text-white/48 break-words">
                    {idol.koreanName}
                  </p>
                )}
              </div>
              <p className="mt-3 line-clamp-3 text-xs leading-5 text-white/58">
                {idol.description}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-white/52">
            <span className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1">
              {idol.agency}
            </span>
            {idol.memberCount ? (
              <span className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1">
                {idol.memberCount} 人
              </span>
            ) : null}
            {idol.genres.slice(0, 1).map((genre) => (
              <span
                key={genre}
                className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1"
              >
                {genre}
              </span>
            ))}
          </div>
        </Link>

        <button
          type="button"
          onClick={() => onToggle(idol.id)}
          className={clsx(
            'mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors',
            isFollowing
              ? 'border border-[#ff6cb7]/28 bg-[#ff4ca1]/16 text-[#ff9cd0]'
              : 'border border-white/10 bg-white/[0.045] text-white/66 hover:text-white',
          )}
        >
          {isFollowing ? (
            <>
              <Check className="h-4 w-4" />
              已追蹤
            </>
          ) : (
            '加入追蹤'
          )}
        </button>
      </div>
    </article>
  )
}

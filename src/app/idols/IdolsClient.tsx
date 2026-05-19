'use client'

import { useState } from 'react'
import { Search, Check, Users } from 'lucide-react'
import type { Idol } from '@/lib/mockIdols'
import { useAppState } from '@/lib/appState'
import IdolAvatar from '@/components/IdolAvatar'
import clsx from 'clsx'

// F1: switch from hard-coded "genre" tags (mostly unset on the new seeds) to
// agency-based filtering — matches the admin/idols pattern and lines up with
// how K-pop fans actually browse (by label/company).
const AGENCY_FILTERS = [
  { id: 'all',   label: '全部' },
  { id: 'jyp',   label: 'JYP' },
  { id: 'hybe',  label: 'HYBE' },
  { id: 'sm',    label: 'SM' },
  { id: 'yg',    label: 'YG' },
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
    return !BIG_FOUR.some((k) => agencyContains(agency, k))
  }
  return agencyContains(agency, filter)
}

export default function IdolsClient({ idols }: { idols: Idol[] }) {
  const { following } = useAppState()
  const [query, setQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<AgencyFilterId>('all')

  const filtered = idols.filter((idol) => {
    const matchQuery =
      !query ||
      idol.name.toLowerCase().includes(query.toLowerCase()) ||
      idol.koreanName.includes(query)
    const matchA = matchAgency(idol.agency ?? '', activeFilter)
    return matchQuery && matchA
  })

  return (
    <div className="flex flex-col pt-12 pb-6">
      {/* Header */}
      <div className="px-4 mb-4">
        <h1 className="text-xl font-bold text-text-base">偶像選擇</h1>
        <p className="text-xs text-muted mt-1">已追蹤 {following.ids.length} 組</p>
      </div>

      {/* Search */}
      <div className="px-4 mb-3">
        <div className="flex items-center gap-2 rounded-xl bg-card border border-card-border px-3 py-2.5">
          <Search className="h-4 w-4 text-muted flex-shrink-0" />
          <input
            type="text"
            placeholder="搜尋偶像或團名…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-text-base placeholder:text-muted focus:outline-none"
          />
        </div>
      </div>

      {/* Agency filter (F1) — chips matching the admin/idols pattern. */}
      <div className="px-4 mb-4 overflow-x-auto scrollbar-none">
        <div className="flex gap-2 pb-1">
          {AGENCY_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={clsx(
                'flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                activeFilter === f.id
                  ? 'bg-primary text-white'
                  : 'border border-card-border bg-card text-muted',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Idol grid */}
      <div className="px-4 grid grid-cols-2 gap-3">
        {filtered.map((idol) => (
          <IdolCard
            key={idol.id}
            idol={idol}
            isFollowing={following.has(idol.id)}
            onToggle={following.toggle}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="px-4 py-12 text-center text-sm text-muted">找不到符合的偶像</div>
      )}
    </div>
  )
}

function IdolCard({
  idol,
  isFollowing,
  onToggle,
}: {
  idol: Idol
  isFollowing: boolean
  onToggle: (id: string) => void
}) {
  return (
    <div
      className={clsx(
        'relative rounded-2xl border p-4 transition-all',
        isFollowing ? 'border-primary/50 bg-primary-dim' : 'border-card-border bg-card',
      )}
    >
      <div className="mb-3">
        <IdolAvatar
          name={idol.name}
          avatarUrl={idol.avatarUrl}
          color={idol.color}
          size="lg"
        />
      </div>

      <div className="mb-3">
        <h3 className="font-bold text-text-base text-sm leading-tight">{idol.name}</h3>
        <p className="text-xs text-muted mt-0.5">{idol.koreanName}</p>
        {idol.memberCount && (
          <div className="flex items-center gap-1 mt-1.5">
            <Users className="h-3 w-3 text-muted" />
            <span className="text-xs text-muted">{idol.memberCount} 人</span>
          </div>
        )}
        <p className="text-xs text-muted/60 mt-0.5">{idol.agency}</p>
      </div>

      <div className="flex flex-wrap gap-1 mb-3">
        {idol.genres.slice(0, 2).map((g) => (
          <span
            key={g}
            className="rounded-full bg-card-border px-2 py-0.5 text-[10px] text-muted"
          >
            {g}
          </span>
        ))}
      </div>

      <button
        onClick={() => onToggle(idol.id)}
        className={clsx(
          'w-full rounded-xl py-2 text-xs font-semibold transition-all flex items-center justify-center gap-1.5',
          isFollowing
            ? 'bg-primary text-white'
            : 'border border-card-border bg-transparent text-muted',
        )}
      >
        {isFollowing ? (
          <>
            <Check className="h-3.5 w-3.5" />
            已追蹤
          </>
        ) : (
          '+ 追蹤'
        )}
      </button>
    </div>
  )
}

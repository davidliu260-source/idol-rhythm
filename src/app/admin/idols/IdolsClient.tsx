'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Search, X } from 'lucide-react'

// ── Types (mirror server-side AdminIdol but with alt_names for search) ──────

export interface AdminIdol {
  id: string
  slug: string
  name: string
  korean_name: string | null
  type: string | null
  category: string | null
  agency: string | null
  alt_names: string[]
  is_active: boolean
}

interface Props {
  idols: AdminIdol[]
}

// ── Tabs ────────────────────────────────────────────────────────────────────
// 'agency' tabs match by lowercase substring on idols.agency. This is
// intentionally lenient — "JYP Entertainment", "JYP", "JYP Ent." all classify
// as 'jyp'. An idol whose agency exists but doesn't match any of the four
// big labels falls into 'other'. Idols with NULL agency also count as 'other'
// so the counts always add up to "all".

type FilterTab =
  | 'active'
  | 'inactive'
  | 'jyp'
  | 'hybe'
  | 'yg'
  | 'sm'
  | 'other'
  | 'all'

const TAB_ORDER: FilterTab[] = [
  'active', 'inactive', 'jyp', 'hybe', 'yg', 'sm', 'other', 'all',
]
const TAB_LABELS: Record<FilterTab, string> = {
  active: '啟用中',
  inactive: '停用',
  jyp: 'JYP',
  hybe: 'HYBE',
  yg: 'YG',
  sm: 'SM',
  other: '其他',
  all: '全部',
}

const BIG_FOUR = ['jyp', 'hybe', 'yg', 'sm'] as const
type BigFour = (typeof BIG_FOUR)[number]

function agencyMatches(agency: string | null, label: BigFour): boolean {
  if (!agency) return false
  return agency.toLowerCase().includes(label)
}

function isBigFour(agency: string | null): boolean {
  return BIG_FOUR.some((k) => agencyMatches(agency, k))
}

function matchTab(idol: AdminIdol, tab: FilterTab): boolean {
  switch (tab) {
    case 'active':   return idol.is_active
    case 'inactive': return !idol.is_active
    case 'jyp':      return agencyMatches(idol.agency, 'jyp')
    case 'hybe':     return agencyMatches(idol.agency, 'hybe')
    case 'yg':       return agencyMatches(idol.agency, 'yg')
    case 'sm':       return agencyMatches(idol.agency, 'sm')
    case 'other':    return !isBigFour(idol.agency)
    case 'all':      return true
  }
}

function matchSearch(idol: AdminIdol, q: string): boolean {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  if (idol.name.toLowerCase().includes(needle)) return true
  if (idol.slug.toLowerCase().includes(needle)) return true
  if (idol.korean_name && idol.korean_name.toLowerCase().includes(needle)) return true
  if (idol.agency && idol.agency.toLowerCase().includes(needle)) return true
  for (const alt of idol.alt_names) {
    if (alt.toLowerCase().includes(needle)) return true
  }
  return false
}

const CATEGORY_LABELS: Record<string, string> = {
  kpop: 'K-Pop', cpop: 'C-Pop', jpop: 'J-Pop', idol: 'Idol', other: 'Other',
}

// ── Component ──────────────────────────────────────────────────────────────

export default function IdolsClient({ idols }: Props) {
  const [tab, setTab] = useState<FilterTab>('active')
  const [query, setQuery] = useState('')

  // Counts ignore search so the user sees the full distribution at all times.
  const tabCounts = useMemo(() => {
    const counts = {} as Record<FilterTab, number>
    for (const t of TAB_ORDER) counts[t] = 0
    for (const idol of idols) {
      for (const t of TAB_ORDER) {
        if (matchTab(idol, t)) counts[t]++
      }
    }
    return counts
  }, [idols])

  const filtered = useMemo(() => {
    return idols.filter((i) => matchTab(i, tab) && matchSearch(i, query))
  }, [idols, tab, query])

  return (
    <>
      {/* Filter tabs */}
      <div className="px-4 mb-3">
        <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
          {TAB_ORDER.map((t) => {
            const isActive = tab === t
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-violet text-white'
                    : 'bg-card border border-card-border text-muted hover:text-text-base'
                }`}
              >
                <span>{TAB_LABELS[t]}</span>
                <span
                  className={`tabular-nums text-[10px] ${
                    isActive ? 'text-white/85' : 'text-muted/70'
                  }`}
                >
                  {tabCounts[t]}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Search box */}
      <div className="px-4 mb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜尋名稱 / 韓文名 / 別名 / 經紀公司"
            className="w-full rounded-xl bg-card border border-card-border pl-9 pr-9 py-2.5 text-xs text-text-base placeholder:text-muted focus:outline-none focus:border-violet/40"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="清除搜尋"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-text-base"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="px-4 flex flex-col gap-2">
        {idols.length > 0 && filtered.length === 0 && (
          <div className="rounded-xl bg-card border border-card-border px-4 py-8 text-center">
            <p className="text-sm text-muted">
              {query ? '沒有符合搜尋的偶像' : `「${TAB_LABELS[tab]}」分類目前沒有偶像`}
            </p>
            <p className="text-xs text-muted/60 mt-1">
              試試其他分類或清除搜尋條件。
            </p>
          </div>
        )}

        {filtered.map((idol) => (
          <Link
            key={idol.id}
            href={`/admin/idols/${idol.id}`}
            className={`rounded-xl bg-card border border-card-border px-4 py-3 flex items-center gap-3 active:opacity-70 transition-opacity ${!idol.is_active ? 'opacity-50' : ''}`}
          >
            <span
              className={`h-2 w-2 rounded-full flex-shrink-0 ${
                idol.is_active ? 'bg-emerald-400' : 'bg-muted/40'
              }`}
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-text-base truncate">{idol.name}</p>
                {idol.korean_name && (
                  <p className="text-xs text-muted truncate">{idol.korean_name}</p>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-[10px] text-muted font-mono">{idol.slug}</span>
                {idol.category && (
                  <span className="text-[10px] text-muted border border-card-border rounded px-1.5 py-0.5">
                    {CATEGORY_LABELS[idol.category] ?? idol.category}
                  </span>
                )}
                {idol.type && (
                  <span className="text-[10px] text-muted">
                    {idol.type === 'group' ? '團體' : '個人'}
                  </span>
                )}
                {idol.agency && (
                  <span className="text-[10px] text-muted/60 truncate">{idol.agency}</span>
                )}
              </div>
            </div>

            <ChevronRight className="h-4 w-4 text-muted flex-shrink-0" />
          </Link>
        ))}
      </div>
    </>
  )
}

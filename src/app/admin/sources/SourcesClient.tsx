'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Search, X } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

export interface SourceRow {
  id: string
  name: string
  sourceKey: string
  idolName: string | null
  sourceType: string
  parserType: string
  isActive: boolean
  lastRunAt: string | null
  lastStatus: string | null
  /** MUST #10：KpopOfficial 主力來源，列表要醒目標示並排前面。 */
  isKpopOfficial?: boolean
  /** MUST #10：健康計數。null／未提供＝migration 072 尚未套用。 */
  health?: {
    consecutiveErrorCount: number
    consecutiveZeroFetchCount: number
    /** 台北時間 `YYYY-MM-DD HH:mm`；null＝尚未成功過。 */
    lastSuccessLabel: string | null
    lastFetchedCount: number | null
  } | null
  /** MUST #10：未解決的故障／警告（含由計數即時算出的）。 */
  alerts?: {
    kind: 'error_streak' | 'stale_success' | 'zero_fetch'
    severity: 'fault' | 'warning'
    status: 'open' | 'acknowledged'
  }[]
}

const ALERT_KIND_LABELS = {
  error_streak: '連續失敗',
  stale_success: '長時間沒有成功',
  zero_fetch: '成功但 0 筆',
} as const

/** 排序：KpopOfficial 與有未解決故障的來源排前面；其餘維持原順序。 */
function attentionRank(s: SourceRow): number {
  const alerts = s.alerts ?? []
  if (alerts.some((a) => a.severity === 'fault' && a.status === 'open')) return s.isKpopOfficial ? 0 : 1
  if (s.isKpopOfficial) return 2
  if (alerts.length > 0) return 3
  return 4
}

interface Props {
  sources: SourceRow[]
}

// ── Tabs ───────────────────────────────────────────────────────────────────
// Note: tabs here intentionally span two orthogonal axes:
//   - status   axis : 啟用中 / 停用    (sum = 全部)
//   - parser_type  : JYP系 / 聚合 / 其他  (sum = 全部)
//   - alert        : 失敗  (overlaps with both axes)
// So tab counts won't all add up to "全部" — this is by design. The user
// switches between them like filter chips, not a single partition.

type FilterTab =
  | 'active'
  | 'inactive'
  | 'failing'
  | 'jyp'
  | 'aggregator'
  | 'other_parser'
  | 'all'

const TAB_ORDER: FilterTab[] = [
  'active', 'inactive', 'failing', 'jyp', 'aggregator', 'other_parser', 'all',
]
const TAB_LABELS: Record<FilterTab, string> = {
  active: '啟用中',
  inactive: '停用',
  failing: '失敗',
  jyp: 'JYP 系',
  aggregator: '聚合來源',
  other_parser: '其他',
  all: '全部',
}

const FAILING_STATUSES = new Set(['error', 'partial_error'])

function matchTab(s: SourceRow, tab: FilterTab): boolean {
  switch (tab) {
    case 'active':       return s.isActive
    case 'inactive':     return !s.isActive
    case 'failing':      return (s.lastStatus !== null && FAILING_STATUSES.has(s.lastStatus)) || (s.alerts?.length ?? 0) > 0
    case 'jyp':          return s.parserType === 'jyp_schedule' || s.parserType === 'jyp_notice'
    case 'aggregator':   return s.parserType === 'kpopofficial_concerts'
    case 'other_parser': return s.parserType !== 'jyp_schedule' && s.parserType !== 'jyp_notice' && s.parserType !== 'kpopofficial_concerts'
    case 'all':          return true
  }
}

function matchSearch(s: SourceRow, q: string): boolean {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  if (s.name.toLowerCase().includes(needle)) return true
  if (s.sourceKey.toLowerCase().includes(needle)) return true
  if (s.idolName && s.idolName.toLowerCase().includes(needle)) return true
  if (s.parserType.toLowerCase().includes(needle)) return true
  return false
}

// ── Component ──────────────────────────────────────────────────────────────

export default function SourcesClient({ sources }: Props) {
  const [tab, setTab] = useState<FilterTab>('active')
  const [query, setQuery] = useState('')

  const tabCounts = useMemo(() => {
    const counts = {} as Record<FilterTab, number>
    for (const t of TAB_ORDER) counts[t] = 0
    for (const s of sources) {
      for (const t of TAB_ORDER) {
        if (matchTab(s, t)) counts[t]++
      }
    }
    return counts
  }, [sources])

  const filtered = useMemo(
    () => sources
      .filter((s) => matchTab(s, tab) && matchSearch(s, query))
      .map((s, index) => ({ s, index }))
      .sort((a, b) => attentionRank(a.s) - attentionRank(b.s) || a.index - b.index)
      .map(({ s }) => s),
    [sources, tab, query],
  )

  return (
    <>
      {/* Filter tabs */}
      <div className="px-4 mb-3">
        <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
          {TAB_ORDER.map((t) => {
            const isActive = tab === t
            // Highlight "failing" tab in amber when it has hits, so a broken
            // crawler stands out even before the user clicks the chip.
            const isFailingChip = t === 'failing' && tabCounts.failing > 0
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? isFailingChip
                      ? 'bg-amber-500 text-white'
                      : 'bg-violet-500 text-white'
                    : isFailingChip
                      ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
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
            placeholder="搜尋名稱 / source_key / 偶像 / parser_type"
            className="w-full rounded-xl bg-card border border-card-border pl-9 pr-9 py-2.5 text-xs text-text-base placeholder:text-muted focus:outline-none focus:border-violet-500/40"
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
        {sources.length > 0 && filtered.length === 0 && (
          <div className="rounded-xl bg-card border border-card-border px-4 py-8 text-center">
            <p className="text-sm text-muted">
              {query ? '沒有符合搜尋的資料來源' : `「${TAB_LABELS[tab]}」分類目前沒有資料來源`}
            </p>
            <p className="text-xs text-muted/60 mt-1">
              試試其他分類或清除搜尋條件。
            </p>
          </div>
        )}

        {filtered.map((source) => (
          <SourceRowItem key={source.id} source={source} />
        ))}
      </div>
    </>
  )
}

function SourceRowItem({ source }: { source: SourceRow }) {
  const isFailing =
    source.lastStatus !== null && FAILING_STATUSES.has(source.lastStatus)

  return (
    <Link
      id={`source-${source.id}`}
      href={`/admin/sources/${source.id}`}
      className="rounded-xl bg-card border border-card-border px-4 py-3 flex flex-col gap-1.5 active:opacity-70 transition-opacity"
    >
      <div className="flex items-center gap-2">
        <span
          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
            source.isActive
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-card border-card-border text-muted'
          }`}
        >
          {source.isActive ? '啟用中' : '已停用'}
        </span>
        {isFailing && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-amber-500/10 border-amber-500/30 text-amber-400">
            {source.lastStatus === 'partial_error' ? '部分失敗' : '失敗'}
          </span>
        )}
        {source.isKpopOfficial && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-fuchsia-500/15 border-fuchsia-500/40 text-fuchsia-300">
            主力來源
          </span>
        )}
        {(source.alerts ?? []).map((alert) => (
          <span
            key={alert.kind}
            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
              alert.status === 'acknowledged'
                ? 'bg-card border-card-border text-muted'
                : alert.severity === 'fault'
                  ? 'bg-red-500/15 border-red-500/30 text-red-300'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            }`}
          >
            {alert.severity === 'fault' ? '故障' : '警告'}：{ALERT_KIND_LABELS[alert.kind]}
            {alert.status === 'acknowledged' ? '（已看過）' : ''}
          </span>
        ))}
        <span className="text-[10px] text-muted ml-auto font-mono">
          {source.parserType}
        </span>
      </div>

      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-text-base leading-snug">
          {source.name}
        </p>
        <ChevronRight className="h-4 w-4 text-muted flex-shrink-0 mt-0.5" />
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted flex-wrap">
        {source.idolName && <span>{source.idolName}</span>}
        {source.idolName && <span>·</span>}
        <span>{source.sourceType}</span>
        {source.lastRunAt && (
          <span className="ml-auto text-[10px] text-muted/60 flex-shrink-0">
            上次：{source.lastRunAt.slice(0, 10)}
          </span>
        )}
      </div>

      {source.health && (
        <div className="flex items-center gap-1.5 text-[10px] text-muted flex-wrap">
          <span className={source.health.consecutiveErrorCount > 0 ? 'text-amber-400' : undefined}>
            連續失敗 {source.health.consecutiveErrorCount} 次
          </span>
          <span>·</span>
          <span>上次成功：{source.health.lastSuccessLabel ?? '尚無紀錄'}</span>
          <span>·</span>
          <span>
            上次抓到：{source.health.lastFetchedCount === null ? '尚無紀錄' : `${source.health.lastFetchedCount} 筆`}
          </span>
          {source.health.consecutiveZeroFetchCount > 0 && (
            <>
              <span>·</span>
              <span className="text-amber-400">連續 0 筆 {source.health.consecutiveZeroFetchCount} 次</span>
            </>
          )}
        </div>
      )}
    </Link>
  )
}

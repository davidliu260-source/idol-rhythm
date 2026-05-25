'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight, Check, X, CheckSquare, Trash2, AlertTriangle, Search } from 'lucide-react'
import { getReviewSourceInfo } from '@/lib/admin/sourceReview'
import EventTypeBadge from '@/components/EventTypeBadge'

interface Candidate {
  id: string
  rawTitle: string
  idolName: string | null
  detectedDate: string | null
  sourceName: string | null
  sourceType: string | null
  sourceUrl: string | null
  detectedEventType: string | null
  detectedEventSubType: string | null
  reviewStatus: 'pending' | 'approved' | 'rejected'
  aiConfidence: number | null
  hasIdol: boolean
  needsRecheck: boolean
}

interface Props {
  candidates: Candidate[]
  isAdmin: boolean
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: '待審核', color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20' },
  approved: { label: '已核准', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  rejected: { label: '已拒絕', color: 'text-muted',       bg: 'bg-card border-card-border' },
}

// ── Tabs ────────────────────────────────────────────────────────────────────
// Mutually exclusive so the counts always add up to "all":
//   待審   = pending (regardless of needs_recheck)
//   需重審 = needs_recheck AND NOT pending (drift on already-decided items)
//   已通過 = approved AND NOT needs_recheck
//   已退回 = rejected AND NOT needs_recheck
//
// Pending+needs_recheck items live in "待審" because they have to be reviewed
// anyway; the orange "內容已變更" badge inside the card flags the drift.

type FilterTab = 'pending' | 'recheck' | 'approved' | 'rejected' | 'all'

const TAB_ORDER: FilterTab[] = ['pending', 'recheck', 'approved', 'rejected', 'all']
const TAB_LABELS: Record<FilterTab, string> = {
  pending: '待審',
  recheck: '需重審',
  approved: '已通過',
  rejected: '已退回',
  all: '全部',
}

function matchTab(c: Candidate, tab: FilterTab): boolean {
  switch (tab) {
    case 'pending':  return c.reviewStatus === 'pending'
    case 'recheck':  return c.needsRecheck && c.reviewStatus !== 'pending'
    case 'approved': return c.reviewStatus === 'approved' && !c.needsRecheck
    case 'rejected': return c.reviewStatus === 'rejected' && !c.needsRecheck
    case 'all':      return true
  }
}

function matchSearch(c: Candidate, q: string): boolean {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  if (c.rawTitle.toLowerCase().includes(needle)) return true
  if (c.idolName && c.idolName.toLowerCase().includes(needle)) return true
  if (c.sourceName && c.sourceName.toLowerCase().includes(needle)) return true
  return false
}

function sourceBadgeClass(risk: string): string {
  switch (risk) {
    case 'official':
      return 'bg-sky-500/10 border-sky-500/25 text-sky-300'
    case 'media':
      return 'bg-teal-500/10 border-teal-500/25 text-teal-300'
    case 'aggregator':
      return 'bg-amber-500/10 border-amber-500/30 text-amber-300'
    default:
      return 'bg-card border-card-border text-muted'
  }
}

export default function CandidatesClient({ candidates, isAdmin }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const [resultMsg, setResultMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  // ── Filter / search state ──────────────────────────────────────────────────
  const [tab, setTabState] = useState<FilterTab>('pending')
  const [query, setQuery] = useState('')

  // Wrap setTab to clear selection when tab changes — selection semantics
  // differ between tabs (pending → approve/reject; recheck → resolve), so
  // carrying selection across is confusing.
  function setTab(next: FilterTab) {
    if (next !== tab) setSelected(new Set())
    setTabState(next)
  }

  // Tab counts ignore search so the user always sees the full distribution.
  const tabCounts = useMemo(() => {
    const counts = {} as Record<FilterTab, number>
    for (const t of TAB_ORDER) counts[t] = 0
    for (const c of candidates) {
      for (const t of TAB_ORDER) {
        if (matchTab(c, t)) counts[t]++
      }
    }
    return counts
  }, [candidates])

  const filteredCandidates = useMemo(
    () => candidates.filter((c) => matchTab(c, tab) && matchSearch(c, query)),
    [candidates, tab, query],
  )

  // Pending candidates within the current filtered view — bulk-select operates
  // on these only, so the user never selects items that are off-screen.
  const visiblePending = useMemo(
    () => filteredCandidates.filter((c) => c.reviewStatus === 'pending'),
    [filteredCandidates],
  )
  const pendingCandidates = visiblePending
  const allPendingSelected =
    pendingCandidates.length > 0 && pendingCandidates.every((c) => selected.has(c.id))

  // Recheck candidates within the current filtered view (only relevant on
  // the 需重審 tab). Bulk-resolve operates on these. Note: an item with
  // review_status='pending' AND needs_recheck=true lives in the 待審 tab
  // per matchTab(); it is NOT included here.
  const visibleRecheck = useMemo(
    () =>
      filteredCandidates.filter(
        (c) => c.needsRecheck && c.reviewStatus !== 'pending',
      ),
    [filteredCandidates],
  )
  const allRecheckSelected =
    visibleRecheck.length > 0 && visibleRecheck.every((c) => selected.has(c.id))

  const todayIso = new Date().toISOString().slice(0, 10)
  // Cleanup-expired button counts ALL pending+expired (not just filtered view).
  // The cleanup endpoint operates server-side on every matching row, so it
  // would be misleading to show only the in-view count here.
  const expiredPendingCount = candidates.filter(
    (c) => c.reviewStatus === 'pending' && c.detectedDate !== null && c.detectedDate < todayIso,
  ).length

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAllPending() {
    if (allPendingSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(pendingCandidates.map((c) => c.id)))
    }
  }

  function toggleAllRecheck() {
    if (allRecheckSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(visibleRecheck.map((c) => c.id)))
    }
  }

  async function bulkResolveRecheck() {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    setResultMsg(null)

    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/event-candidates/bulk-resolve-recheck', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
        })
        const data = await res.json()
        if (!res.ok || data.failed > 0) {
          const errText =
            data.errors?.length > 0
              ? data.errors
                  .map((e: { id: string; message: string }) => e.message)
                  .join('；')
              : data.error ?? '部分項目處理失敗'
          // Partial success surfaces a warning rather than a hard error so
          // the admin sees both: how many cleared and what failed.
          setResultMsg({
            type: 'error',
            text:
              data.resolved > 0
                ? `已處理 ${data.resolved} 筆（同步事件 ${data.synced} 筆），失敗 ${data.failed} 筆：${errText}`
                : `處理失敗：${errText}`,
          })
          setSelected(new Set())
          router.refresh()
        } else {
          setResultMsg({
            type: 'ok',
            text: `已處理 ${data.resolved} 筆需重審${data.synced > 0 ? `（同步繁中欄位到 ${data.synced} 筆事件）` : ''}`,
          })
          setSelected(new Set())
          router.refresh()
        }
      } catch (e) {
        setResultMsg({
          type: 'error',
          text: e instanceof Error ? e.message : '網路錯誤',
        })
      }
    })
  }

  async function bulkAction(action: 'approve' | 'reject') {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    setResultMsg(null)

    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/event-candidates/bulk-review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids, action }),
        })
        const data = await res.json()
        if (!res.ok || !data.ok) {
          const errText =
            data.errors?.length > 0
              ? data.errors.map((e: { id: string; message: string }) => e.message).join('；')
              : data.error ?? '操作失敗'
          setResultMsg({ type: 'error', text: errText })
        } else {
          const label = action === 'approve' ? '核准' : '拒絕'
          setResultMsg({ type: 'ok', text: `已${label} ${data.succeeded} 筆` })
          setSelected(new Set())
          router.refresh()
        }
      } catch (e) {
        setResultMsg({ type: 'error', text: e instanceof Error ? e.message : '網路錯誤' })
      }
    })
  }

  async function cleanupExpired() {
    if (expiredPendingCount === 0) return
    if (!confirm(`將 ${expiredPendingCount} 筆過期待審核候選標記為已拒絕（reviewer_note=auto-expired）？資料保留，可隨時查詢。`)) {
      return
    }
    setResultMsg(null)

    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/event-candidates/cleanup-expired', {
          method: 'POST',
        })
        const data = await res.json()
        if (!res.ok || !data.ok) {
          setResultMsg({ type: 'error', text: data.error ?? '清理失敗' })
        } else {
          setResultMsg({ type: 'ok', text: `已清理 ${data.affected} 筆過期候選` })
          router.refresh()
        }
      } catch (e) {
        setResultMsg({ type: 'error', text: e instanceof Error ? e.message : '網路錯誤' })
      }
    })
  }

  const hasSelected = selected.size > 0
  const selectedHaveNoIdol = Array.from(selected).some(
    (id) => !candidates.find((c) => c.id === id)?.hasIdol,
  )
  const selectedHaveAggregator = Array.from(selected).some((id) => {
    const candidate = candidates.find((c) => c.id === id)
    if (!candidate) return false
    return getReviewSourceInfo(candidate).needsOriginalSource
  })

  return (
    <>
      {/* Result message */}
      {resultMsg && (
        <div className="px-4 mb-3">
          <div
            className={`rounded-xl px-3 py-2.5 text-xs ${
              resultMsg.type === 'ok'
                ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-400'
                : 'bg-red-500/10 border border-red-500/25 text-red-400'
            }`}
          >
            {resultMsg.text}
          </div>
        </div>
      )}

      {/* Cleanup expired pending button */}
      {isAdmin && expiredPendingCount > 0 && (
        <div className="px-4 mb-3">
          <button
            onClick={cleanupExpired}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-400 disabled:opacity-50 active:opacity-70 transition-opacity"
          >
            <Trash2 className="h-3.5 w-3.5" />
            清理過期候選（{expiredPendingCount} 筆 detected_date 已過）
          </button>
        </div>
      )}

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
            placeholder="搜尋活動標題 / 對應偶像 / 來源"
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

      {/* Select-all button — context-aware per tab */}
      {isAdmin && tab === 'pending' && pendingCandidates.length > 0 && (
        <div className="px-4 mb-2">
          <button
            onClick={toggleAllPending}
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-text-base transition-colors"
          >
            <CheckSquare className="h-3.5 w-3.5" />
            {allPendingSelected ? '取消全選' : `全選此頁待審核（${pendingCandidates.length} 筆）`}
          </button>
        </div>
      )}
      {isAdmin && tab === 'recheck' && visibleRecheck.length > 0 && (
        <div className="px-4 mb-2">
          <button
            onClick={toggleAllRecheck}
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-text-base transition-colors"
          >
            <CheckSquare className="h-3.5 w-3.5" />
            {allRecheckSelected ? '取消全選' : `全選此頁需重審（${visibleRecheck.length} 筆）`}
          </button>
        </div>
      )}

      {/* Candidates list */}
      <div className="px-4 flex flex-col gap-2 pb-32">
        {candidates.length === 0 && (
          <div className="rounded-xl bg-card border border-card-border px-4 py-8 text-center">
            <p className="text-sm text-muted">尚無候選活動</p>
          </div>
        )}
        {candidates.length > 0 && filteredCandidates.length === 0 && (
          <div className="rounded-xl bg-card border border-card-border px-4 py-8 text-center">
            <p className="text-sm text-muted">
              {query ? '沒有符合搜尋的候選' : `「${TAB_LABELS[tab]}」分類目前沒有候選`}
            </p>
            <p className="text-xs text-muted/60 mt-1">
              試試其他分類或清除搜尋條件。
            </p>
          </div>
        )}
        {filteredCandidates.map((c) => {
          const statusCfg = STATUS_CONFIG[c.reviewStatus] ?? STATUS_CONFIG.pending
          const sourceInfo = getReviewSourceInfo(c)
          const isChecked = selected.has(c.id)
          const isPending = c.reviewStatus === 'pending'
          // Checkbox visibility is tab-scoped to keep selection semantics
          // unambiguous: 待審 tab selects pending (approve/reject), 需重審
          // tab selects already-decided drift items (resolve). Mixing the
          // two would make the toolbar ambiguous.
          const isCheckable =
            (tab === 'pending' && isPending) ||
            (tab === 'recheck' && c.needsRecheck && !isPending)

          return (
            <div key={c.id} className="relative flex items-stretch gap-2">
              {/* Checkbox zone — admin + tab-scoped */}
              {isAdmin && isCheckable && (
                <button
                  onClick={() => toggleOne(c.id)}
                  className="flex-shrink-0 flex items-center justify-center w-8 rounded-xl bg-card border border-card-border active:opacity-70 transition-opacity"
                  aria-label={isChecked ? '取消選取' : '選取'}
                >
                  <div
                    className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${
                      isChecked
                        ? 'bg-violet border-violet'
                        : 'border-card-border bg-transparent'
                    }`}
                  >
                    {isChecked && <Check className="h-2.5 w-2.5 text-white" />}
                  </div>
                </button>
              )}

              {/* Card */}
              <Link
                href={`/admin/event-candidates/${c.id}`}
                className={`flex-1 rounded-xl bg-card border px-4 py-3 flex flex-col gap-1.5 active:opacity-70 transition-opacity ${
                  isChecked ? 'border-violet/50' : 'border-card-border'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${statusCfg.bg} ${statusCfg.color}`}
                  >
                    {statusCfg.label}
                  </span>
                  {c.needsRecheck && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-orange-500/10 border-orange-500/30 text-orange-400">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      內容已變更
                    </span>
                  )}
                  {sourceInfo.needsOriginalSource && (
                    <span
                      className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${sourceBadgeClass(sourceInfo.risk)}`}
                    >
                      <AlertTriangle className="h-2.5 w-2.5" />
                      {sourceInfo.shortLabel}
                    </span>
                  )}
                  {c.detectedEventType && (
                    <EventTypeBadge
                      type={c.detectedEventType}
                      subType={c.detectedEventSubType}
                    />
                  )}
                  {c.detectedDate && (
                    <span className="text-[10px] text-muted tabular-nums ml-auto">
                      {c.detectedDate.slice(0, 10)}
                    </span>
                  )}
                </div>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-text-base leading-snug">{c.rawTitle}</p>
                  <ChevronRight className="h-4 w-4 text-muted flex-shrink-0 mt-0.5" />
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted flex-wrap">
                  {c.idolName && <span>{c.idolName}</span>}
                  {c.idolName && c.sourceName && <span>·</span>}
                  {c.sourceName && <span>{c.sourceName}</span>}
                  {c.sourceName && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${sourceBadgeClass(sourceInfo.risk)}`}>
                      {sourceInfo.shortLabel}
                    </span>
                  )}
                  {!c.hasIdol && isPending && (
                    <span className="ml-auto text-[10px] text-amber-500/80">無偶像對應</span>
                  )}
                  {c.aiConfidence !== null && c.hasIdol && (
                    <span className="ml-auto text-[10px] text-muted/60 flex-shrink-0">
                      信心 {Math.round(c.aiConfidence * 100)}%
                    </span>
                  )}
                </div>
              </Link>
            </div>
          )
        })}
      </div>

      {/* Bulk action toolbar — appears when items selected; buttons swap per tab */}
      {isAdmin && hasSelected && (
        <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 pt-3 bg-gradient-to-t from-bg via-bg/95 to-transparent">
          <div className="max-w-md mx-auto flex items-center gap-2 rounded-2xl bg-card border border-card-border px-4 py-3 shadow-xl">
            <span className="text-xs text-muted flex-1">
              已選 <span className="text-text-base font-semibold">{selected.size}</span> 筆
            </span>
            {tab === 'pending' ? (
              <>
                <button
                  onClick={() => bulkAction('reject')}
                  disabled={isPending}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 disabled:opacity-50 active:opacity-70 transition-opacity"
                >
                  <X className="h-3 w-3" />
                  批量拒絕
                </button>
                <button
                  onClick={() => bulkAction('approve')}
                  disabled={isPending || selectedHaveNoIdol || selectedHaveAggregator}
                  title={
                    selectedHaveNoIdol
                      ? '部分候選缺少偶像對應，無法批量核准'
                      : selectedHaveAggregator
                        ? '聚合 / 社群來源需要逐筆確認原始佐證，不支援批量核准'
                        : undefined
                  }
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 active:opacity-70 transition-opacity"
                >
                  <Check className="h-3 w-3" />
                  批量核准
                </button>
              </>
            ) : tab === 'recheck' ? (
              <button
                onClick={bulkResolveRecheck}
                disabled={isPending}
                className="inline-flex items-center gap-1 rounded-lg bg-violet px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 active:opacity-70 transition-opacity"
              >
                <Check className="h-3 w-3" />
                批量已處理
              </button>
            ) : null}
          </div>
        </div>
      )}
    </>
  )
}

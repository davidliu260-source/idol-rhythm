'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronRight, Check, X, CheckSquare, ShieldCheck, Trash2, Search,
} from 'lucide-react'
import { EVENT_TYPE_LABELS, SOURCE_CONFIG } from '@/lib/mockEvents'
import type { TrustLevel } from '@/lib/types'

interface AdminEvent {
  id: string
  idolName: string
  title: string
  type: string
  status: string
  trustLevel: TrustLevel
  date: string
  countryFlag: string
  location: string | null
  isPublished: boolean
  publishedAt: string | null
  sourceCount: number
}

// ── Tab filter definitions ───────────────────────────────────────────────────
// Each tab is a self-contained predicate. Counts shown in tabs match the
// filtered list count for that tab, so the user can trust the number.

type FilterTab = 'upcoming' | 'draft' | 'published' | 'past' | 'official' | 'media' | 'all'

const TAB_ORDER: FilterTab[] = [
  'upcoming', 'draft', 'published', 'past', 'official', 'media', 'all',
]
const TAB_LABELS: Record<FilterTab, string> = {
  upcoming: '即將',
  draft: '草稿',
  published: '已發布',
  past: '過去',
  official: '官方',
  media: '媒體',
  all: '全部',
}

function todayIsoDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function matchTab(event: AdminEvent, tab: FilterTab, todayIso: string): boolean {
  // events.date may include a time component or be a bare date string.
  // Compare 10-char date prefixes so "2026-05-20T19:00:00Z" still classifies
  // as 'upcoming' on the day of 2026-05-20.
  const eventDay = event.date.slice(0, 10)
  switch (tab) {
    case 'upcoming':  return eventDay >= todayIso
    case 'past':      return eventDay <  todayIso
    case 'draft':     return !event.isPublished
    case 'published': return event.isPublished
    case 'official':  return event.trustLevel === 'official'
    case 'media':     return event.trustLevel === 'media'
    case 'all':       return true
  }
}

function matchSearch(event: AdminEvent, q: string): boolean {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  return (
    event.title.toLowerCase().includes(needle) ||
    event.idolName.toLowerCase().includes(needle) ||
    (event.location ?? '').toLowerCase().includes(needle)
  )
}

interface Props {
  events: AdminEvent[]
  isAdmin: boolean
}

export default function EventsClient({ events, isAdmin }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const [resultMsg, setResultMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  // ── Filter / search state ──────────────────────────────────────────────────
  const [tab, setTab] = useState<FilterTab>('upcoming')
  const [query, setQuery] = useState('')
  const todayIso = useMemo(() => todayIsoDate(), [])

  // Tab counts ignore the search query so the user always sees the full
  // distribution of activity across tabs. Search only affects the rendered
  // list within the active tab.
  const tabCounts = useMemo(() => {
    const counts = {} as Record<FilterTab, number>
    for (const t of TAB_ORDER) counts[t] = 0
    for (const e of events) {
      for (const t of TAB_ORDER) {
        if (matchTab(e, t, todayIso)) counts[t]++
      }
    }
    return counts
  }, [events, todayIso])

  const filteredEvents = useMemo(() => {
    const list = events.filter(
      (e) => matchTab(e, tab, todayIso) && matchSearch(e, query),
    )
    // Sort by date: 'upcoming' shows nearest-first; everything else newest-first.
    const ascending = tab === 'upcoming'
    return [...list].sort((a, b) => {
      const da = a.date.slice(0, 10)
      const db = b.date.slice(0, 10)
      if (da === db) return 0
      return ascending ? (da < db ? -1 : 1) : (da > db ? -1 : 1)
    })
  }, [events, tab, todayIso, query])

  // "全選草稿" should only select drafts inside the current filtered view —
  // selecting drafts that aren't on screen would be confusing.
  const visibleDraftIds = useMemo(
    () => filteredEvents.filter((e) => !e.isPublished).map((e) => e.id),
    [filteredEvents],
  )

  const draftIds = visibleDraftIds

  const selectionInfo = useMemo(() => {
    let drafts = 0
    let published = 0
    selected.forEach((id) => {
      const ev = events.find((e) => e.id === id)
      if (!ev) return
      ev.isPublished ? published++ : drafts++
    })
    const mixed = drafts > 0 && published > 0
    const kind: 'drafts' | 'published' | 'mixed' | 'empty' =
      selected.size === 0
        ? 'empty'
        : mixed
          ? 'mixed'
          : drafts > 0
            ? 'drafts'
            : 'published'
    return { drafts, published, mixed, kind }
  }, [selected, events])

  const allDraftsSelected =
    draftIds.length > 0 && draftIds.every((id) => selected.has(id))

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAllDrafts() {
    if (allDraftsSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(draftIds))
    }
  }

  async function bulkAction(action: 'publish_auto' | 'unpublish' | 'delete_drafts') {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    setResultMsg(null)

    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/events/bulk-publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids, action }),
        })
        const data = await res.json()
        if (!res.ok || !data.ok) {
          setResultMsg({ type: 'error', text: data.error ?? '操作失敗' })
        } else {
          const labelMap = {
            publish_auto: '自動判斷並發布',
            unpublish: '下架',
            delete_drafts: '刪除草稿',
          }
          setResultMsg({
            type: 'ok',
            text: `${labelMap[action]}：${data.affected}/${data.total} 筆生效`,
          })
          setSelected(new Set())
          router.refresh()
        }
      } catch (e) {
        setResultMsg({ type: 'error', text: e instanceof Error ? e.message : '網路錯誤' })
      }
    })
  }

  const now = useMemo(() => new Date(), [])

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

      {/* Filter tabs — horizontal scroll on narrow screens, no wrap */}
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
            placeholder="搜尋藝人 / 活動標題 / 地點"
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

      {/* Select-all-drafts button — operates on drafts inside the current filtered view */}
      {isAdmin && visibleDraftIds.length > 0 && (
        <div className="px-4 mb-2">
          <button
            onClick={toggleAllDrafts}
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-text-base transition-colors"
          >
            <CheckSquare className="h-3.5 w-3.5" />
            {allDraftsSelected ? '取消全選' : `全選此頁草稿（${visibleDraftIds.length} 筆）`}
          </button>
        </div>
      )}

      {/* Events list */}
      <div className="px-4 flex flex-col gap-2 pb-32">
        {events.length === 0 && (
          <div className="rounded-xl bg-card border border-card-border px-4 py-8 text-center">
            <p className="text-sm text-muted">尚無活動資料</p>
            <p className="text-xs text-muted/60 mt-1">
              {isAdmin ? '請使用上方「新增草稿活動」建立第一筆活動。' : '請先以管理員身份登入。'}
            </p>
          </div>
        )}
        {events.length > 0 && filteredEvents.length === 0 && (
          <div className="rounded-xl bg-card border border-card-border px-4 py-8 text-center">
            <p className="text-sm text-muted">
              {query ? '沒有符合搜尋的活動' : `「${TAB_LABELS[tab]}」分類目前沒有活動`}
            </p>
            <p className="text-xs text-muted/60 mt-1">
              試試其他分類或清除搜尋條件。
            </p>
          </div>
        )}
        {filteredEvents.map((event) => (
          <EventRow
            key={event.id}
            event={event}
            now={now}
            isAdmin={isAdmin}
            isChecked={selected.has(event.id)}
            onToggle={() => toggleOne(event.id)}
          />
        ))}
      </div>

      {/* Bulk action toolbar */}
      {isAdmin && selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 pt-3 bg-gradient-to-t from-bg via-bg/95 to-transparent">
          <div className="max-w-md mx-auto flex flex-col gap-2 rounded-2xl bg-card border border-card-border px-4 py-3 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">
                已選 <span className="text-text-base font-semibold">{selected.size}</span> 筆
                {selectionInfo.kind === 'drafts' && '（草稿）'}
                {selectionInfo.kind === 'published' && '（已發布）'}
              </span>
              <button
                onClick={() => setSelected(new Set())}
                className="text-[11px] text-muted hover:text-text-base"
              >
                取消選取
              </button>
            </div>

            {selectionInfo.kind === 'mixed' && (
              <p className="text-[11px] text-amber-400">
                混合了草稿與已發布的項目，請只選同一類型。
              </p>
            )}

            {selectionInfo.kind === 'drafts' && (
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    const ok = confirm(
                      `確定要批量發布這 ${selected.size} 筆草稿嗎？\n\n系統會自動判斷來源；官方或可靠媒體會發布到前台，聚合、社群或未知來源會保持草稿。`,
                    )
                    if (!ok) return
                    bulkAction('publish_auto')
                  }}
                  disabled={isPending}
                  className="inline-flex items-center justify-center gap-1 rounded-lg bg-violet px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 active:opacity-70 transition-opacity"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  自動判斷 + 發布
                </button>
                <p className="text-[10px] text-muted leading-snug">
                  系統會依來源類型自動設為官方或媒體；聚合、社群或未知來源會保持草稿。
                </p>
                <button
                  onClick={() => {
                    if (!confirm(`確定要永久刪除這 ${selected.size} 筆草稿嗎？此操作無法復原。`)) return
                    bulkAction('delete_drafts')
                  }}
                  disabled={isPending}
                  className="inline-flex items-center justify-center gap-1 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400 disabled:opacity-50 active:opacity-70 transition-opacity"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  刪除草稿（{selected.size} 筆）
                </button>
              </div>
            )}

            {selectionInfo.kind === 'published' && (
              <button
                onClick={() => {
                  if (!confirm(`確定要批量下架這 ${selected.size} 筆已發布活動嗎？下架後會回到草稿，不會出現在前台。`)) return
                  bulkAction('unpublish')
                }}
                disabled={isPending}
                className="inline-flex items-center justify-center gap-1 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400 disabled:opacity-50 active:opacity-70 transition-opacity"
              >
                <X className="h-3.5 w-3.5" />
                批量下架
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function EventRow({
  event,
  now,
  isAdmin,
  isChecked,
  onToggle,
}: {
  event: AdminEvent
  now: Date
  isAdmin: boolean
  isChecked: boolean
  onToggle: () => void
}) {
  const isPast = new Date(event.date) < now
  const trustConfig = SOURCE_CONFIG[event.trustLevel] ?? SOURCE_CONFIG['official']
  const typeLabel = EVENT_TYPE_LABELS[event.type as keyof typeof EVENT_TYPE_LABELS] ?? event.type

  const statusColors: Record<string, string> = {
    confirmed: 'text-emerald-400',
    tentative: 'text-amber-400',
    postponed: 'text-orange-400',
    cancelled: 'text-red-400 line-through',
  }

  const publishedLabel = event.isPublished
    ? event.publishedAt
      ? `已發布 ${event.publishedAt.slice(0, 10)}`
      : '已發布'
    : '尚未發布'

  const publishedBadgeCls = event.isPublished
    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'

  return (
    <div className="relative flex items-stretch gap-2">
      {isAdmin && (
        <button
          onClick={onToggle}
          className="flex-shrink-0 flex items-center justify-center w-8 rounded-xl bg-card border border-card-border active:opacity-70 transition-opacity"
          aria-label={isChecked ? '取消選取' : '選取'}
        >
          <div
            className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${
              isChecked ? 'bg-violet border-violet' : 'border-card-border bg-transparent'
            }`}
          >
            {isChecked && <Check className="h-2.5 w-2.5 text-white" />}
          </div>
        </button>
      )}

      <Link
        href={`/admin/events/${event.id}`}
        className={`flex-1 rounded-xl bg-card border px-4 py-3 flex flex-col gap-1.5 active:opacity-70 transition-opacity ${
          isChecked ? 'border-violet/50' : 'border-card-border'
        } ${isPast && event.isPublished ? 'opacity-50' : ''}`}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-semibold ${trustConfig.color}`}>
            {trustConfig.label}
          </span>
          <span className="text-[10px] text-muted border border-card-border rounded px-1.5 py-0.5">
            {typeLabel}
          </span>
          <span className="ml-auto text-[10px] text-muted tabular-nums">
            {event.countryFlag} {event.date.slice(0, 10)}
          </span>
        </div>
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-text-base leading-snug">{event.title}</p>
          <ChevronRight className="h-4 w-4 text-muted flex-shrink-0 mt-0.5" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted">{event.idolName}</span>
          <span className={`text-[10px] font-medium ${statusColors[event.status] ?? 'text-muted'}`}>
            {event.status}
          </span>
          <span className={`ml-auto text-[10px] rounded px-1.5 py-0.5 border ${publishedBadgeCls}`}>
            {publishedLabel}
          </span>
        </div>
      </Link>
    </div>
  )
}

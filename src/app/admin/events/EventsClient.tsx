'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronRight, Check, X, CheckSquare, ShieldCheck, Newspaper,
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
  isPublished: boolean
  publishedAt: string | null
  sourceCount: number
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

  const draftIds = useMemo(
    () => events.filter((e) => !e.isPublished).map((e) => e.id),
    [events],
  )

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

  async function bulkAction(action: 'publish_official' | 'publish_media' | 'unpublish') {
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
            publish_official: '設為官方並發布',
            publish_media: '設為媒體並發布',
            unpublish: '下架',
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

      {/* Select-all-drafts button */}
      {isAdmin && draftIds.length > 0 && (
        <div className="px-4 mb-2">
          <button
            onClick={toggleAllDrafts}
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-text-base transition-colors"
          >
            <CheckSquare className="h-3.5 w-3.5" />
            {allDraftsSelected ? '取消全選' : `全選草稿（${draftIds.length} 筆）`}
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
        {events.map((event) => (
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
              <div className="flex gap-2">
                <button
                  onClick={() => bulkAction('publish_official')}
                  disabled={isPending}
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-violet px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 active:opacity-70 transition-opacity"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  設官方 + 發布
                </button>
                <button
                  onClick={() => bulkAction('publish_media')}
                  disabled={isPending}
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 active:opacity-70 transition-opacity"
                >
                  <Newspaper className="h-3.5 w-3.5" />
                  設媒體 + 發布
                </button>
              </div>
            )}

            {selectionInfo.kind === 'published' && (
              <button
                onClick={() => bulkAction('unpublish')}
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

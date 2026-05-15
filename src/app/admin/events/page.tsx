export const dynamic = 'force-dynamic'

import Link from 'next/link'
import {
  ArrowLeft, CalendarCheck, ShieldCheck, Newspaper,
  Clock, ChevronRight, FilePlus, FileEdit, CheckCircle2,
} from 'lucide-react'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { EVENT_TYPE_LABELS, SOURCE_CONFIG } from '@/lib/mockEvents'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'
import type { TrustLevel } from '@/lib/types'

// ── Admin-only event shape (includes draft fields) ────────────────────────────

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

// Fetches ALL events (including drafts) using the server client so the
// admin session cookie is forwarded and the "events: admin_users select"
// RLS policy grants access.
async function getAdminEvents(): Promise<{ events: AdminEvent[]; error: string | null }> {
  const supabase = getSupabaseServerClient()
  if (!supabase) {
    return {
      events: [],
      error: 'Supabase 環境變數未設定（NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY）',
    }
  }

  const { data, error } = await supabase
    .from('events')
    .select('id, idol_name, title, type, status, trust_level, date, country_flag, is_published, published_at, event_sources(id)')
    .order('date', { ascending: false })

  if (error) {
    return {
      events: [],
      error: `查詢活動失敗：${error.code ? `[${error.code}] ` : ''}${error.message}`,
    }
  }

  const events: AdminEvent[] = (data ?? []).map((row) => ({
    id: row.id as string,
    idolName: row.idol_name as string,
    title: row.title as string,
    type: row.type as string,
    status: row.status as string,
    trustLevel: row.trust_level as TrustLevel,
    date: row.date as string,
    countryFlag: row.country_flag as string,
    isPublished: row.is_published as boolean,
    publishedAt: row.published_at as string | null,
    sourceCount: Array.isArray(row.event_sources) ? row.event_sources.length : 0,
  }))

  return { events, error: null }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminEventsPage() {
  const [{ isAdmin }, { events, error }] = await Promise.all([
    getCurrentAdmin(),
    getAdminEvents(),
  ])

  const now = new Date()
  const draftCount = events.filter((e) => !e.isPublished).length
  const publishedCount = events.filter((e) => e.isPublished).length
  const officialCount = events.filter((e) => e.trustLevel === 'official').length
  const upcomingCount = events.filter((e) => new Date(e.date) >= now).length

  return (
    <div className="flex flex-col gap-0 pt-12 pb-6">
      {/* Header */}
      <div className="px-4 mb-4">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-text-base mb-3"
        >
          <ArrowLeft className="h-3 w-3" />
          Admin Dashboard
        </Link>
        <div className="flex items-center gap-2">
          <CalendarCheck className="h-5 w-5 text-violet" />
          <h1 className="text-xl font-bold text-text-base">後台活動列表</h1>
        </div>
        <p className="text-xs text-muted mt-1">
          共 {events.length} 筆活動
          {events.length > 0 && (
            <span className="ml-1">
              （<span className="text-amber-400">{draftCount} 草稿</span>
              {' / '}
              <span className="text-emerald-400">{publishedCount} 已發布</span>）
            </span>
          )}
        </p>
      </div>

      {/* Admin action / read-only banner */}
      <div className="px-4 mb-4 flex flex-col gap-2">
        {isAdmin ? (
          <Link
            href="/admin/events/new"
            className="flex items-center gap-2 rounded-xl bg-violet/15 border border-violet/30 px-3 py-2.5 hover:bg-violet/20 transition-colors"
          >
            <FilePlus className="h-4 w-4 text-violet flex-shrink-0" />
            <span className="text-xs font-semibold text-violet">新增草稿活動</span>
          </Link>
        ) : (
          <div className="rounded-xl bg-violet/10 border border-violet/25 px-3 py-2.5">
            <p className="text-xs text-muted leading-snug">
              目前為只讀後台預覽。新增 / 編輯需要管理員登入。
            </p>
          </div>
        )}
      </div>

      {/* Query error */}
      {error && (
        <div className="px-4 mb-4">
          <div className="rounded-xl bg-red-500/10 border border-red-500/25 px-3 py-3">
            <p className="text-xs font-semibold text-red-400 mb-1">活動列表載入失敗</p>
            <p className="text-xs text-red-400/80 break-all leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {/* Summary stats */}
      <div className="px-4 grid grid-cols-2 gap-3 mb-4">
        <MiniStat icon={<FileEdit className="h-3.5 w-3.5" />} label="草稿" value={draftCount} color="text-amber-400" />
        <MiniStat icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="已發布" value={publishedCount} color="text-emerald-400" />
        <MiniStat icon={<ShieldCheck className="h-3.5 w-3.5" />} label="官方確認" value={officialCount} color="text-violet" />
        <MiniStat icon={<Clock className="h-3.5 w-3.5" />} label="即將到來" value={upcomingCount} color="text-primary" />
      </div>

      {/* Events list */}
      <div className="px-4 flex flex-col gap-2">
        {events.length === 0 && !error && (
          <div className="rounded-xl bg-card border border-card-border px-4 py-8 text-center">
            <p className="text-sm text-muted">尚無活動資料</p>
            <p className="text-xs text-muted/60 mt-1">
              {isAdmin ? '請使用上方「新增草稿活動」建立第一筆活動。' : '請先以管理員身份登入。'}
            </p>
          </div>
        )}
        {events.map((event) => (
          <EventRow key={event.id} event={event} now={now} />
        ))}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MiniStat({
  icon,
  label,
  value,
  color = 'text-violet',
}: {
  icon: React.ReactNode
  label: string
  value: number
  color?: string
}) {
  return (
    <div className="rounded-xl bg-card border border-card-border px-3 py-3 flex items-center gap-3">
      <span className={color}>{icon}</span>
      <div>
        <p className="text-base font-bold text-text-base leading-none">{value}</p>
        <p className="text-[10px] text-muted mt-0.5">{label}</p>
      </div>
    </div>
  )
}

function EventRow({ event, now }: { event: AdminEvent; now: Date }) {
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
    <Link
      href={`/admin/events/${event.id}`}
      className={`rounded-xl bg-card border border-card-border px-4 py-3 flex flex-col gap-1.5 active:opacity-70 transition-opacity ${isPast && event.isPublished ? 'opacity-50' : ''}`}
    >
      {/* Top row: trust badge + type + date */}
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

      {/* Title + chevron */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-text-base leading-snug">{event.title}</p>
        <ChevronRight className="h-4 w-4 text-muted flex-shrink-0 mt-0.5" />
      </div>

      {/* Bottom row: idol + status + publish badge */}
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
  )
}

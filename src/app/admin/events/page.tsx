export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { ArrowLeft, CalendarCheck, ShieldCheck, Newspaper, Clock } from 'lucide-react'
import { getPublishedEvents } from '@/lib/supabase/events'
import { getVisibleEvents, EVENT_TYPE_LABELS, SOURCE_CONFIG } from '@/lib/mockEvents'
import type { Event, TrustLevel } from '@/lib/types'

export default async function AdminEventsPage() {
  const supabaseEvents = await getPublishedEvents()
  const events: Event[] = supabaseEvents.length > 0 ? supabaseEvents : getVisibleEvents()

  const now = new Date()
  const officialCount = events.filter((e) => e.source.level === 'official').length
  const mediaCount = events.filter((e) => e.source.level === 'media').length
  const upcomingCount = events.filter((e) => new Date(e.date) >= now).length

  const sorted = [...events].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

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
        <p className="text-xs text-muted mt-1">共 {events.length} 筆已發布活動</p>
      </div>

      {/* Read-only banner */}
      <div className="px-4 mb-4">
        <div className="rounded-xl bg-violet/10 border border-violet/25 px-3 py-2.5">
          <p className="text-xs text-muted leading-snug">
            目前為只讀後台預覽，尚未啟用管理員登入與寫入權限。不提供新增、編輯、刪除。
          </p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="px-4 grid grid-cols-2 gap-3 mb-4">
        <MiniStat icon={<CalendarCheck className="h-3.5 w-3.5" />} label="活動總數" value={events.length} />
        <MiniStat icon={<ShieldCheck className="h-3.5 w-3.5" />} label="官方確認" value={officialCount} color="text-emerald-400" />
        <MiniStat icon={<Newspaper className="h-3.5 w-3.5" />} label="媒體確認" value={mediaCount} color="text-blue-400" />
        <MiniStat icon={<Clock className="h-3.5 w-3.5" />} label="即將到來" value={upcomingCount} color="text-primary" />
      </div>

      {/* Events list */}
      <div className="px-4 flex flex-col gap-2">
        {sorted.map((event) => (
          <EventRow key={event.id} event={event} now={now} />
        ))}
      </div>
    </div>
  )
}

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

function EventRow({ event, now }: { event: Event; now: Date }) {
  const isPast = new Date(event.date) < now
  const trustConfig = SOURCE_CONFIG[event.source.level as TrustLevel]
  const typeLabel = EVENT_TYPE_LABELS[event.type] ?? event.type

  const statusColors: Record<string, string> = {
    confirmed: 'text-emerald-400',
    tentative: 'text-amber-400',
    postponed: 'text-orange-400',
    cancelled: 'text-red-400 line-through',
  }

  return (
    <div className={`rounded-xl bg-card border border-card-border px-4 py-3 flex flex-col gap-1.5 ${isPast ? 'opacity-50' : ''}`}>
      {/* Top row: trust badge + type + date */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[10px] font-semibold ${trustConfig.color}`}>
          {trustConfig.label}
        </span>
        <span className="text-[10px] text-muted border border-card-border rounded px-1.5 py-0.5">
          {typeLabel}
        </span>
        <span className="ml-auto text-[10px] text-muted tabular-nums">{event.date.slice(0, 10)}</span>
      </div>

      {/* Title */}
      <p className="text-sm font-semibold text-text-base leading-snug">{event.title}</p>

      {/* Bottom row: idol + status + published */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted">{event.idolName}</span>
        <span className={`text-[10px] font-medium ${statusColors[event.status] ?? 'text-muted'}`}>
          {event.status}
        </span>
        <span className="ml-auto text-[10px] rounded px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          published
        </span>
      </div>
    </div>
  )
}

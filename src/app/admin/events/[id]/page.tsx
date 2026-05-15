export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { ArrowLeft, Eye } from 'lucide-react'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import {
  getEventById as getMockEvent,
  EVENT_TYPE_LABELS,
  EVENT_SUBTYPE_LABELS,
  SOURCE_CONFIG,
} from '@/lib/mockEvents'
import type {
  Event, TrustLevel, EventSubType, EventType, EventStatus, SourceType,
} from '@/lib/types'

// Fetches any event by UUID, including unpublished drafts.
// Uses the server client so the admin's session cookie is forwarded to Supabase,
// allowing the "events: admin_users select" RLS policy to grant access.
async function getAdminEvent(id: string): Promise<Event | null> {
  const supabase = getSupabaseServerClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('events')
    .select('*, idols(slug), event_sources(id, event_id, level, label, type, url)')
    .eq('id', id)
    .single()

  if (error || !data) return null

  const row = data as {
    id: string; idol_id: string; idol_name: string; title: string
    type: string; sub_type: string | null; status: string; trust_level: string
    date: string; time: string | null; location: string | null
    country: string; country_flag: string; description: string | null
    tags: string[] | null; ticket_url: string | null; stream_url: string | null
    is_published: boolean
    idols?: { slug: string } | null
    event_sources?: Array<{
      id: string; event_id: string; level: string
      label: string; type: string | null; url: string | null
    }> | null
  }

  const primarySource = row.event_sources?.[0]
  const source = primarySource
    ? {
        level: primarySource.level as TrustLevel,
        label: primarySource.label,
        type: (primarySource.type ?? undefined) as SourceType | undefined,
        url: primarySource.url ?? undefined,
      }
    : { level: row.trust_level as TrustLevel, label: row.idol_name }

  return {
    id: row.id,
    idolId: row.idols?.slug ?? row.idol_id,
    idolName: row.idol_name,
    title: row.title,
    type: row.type as EventType,
    subType: (row.sub_type ?? undefined) as EventSubType | undefined,
    status: row.status as EventStatus,
    date: row.date,
    time: row.time ?? undefined,
    location: row.location ?? undefined,
    country: row.country,
    countryFlag: row.country_flag,
    source,
    description: row.description ?? '',
    isFavorited: false,
    ticketUrl: row.ticket_url ?? undefined,
    streamUrl: row.stream_url ?? undefined,
    tags: row.tags ?? [],
  }
}

export default async function AdminEventDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const { id } = params

  // Try Supabase (includes drafts); fall back to mock for dev UUIDs
  let event: Event | null = await getAdminEvent(id)
  if (!event) {
    event = getMockEvent(id) ?? null
  }

  if (!event) {
    return (
      <div className="flex flex-col gap-0 pt-12 pb-6 px-4">
        <Link
          href="/admin/events"
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-text-base mb-6"
        >
          <ArrowLeft className="h-3 w-3" />
          返回活動列表
        </Link>
        <div className="rounded-xl bg-card border border-card-border px-4 py-8 text-center">
          <p className="text-sm text-muted">找不到活動</p>
          <p className="text-xs text-muted/60 mt-1">ID: {id}</p>
        </div>
      </div>
    )
  }

  const trustConfig = SOURCE_CONFIG[event.source.level as TrustLevel]
  const typeLabel = EVENT_TYPE_LABELS[event.type] ?? event.type
  const subTypeLabel = event.subType
    ? (EVENT_SUBTYPE_LABELS[event.subType as EventSubType] ?? event.subType)
    : null

  const statusColors: Record<string, string> = {
    confirmed: 'text-emerald-400',
    tentative: 'text-amber-400',
    postponed: 'text-orange-400',
    cancelled: 'text-red-400',
  }

  return (
    <div className="flex flex-col gap-0 pt-12 pb-6">
      {/* Header */}
      <div className="px-4 mb-4">
        <Link
          href="/admin/events"
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-text-base mb-3"
        >
          <ArrowLeft className="h-3 w-3" />
          返回活動列表
        </Link>
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-violet" />
          <h1 className="text-xl font-bold text-text-base">活動詳情預覽</h1>
        </div>
      </div>

      {/* Read-only banner */}
      <div className="px-4 mb-4">
        <div className="rounded-xl bg-violet/10 border border-violet/25 px-3 py-2.5">
          <p className="text-xs text-muted leading-snug">
            只讀預覽｜目前為後台唯讀，尚未啟用管理員登入與寫入權限。
          </p>
        </div>
      </div>

      {/* Main card */}
      <div className="px-4 flex flex-col gap-3">

        {/* Title block */}
        <div className="rounded-xl bg-card border border-card-border px-4 py-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-semibold ${trustConfig.color}`}>
              {trustConfig.label}
            </span>
            <span className="text-[10px] text-muted border border-card-border rounded px-1.5 py-0.5">
              {typeLabel}
            </span>
            {subTypeLabel && (
              <span className="text-[10px] text-muted border border-card-border rounded px-1.5 py-0.5">
                {subTypeLabel}
              </span>
            )}
          </div>
          <h2 className="text-base font-bold text-text-base leading-snug">{event.title}</h2>
          <p className="text-xs text-muted">{event.idolName}</p>
        </div>

        {/* Details grid */}
        <div className="rounded-xl bg-card border border-card-border px-4 py-4 flex flex-col gap-3">
          <Field label="狀態">
            <span className={`text-sm font-medium ${statusColors[event.status] ?? 'text-muted'}`}>
              {event.status}
            </span>
          </Field>
          <Divider />
          <Field label="日期">{event.date.slice(0, 10)}</Field>
          {event.time && <><Divider /><Field label="時間">{event.time}</Field></>}
          <Divider />
          <Field label="國家 / 地區">
            {event.countryFlag} {event.country}
          </Field>
          {event.location && <><Divider /><Field label="地點">{event.location}</Field></>}
        </div>

        {/* Source */}
        <div className="rounded-xl bg-card border border-card-border px-4 py-4 flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide">來源資訊</p>
          <Field label="來源名稱">{event.source.label}</Field>
          {event.source.type && <><Divider /><Field label="來源類型">{event.source.type}</Field></>}
          <Divider />
          <Field label="可信度">
            <span className={trustConfig.color}>{trustConfig.label}</span>
            <span className="text-xs text-muted/60 ml-1">— {trustConfig.desc}</span>
          </Field>
          {event.source.url && (
            <>
              <Divider />
              <Field label="來源 URL">
                <a
                  href={event.source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-violet underline underline-offset-2 break-all"
                >
                  {event.source.url}
                </a>
              </Field>
            </>
          )}
        </div>

        {/* URLs */}
        {(event.ticketUrl || event.streamUrl) && (
          <div className="rounded-xl bg-card border border-card-border px-4 py-4 flex flex-col gap-3">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide">連結</p>
            {event.ticketUrl && (
              <Field label="票務 URL">
                <a
                  href={event.ticketUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-violet underline underline-offset-2 break-all"
                >
                  {event.ticketUrl}
                </a>
              </Field>
            )}
            {event.ticketUrl && event.streamUrl && <Divider />}
            {event.streamUrl && (
              <Field label="串流 URL">
                <a
                  href={event.streamUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-violet underline underline-offset-2 break-all"
                >
                  {event.streamUrl}
                </a>
              </Field>
            )}
          </div>
        )}

        {/* Tags */}
        {event.tags && event.tags.length > 0 && (
          <div className="rounded-xl bg-card border border-card-border px-4 py-4 flex flex-col gap-2">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide">標籤</p>
            <div className="flex flex-wrap gap-1.5">
              {event.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] rounded-full border border-card-border px-2 py-0.5 text-muted"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        {event.description && (
          <div className="rounded-xl bg-card border border-card-border px-4 py-4 flex flex-col gap-2">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide">說明</p>
            <p className="text-xs text-text-base leading-relaxed">{event.description}</p>
          </div>
        )}

        {/* Internal ID */}
        <div className="rounded-xl bg-card border border-card-border px-4 py-3">
          <Field label="Event ID">
            <span className="font-mono text-[10px] text-muted/60 break-all">{event.id}</span>
          </Field>
        </div>

      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <p className="text-xs text-muted flex-shrink-0 w-20">{label}</p>
      <div className="text-xs text-text-base text-right flex-1">{children}</div>
    </div>
  )
}

function Divider() {
  return <div className="h-px bg-card-border" />
}

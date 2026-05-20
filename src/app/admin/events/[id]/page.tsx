export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { ArrowLeft, Eye, AlertTriangle, Send, EyeOff, FileEdit } from 'lucide-react'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'
import {
  getEventById as getMockEvent,
  SOURCE_CONFIG,
} from '@/lib/mockEvents'
import type { TrustLevel, EventSubType, EventType, EventStatus, SourceType } from '@/lib/types'
import EventTypeBadge from '@/components/EventTypeBadge'
import { publishEvent, unpublishEvent } from './actions'
import GenerateChineseButton from './GenerateChineseButton'
import MarkReviewedButton from './MarkReviewedButton'

// ── Admin-only types (not exported — used only in this page) ──────────────────

interface AdminEventSource {
  id: string
  level: TrustLevel
  label: string
  type: SourceType | null
  url: string | null
  createdAt: string
}

interface AdminEventDetail {
  id: string
  idolId: string
  idolName: string
  title: string
  displayTitleZh?: string
  displaySummaryZh?: string
  locationNameZh?: string
  translationStatus: string
  type: EventType
  subType?: EventSubType
  status: EventStatus
  trustLevel: TrustLevel
  date: string
  startDate?: string
  endDate?: string
  dateLabel?: string
  time?: string
  location?: string
  city?: string
  venueName?: string
  address?: string
  mapUrl?: string
  country: string
  countryFlag: string
  description: string
  tags: string[]
  ticketUrl?: string
  streamUrl?: string
  // Admin-only fields
  isPublished: boolean
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  sources: AdminEventSource[]
}

// ── Data fetcher ──────────────────────────────────────────────────────────────

async function getAdminEvent(id: string): Promise<AdminEventDetail | null> {
  const supabase = getSupabaseServerClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('events')
    .select('*, idols(slug), event_sources(id, event_id, level, label, type, url, created_at)')
    .eq('id', id)
    .single()

  if (error || !data) return null

  const row = data as {
    id: string; idol_id: string; idol_name: string; title: string
    display_title_zh: string | null; display_summary_zh: string | null
    location_name_zh: string | null; translation_status: string | null
    type: string; sub_type: string | null; status: string; trust_level: string
    date: string; start_date: string | null; end_date: string | null
    date_label: string | null; time: string | null; location: string | null
    city: string | null; venue_name: string | null; address: string | null; map_url: string | null
    country: string; country_flag: string; description: string | null
    tags: string[] | null; ticket_url: string | null; stream_url: string | null
    is_published: boolean; published_at: string | null
    created_at: string; updated_at: string
    idols?: { slug: string } | null
    event_sources?: Array<{
      id: string; event_id: string; level: string
      label: string; type: string | null; url: string | null; created_at: string
    }> | null
  }

  const sources: AdminEventSource[] = (row.event_sources ?? []).map((s) => ({
    id: s.id,
    level: s.level as TrustLevel,
    label: s.label,
    type: (s.type ?? null) as SourceType | null,
    url: s.url ?? null,
    createdAt: s.created_at,
  }))

  return {
    id: row.id,
    idolId: row.idols?.slug ?? row.idol_id,
    idolName: row.idol_name,
    title: row.title,
    displayTitleZh: row.display_title_zh ?? undefined,
    displaySummaryZh: row.display_summary_zh ?? undefined,
    locationNameZh: row.location_name_zh ?? undefined,
    translationStatus: row.translation_status ?? 'none',
    type: row.type as EventType,
    subType: (row.sub_type ?? undefined) as EventSubType | undefined,
    status: row.status as EventStatus,
    trustLevel: row.trust_level as TrustLevel,
    date: row.date,
    startDate: row.start_date ?? undefined,
    endDate: row.end_date ?? undefined,
    dateLabel: row.date_label ?? undefined,
    time: row.time ?? undefined,
    location: row.location ?? undefined,
    city: row.city ?? undefined,
    venueName: row.venue_name ?? undefined,
    address: row.address ?? undefined,
    mapUrl: row.map_url ?? undefined,
    country: row.country,
    countryFlag: row.country_flag,
    description: row.description ?? '',
    tags: row.tags ?? [],
    ticketUrl: row.ticket_url ?? undefined,
    streamUrl: row.stream_url ?? undefined,
    isPublished: row.is_published,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sources,
  }
}

// Converts a mock Event (which lacks admin fields) into AdminEventDetail with
// sensible defaults, so the mock fallback still renders correctly.
function mockToAdminDetail(id: string): AdminEventDetail | null {
  const mock = getMockEvent(id)
  if (!mock) return null
  return {
    id: mock.id,
    idolId: mock.idolId,
    idolName: mock.idolName,
    title: mock.title,
    translationStatus: 'none',
    type: mock.type,
    subType: mock.subType,
    status: mock.status,
    trustLevel: mock.source.level,
    date: mock.date,
    time: mock.time,
    location: mock.location,
    country: mock.country,
    countryFlag: mock.countryFlag,
    description: mock.description,
    tags: mock.tags,
    ticketUrl: mock.ticketUrl,
    streamUrl: mock.streamUrl,
    // Mock events are treated as published demo data
    isPublished: true,
    publishedAt: null,
    createdAt: mock.date,
    updatedAt: mock.date,
    sources: [{
      id: 'mock',
      level: mock.source.level,
      label: mock.source.label,
      type: mock.source.type ?? null,
      url: mock.source.url ?? null,
      createdAt: mock.date,
    }],
  }
}

const TRANSLATION_STATUS_LABELS: Record<string, string> = {
  none: '未產生',
  machine: '機器產生',
  reviewed: '已審閱',
  manual: '人工編輯',
}

function getEventChineseDisabledReason(event: AdminEventDetail): string | null {
  if (event.isPublished) {
    return '已發布活動不支援直接產生繁中欄位'
  }
  if (event.translationStatus === 'manual' || event.translationStatus === 'reviewed') {
    return '中文欄位已是人工編輯或已審閱狀態，不自動覆蓋'
  }
  if (event.displayTitleZh || event.displaySummaryZh || event.locationNameZh) {
    return '已有中文顯示欄位，第一版不支援覆蓋既有內容'
  }
  return null
}

function getEventReviewedDisabledReason(event: AdminEventDetail): string | null {
  if (event.translationStatus !== 'machine') {
    return '只有機器產生狀態可以標記已審閱'
  }
  if (!event.displayTitleZh && !event.displaySummaryZh && !event.locationNameZh) {
    return '缺少中文欄位，無法標記已審閱'
  }
  return null
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminEventDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const { id } = params

  const [eventResult, { isAdmin }] = await Promise.all([
    getAdminEvent(id),
    getCurrentAdmin(),
  ])

  const event: AdminEventDetail | null = eventResult ?? mockToAdminDetail(id)

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

  const trustConfig = SOURCE_CONFIG[event.trustLevel]
  const displayTitle = event.displayTitleZh || event.title
  const dateDisplay =
    event.dateLabel ||
    (event.startDate && event.endDate
      ? `${event.startDate.slice(0, 10)} - ${event.endDate.slice(0, 10)}`
      : (event.startDate ?? event.date).slice(0, 10))
  const chineseDisabledReason = getEventChineseDisabledReason(event)
  const reviewedDisabledReason = getEventReviewedDisabledReason(event)

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

      {/* Draft warning banner */}
      {!event.isPublished && (
        <div className="px-4 mb-3">
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 px-3 py-2.5 flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300 leading-snug">
              此活動目前為<span className="font-semibold">草稿</span>，不會出現在前台。
            </p>
          </div>
        </div>
      )}

      {/* Publish / Unpublish action — admin only; read-only banner for others */}
      <div className="px-4 mb-4">
        {isAdmin ? (
          event.isPublished ? (
            /* ── Unpublish button ── */
            <form action={unpublishEvent.bind(null, event.id)}>
              <button
                type="submit"
                className="w-full flex items-center gap-2 rounded-xl bg-amber-500/15 border border-amber-500/30 px-3 py-2.5 hover:bg-amber-500/25 transition-colors text-left"
              >
                <EyeOff className="h-4 w-4 text-amber-400 flex-shrink-0" />
                <span className="text-xs font-semibold text-amber-400">下架活動（取消發布）</span>
              </button>
            </form>
          ) : (
            /* ── Publish button ── */
            <form action={publishEvent.bind(null, event.id)}>
              <button
                type="submit"
                className="w-full flex items-center gap-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-3 py-2.5 hover:bg-emerald-500/25 transition-colors text-left"
              >
                <Send className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                <span className="text-xs font-semibold text-emerald-400">發布活動（立即上線）</span>
              </button>
            </form>
          )
        ) : (
          <div className="rounded-xl bg-violet/10 border border-violet/25 px-3 py-2.5">
            <p className="text-xs text-muted leading-snug">
              只讀詳情預覽｜發布 / 編輯功能規劃中
            </p>
          </div>
        )}
      </div>

      {/* Edit draft link — admin only, draft only */}
      {isAdmin && !event.isPublished && (
        <div className="px-4 mb-1">
          <Link
            href={`/admin/events/${event.id}/edit`}
            className="flex items-center gap-2 rounded-xl bg-card border border-card-border px-3 py-2.5 hover:bg-card-border/30 transition-colors"
          >
            <FileEdit className="h-4 w-4 text-muted flex-shrink-0" />
            <span className="text-xs font-medium text-muted">編輯草稿內容</span>
          </Link>
        </div>
      )}

      {/* Main card */}
      <div className="px-4 flex flex-col gap-3">

        {/* Title block */}
        <div className="rounded-xl bg-card border border-card-border px-4 py-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-semibold ${trustConfig.color}`}>
              {trustConfig.label}
            </span>
            <EventTypeBadge type={event.type} subType={event.subType} />
          </div>
          <h2 className="text-base font-bold text-text-base leading-snug">{displayTitle}</h2>
          {event.displayTitleZh && event.displayTitleZh !== event.title && (
            <p className="text-[10px] text-muted leading-snug">原文：{event.title}</p>
          )}
          <p className="text-xs text-muted">{event.idolName}</p>
        </div>

        {/* Publish status */}
        <div className="rounded-xl bg-card border border-card-border px-4 py-4 flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide">發布狀態</p>
          <Field label="狀態">
            {event.isPublished ? (
              <span className="text-emerald-400 font-medium">已發布</span>
            ) : (
              <span className="text-amber-400 font-medium">尚未發布（草稿）</span>
            )}
          </Field>
          <Divider />
          <Field label="發布時間">
            {event.publishedAt
              ? formatDatetime(event.publishedAt)
              : <span className="text-muted/60">尚未發布</span>}
          </Field>
        </div>

        {/* Event details */}
        <div className="rounded-xl bg-card border border-card-border px-4 py-4 flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide">活動資訊</p>
          <Field label="活動狀態">
            <span className={`font-medium ${statusColors[event.status] ?? 'text-muted'}`}>
              {event.status}
            </span>
          </Field>
          <Divider />
          <Field label="日期">{dateDisplay}</Field>
          {event.time && <><Divider /><Field label="時間">{event.time}</Field></>}
          <Divider />
          <Field label="國家 / 地區">
            {event.countryFlag} {event.country}
          </Field>
          {event.location && <><Divider /><Field label="地點">{event.location}</Field></>}
          {event.locationNameZh && <><Divider /><Field label="中文地點">{event.locationNameZh}</Field></>}
          {(event.city || event.venueName || event.address) && (
            <>
              <Divider />
              <Field label="地點細節">
                {[event.city, event.venueName, event.address].filter(Boolean).join(' / ')}
              </Field>
            </>
          )}
          {event.mapUrl && (
            <>
              <Divider />
              <Field label="地圖 URL">
                <a href={event.mapUrl} target="_blank" rel="noopener noreferrer" className="text-violet underline underline-offset-2 break-all">
                  {event.mapUrl}
                </a>
              </Field>
            </>
          )}
        </div>

        {(event.displayTitleZh ||
          event.displaySummaryZh ||
          event.locationNameZh ||
          event.translationStatus !== 'none' ||
          (isAdmin && !event.isPublished)) && (
          <div className="rounded-xl bg-card border border-card-border px-4 py-4 flex flex-col gap-3">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide">中文顯示</p>
            {isAdmin && !event.isPublished && (
              <>
                <GenerateChineseButton
                  eventId={event.id}
                  disabledReason={chineseDisabledReason}
                />
                {event.translationStatus === 'machine' && (
                  <MarkReviewedButton
                    eventId={event.id}
                    disabledReason={reviewedDisabledReason}
                  />
                )}
                <Divider />
              </>
            )}
            {event.displayTitleZh && <Field label="中文標題">{event.displayTitleZh}</Field>}
            {event.displayTitleZh && <Divider />}
            {event.displaySummaryZh && <Field label="中文摘要">{event.displaySummaryZh}</Field>}
            {event.displaySummaryZh && <Divider />}
            {event.locationNameZh && <Field label="中文地點">{event.locationNameZh}</Field>}
            {event.locationNameZh && <Divider />}
            <Field label="狀態">
              {TRANSLATION_STATUS_LABELS[event.translationStatus] ?? event.translationStatus}
            </Field>
          </div>
        )}

        {/* Sources */}
        {event.sources.length > 0 && (
          <div className="rounded-xl bg-card border border-card-border px-4 py-4 flex flex-col gap-3">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide">
              來源資訊（{event.sources.length} 筆）
            </p>
            {event.sources.map((src, idx) => (
              <div key={src.id} className="flex flex-col gap-2">
                {idx > 0 && <div className="h-px bg-card-border my-1" />}
                <Field label="來源名稱">{src.label}</Field>
                <Divider />
                <Field label="可信度">
                  <span className={SOURCE_CONFIG[src.level]?.color ?? 'text-muted'}>
                    {SOURCE_CONFIG[src.level]?.label ?? src.level}
                  </span>
                </Field>
                {src.type && (
                  <><Divider /><Field label="來源類型">{src.type}</Field></>
                )}
                {src.url && (
                  <>
                    <Divider />
                    <Field label="來源 URL">
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-violet underline underline-offset-2 break-all"
                      >
                        {src.url}
                      </a>
                    </Field>
                  </>
                )}
                <Divider />
                <Field label="新增時間">
                  {src.createdAt ? formatDatetime(src.createdAt) : '—'}
                </Field>
                {src.id !== 'mock' && (
                  <>
                    <Divider />
                    <Field label="來源 ID">
                      <span className="font-mono text-[10px] text-muted/60 break-all">{src.id}</span>
                    </Field>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

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
                  className="text-violet underline underline-offset-2 break-all"
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
                  className="text-violet underline underline-offset-2 break-all"
                >
                  {event.streamUrl}
                </a>
              </Field>
            )}
          </div>
        )}

        {/* Tags */}
        {event.tags.length > 0 && (
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

        {/* Time records */}
        <div className="rounded-xl bg-card border border-card-border px-4 py-4 flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide">時間紀錄</p>
          <Field label="建立時間">{formatDatetime(event.createdAt)}</Field>
          <Divider />
          <Field label="最後更新">{formatDatetime(event.updatedAt)}</Field>
        </div>

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDatetime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('zh-TW', {
      timeZone: 'Asia/Taipei',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

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

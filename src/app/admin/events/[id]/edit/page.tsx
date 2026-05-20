export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { ArrowLeft, FileEdit, Lock, AlertTriangle } from 'lucide-react'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import EditEventForm from './EditEventForm'
import type { EditEventFormProps } from './EditEventForm'

// ── Data fetchers ─────────────────────────────────────────────────────────────

async function getIdolsForForm(): Promise<{
  idols: { id: string; name: string }[]
  idolsError: string | null
}> {
  const supabase = getSupabaseServerClient()
  if (!supabase) {
    return {
      idols: [],
      idolsError: 'Supabase 環境變數未設定',
    }
  }

  const { data, error } = await supabase
    .from('idols')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  if (error) {
    return {
      idols: [],
      idolsError: `查詢偶像失敗：${error.code ? `[${error.code}] ` : ''}${error.message}`,
    }
  }

  return {
    idols: (data ?? []) as { id: string; name: string }[],
    idolsError: null,
  }
}

interface EventRow {
  id: string
  idol_id: string
  idol_name: string
  title: string
  type: string
  sub_type: string | null
  status: string
  trust_level: string
  date: string
  time: string | null
  location: string | null
  country: string
  country_flag: string
  description: string | null
  tags: string[] | null
  ticket_url: string | null
  stream_url: string | null
  is_published: boolean
  idols?: { id: string } | null
  event_sources?: Array<{
    label: string
    type: string | null
    url: string | null
  }> | null
}

async function getEventForEdit(id: string): Promise<EventRow | null> {
  const supabase = getSupabaseServerClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('events')
    .select('*, idols(id), event_sources(label, type, url)')
    .eq('id', id)
    .single()

  if (error || !data) return null
  return data as EventRow
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminEditEventPage({
  params,
}: {
  params: { id: string }
}) {
  const { id } = params

  const [{ isAdmin }, eventResult, { idols, idolsError }] = await Promise.all([
    getCurrentAdmin(),
    getEventForEdit(id),
    getIdolsForForm(),
  ])

  // ── Guard: must be admin ───────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div className="flex flex-col pt-12 pb-6 px-4 gap-4">
        <Link
          href={`/admin/events/${id}`}
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-text-base"
        >
          <ArrowLeft className="h-3 w-3" />
          返回活動詳情
        </Link>
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 px-4 py-4 flex items-start gap-3">
          <Lock className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-semibold text-amber-300">需要管理員登入</p>
            <p className="text-xs text-amber-300/70">此頁面僅限已驗證管理員使用。</p>
            <Link
              href="/admin/login"
              className="self-start text-xs font-semibold text-amber-300 underline underline-offset-2"
            >
              前往管理員登入 →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Event not found ────────────────────────────────────────────────────────
  if (!eventResult) {
    return (
      <div className="flex flex-col pt-12 pb-6 px-4 gap-4">
        <Link
          href="/admin/events"
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-text-base"
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

  // ── Guard: must be a draft ─────────────────────────────────────────────────
  if (eventResult.is_published) {
    return (
      <div className="flex flex-col pt-12 pb-6 px-4 gap-4">
        <Link
          href={`/admin/events/${id}`}
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-text-base"
        >
          <ArrowLeft className="h-3 w-3" />
          返回活動詳情
        </Link>
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 px-4 py-4 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-semibold text-amber-300">已發布活動暫不支援直接編輯</p>
            <p className="text-xs text-amber-300/70 leading-relaxed">
              請先在詳情頁按「下架活動」，將活動改為草稿狀態，再回來編輯。
            </p>
            <Link
              href={`/admin/events/${id}`}
              className="self-start text-xs font-semibold text-amber-300 underline underline-offset-2"
            >
              返回詳情頁 →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Build initial values for the form ─────────────────────────────────────
  const firstSource = (eventResult.event_sources ?? [])[0]

  const initial: EditEventFormProps['initial'] = {
    idolId:      eventResult.idols?.id ?? eventResult.idol_id,
    title:       eventResult.title,
    type:        eventResult.type,
    subType:     eventResult.sub_type ?? '',
    status:      eventResult.status,
    date:        eventResult.date,
    time:        eventResult.time ?? '',
    country:     eventResult.country,
    countryFlag: eventResult.country_flag,
    location:    eventResult.location ?? '',
    description: eventResult.description ?? '',
    tags:        (eventResult.tags ?? []).join(', '),
    ticketUrl:   eventResult.ticket_url ?? '',
    streamUrl:   eventResult.stream_url ?? '',
    sourceLabel: firstSource?.label ?? '',
    sourceType:  firstSource?.type ?? 'official_sns',
    sourceUrl:   firstSource?.url ?? '',
  }

  return (
    <div className="flex flex-col gap-0 pt-12 pb-6">
      {/* Header */}
      <div className="px-4 mb-4">
        <Link
          href={`/admin/events/${id}`}
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-text-base mb-3"
        >
          <ArrowLeft className="h-3 w-3" />
          返回活動詳情
        </Link>
        <div className="flex items-center gap-2">
          <FileEdit className="h-5 w-5 text-violet" />
          <h1 className="text-xl font-bold text-text-base">編輯草稿活動</h1>
        </div>
        <p className="text-xs text-muted mt-1 truncate">{eventResult.title}</p>
      </div>

      {/* Info banner */}
      <div className="px-4 mb-4">
        <div className="rounded-xl bg-violet/10 border border-violet/25 px-3 py-2.5">
          <p className="text-xs text-muted leading-snug">
            只可編輯草稿（未發布）活動。來源資訊儲存時將全部取代。
          </p>
        </div>
      </div>

      {/* Idol query error */}
      {idolsError && (
        <div className="px-4 mb-4">
          <div className="rounded-xl bg-red-500/10 border border-red-500/25 px-3 py-3">
            <p className="text-xs font-semibold text-red-400 mb-1">偶像清單載入失敗</p>
            <p className="text-xs text-red-400/80 break-all leading-relaxed">{idolsError}</p>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="px-4">
        <EditEventForm eventId={id} idols={idols} initial={initial} />
      </div>
    </div>
  )
}

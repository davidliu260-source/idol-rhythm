export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  ExternalLink,
  Globe2,
  MapPin,
  Radio,
  Sparkles,
  Ticket,
  Tv,
} from 'lucide-react'
import {
  EVENT_SUBTYPE_LABELS,
  EVENT_TYPE_LABELS,
  getEventById as getMockEventById,
  type Event,
} from '@/lib/mockEvents'
import { getIdolById } from '@/lib/mockIdols'
import { getEventById as getSupabaseEventById } from '@/lib/supabase/events'
import { getEventDateLabel } from '@/lib/eventDisplay'
import {
  EventDetailFavoriteBtn,
  EventDetailReminderBtn,
  EventDetailShareBtn,
} from '@/components/EventDetailActions'

export default async function EventDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabaseEvent = await getSupabaseEventById(params.id)
  const event = supabaseEvent ?? getMockEventById(params.id)
  if (!event) return notFound()

  const idol = getIdolById(event.idolId)
  const dateLabel = getEventDateLabel(event)
  const isDemoEvent = !supabaseEvent
  const summaryText = event.displaySummaryZh?.trim() || event.description.trim()
  const hasLocalizedSummary = Boolean(event.displaySummaryZh?.trim())
  const typeLabel = getTypeLabel(event)
  const statusLabel = getStatusLabel(event)
  const venueLabel =
    event.venueName ||
    event.location ||
    event.originalLocation ||
    extractLocationFromSummary(event.description) ||
    event.city ||
    event.country
  const locationLine = [event.city, event.country].filter(Boolean).join(', ')
  const trackCode = getTrackCode(event.id)
  const coverTitle = getCoverTitle(event)
  const shareText = `${event.idolName} · ${event.title}`

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_14%_0%,rgba(255,83,171,0.16),transparent_24%),linear-gradient(180deg,#141019_0%,#08070d_100%)] pb-8 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:34px_34px] opacity-35" />

      <div className="relative mx-auto flex w-full max-w-[520px] flex-col gap-4 px-4 pt-10">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/schedule"
            className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-3 py-2 text-sm font-medium text-white/72 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </Link>

          <div className="flex items-center gap-2">
            <EventDetailShareBtn title={event.title} text={shareText} />
            <EventDetailReminderBtn eventId={event.id} />
            <EventDetailFavoriteBtn eventId={event.id} />
          </div>
        </div>

        {isDemoEvent && (
          <div className="rounded-[18px] border border-amber-300/20 bg-amber-300/10 px-3.5 py-3 text-xs leading-relaxed text-amber-100">
            <span className="font-semibold">Demo 展示資料</span>
            <span className="text-amber-100/72"> ｜非真實官方行程，請以官方 SNS 或購票平台公告為準</span>
          </div>
        )}

        <section className="relative overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(33,27,39,0.96),rgba(18,15,24,0.98))] p-4 shadow-[0_22px_80px_rgba(0,0,0,0.42)]">
          <div className="pointer-events-none absolute inset-0 opacity-[0.16] [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.8)_1px,transparent_0)] [background-size:13px_13px]" />
          <div className="pointer-events-none absolute inset-0 rounded-[26px] border border-white/6" />
          <div className="absolute inset-y-0 left-5 w-7 bg-[linear-gradient(180deg,rgba(255,96,154,0.86),rgba(148,92,255,0.74))]" />

          <div className="relative pl-12">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/52">IR-{trackCode}</p>
                <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-white/38">IDOL · RHYTHM</p>
              </div>
              <div className="rounded-md border border-[#ff5aa8]/45 px-2 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-[#ff79bd]">
                TRK · 01
              </div>
            </div>

            <div className="mb-5">
              <p className="text-[42px] font-black uppercase leading-none tracking-normal text-[#ff5f9f]">
                {event.idolName}
              </p>
              <h1 className="mt-4 text-[34px] font-black uppercase leading-[1.03] tracking-normal text-white">
                {coverTitle}
              </h1>
            </div>

            <div className="border-t border-white/12 pt-4">
              <p className="text-[22px] font-black uppercase tracking-normal text-[#a77bff]">
                {event.city || event.country}
              </p>
              <p className="mt-1 text-sm font-semibold uppercase tracking-normal text-white/78">
                {locationLine || venueLabel}
              </p>
            </div>

            <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.025] p-3">
              <div className="flex items-start gap-2 text-xs text-white/74">
                <CalendarDays className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[#ff86c4]" />
                <span>{dateLabel}{event.time ? ` · ${event.time}` : ''}</span>
              </div>
              {venueLabel && (
                <div className="mt-2 flex items-start gap-2 text-xs text-white/62">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[#ff86c4]" />
                  <span>{venueLabel}</span>
                </div>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <CassetteSpec label="Status" value={statusLabel} tone="green" />
              <CassetteSpec label="Type" value={typeLabel} tone="violet" />
            </div>

            <div className="mt-4 flex items-end justify-between gap-3 text-[10px] uppercase tracking-[0.16em] text-white/36">
              <span>© 2026 Idol Rhythm</span>
              <span>VOL.05 · 2026</span>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 rounded-[22px] border border-white/8 bg-white/[0.035] p-4 sm:grid-cols-3">
          <InfoTile
            icon={<CalendarDays className="h-4 w-4" />}
            label="日期 / 時間"
            value={`${dateLabel}${event.time ? ` · ${event.time}` : ''}`}
            meta={event.endDate ? '多日行程' : undefined}
          />
          <InfoTile
            icon={<Globe2 className="h-4 w-4" />}
            label="地點 / 場館"
            value={venueLabel || event.country}
            meta={locationLine || event.country}
          />
          <InfoTile
            icon={<Clock3 className="h-4 w-4" />}
            label="狀態"
            value={statusLabel}
            meta={typeLabel}
          />
        </section>

        {summaryText && (
          <section className="rounded-[22px] border border-white/8 bg-white/[0.035] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#ff86c4]" />
                <h2 className="text-sm font-semibold text-white">
                  {hasLocalizedSummary ? '本地化摘要' : '原始摘要'}
                </h2>
              </div>
              <span className="rounded-full border border-white/8 bg-white/[0.04] px-2 py-1 text-[10px] font-medium text-white/42">
                {hasLocalizedSummary ? '依使用者語言顯示' : '原文'}
              </span>
            </div>
            <p className="text-sm leading-6 text-white/78">{summaryText}</p>
            {event.originalTitle && (
              <div className="mt-4 rounded-2xl border border-white/8 bg-black/10 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/34">Original title</p>
                <p className="mt-1 text-xs leading-5 text-white/58">{event.originalTitle}</p>
              </div>
            )}
          </section>
        )}

        <section className="rounded-[22px] border border-white/8 bg-white/[0.035] p-4">
          <h2 className="mb-3 text-sm font-semibold text-white">資訊來源</h2>
          <SourceLine
            tone={event.source.level === 'official' ? 'green' : 'blue'}
            title={event.source.level === 'official' ? '官方確認' : '媒體確認'}
            label={event.source.label}
            description={event.source.type ? getSourceTypeLabel(event.source.type) : '來源已通過前台顯示規則'}
          />
          {event.source.url && (
            <a
              href={event.source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/72"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              查看來源
            </a>
          )}
        </section>

        <section className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <ActionLink
            icon={<Ticket className="h-4 w-4" />}
            label="票務 & 購票"
            subLabel={event.ticketUrl ? '前往連結' : '連結待補'}
            href={event.ticketUrl}
          />
          <ActionLink
            icon={<Tv className="h-4 w-4" />}
            label="官方 & 更多"
            subLabel={event.streamUrl || event.source.url ? '前往連結' : '連結待補'}
            href={event.streamUrl || event.source.url}
          />
          <ShareAction title={event.title} text={shareText} />
        </section>
      </div>
    </div>
  )
}

function CassetteSpec({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'green' | 'violet'
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/10 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/36">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <span className={tone === 'green' ? 'h-2 w-2 rounded-full bg-emerald-300' : 'h-2 w-2 rounded-full bg-violet-300'} />
        <span className={tone === 'green' ? 'text-xs font-semibold text-emerald-300' : 'text-xs font-semibold text-violet-300'}>
          {value}
        </span>
      </div>
    </div>
  )
}

function InfoTile({
  icon,
  label,
  value,
  meta,
}: {
  icon: React.ReactNode
  label: string
  value: string
  meta?: string
}) {
  return (
    <div className="flex gap-3 sm:flex-col">
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-white/8 bg-white/[0.04] text-[#b6a9ff]">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-white/40">{label}</p>
        <p className="mt-1 text-sm font-semibold leading-5 text-white">{value}</p>
        {meta && <p className="mt-1 text-xs leading-4 text-white/42">{meta}</p>}
      </div>
    </div>
  )
}

function SourceLine({
  tone,
  title,
  label,
  description,
}: {
  tone: 'green' | 'blue'
  title: string
  label: string
  description: string
}) {
  return (
    <div className="flex gap-3">
      <span className={tone === 'green' ? 'mt-1 h-2.5 w-2.5 rounded-full bg-emerald-300' : 'mt-1 h-2.5 w-2.5 rounded-full bg-sky-300'} />
      <div className="min-w-0">
        <p className={tone === 'green' ? 'text-sm font-semibold text-emerald-300' : 'text-sm font-semibold text-sky-300'}>
          {title}
          <span className="font-normal text-white/44"> · {label}</span>
        </p>
        <p className="mt-1 text-xs leading-5 text-white/42">{description}</p>
      </div>
    </div>
  )
}

function ActionLink({
  icon,
  label,
  subLabel,
  href,
}: {
  icon: React.ReactNode
  label: string
  subLabel: string
  href?: string
}) {
  const className = 'flex items-center gap-3 rounded-[18px] border border-white/8 bg-white/[0.035] px-3 py-3 text-left transition-colors'

  if (!href) {
    return (
      <div className={`${className} cursor-not-allowed opacity-55`}>
        <span className="text-[#b6a9ff]">{icon}</span>
        <div>
          <p className="text-sm font-semibold text-white">{label}</p>
          <p className="text-xs text-white/38">{subLabel}</p>
        </div>
      </div>
    )
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`${className} hover:bg-white/[0.06]`}>
      <span className="text-[#b6a9ff]">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-xs text-white/38">{subLabel}</p>
      </div>
    </a>
  )
}

function ShareAction({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-[18px] border border-white/8 bg-white/[0.035] px-3 py-3">
      <EventDetailShareBtn title={title} text={text} variant="inline" />
    </div>
  )
}

function getTypeLabel(event: Event): string {
  if (event.subType && event.subType in EVENT_SUBTYPE_LABELS) {
    return EVENT_SUBTYPE_LABELS[event.subType]
  }
  return EVENT_TYPE_LABELS[event.type] || event.type
}

function getStatusLabel(event: Event): string {
  if (event.status === 'confirmed') return '官方確認'
  if (event.status === 'tentative') return '待確認'
  if (event.status === 'postponed') return '延期'
  return '已取消'
}

function getSourceTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    official_sns: '官方社群平台公告',
    official_website: '官方網站公告',
    media_outlet: '媒體或平台資訊',
    fan_account: '可靠粉絲帳號整理',
    community: '社群來源',
    unknown: '來源類型未標記',
  }
  return labels[type] ?? type
}

function getTrackCode(id: string): string {
  return id.replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase().padEnd(6, '0')
}

function getCoverTitle(event: Event): string {
  return event.title
    .replace(event.idolName, '')
    .replace(/^[\s·:-]+/, '')
    .trim() || event.title
}

function extractLocationFromSummary(description: string): string | undefined {
  const match = description.match(/Location:\s*(.+?)(?:\s+Matched idol:|\s+Source:|$)/i)
  return match?.[1]?.trim() || undefined
}

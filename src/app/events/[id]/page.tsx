export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { ExternalLink, Sparkles, Ticket, Tv } from 'lucide-react'
import { getEventById as getMockEventById } from '@/lib/mockEvents'
import { getEventById as getSupabaseEventById } from '@/lib/supabase/events'
import { EventDetailShareBtn } from '@/components/EventDetailActions'
import EventDetailHero from '@/components/EventDetailHero'
import EventDetailInfoRows from '@/components/EventDetailInfoRows'

export default async function EventDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabaseEvent = await getSupabaseEventById(params.id)
  const event = supabaseEvent ?? getMockEventById(params.id)
  if (!event) return notFound()

  const isDemoEvent = !supabaseEvent
  const summaryText = event.displaySummaryZh?.trim() || event.description.trim()
  const hasLocalizedSummary = Boolean(event.displaySummaryZh?.trim())
  const shareText = `${event.idolName} · ${event.title}`

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#08070d] pb-8 text-white">
      <div className="relative mx-auto flex w-full max-w-[520px] flex-col">
        <EventDetailHero event={event} />
        <div className="flex flex-col gap-4 px-4">
        {isDemoEvent && (
          <div className="rounded-[18px] border border-amber-300/20 bg-amber-300/10 px-3.5 py-3 text-xs leading-relaxed text-amber-100">
            <span className="font-semibold">Demo 展示資料</span>
            <span className="text-amber-100/72"> ｜非真實官方行程，請以官方 SNS 或購票平台公告為準</span>
          </div>
        )}

        <EventDetailInfoRows event={event} />

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

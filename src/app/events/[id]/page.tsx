import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  MapPin,
  Clock,
  Globe,
  ExternalLink,
  Heart,
  Share2,
  CheckCircle2,
  Sparkles,
  Tv,
  Ticket,
} from 'lucide-react'
import { getEventById, formatEventDate } from '@/lib/mockEvents'
import { getIdolById } from '@/lib/mockIdols'
import SourceBadge from '@/components/SourceBadge'
import EventTypeBadge from '@/components/EventTypeBadge'

export default function EventDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const event = getEventById(params.id)
  if (!event) return notFound()

  const idol = getIdolById(event.idolId)
  const dateLabel = formatEventDate(event.date)

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero banner */}
      <div
        className="relative h-52 flex flex-col justify-end px-4 pb-5 pt-12"
        style={{
          background: idol
            ? `linear-gradient(135deg, ${idol.color}33, ${idol.color}88)`
            : 'linear-gradient(135deg, #1e1b4b, #312e81)',
        }}
      >
        <Link
          href="/schedule"
          className="absolute top-12 left-4 flex items-center gap-1.5 text-white/80"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm">返回</span>
        </Link>

        <div className="absolute top-12 right-4 flex items-center gap-2">
          <button className="rounded-full bg-white/10 backdrop-blur-sm p-2">
            <Share2 className="h-4 w-4 text-white" />
          </button>
          <button className="rounded-full bg-white/10 backdrop-blur-sm p-2">
            <Heart
              className={`h-4 w-4 ${event.isFavorited ? 'fill-primary text-primary' : 'text-white'}`}
            />
          </button>
        </div>

        <div className="flex items-end gap-3">
          <div
            className="h-16 w-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white ring-2 ring-white/20 flex-shrink-0"
            style={{
              background: idol
                ? `linear-gradient(135deg, ${idol.color}66, ${idol.color})`
                : '#4c1d95',
            }}
          >
            {event.idolName.charAt(0)}
          </div>
          <div>
            <p className="text-xs text-white/60 font-medium">{event.idolName}</p>
            <div className="flex items-center gap-2 mt-1">
              <EventTypeBadge type={event.type} size="md" />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-5 flex flex-col gap-4">

        {/* Demo data notice */}
        <div className="flex items-start gap-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 px-3 py-2.5">
          <span className="text-amber-400 text-sm leading-none mt-0.5">⚠️</span>
          <p className="text-xs text-amber-300 leading-snug">
            <span className="font-semibold">Demo 展示資料</span>
            ｜非真實官方行程，請以官方 SNS 或購票平台公告為準
          </p>
        </div>

        {/* Title & confirmed status */}
        <div>
          <h1 className="text-lg font-bold text-text-base leading-snug">{event.title}</h1>
          <div className="flex items-center gap-2 mt-2">
            {event.confirmed ? (
              <span className="flex items-center gap-1 text-xs text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                已確認
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-amber-400">
                ⚠ 待確認，資訊可能變動
              </span>
            )}
          </div>
        </div>

        {/* Info grid */}
        <div className="rounded-2xl border border-card-border bg-card p-4 flex flex-col gap-3">
          <InfoRow
            icon={<Clock className="h-4 w-4" />}
            label="日期時間"
            value={`${dateLabel}${event.time ? ` · ${event.time}` : ''}`}
          />
          <InfoRow
            icon={<Globe className="h-4 w-4" />}
            label="地區"
            value={`${event.countryFlag} ${event.country}`}
          />
          {event.location && (
            <InfoRow
              icon={<MapPin className="h-4 w-4" />}
              label="地點"
              value={event.location}
            />
          )}
        </div>

        {/* AI summary mock */}
        <div className="rounded-2xl border border-violet-500/25 bg-violet-500/5 p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <Sparkles className="h-3.5 w-3.5 text-violet-400" />
            <span className="text-xs font-semibold text-violet-400">AI 繁中摘要</span>
            <span className="ml-auto text-[10px] text-muted bg-card border border-card-border px-1.5 py-0.5 rounded-full">
              Demo
            </span>
          </div>
          <p className="text-sm text-text-base leading-relaxed">{event.description}</p>
          {event.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {event.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-violet-500/10 border border-violet-500/20 px-2.5 py-0.5 text-xs text-violet-300"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Source */}
        <div className="rounded-2xl border border-card-border bg-card p-4">
          <h2 className="text-xs font-semibold text-muted mb-2.5">資訊來源</h2>
          <SourceBadge source={event.source} label={event.sourceLabel} showDesc size="md" />
        </div>

        {/* Ticket info */}
        {event.ticketUrl && (
          <div className="rounded-2xl border border-orange-500/25 bg-orange-500/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Ticket className="h-4 w-4 text-orange-400" />
              <h2 className="text-xs font-semibold text-orange-400">票務資訊</h2>
            </div>
            <a
              href={event.ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-bold text-white"
            >
              <ExternalLink className="h-4 w-4" />
              前往購票
            </a>
          </div>
        )}

        {/* Streaming info */}
        {event.streamUrl && (
          <div className="rounded-2xl border border-indigo-500/25 bg-indigo-500/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Tv className="h-4 w-4 text-indigo-400" />
              <h2 className="text-xs font-semibold text-indigo-400">串流 / 直播資訊</h2>
            </div>
            <a
              href={event.streamUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-bold text-white"
            >
              <ExternalLink className="h-4 w-4" />
              前往觀看
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-muted flex-shrink-0">{icon}</span>
      <div className="flex-1 flex items-center justify-between gap-2">
        <span className="text-xs text-muted">{label}</span>
        <span className="text-sm text-text-base font-medium text-right">{value}</span>
      </div>
    </div>
  )
}

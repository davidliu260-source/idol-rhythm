export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Calendar, Users, Building2, Globe } from 'lucide-react'
import { getIdolBySlug, getPublishedEvents } from '@/lib/supabase/events'
import IdolAvatar from '@/components/IdolAvatar'
import EventCard from '@/components/EventCard'
import FollowIdolButton from './FollowIdolButton'

/**
 * F5: Public idol detail page at `/idols/[slug]`.
 *
 * Renders:
 *   - Hero (avatar / name / korean name / agency / follow button)
 *   - Description card (if any)
 *   - Meta card (debut / member count / type / category)
 *   - Upcoming events for this idol
 *   - Past events (collapsed visually)
 *
 * Inactive idols return notFound() — see getIdolBySlug.
 */
export default async function IdolDetailPage({
  params,
}: {
  params: { slug: string }
}) {
  const idol = await getIdolBySlug(params.slug)
  if (!idol) return notFound()

  const allEvents = await getPublishedEvents()
  const idolEvents = allEvents.filter((e) => e.idolId === idol.id)

  const now = new Date()
  const upcoming = idolEvents
    .filter((e) => new Date(e.date) >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const past = idolEvents
    .filter((e) => new Date(e.date) < now)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const typeLabel =
    idol.type === 'group' ? '團體 Group' : idol.type === 'solo' ? '個人 Solo' : ''

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero — tinted by idol color */}
      <div
        className="relative px-4 pt-12 pb-6"
        style={{
          background: `linear-gradient(135deg, ${idol.color}22, ${idol.color}55)`,
        }}
      >
        <Link
          href="/idols"
          className="inline-flex items-center gap-1.5 text-xs text-white/80 mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          返回偶像列表
        </Link>

        <div className="flex items-end gap-4">
          <IdolAvatar
            name={idol.name}
            avatarUrl={idol.avatarUrl}
            color={idol.color}
            size="lg"
            className="ring-2 ring-white/20"
          />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-text-base leading-tight truncate">
              {idol.name}
            </h1>
            {idol.koreanName && (
              <p className="text-sm text-muted mt-0.5 truncate">{idol.koreanName}</p>
            )}
            {idol.agency && (
              <p className="text-xs text-muted/80 mt-0.5 truncate">{idol.agency}</p>
            )}
          </div>
        </div>

        <div className="mt-4">
          <FollowIdolButton idolSlug={idol.id} idolName={idol.name} />
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-5 flex flex-col gap-5 flex-1">
        {/* Meta info */}
        {(idol.type || idol.memberCount || idol.debut || idol.category) && (
          <div className="rounded-2xl border border-card-border bg-card p-4 grid grid-cols-2 gap-3">
            {typeLabel && (
              <MetaRow icon={<Users className="h-3.5 w-3.5" />} label="類型" value={typeLabel} />
            )}
            {idol.memberCount && (
              <MetaRow
                icon={<Users className="h-3.5 w-3.5" />}
                label="成員"
                value={`${idol.memberCount} 人`}
              />
            )}
            {idol.debut && (
              <MetaRow
                icon={<Calendar className="h-3.5 w-3.5" />}
                label="出道"
                value={idol.debut}
              />
            )}
            {idol.agency && (
              <MetaRow
                icon={<Building2 className="h-3.5 w-3.5" />}
                label="經紀公司"
                value={idol.agency}
              />
            )}
            {idol.category && (
              <MetaRow
                icon={<Globe className="h-3.5 w-3.5" />}
                label="分類"
                value={CATEGORY_LABELS[idol.category] ?? idol.category}
              />
            )}
          </div>
        )}

        {/* Description */}
        {idol.description && (
          <div className="rounded-2xl border border-card-border bg-card p-4">
            <h2 className="text-xs font-semibold text-muted mb-2">關於</h2>
            <p className="text-sm text-text-base leading-relaxed whitespace-pre-line">
              {idol.description}
            </p>
          </div>
        )}

        {/* Upcoming events */}
        <section>
          <h2 className="text-sm font-semibold text-text-base mb-3">
            即將到來{upcoming.length > 0 && ` · ${upcoming.length} 場`}
          </h2>
          {upcoming.length === 0 ? (
            <div className="rounded-2xl border border-card-border bg-card px-4 py-6 text-center">
              <p className="text-sm text-muted">目前沒有公開行程</p>
              <Link
                href="/schedule"
                className="mt-1 inline-block text-xs text-primary"
              >
                看看其他偶像 →
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {upcoming.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </section>

        {/* Past events (collapsed visual weight) */}
        {past.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-muted mb-3">
              已結束 · {past.length} 場
            </h2>
            <div className="flex flex-col gap-2 opacity-60">
              {past.slice(0, 10).map((event) => (
                <EventCard key={event.id} event={event} compact />
              ))}
              {past.length > 10 && (
                <p className="text-[11px] text-muted/60 text-center pt-1">
                  以上為最近 10 筆已結束行程
                </p>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

const CATEGORY_LABELS: Record<string, string> = {
  kpop: 'K-Pop',
  cpop: 'C-Pop',
  jpop: 'J-Pop',
  idol: 'Idol',
  other: 'Other',
}

function MetaRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted/70 mt-0.5 flex-shrink-0">{icon}</span>
      <div className="flex flex-col min-w-0">
        <span className="text-[10px] text-muted uppercase tracking-wide">{label}</span>
        <span className="text-xs text-text-base truncate">{value}</span>
      </div>
    </div>
  )
}

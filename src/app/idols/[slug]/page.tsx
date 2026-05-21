export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Building2,
  Calendar,
  ChevronRight,
  Globe,
  Sparkles,
  Star,
  Users,
} from 'lucide-react'
import IdolAvatar from '@/components/IdolAvatar'
import EventCard from '@/components/EventCard'
import { SCHEDULE_ARCHIVE_SHELL } from '@/app/schedule/scheduleTheme'
import { getIdolBySlug, getPublishedEvents } from '@/lib/supabase/events'
import FollowIdolButton from './FollowIdolButton'
import clsx from 'clsx'

export default async function IdolDetailPage({
  params,
}: {
  params: { slug: string }
}) {
  const idol = await getIdolBySlug(params.slug)
  if (!idol) return notFound()

  const allEvents = await getPublishedEvents()
  const idolEvents = allEvents.filter((event) => event.idolId === idol.id)

  const now = new Date()
  const upcoming = idolEvents
    .filter((event) => new Date(event.date) >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const past = idolEvents
    .filter((event) => new Date(event.date) < now)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const typeLabel =
    idol.type === 'group' ? '團體 Group' : idol.type === 'solo' ? '個人 Solo' : ''

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_12%_0%,rgba(255,90,174,0.16),transparent_24%),linear-gradient(180deg,#17111d_0%,#09070d_100%)] pb-28 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:34px_34px] opacity-24" />

      <div className="relative mx-auto flex w-full max-w-[520px] flex-col gap-4 px-4 pb-6 pt-8">
        <Link
          href="/idols"
          className="inline-flex items-center gap-2 self-start rounded-full border border-white/8 bg-white/[0.04] px-3 py-2 text-sm font-medium text-white/72 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          返回名冊
        </Link>

        <section className={clsx(SCHEDULE_ARCHIVE_SHELL, 'px-5 py-5')}>
          <div className="pointer-events-none absolute inset-0 rounded-[28px] border border-white/6" />
          <div
            className="pointer-events-none absolute inset-y-6 left-5 w-1 rounded-full opacity-95"
            style={{
              background: `linear-gradient(180deg, ${idol.color}, rgba(255,255,255,0.38))`,
            }}
          />

          <div className="relative pl-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-white/34">
                  ARTIST DOSSIER
                </p>
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#ff8bc8]">
                  ARCHIVE DETAIL
                </p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/44">
                {idol.category ? CATEGORY_LABELS[idol.category] ?? idol.category : 'Idol'}
              </span>
            </div>

            <div className="mt-5 flex items-end gap-4">
              <IdolAvatar
                name={idol.name}
                avatarUrl={idol.avatarUrl}
                color={idol.color}
                size="lg"
                className="ring-2 ring-white/16"
              />
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-[34px] font-black leading-none text-white">
                  {idol.name}
                </h1>
                {idol.koreanName && (
                  <p className="mt-2 truncate text-sm text-white/56">{idol.koreanName}</p>
                )}
                {idol.agency && (
                  <p className="mt-1 truncate text-xs text-white/46">{idol.agency}</p>
                )}
              </div>
            </div>

            <div className="mt-5">
              <FollowIdolButton idolSlug={idol.id} idolName={idol.name} />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-3 gap-2">
          <StatTile label="即將到來" value={`${upcoming.length}`} accent="pink" />
          <StatTile label="已歸檔" value={`${past.length}`} accent="violet" />
          <StatTile
            label="成員"
            value={idol.memberCount ? `${idol.memberCount}` : '—'}
            accent="slate"
          />
        </section>

        {(idol.type || idol.memberCount || idol.debut || idol.category || idol.agency) && (
          <section className="rounded-[26px] border border-white/8 bg-white/[0.035] p-5">
            <SectionHeader
              icon={<Star className="h-4 w-4 text-[#ff8bc8]" />}
              title="檔案資訊"
            />
            <div className="grid grid-cols-2 gap-3">
              {typeLabel && (
                <MetaCard icon={<Users className="h-4 w-4" />} label="類型" value={typeLabel} />
              )}
              {idol.memberCount && (
                <MetaCard
                  icon={<Users className="h-4 w-4" />}
                  label="成員"
                  value={`${idol.memberCount} 人`}
                />
              )}
              {idol.debut && (
                <MetaCard
                  icon={<Calendar className="h-4 w-4" />}
                  label="出道"
                  value={idol.debut}
                />
              )}
              {idol.agency && (
                <MetaCard
                  icon={<Building2 className="h-4 w-4" />}
                  label="經紀公司"
                  value={idol.agency}
                />
              )}
              {idol.category && (
                <MetaCard
                  icon={<Globe className="h-4 w-4" />}
                  label="分類"
                  value={CATEGORY_LABELS[idol.category] ?? idol.category}
                />
              )}
            </div>
          </section>
        )}

        {idol.description && (
          <section className="rounded-[26px] border border-white/8 bg-white/[0.035] p-5">
            <SectionHeader
              icon={<Sparkles className="h-4 w-4 text-[#ff8bc8]" />}
              title="關於這位偶像"
            />
            <p className="text-sm leading-7 text-white/72 whitespace-pre-line">
              {idol.description}
            </p>
          </section>
        )}

        <section className="rounded-[26px] border border-white/8 bg-white/[0.035] p-5">
          <SectionHeader
            icon={<Calendar className="h-4 w-4 text-[#ff8bc8]" />}
            title="即將到來"
            count={upcoming.length}
          />
          {upcoming.length === 0 ? (
            <EmptyState
              title="目前沒有公開行程"
              body="這位偶像目前沒有已公開確認的未來活動。"
              href="/schedule"
              label="看看其他行程"
            />
          ) : (
            <div className="space-y-2">
              {upcoming.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </section>

        {past.length > 0 && (
          <section className="rounded-[26px] border border-white/8 bg-white/[0.035] p-5">
            <SectionHeader
              icon={<Calendar className="h-4 w-4 text-white/68" />}
              title="已歸檔"
              count={past.length}
              dimmed
            />
            <div className="space-y-2 opacity-70">
              {past.slice(0, 10).map((event) => (
                <EventCard key={event.id} event={event} compact />
              ))}
            </div>
            {past.length > 10 && (
              <p className="mt-3 text-center text-[11px] text-white/38">
                目前先顯示最近 10 筆已歸檔行程
              </p>
            )}
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

function StatTile({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent: 'pink' | 'violet' | 'slate'
}) {
  return (
    <div
      className={clsx(
        'rounded-[18px] border px-3 py-3',
        accent === 'pink' && 'border-[#ff6cb7]/20 bg-[#ff4ca1]/10',
        accent === 'violet' && 'border-violet-300/16 bg-violet-400/10',
        accent === 'slate' && 'border-white/8 bg-white/[0.035]',
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/40">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black leading-none text-white">{value}</p>
    </div>
  )
}

function SectionHeader({
  icon,
  title,
  count,
  dimmed = false,
}: {
  icon: React.ReactNode
  title: string
  count?: number
  dimmed?: boolean
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      {icon}
      <h2 className={clsx('text-sm font-bold', dimmed ? 'text-white/72' : 'text-white')}>
        {title}
      </h2>
      {count !== undefined && (
        <span className={clsx('text-xs font-medium', dimmed ? 'text-white/38' : 'text-[#ff8bc8]')}>
          {count}
        </span>
      )}
    </div>
  )
}

function MetaCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-[20px] border border-white/8 bg-black/10 px-4 py-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex-shrink-0 text-white/46">{icon}</span>
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/34">
            {label}
          </p>
          <p className="mt-1 text-sm font-semibold text-white/78">{value}</p>
        </div>
      </div>
    </div>
  )
}

function EmptyState({
  title,
  body,
  href,
  label,
}: {
  title: string
  body: string
  href: string
  label: string
}) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-black/10 px-4 py-6 text-center">
      <p className="text-base font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-white/52">{body}</p>
      <Link
        href={href}
        className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#ff8bc8]"
      >
        {label}
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  )
}

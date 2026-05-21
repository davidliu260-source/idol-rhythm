export const dynamic = 'force-dynamic'

import Link from 'next/link'
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Heart,
  ListMusic,
  Sparkles,
  Star,
} from 'lucide-react'
import { getPublishedEvents, getActiveIdols } from '@/lib/supabase/events'
import { getEventDateLabel } from '@/lib/eventDisplay'
import { type Event } from '@/lib/mockEvents'
import HomePersonalized from '@/components/HomePersonalized'
import HomeTimeline from '@/components/HomeTimeline'
import { SCHEDULE_ARCHIVE_SHELL } from './schedule/scheduleTheme'
import clsx from 'clsx'

export default async function HomePage() {
  const [events, idols] = await Promise.all([
    getPublishedEvents(),
    getActiveIdols(),
  ])

  const today = new Date()
  const dateStr = formatToday(today)
  const todayEvents = events.filter((event) => isSameDay(event.date, today))
  const upcomingEvents = events
    .filter((event) => isFutureOrToday(event.date))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const spotlight = todayEvents[0] ?? upcomingEvents[0] ?? events[0]
  const nextSevenDays = upcomingEvents.filter((event) => isWithinDays(event.date, 7))

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_12%_0%,rgba(255,90,174,0.16),transparent_24%),linear-gradient(180deg,#17111d_0%,#09070d_100%)] pb-28 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:34px_34px] opacity-24" />

      <div className="relative mx-auto flex w-full max-w-[520px] flex-col gap-5 px-4 pt-8">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-white/34">
              IDOL · RHYTHM
            </p>
            <h1 className="mt-2 text-[34px] font-black leading-none tracking-normal text-white">
              今日檔案
            </h1>
            <p className="mt-2 text-sm text-white/52">{dateStr}</p>
          </div>
          <button
            type="button"
            aria-label="通知"
            className="relative flex h-12 w-12 items-center justify-center rounded-full border border-white/8 bg-white/[0.045] text-white/64"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-[#ff4ca1]" />
          </button>
        </header>

        <section className={clsx(SCHEDULE_ARCHIVE_SHELL, 'px-5 py-5')}>
          <div className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.85)_1px,transparent_0)] [background-size:13px_13px]" />
          <div className="pointer-events-none absolute inset-0 rounded-[28px] border border-white/6" />

          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[#ff8bc8]">
                TODAY ARCHIVE
              </p>
              <h2 className="mt-3 text-2xl font-black leading-tight text-white">
                {spotlight ? '今天從這裡開始追' : '今天暫無公開活動'}
              </h2>
              <p className="mt-2 text-sm leading-6 text-white/58">
                {spotlight
                  ? '先看最近一筆已公開確認行程，再往下掃你的追蹤、提醒和收藏。'
                  : '目前沒有可顯示的公開確認行程，資料更新後會出現在這裡。'}
              </p>
            </div>
            <div className="rounded-full border border-[#ff6cb7]/24 bg-[#ff4ca1]/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#ff8bc8]">
              VOL.05
            </div>
          </div>

          <div className="relative mt-5 grid grid-cols-3 gap-2">
            <HomeStat label="今日" value={todayEvents.length} tone="pink" />
            <HomeStat label="7 日內" value={nextSevenDays.length} tone="violet" />
            <HomeStat label="已公開" value={events.length} tone="slate" />
          </div>

          {spotlight && (
            <SpotlightCard event={spotlight} isToday={todayEvents.some((event) => event.id === spotlight.id)} />
          )}
        </section>

        <section className="grid grid-cols-3 gap-2">
          <QuickAccess
            href="/schedule"
            icon={<ListMusic className="h-4 w-4" />}
            label="行程"
            meta="Tracklist"
          />
          <QuickAccess
            href="/favorites"
            icon={<Heart className="h-4 w-4" />}
            label="收藏"
            meta="Archive"
          />
          <QuickAccess
            href="/idols"
            icon={<Star className="h-4 w-4" />}
            label="偶像"
            meta="Roster"
          />
        </section>

        <HomePersonalized events={events} idols={idols} />
        <HomeTimeline events={events} idols={idols} />
      </div>
    </div>
  )
}

function HomeStat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'pink' | 'violet' | 'slate'
}) {
  return (
    <div
      className={clsx(
        'rounded-[18px] border px-3 py-3',
        tone === 'pink' && 'border-[#ff6cb7]/20 bg-[#ff4ca1]/10',
        tone === 'violet' && 'border-violet-300/16 bg-violet-400/10',
        tone === 'slate' && 'border-white/8 bg-white/[0.035]',
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/40">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black leading-none text-white">{value}</p>
    </div>
  )
}

function SpotlightCard({ event, isToday }: { event: Event; isToday: boolean }) {
  const dateLabel = getEventDateLabel(event)
  const locationLabel = event.venueName || event.location || event.city || event.country

  return (
    <Link
      href={`/events/${event.id}`}
      className="relative mt-5 block overflow-hidden rounded-[24px] border border-[#ff6cb7]/18 bg-[linear-gradient(180deg,rgba(48,34,56,0.92),rgba(25,18,31,0.98))] p-4 transition-transform active:scale-[0.99]"
    >
      <div className="absolute inset-y-4 left-0 w-1 rounded-r-full bg-[linear-gradient(180deg,rgba(255,108,183,0.92),rgba(130,94,255,0.75))]" />
      <div className="relative pl-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold uppercase tracking-normal text-[#ff6cb7]">
              {event.idolName}
            </p>
            <h3 className="mt-1 text-xl font-black leading-tight text-white">
              {event.title}
            </h3>
          </div>
          <span className="flex-shrink-0 rounded-full border border-white/12 bg-white/[0.045] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/52">
            TRK 01
          </span>
        </div>

        <div className="mt-4 rounded-[18px] border border-white/10 bg-white/[0.035] px-3 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <CalendarDays className="h-4 w-4 text-[#ff8bc8]" />
            <span>{isToday ? '今天' : dateLabel}{event.time ? ` · ${event.time}` : ''}</span>
          </div>
          {locationLabel && (
            <p className="mt-2 text-xs leading-5 text-white/46">{locationLabel}</p>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/8 pt-3">
          <span className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.24em] text-white/38">
            <Sparkles className="h-3.5 w-3.5 text-[#ff8bc8]" />
            NOW SPINNING
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-white/62">
            查看詳情
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </Link>
  )
}

function QuickAccess({
  href,
  icon,
  label,
  meta,
}: {
  href: string
  icon: React.ReactNode
  label: string
  meta: string
}) {
  return (
    <Link
      href={href}
      className="rounded-[20px] border border-white/8 bg-white/[0.035] px-3 py-3 text-left transition-colors hover:bg-white/[0.055]"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/8 bg-white/[0.045] text-[#ff8bc8]">
        {icon}
      </span>
      <p className="mt-3 text-sm font-bold text-white">{label}</p>
      <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white/34">
        {meta}
      </p>
    </Link>
  )
}

function formatToday(date: Date): string {
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日 週${weekdays[date.getDay()]}`
}

function isSameDay(dateStr: string, compareDate: Date): boolean {
  const date = new Date(dateStr)
  return (
    date.getFullYear() === compareDate.getFullYear() &&
    date.getMonth() === compareDate.getMonth() &&
    date.getDate() === compareDate.getDate()
  )
}

function isFutureOrToday(dateStr: string): boolean {
  const date = new Date(dateStr)
  date.setHours(23, 59, 59, 999)
  return date.getTime() >= Date.now()
}

function isWithinDays(dateStr: string, days: number): boolean {
  const date = new Date(dateStr)
  const now = new Date()
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() + days)
  return date >= now && date <= cutoff
}

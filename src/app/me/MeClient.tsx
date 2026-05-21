'use client'

import Link from 'next/link'
import { useState } from 'react'
import clsx from 'clsx'
import {
  Bell,
  Calendar,
  ChevronRight,
  Heart,
  LibraryBig,
  Loader2,
  LogIn,
  LogOut,
  Shield,
  Sparkles,
  Star,
  User,
} from 'lucide-react'
import IdolAvatar from '@/components/IdolAvatar'
import { SCHEDULE_ARCHIVE_SHELL } from '@/app/schedule/scheduleTheme'
import { useAppState } from '@/lib/appState'
import { getBrowserSupabaseClient } from '@/lib/supabase/browserClient'
import { getEventDateLabel } from '@/lib/eventDisplay'
import type { Idol } from '@/lib/mockIdols'
import type { Event } from '@/lib/mockEvents'

const MAX_FOLLOWING = 6
const MAX_FAVORITES = 4
const MAX_REMINDERS = 4

export default function MeClient({
  idols,
  events,
}: {
  idols: Idol[]
  events: Event[]
}) {
  const { following, favorites, reminders, user, isUserLoading } = useAppState()

  if (isUserLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4 pb-6 pt-12 text-sm text-white/60">
        <div className="flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-4 py-2.5">
          <Loader2 className="h-4 w-4 animate-spin" />
          載入中…
        </div>
      </div>
    )
  }

  const followingIdols = idols.filter((idol) => following.has(idol.id))
  const now = new Date()
  const upcomingFollowedEvents = events
    .filter((event) => following.has(event.idolId) && new Date(event.date) >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const reminderEvents = events
    .filter((event) => reminders.has(event.id) && new Date(event.date) >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const favoriteEvents = events
    .filter((event) => favorites.has(event.id) && new Date(event.date) >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  if (!user) {
    return (
      <ConsoleShell>
        <section className={clsx(SCHEDULE_ARCHIVE_SHELL, 'px-5 py-5')}>
          <div className="pointer-events-none absolute inset-0 rounded-[28px] border border-white/6" />
          <div className="relative">
            <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-white/34">
              PRIVATE CONSOLE
            </p>
            <div className="mt-4 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#ff6cb7]/25 bg-[#ff4ca1]/12 text-[#ff6cb7]">
                <User className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-[34px] font-black leading-none text-white">
                  我的控制台
                </h1>
                <p className="mt-2 text-sm text-white/58">
                  登入後把追蹤、收藏、提醒和通知都收進同一個 archive。
                </p>
              </div>
            </div>
          </div>

          <div className="relative mt-5 grid grid-cols-3 gap-2">
            <ConsoleStat label="追蹤" value="0" accent="pink" />
            <ConsoleStat label="收藏" value="0" accent="violet" />
            <ConsoleStat label="提醒" value="0" accent="slate" />
          </div>
        </section>

        <section className="rounded-[26px] border border-white/8 bg-white/[0.035] p-5 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-white/8 bg-white/[0.04] text-white/72">
            <LibraryBig className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-xl font-black text-white">尚未登入</h2>
          <p className="mt-2 text-sm leading-6 text-white/56">
            登入後可以同步你的追蹤、收藏與提醒，之後手機版通知也會從這裡接上。
          </p>
          <Link
            href="/login?next=/me"
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#ff6cb7]/24 bg-[#ff4ca1]/14 px-4 py-2.5 text-sm font-semibold text-[#ff9ed3]"
          >
            <LogIn className="h-4 w-4" />
            登入 / 註冊
          </Link>
        </section>
      </ConsoleShell>
    )
  }

  return (
    <ConsoleShell>
      <section className={clsx(SCHEDULE_ARCHIVE_SHELL, 'px-5 py-5')}>
        <div className="pointer-events-none absolute inset-0 rounded-[28px] border border-white/6" />
        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-white/34">
                PRIVATE CONSOLE
              </p>
              <div className="mt-4 flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#ff6cb7]/25 bg-[#ff4ca1]/12 text-[#ff6cb7]">
                  <Sparkles className="h-5 w-5" />
                </span>
                <div>
                  <h1 className="text-[34px] font-black leading-none text-white">
                    我的控制台
                  </h1>
                  <p className="mt-2 text-sm text-white/58">
                    把追蹤、收藏、提醒和通知入口集中在這裡。
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-[18px] border border-emerald-400/18 bg-emerald-400/10 px-3 py-2 text-right">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-emerald-200/60">
                Session
              </p>
              <p className="mt-1 text-xs font-semibold text-emerald-200">已登入</p>
            </div>
          </div>

          <div className="mt-5 rounded-[22px] border border-white/8 bg-white/[0.035] px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/8 bg-[linear-gradient(135deg,rgba(255,105,180,0.38),rgba(124,58,237,0.42))] text-xl font-black text-white">
                {(user.email ?? 'I').slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">帳號</p>
                <p className="mt-1 break-all text-xs text-white/56">{user.email ?? '—'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-3 gap-2">
          <ConsoleStat label="追蹤" value={`${following.ids.length}`} accent="pink" />
          <ConsoleStat label="收藏" value={`${favorites.ids.length}`} accent="violet" />
          <ConsoleStat label="提醒" value={`${reminders.ids.length}`} accent="slate" />
        </div>
      </section>

      <section
        id="notifications"
        className="rounded-[26px] border border-white/8 bg-white/[0.035] p-5"
      >
        <SectionHeader
          icon={<Bell className="h-4 w-4 text-[#ff8bc8]" />}
          title="提醒與通知"
          count={reminders.ids.length}
          href="/schedule"
          actionLabel="管理提醒"
        />
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <div className="rounded-[22px] border border-white/8 bg-white/[0.04] px-4 py-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-white/40">
              Notification Deck
            </p>
            <p className="mt-3 text-lg font-black text-white">
              {reminders.ids.length > 0 ? `目前有 ${reminders.ids.length} 則活動提醒` : '目前還沒有活動提醒'}
            </p>
            <p className="mt-2 text-sm leading-6 text-white/56">
              首頁右上角鈴鐺會先反映這裡的提醒數量。之後 app 化時，活動即將到來的手機通知也會從這個入口延伸。
            </p>
          </div>
          <div className="rounded-[22px] border border-white/8 bg-black/10 px-4 py-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-white/40">
              Next Up
            </p>
            {reminderEvents.length > 0 ? (
              <div className="mt-3 space-y-2">
                {reminderEvents.slice(0, 2).map((event) => (
                  <CompactEventLine key={event.id} event={event} tone="violet" />
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-white/50">
                還沒有設定提醒。先從行程頁把想追的活動標成提醒。
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-[26px] border border-white/8 bg-white/[0.035] p-5">
        <SectionHeader
          icon={<Star className="h-4 w-4 text-[#ff8bc8]" />}
          title="追蹤中的偶像"
          count={following.ids.length}
          href="/idols"
          actionLabel="管理偶像"
        />
        {followingIdols.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {followingIdols.slice(0, MAX_FOLLOWING).map((idol) => (
              <Link
                key={idol.id}
                href="/idols"
                className="flex items-center gap-3 rounded-[22px] border border-white/8 bg-black/10 px-4 py-3 transition-colors hover:bg-white/[0.04]"
              >
                <IdolAvatar
                  name={idol.name}
                  avatarUrl={idol.avatarUrl}
                  color={idol.color}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{idol.name}</p>
                  <p className="truncate text-xs text-white/48">{idol.agency}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-white/34" />
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            text="還沒有追蹤偶像。之後首頁的專屬行程、提醒與收藏會以你的追蹤名單為中心。"
            href="/idols"
            label="去選偶像"
          />
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[26px] border border-white/8 bg-white/[0.035] p-5">
          <SectionHeader
            icon={<Heart className="h-4 w-4 text-[#ff8bc8]" />}
            title="我的收藏"
            count={favorites.ids.length}
            href="/favorites"
            actionLabel="全部收藏"
          />
          {favoriteEvents.length > 0 ? (
            <div className="space-y-2">
              {favoriteEvents.slice(0, MAX_FAVORITES).map((event) => (
                <CompactEventLine key={event.id} event={event} tone="pink" />
              ))}
            </div>
          ) : (
            <EmptyState
              text="還沒有收藏活動。從行程或詳情頁收進你的 archive shelf。"
              href="/favorites"
              label="去收藏頁"
            />
          )}
        </div>

        <div className="rounded-[26px] border border-white/8 bg-white/[0.035] p-5">
          <SectionHeader
            icon={<Calendar className="h-4 w-4 text-[#ff8bc8]" />}
            title="近期追蹤行程"
            count={upcomingFollowedEvents.length}
            href="/schedule"
            actionLabel="完整行程"
          />
          {upcomingFollowedEvents.length > 0 ? (
            <div className="space-y-2">
              {upcomingFollowedEvents.slice(0, MAX_REMINDERS).map((event) => (
                <CompactEventLine key={event.id} event={event} tone="slate" />
              ))}
            </div>
          ) : (
            <EmptyState
              text="追蹤中的偶像目前沒有公開確認的未來行程。"
              href="/schedule"
              label="去行程頁"
            />
          )}
        </div>
      </section>

      <section className="rounded-[26px] border border-white/8 bg-white/[0.035] p-5">
        <SectionHeader
          icon={<Shield className="h-4 w-4 text-[#ff8bc8]" />}
          title="帳號與設定"
          href="/me"
          actionLabel="系統狀態"
        />
        <div className="space-y-2">
          <MenuRow
            icon={<Bell className="h-4 w-4" />}
            label="通知設定"
            desc="之後 app 化時，活動即將來臨的手機通知會從這裡延伸。"
          />
          <MenuRow
            icon={<Shield className="h-4 w-4" />}
            label="隱私與帳號"
            desc="維持目前登入狀態與個人資料同步。"
          />
        </div>
        <div className="mt-4">
          <SignOutButton />
        </div>
      </section>
    </ConsoleShell>
  )
}

function ConsoleShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_12%_0%,rgba(255,90,174,0.16),transparent_24%),linear-gradient(180deg,#17111d_0%,#09070d_100%)] pb-28 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:34px_34px] opacity-24" />
      <div className="relative mx-auto flex w-full max-w-[520px] flex-col gap-4 px-4 pb-6 pt-8">
        {children}
      </div>
    </div>
  )
}

function ConsoleStat({
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
  href,
  actionLabel,
}: {
  icon: React.ReactNode
  title: string
  count?: number
  href: string
  actionLabel: string
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      {icon}
      <h2 className="text-sm font-bold text-white">{title}</h2>
      {count !== undefined && count > 0 && (
        <span className="text-xs font-medium text-[#ff8bc8]">{count}</span>
      )}
      <Link
        href={href}
        className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-white/42"
      >
        {actionLabel}
        <ChevronRight className="h-3 w-3" />
      </Link>
    </div>
  )
}

function CompactEventLine({
  event,
  tone,
}: {
  event: Event
  tone: 'pink' | 'violet' | 'slate'
}) {
  const accent =
    tone === 'pink'
      ? 'text-[#ff95cf]'
      : tone === 'violet'
        ? 'text-violet-200'
        : 'text-white/72'
  const location = event.venueName || event.location || event.city || event.country

  return (
    <Link
      href={`/events/${event.id}`}
      className="block rounded-[20px] border border-white/8 bg-black/10 px-4 py-3 transition-colors hover:bg-white/[0.04]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={clsx('truncate text-xs font-semibold', accent)}>{event.idolName}</p>
          <p className="mt-1 line-clamp-2 text-sm font-semibold leading-6 text-white">
            {event.title}
          </p>
          <p className="mt-2 text-xs text-white/48">
            {getEventDateLabel(event)}
            {location ? ` · ${location}` : ''}
          </p>
        </div>
        <ChevronRight className="mt-1 h-4 w-4 flex-shrink-0 text-white/28" />
      </div>
    </Link>
  )
}

function EmptyState({
  text,
  href,
  label,
}: {
  text: string
  href: string
  label: string
}) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-black/10 px-4 py-4">
      <p className="text-sm leading-6 text-white/52">{text}</p>
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

function MenuRow({
  icon,
  label,
  desc,
}: {
  icon: React.ReactNode
  label: string
  desc: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-[20px] border border-white/8 bg-black/10 px-4 py-3.5">
      <span className="text-white/52">{icon}</span>
      <div className="flex-1">
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-xs leading-5 text-white/48">{desc}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-white/28" />
    </div>
  )
}

function SignOutButton() {
  const [submitting, setSubmitting] = useState(false)

  async function handleSignOut() {
    setSubmitting(true)
    const supabase = getBrowserSupabaseClient()
    if (supabase) {
      await supabase.auth.signOut()
    }
    window.location.href = '/me'
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={submitting}
      className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-4 py-3 text-sm font-medium text-white/70 transition-colors hover:text-white disabled:opacity-60"
    >
      {submitting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <LogOut className="h-4 w-4" />
      )}
      登出
    </button>
  )
}

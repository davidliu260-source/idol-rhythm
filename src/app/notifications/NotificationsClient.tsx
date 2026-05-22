'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Bell, CheckCheck, ChevronLeft, Inbox, LogIn, Loader2 } from 'lucide-react'
import clsx from 'clsx'
import { useAppState } from '@/lib/appState'
import { getBrowserSupabaseClient } from '@/lib/supabase/browserClient'
import {
  listNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  type Notification,
} from '@/lib/supabase/notifications'
import { SCHEDULE_ARCHIVE_SHELL } from '@/app/schedule/scheduleTheme'

// ── Helpers ───────────────────────────────────────────────────────────────────

function typeLabel(type: Notification['type']): string {
  if (type === 'event_reminder') return '活動提醒'
  if (type === 'followed_idol_new_event') return '新活動'
  return type
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return '剛剛'
  if (min < 60) return `${min} 分鐘前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} 小時前`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day} 天前`
  return new Date(iso).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' })
}

// ── Shell ─────────────────────────────────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-8">
      {children}
    </main>
  )
}

// ── NotificationRow ───────────────────────────────────────────────────────────

function NotificationRow({
  notification,
  onRead,
}: {
  notification: Notification
  onRead: (id: string) => void
}) {
  const unread = notification.read_at === null
  const eventPath = notification.event_id ? `/events/${notification.event_id}` : null

  function handleClick() {
    if (unread) onRead(notification.id)
  }

  const content = (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      className={clsx(
        'flex items-start gap-3 rounded-[18px] border px-4 py-3.5 transition-colors',
        unread
          ? 'border-[#ff6cb7]/20 bg-[#ff4ca1]/8 hover:bg-[#ff4ca1]/12'
          : 'border-white/6 bg-white/[0.03] hover:bg-white/[0.06]'
      )}
    >
      {/* unread indicator */}
      <span className="mt-1.5 flex-shrink-0">
        {unread ? (
          <span className="block h-2 w-2 rounded-full bg-[#ff4ca1] shadow-[0_0_8px_rgba(255,76,161,0.5)]" />
        ) : (
          <span className="block h-2 w-2 rounded-full bg-white/12" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className={clsx(
            'text-[10px] font-semibold uppercase tracking-[0.2em]',
            unread ? 'text-[#ff8bc8]' : 'text-white/36'
          )}>
            {typeLabel(notification.type)}
          </span>
          <span className="flex-shrink-0 text-[10px] text-white/32">
            {relativeTime(notification.delivered_at)}
          </span>
        </div>
        <p className={clsx(
          'mt-1 text-sm font-semibold leading-snug',
          unread ? 'text-white' : 'text-white/60'
        )}>
          {notification.title}
        </p>
        {notification.body && (
          <p className="mt-1 text-xs leading-5 text-white/44">
            {notification.body}
          </p>
        )}
      </div>
    </div>
  )

  if (eventPath) {
    return (
      <Link href={eventPath} onClick={handleClick} className="block">
        {content}
      </Link>
    )
  }
  return content
}

// ── Main component ────────────────────────────────────────────────────────────

export default function NotificationsClient() {
  const { user, isUserLoading } = useAppState()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [markingAll, setMarkingAll] = useState(false)

  const unreadCount = notifications.filter((n) => n.read_at === null).length

  const fetchNotifications = useCallback(async () => {
    const supabase = getBrowserSupabaseClient()
    if (!supabase) { setLoading(false); return }
    setLoading(true)
    const data = await listNotifications(supabase, 50)
    setNotifications(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (isUserLoading) return
    if (!user) { setLoading(false); return }
    fetchNotifications()
  }, [user, isUserLoading, fetchNotifications])

  // Mark a single notification as read (optimistic)
  const handleMarkRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => n.id === id ? { ...n, read_at: new Date().toISOString() } : n)
    )
    const supabase = getBrowserSupabaseClient()
    if (supabase) await markNotificationAsRead(supabase, id)
  }, [])

  // Mark all as read
  const handleMarkAll = useCallback(async () => {
    setMarkingAll(true)
    const now = new Date().toISOString()
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })))
    const supabase = getBrowserSupabaseClient()
    if (supabase) await markAllNotificationsAsRead(supabase)
    setMarkingAll(false)
  }, [])

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isUserLoading) {
    return (
      <PageShell>
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-white/50">
          <div className="flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-4 py-2.5">
            <Loader2 className="h-4 w-4 animate-spin" />
            載入中…
          </div>
        </div>
      </PageShell>
    )
  }

  // ── Not logged in ──────────────────────────────────────────────────────────
  if (!user) {
    return (
      <PageShell>
        <div className={clsx(SCHEDULE_ARCHIVE_SHELL, 'px-5 py-8 text-center')}>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-white/8 bg-white/[0.04] text-white/60">
            <Bell className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-black text-white">通知中心</h1>
          <p className="mt-2 text-sm leading-6 text-white/56">
            登入後查看你的活動提醒與追蹤偶像的最新動態。
          </p>
          <Link
            href="/login?next=/notifications"
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#ff6cb7]/24 bg-[#ff4ca1]/14 px-4 py-2.5 text-sm font-semibold text-[#ff9ed3]"
          >
            <LogIn className="h-4 w-4" />
            登入 / 註冊
          </Link>
        </div>
      </PageShell>
    )
  }

  // ── Logged in ──────────────────────────────────────────────────────────────
  return (
    <PageShell>
      {/* Header */}
      <div className={clsx(SCHEDULE_ARCHIVE_SHELL, 'px-5 py-5')}>
        <div className="relative flex items-center gap-3">
          <Link
            href="/me#notifications"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-white/8 bg-white/[0.04] text-white/56 transition-colors hover:text-white"
            aria-label="返回我的控制台"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-white/36">
              Notification Archive
            </p>
            <h1 className="text-2xl font-black leading-tight text-white">
              通知中心
            </h1>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAll}
              disabled={markingAll}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white/70 transition-colors hover:text-white disabled:opacity-40"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              {markingAll ? '標記中…' : '全部已讀'}
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="mt-4 flex items-center gap-3 text-sm">
          <span className="text-white/50">
            共 <span className="font-semibold text-white">{notifications.length}</span> 則
          </span>
          {unreadCount > 0 && (
            <>
              <span className="text-white/20">·</span>
              <span className="font-semibold text-[#ff8bc8]">{unreadCount} 則未讀</span>
            </>
          )}
        </div>
      </div>

      {/* List */}
      <div className="mt-3 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-white/40">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            載入通知中…
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/8 bg-white/[0.04] text-white/30">
              <Inbox className="h-7 w-7" />
            </div>
            <p className="mt-4 text-sm font-semibold text-white/50">目前沒有通知</p>
            <p className="mt-1.5 text-xs leading-5 text-white/30">
              設定活動提醒，或追蹤偶像後，新通知會出現在這裡。
            </p>
          </div>
        ) : (
          notifications.map((n) => (
            <NotificationRow key={n.id} notification={n} onRead={handleMarkRead} />
          ))
        )}
      </div>
    </PageShell>
  )
}

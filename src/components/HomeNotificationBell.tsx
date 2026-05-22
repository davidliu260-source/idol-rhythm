'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { useAppState } from '@/lib/appState'
import { getBrowserSupabaseClient } from '@/lib/supabase/browserClient'
import { getUnreadNotificationCount } from '@/lib/supabase/notifications'

export default function HomeNotificationBell() {
  const { reminders, user } = useAppState()
  const [mounted, setMounted] = useState(false)
  const [unreadCount, setUnreadCount] = useState<number | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // When the user is logged in, fetch real unread count from notifications table.
  // Falls back to reminders count (local state) when not logged in or on error.
  useEffect(() => {
    if (!user) {
      setUnreadCount(null)
      return
    }

    let cancelled = false

    async function fetchCount() {
      const supabase = getBrowserSupabaseClient()
      if (!supabase) return
      const count = await getUnreadNotificationCount(supabase)
      if (!cancelled) setUnreadCount(count)
    }

    fetchCount()
    return () => { cancelled = true }
  }, [user])

  // Determine which count to display:
  // - logged in  → unreadCount (notifications table); null while loading → show nothing
  // - logged out → reminders.ids.length (local state fallback)
  const count = mounted
    ? user
      ? (unreadCount ?? 0)
      : reminders.ids.length
    : 0

  const label = count > 0 ? `查看 ${count} 則通知` : '查看通知'

  return (
    <Link
      href="/me#notifications"
      aria-label={label}
      className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border border-white/8 bg-white/[0.045] text-white/64 transition-colors hover:text-white"
    >
      <Bell className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full border border-[#17111d] bg-[#ff4ca1] px-1 text-[10px] font-black leading-none text-white shadow-[0_0_16px_rgba(255,76,161,0.4)]">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  )
}

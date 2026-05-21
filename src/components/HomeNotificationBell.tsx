'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { useAppState } from '@/lib/appState'

export default function HomeNotificationBell() {
  const { reminders } = useAppState()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const count = mounted ? reminders.ids.length : 0
  const label = count > 0 ? `查看 ${count} 則活動提醒` : '查看活動提醒'

  return (
    <Link
      href="/me"
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

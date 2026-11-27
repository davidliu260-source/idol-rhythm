'use client'

import Link from 'next/link'
import { User } from 'lucide-react'
import { useAppState } from '@/lib/appState'

/**
 * Home page account entry next to the notification bell.
 * Logged in → /me; logged out → /login. Never shows the email.
 */
export default function HomeAccountButton() {
  const { user } = useAppState()
  const href = user ? '/me' : '/login'
  const label = user ? '前往我的控制台' : '登入'

  return (
    <Link
      href={href}
      aria-label={label}
      className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border border-white/8 bg-white/[0.045] text-white/64 transition-colors hover:text-white"
    >
      <User className="h-5 w-5" />
    </Link>
  )
}

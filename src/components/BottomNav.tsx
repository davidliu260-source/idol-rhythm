'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Calendar, Star, Heart, User } from 'lucide-react'
import clsx from 'clsx'

const NAV_ITEMS = [
  { href: '/', icon: Home, label: '今日' },
  { href: '/schedule', icon: Calendar, label: '行程' },
  { href: '/idols', icon: Star, label: '偶像' },
  { href: '/favorites', icon: Heart, label: '收藏' },
  { href: '/me', icon: User, label: '我的' },
]

export default function BottomNav() {
  const pathname = usePathname()

  if (pathname.startsWith('/admin')) return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-card-border bg-bg/95 backdrop-blur-md pb-safe">
      <div className="mx-auto flex max-w-md items-center justify-around px-2 pt-2 pb-4">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'relative flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all',
                active ? 'text-primary' : 'text-muted hover:text-text-base',
              )}
            >
              <Icon
                className={clsx('h-5 w-5', active && 'drop-shadow-[0_0_6px_rgba(233,30,140,0.6)]')}
                strokeWidth={active ? 2.5 : 1.8}
              />
              <span className={clsx('text-[10px] font-medium leading-none', active && 'text-primary')}>
                {label}
              </span>
              {active && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-0.5 w-5 rounded-full bg-primary opacity-70" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

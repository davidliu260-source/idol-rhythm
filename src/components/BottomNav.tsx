'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, MapPin, CalendarDays, Layers, Star } from 'lucide-react'
import clsx from 'clsx'

const NAV_ITEMS = [
  { href: '/', icon: Home, label: '首頁' },
  { href: '/cities', icon: MapPin, label: '城市' },
  { href: '/schedule', icon: CalendarDays, label: '行事曆' },
  { href: '/atlas', icon: Layers, label: '圖鑑' },
  { href: '/me', icon: Star, label: '追蹤' },
]

export default function BottomNav() {
  const pathname = usePathname()

  if (pathname.startsWith('/admin')) return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-card-border bg-bg/95 backdrop-blur-md pb-safe">
      <div className="mx-auto flex max-w-md items-center justify-around px-2 pt-2 pb-4">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active =
            href === '/'
              ? pathname === '/'
              : href === '/me'
                ? ['/me', '/idols', '/notifications', '/account'].some((prefix) =>
                    pathname.startsWith(prefix),
                  )
                : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'relative flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all',
                active ? 'text-primary-light' : 'text-muted hover:text-text-base',
              )}
            >
              <Icon
                className={clsx('h-5 w-5', active && 'drop-shadow-[0_0_6px_rgba(255,45,149,0.6)]')}
                strokeWidth={active ? 2.5 : 1.8}
              />
              <span className={clsx('text-[10px] font-medium leading-none', active && 'text-primary-light')}>
                {label}
              </span>
              {active && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-0.5 w-5 rounded-full bg-primary-light opacity-70" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

'use client'

import { usePathname } from 'next/navigation'
import LegalLinks from './LegalLinks'

export default function SiteFooter() {
  const pathname = usePathname()
  if (pathname.startsWith('/admin')) return null

  return (
    <footer className="mt-10 border-t border-card-border px-4 pb-2 pt-5">
      <LegalLinks />
    </footer>
  )
}

import Link from 'next/link'
import { LEGAL_NAV } from '@/lib/legal'

export default function LegalLinks({ className = '' }: { className?: string }) {
  return (
    <nav aria-label="法律資訊" className={className}>
      <ul className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        {LEGAL_NAV.map((item, index) => (
          <li key={item.href} className="flex items-center gap-3">
            {index > 0 ? <span className="text-muted/50" aria-hidden="true">·</span> : null}
            <Link
              href={item.href}
              className="text-[11px] leading-5 text-muted transition-colors hover:text-text-base"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

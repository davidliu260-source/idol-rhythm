import Link from 'next/link'
import LegalDocument from './LegalDocument'
import LegalLinks from './LegalLinks'
import type { LegalDoc } from '@/lib/legal'

export default function LegalPage({ document }: { document: LegalDoc }) {
  return (
    <div className="px-4 pb-6 pt-8">
      <Link
        href="/"
        className="inline-flex w-fit items-center text-xs font-medium text-muted transition-colors hover:text-text-base"
      >
        ← 回到首頁
      </Link>
      <div className="mt-5 rounded-2xl border border-card-border bg-card px-5 py-6">
        <LegalDocument document={document} />
      </div>
      <LegalLinks className="mt-6" />
    </div>
  )
}

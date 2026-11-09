'use client'

import { useState } from 'react'
import { Calendar, Copy, Check } from 'lucide-react'
import clsx from 'clsx'

export default function SubscribeCalendarButton({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false)
  const path = `/api/ics/idols/${encodeURIComponent(slug)}`

  async function copyLink() {
    await navigator.clipboard.writeText(`https://${window.location.host}${path}`)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="mt-2 flex gap-2">
      <button
        type="button"
        onClick={() => window.location.assign(`webcal://${window.location.host}${path}`)}
        className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/[0.045] px-4 py-3 text-sm font-semibold text-white/78 transition-colors hover:text-white"
      >
        <Calendar className="h-4 w-4" />
        訂閱到行事曆
      </button>
      <button
        type="button"
        onClick={copyLink}
        className={clsx(
          'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/[0.045] px-4 py-3 text-sm font-semibold text-white/78 transition-colors hover:text-white',
          copied && 'text-[#ff9cd0]',
        )}
        aria-live="polite"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? '已複製' : '複製連結'}
      </button>
    </div>
  )
}

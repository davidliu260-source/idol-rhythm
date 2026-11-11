'use client'

import { useEffect, useRef, useState } from 'react'
import { Calendar, Copy, Check } from 'lucide-react'
import clsx from 'clsx'

export default function SubscribeCalendarButton({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const fallbackInput = useRef<HTMLInputElement>(null)
  const path = `/api/ics/idols/${encodeURIComponent(slug)}`
  const httpsUrl = `https://${typeof window === 'undefined' ? '' : window.location.host}${path}`

  useEffect(() => {
    if (copyFailed) fallbackInput.current?.select()
  }, [copyFailed])

  async function copyLink() {
    setCopyFailed(false)
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable')
      await navigator.clipboard.writeText(httpsUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
      setCopyFailed(true)
    }
  }

  return (
    <div className="mt-2">
      <div className="flex gap-2">
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
      {copyFailed && (
        <div className="mt-2">
          <input
            ref={fallbackInput}
            type="url"
            value={httpsUrl}
            readOnly
            aria-label="行事曆訂閱網址"
            className="w-full rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2 text-xs text-white/78 outline-none"
          />
          <p className="mt-1 text-xs text-white/50">請長按或手動複製這個網址</p>
        </div>
      )}
    </div>
  )
}

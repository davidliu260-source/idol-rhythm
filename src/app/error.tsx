'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Page error:', error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 gap-5 text-center">
      <div className="rounded-2xl border border-card-border bg-card p-6 max-w-sm w-full">
        <p className="text-3xl mb-3">⚠️</p>
        <h2 className="text-base font-bold text-text-base mb-2">出了點問題</h2>
        <p className="text-xs text-muted mb-5 leading-relaxed">
          {error.message || '頁面發生錯誤，請重試'}
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={reset}
            className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white"
          >
            重試
          </button>
          <Link
            href="/"
            className="block w-full rounded-xl border border-card-border py-2.5 text-sm font-medium text-muted"
          >
            回首頁
          </Link>
        </div>
      </div>
    </div>
  )
}

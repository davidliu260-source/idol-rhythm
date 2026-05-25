'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft } from 'lucide-react'

export default function AdminEventError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[admin/events] Server Action error:', error)
  }, [error])

  return (
    <div className="flex flex-col gap-0 pt-12 pb-6 px-4">
      <Link
        href="/admin/events"
        className="inline-flex items-center gap-1 text-xs text-muted hover:text-text-base mb-6"
      >
        <ArrowLeft className="h-3 w-3" />
        返回活動列表
      </Link>
      <div className="rounded-xl bg-card border border-card-border px-4 py-8 flex flex-col items-center gap-4 text-center">
        <AlertTriangle className="h-8 w-8 text-amber-400" />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-text-base">操作失敗</p>
          <p className="text-xs text-muted leading-relaxed max-w-xs">
            {error.message || '操作發生錯誤，請重試或回活動列表。'}
          </p>
        </div>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <button
            onClick={reset}
            className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white"
          >
            重試
          </button>
          <Link
            href="/admin/events"
            className="block w-full rounded-xl border border-card-border py-2.5 text-sm font-medium text-muted"
          >
            回活動列表
          </Link>
        </div>
      </div>
    </div>
  )
}

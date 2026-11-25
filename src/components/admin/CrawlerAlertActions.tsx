'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

type AlertAction = 'acknowledge' | 'resolve'

/**
 * MUST #10：故障提醒的「已看過」／「已解決」按鈕。
 * 只呼叫 /api/admin/crawler-alerts 更新提醒狀態，不會更動活動或來源。
 */
export default function CrawlerAlertActions({
  alertId,
  canAcknowledge,
}: {
  alertId: number
  canAcknowledge: boolean
}) {
  const router = useRouter()
  const [pending, setPending] = useState<AlertAction | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(action: AlertAction) {
    setPending(action)
    setError(null)
    try {
      const response = await fetch('/api/admin/crawler-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: alertId, action }),
      })
      const body = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!response.ok || !body?.ok) {
        setError(body?.error ?? `更新失敗（HTTP ${response.status}）`)
        return
      }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新失敗')
    } finally {
      setPending(null)
    }
  }

  const buttonClass =
    'inline-flex items-center gap-1 rounded-lg border border-card-border bg-card px-2.5 py-1.5 text-[11px] font-semibold text-text-base disabled:opacity-50'

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {canAcknowledge && (
          <button type="button" className={buttonClass} disabled={pending !== null} onClick={() => run('acknowledge')}>
            {pending === 'acknowledge' && <Loader2 className="h-3 w-3 animate-spin" />}
            已看過
          </button>
        )}
        <button type="button" className={buttonClass} disabled={pending !== null} onClick={() => run('resolve')}>
          {pending === 'resolve' && <Loader2 className="h-3 w-3 animate-spin" />}
          已解決
        </button>
      </div>
      {error && <p role="alert" className="text-[11px] text-red-400 break-all">{error}</p>}
    </div>
  )
}

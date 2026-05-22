'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { resolveRecheck } from './actions'

interface ResolveRecheckButtonProps {
  candidateId: string
  /** When true the button label notes that display fields will be synced to the linked event */
  isApproved: boolean
}

export default function ResolveRecheckButton({
  candidateId,
  isApproved,
}: ResolveRecheckButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'ok' | 'warn' | 'error'; text: string } | null>(
    null,
  )

  function run() {
    setMessage(null)
    startTransition(async () => {
      const result = await resolveRecheck(candidateId)
      if (!result.ok) {
        setMessage({ type: 'error', text: result.error ?? '解決失敗' })
        return
      }
      // ok=true but sync failed (non-fatal) — result.error contains the detail
      if (result.error) {
        setMessage({ type: 'warn', text: result.error })
        router.refresh()
        return
      }
      const text = result.synced
        ? '已解決：重審標記已清除，中文欄位已同步至活動'
        : '已解決：重審標記已清除'
      setMessage({ type: 'ok', text })
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={run}
        disabled={isPending}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-orange-500/35 bg-orange-500/10 px-3 py-2.5 text-xs font-semibold text-orange-400 disabled:opacity-50 active:opacity-80 transition-opacity"
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5" />
        )}
        {isPending
          ? '處理中...'
          : isApproved
            ? '標記已解決（同步中文欄位至活動）'
            : '標記已解決'}
      </button>
      {message && (
        <p
          className={
            message.type === 'ok'
              ? 'text-[10px] text-orange-400/80 leading-snug'
              : message.type === 'warn'
                ? 'text-[10px] text-amber-400 leading-snug break-all'
                : 'text-[10px] text-red-400 leading-snug break-all'
          }
        >
          {message.text}
        </p>
      )}
    </div>
  )
}

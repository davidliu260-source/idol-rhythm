'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { markCandidateChineseReviewed } from './actions'

interface MarkReviewedButtonProps {
  candidateId: string
  disabledReason?: string | null
}

export default function MarkReviewedButton({
  candidateId,
  disabledReason,
}: MarkReviewedButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const disabled = isPending || Boolean(disabledReason)

  function run() {
    setMessage(null)
    startTransition(async () => {
      const result = await markCandidateChineseReviewed(candidateId)
      if (!result.ok) {
        setMessage({ type: 'error', text: result.error ?? '標記失敗' })
        return
      }
      setMessage({ type: 'ok', text: '已標記為已審閱' })
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={run}
        disabled={disabled}
        title={disabledReason ?? undefined}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-2.5 text-xs font-semibold text-emerald-400 disabled:opacity-50 active:opacity-80 transition-opacity"
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5" />
        )}
        {isPending ? '標記中...' : '標記已審閱'}
      </button>
      {disabledReason && (
        <p className="text-[10px] text-muted leading-snug">{disabledReason}</p>
      )}
      {message && (
        <p
          className={
            message.type === 'ok'
              ? 'text-[10px] text-emerald-400 leading-snug'
              : 'text-[10px] text-red-400 leading-snug break-all'
          }
        >
          {message.text}
        </p>
      )}
    </div>
  )
}

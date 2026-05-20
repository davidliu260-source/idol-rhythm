'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Sparkles } from 'lucide-react'
import { generateCandidateChineseDisplay } from './actions'

interface GenerateChineseButtonProps {
  candidateId: string
  disabledReason?: string | null
}

export default function GenerateChineseButton({
  candidateId,
  disabledReason,
}: GenerateChineseButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const disabled = isPending || Boolean(disabledReason)

  function run() {
    setMessage(null)
    startTransition(async () => {
      const result = await generateCandidateChineseDisplay(candidateId)
      if (!result.ok) {
        setMessage({ type: 'error', text: result.error ?? '產生失敗' })
        return
      }
      setMessage({ type: 'ok', text: '已產生繁中顯示文案' })
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
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet/35 bg-violet/15 px-3 py-2.5 text-xs font-semibold text-violet disabled:opacity-50 active:opacity-80 transition-opacity"
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        {isPending ? '產生中...' : '產生繁中顯示文案'}
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

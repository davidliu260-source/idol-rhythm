'use client'

import { useState, useTransition } from 'react'
import { SearchCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function VerifyCandidateButton({ candidateId }: { candidateId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  function verify() {
    setMessage(null)
    startTransition(async () => {
      try {
        const response = await fetch('/api/admin/event-candidates/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: [candidateId] }),
        })
        const data = await response.json()
        if (!response.ok || !data.ok) {
          setMessage(data.error ?? data.results?.[0]?.error ?? '自動求證失敗')
          return
        }
        setMessage(`求證完成：${data.results?.[0]?.status ?? 'unknown'}`)
        router.refresh()
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '網路錯誤')
      }
    })
  }

  return (
    <div className="rounded-xl bg-violet/10 border border-violet/25 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <SearchCheck className="h-4 w-4 text-violet-300" />
        <div className="flex-1">
          <p className="text-xs font-semibold text-violet-200">B-direct 自動求證</p>
          <p className="text-[10px] text-violet-200/70">只寫回求證狀態與證據，不會建立或發布活動。</p>
        </div>
        <button
          type="button"
          onClick={verify}
          disabled={pending}
          className="rounded-lg bg-violet px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {pending ? '搜尋中…' : '自動求證'}
        </button>
      </div>
      {message && <p className="mt-2 text-[11px] text-violet-200 break-words">{message}</p>}
    </div>
  )
}

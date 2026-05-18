'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, KeyRound, CheckCircle2 } from 'lucide-react'
import { getBrowserSupabaseClient } from '@/lib/supabase/browserClient'

const PASSWORD_MIN = 8

const inputCls =
  'w-full rounded-xl border border-card-border bg-card px-4 py-3 text-sm text-text-base placeholder:text-muted/40 focus:outline-none focus:border-primary/60 transition-colors'

export default function ResetPasswordForm() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < PASSWORD_MIN) {
      return setError(`密碼至少 ${PASSWORD_MIN} 個字元`)
    }
    if (password !== confirm) {
      return setError('兩次輸入的密碼不一致')
    }

    setSubmitting(true)
    const supabase = getBrowserSupabaseClient()
    if (!supabase) {
      setError('Supabase 未設定')
      setSubmitting(false)
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(`更新密碼失敗：${updateError.message}`)
      setSubmitting(false)
      return
    }

    setDone(true)
    setSubmitting(false)

    // After a short success state, send the user to /me. router.refresh()
    // makes the Server Components on /me pick up the still-valid session.
    setTimeout(() => {
      router.replace('/me')
      router.refresh()
    }, 1500)
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-center gap-2.5">
        <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
        <div className="flex flex-col">
          <p className="text-sm font-semibold text-emerald-300">密碼已更新</p>
          <p className="text-[11px] text-emerald-300/70">即將為你轉跳至「我的」⋯</p>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">
          新密碼
          <span className="text-muted/50 ml-1">（至少 {PASSWORD_MIN} 字元）</span>
        </span>
        <input
          type="password"
          required
          autoComplete="new-password"
          minLength={PASSWORD_MIN}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={`至少 ${PASSWORD_MIN} 個字元`}
          className={inputCls}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">確認新密碼</span>
        <input
          type="password"
          required
          autoComplete="new-password"
          minLength={PASSWORD_MIN}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="再次輸入同一組密碼"
          className={inputCls}
        />
      </label>

      {error && (
        <p className="text-xs text-red-400 leading-relaxed break-all">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 transition-opacity"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
        {submitting ? '更新中…' : '更新密碼'}
      </button>
    </form>
  )
}

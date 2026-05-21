'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, KeyRound, CheckCircle2 } from 'lucide-react'
import { getBrowserSupabaseClient } from '@/lib/supabase/browserClient'

const PASSWORD_MIN = 8

const inputCls =
  'w-full rounded-[20px] border border-white/10 bg-black/10 px-4 py-3.5 text-sm text-white placeholder:text-white/28 focus:border-[#ff6cb7]/40 focus:outline-none transition-colors'

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
      <div className="rounded-[24px] border border-emerald-400/18 bg-emerald-400/10 p-4 flex items-center gap-2.5">
        <CheckCircle2 className="h-4 w-4 text-emerald-300 flex-shrink-0" />
        <div className="flex flex-col">
          <p className="text-sm font-semibold text-emerald-100">密碼已更新</p>
          <p className="text-[11px] text-emerald-100/68">即將為你轉跳至「我的」⋯</p>
        </div>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[24px] border border-white/8 bg-white/[0.035] p-4"
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-white/40">
        New Credentials
      </p>

      <div className="mt-4 flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-white/62">
          新密碼
          <span className="ml-1 text-white/36">（至少 {PASSWORD_MIN} 字元）</span>
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
        <span className="text-xs font-medium text-white/62">確認新密碼</span>
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
        <p className="text-xs leading-6 text-red-200 break-all">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-1 flex items-center justify-center gap-2 rounded-[20px] bg-[#ff4ca1] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_14px_40px_rgba(255,76,161,0.28)] transition-opacity disabled:opacity-60"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
        {submitting ? '更新中…' : '更新密碼'}
      </button>
      </div>
    </form>
  )
}

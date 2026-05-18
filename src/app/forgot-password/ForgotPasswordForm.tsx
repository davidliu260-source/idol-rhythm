'use client'

import { useState } from 'react'
import { Loader2, Mail, MailCheck } from 'lucide-react'
import { getBrowserSupabaseClient } from '@/lib/supabase/browserClient'

const inputCls =
  'w-full rounded-xl border border-card-border bg-card px-4 py-3 text-sm text-text-base placeholder:text-muted/40 focus:outline-none focus:border-primary/60 transition-colors'

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function callbackRedirect(): string {
    return `${window.location.origin}/auth/callback?next=${encodeURIComponent('/reset-password')}`
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const trimmed = email.trim()
    if (!trimmed) return setError('請輸入 email')

    setSubmitting(true)
    const supabase = getBrowserSupabaseClient()
    if (!supabase) {
      setError('Supabase 未設定')
      setSubmitting(false)
      return
    }

    // Supabase always responds 200 here even if the email is unknown — by
    // design, to avoid email-enumeration. So the success banner just means
    // "the request was accepted", not "the email exists".
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: callbackRedirect(),
    })

    if (resetError) {
      setError(resetError.message)
      setSubmitting(false)
      return
    }

    setSent(true)
    setSubmitting(false)
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <MailCheck className="h-4 w-4 text-emerald-400" />
          <p className="text-sm font-semibold text-emerald-300">重設密碼信已寄出</p>
        </div>
        <p className="text-xs text-emerald-300/80 leading-relaxed">
          如果 <span className="font-mono break-all">{email}</span> 存在於我們的系統，
          你會收到一封重設密碼的連結。點擊信件中的連結，即可設定新密碼。
        </p>
        <p className="text-[10px] text-emerald-300/50 leading-relaxed">
          沒收到？請檢查垃圾信件夾，或稍後重試。連結通常 1 小時內有效。
        </p>
        <button
          type="button"
          onClick={() => {
            setSent(false)
            setError(null)
          }}
          className="self-start text-xs text-emerald-300 underline underline-offset-2 mt-1"
        >
          換一個 email 重試
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
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
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
        {submitting ? '寄送中…' : '寄送重設密碼連結'}
      </button>

      <p className="text-[10px] text-muted/60 leading-relaxed">
        為防止 email 枚舉攻擊，我們不會告訴你該 email 是否已註冊。即使該 email 沒有帳號，畫面仍會顯示「已寄出」。
      </p>
    </form>
  )
}

'use client'

import { useState } from 'react'
import { Loader2, Mail, MailCheck } from 'lucide-react'
import { getBrowserSupabaseClient } from '@/lib/supabase/browserClient'

const inputCls =
  'w-full rounded-[20px] border border-white/10 bg-black/10 px-4 py-3.5 text-sm text-white placeholder:text-white/28 focus:border-[#ff6cb7]/40 focus:outline-none transition-colors'

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
      <div className="rounded-[24px] border border-emerald-400/18 bg-emerald-400/10 p-4">
        <div className="flex items-center gap-2">
          <MailCheck className="h-4 w-4 text-emerald-300" />
          <p className="text-sm font-semibold text-emerald-100">重設密碼信已寄出</p>
        </div>
        <p className="mt-2 text-xs leading-6 text-emerald-100/80">
          如果 <span className="font-mono break-all">{email}</span> 存在於我們的系統，
          你會收到一封重設密碼的連結。點擊信件中的連結，即可設定新密碼。
        </p>
        <p className="mt-1 text-[11px] leading-6 text-emerald-100/56">
          沒收到？請檢查垃圾信件夾，或稍後重試。連結通常 1 小時內有效。
        </p>
        <button
          type="button"
          onClick={() => {
            setSent(false)
            setError(null)
          }}
          className="mt-2 self-start text-xs text-emerald-100 underline underline-offset-2"
        >
          換一個 email 重試
        </button>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[24px] border border-white/8 bg-white/[0.035] p-4"
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-white/40">
        Reset Request
      </p>

      <div className="mt-4 flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-white/62">Email</span>
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
        <p className="text-xs leading-6 text-red-200 break-all">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-1 flex items-center justify-center gap-2 rounded-[20px] bg-[#ff4ca1] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_14px_40px_rgba(255,76,161,0.28)] transition-opacity disabled:opacity-60"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
        {submitting ? '寄送中…' : '寄送重設密碼連結'}
      </button>

      <p className="text-[11px] leading-6 text-white/42">
        為防止 email 枚舉攻擊，我們不會告訴你該 email 是否已註冊。即使該 email 沒有帳號，畫面仍會顯示「已寄出」。
      </p>
      </div>
    </form>
  )
}

'use client'

import { useState } from 'react'
import { Loader2, Mail, MailCheck } from 'lucide-react'
import { getBrowserSupabaseClient } from '@/lib/supabase/browserClient'

const inputCls =
  'w-full rounded-xl border border-card-border bg-card px-4 py-3 text-sm text-text-base placeholder:text-muted/40 focus:outline-none focus:border-primary/60 transition-colors'

export default function LoginForm({ nextPath }: { nextPath: string }) {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const trimmed = email.trim()
    if (!trimmed) {
      setError('請輸入 email')
      return
    }

    setSubmitting(true)

    const supabase = getBrowserSupabaseClient()
    if (!supabase) {
      setError('Supabase 未設定')
      setSubmitting(false)
      return
    }

    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`

    const { error: authError } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: redirectTo,
      },
    })

    if (authError) {
      setError(authError.message)
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
          <p className="text-sm font-semibold text-emerald-300">登入信已寄出</p>
        </div>
        <p className="text-xs text-emerald-300/70 leading-relaxed">
          請到 <span className="font-mono break-all">{email}</span> 收信，點擊信中的連結即可完成登入。
        </p>
        <p className="text-[10px] text-emerald-300/50 leading-relaxed">
          若沒收到，請檢查垃圾信件夾。連結通常 1 小時內有效。
        </p>
        <button
          type="button"
          onClick={() => {
            setSent(false)
            setError(null)
          }}
          className="self-start text-xs text-emerald-300 underline underline-offset-2 mt-1"
        >
          重新輸入 email
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
        {submitting ? '寄送中…' : '寄送登入連結'}
      </button>

      <p className="text-[10px] text-muted/60 leading-relaxed">
        點擊「寄送登入連結」後，請到信箱收信並點擊連結完成登入。
        不需要設定密碼。
      </p>
    </form>
  )
}

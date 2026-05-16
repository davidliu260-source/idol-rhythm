'use client'

import { useState } from 'react'
import { Loader2, Mail, MailCheck } from 'lucide-react'
import { getBrowserSupabaseClient } from '@/lib/supabase/browserClient'

const inputCls =
  'w-full rounded-xl border border-card-border bg-card px-4 py-3 text-sm text-text-base placeholder:text-muted/40 focus:outline-none focus:border-primary/60 transition-colors'

export default function LoginForm({ nextPath }: { nextPath: string }) {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [oauthSubmitting, setOauthSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Shared between magic link and OAuth — both flows land on the same
  // /auth/callback route, which exchanges the PKCE code for a session.
  function getCallbackRedirect(): string {
    return `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
  }

  // ── Google OAuth ────────────────────────────────────────────────────────
  async function handleGoogleSignIn() {
    setError(null)
    setOauthSubmitting(true)

    const supabase = getBrowserSupabaseClient()
    if (!supabase) {
      setError('Supabase 未設定')
      setOauthSubmitting(false)
      return
    }

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getCallbackRedirect(),
      },
    })

    if (oauthError) {
      setError(oauthError.message)
      setOauthSubmitting(false)
      return
    }
    // Success path: Supabase triggers a full-page navigation to Google's
    // OAuth consent screen. No further work needed here.
  }

  // ── Magic link ──────────────────────────────────────────────────────────
  async function handleEmailSubmit(e: React.FormEvent) {
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

    const { error: authError } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: getCallbackRedirect(),
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

  // ── Sent confirmation view ──────────────────────────────────────────────
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

  const anySubmitting = submitting || oauthSubmitting

  // ── Main view: Google button + divider + magic link form ────────────────
  return (
    <div className="flex flex-col gap-4">
      {/* Google OAuth — placed above email form as the faster path */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={anySubmitting}
        className="flex items-center justify-center gap-2.5 rounded-xl border border-card-border bg-white px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-100 disabled:opacity-60 transition-opacity"
      >
        {oauthSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <GoogleLogo className="h-4 w-4" />
        )}
        {oauthSubmitting ? '導向 Google…' : '使用 Google 登入'}
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-card-border" />
        <p className="text-[10px] text-muted/60 uppercase tracking-wider">或使用 Email</p>
        <div className="h-px flex-1 bg-card-border" />
      </div>

      {/* Magic link form (preserved from Milestone 1) */}
      <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
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
          disabled={anySubmitting}
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
    </div>
  )
}

/**
 * Google "G" logo, inlined as SVG so we don't need an extra request or font.
 * Standard four-colour mark — must match Google's brand guidelines.
 */
function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  )
}

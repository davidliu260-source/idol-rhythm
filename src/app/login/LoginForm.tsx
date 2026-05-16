'use client'

import { useState } from 'react'
import { Loader2, Mail, MailCheck, KeyRound, UserPlus } from 'lucide-react'
import { getBrowserSupabaseClient } from '@/lib/supabase/browserClient'

const PASSWORD_MIN = 8

const inputCls =
  'w-full rounded-xl border border-card-border bg-card px-4 py-3 text-sm text-text-base placeholder:text-muted/40 focus:outline-none focus:border-primary/60 transition-colors'

type Tab = 'password' | 'magiclink'
type PasswordMode = 'signin' | 'signup'

export default function LoginForm({ nextPath }: { nextPath: string }) {
  // ── Tab / mode state ────────────────────────────────────────────────────
  const [tab, setTab] = useState<Tab>('password')
  const [passwordMode, setPasswordMode] = useState<PasswordMode>('signin')

  // ── Shared form state ───────────────────────────────────────────────────
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // ── Async state ─────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false)
  const [oauthSubmitting, setOauthSubmitting] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [signupConfirmSent, setSignupConfirmSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function getCallbackRedirect(): string {
    return `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
  }

  function clearMessages() {
    setError(null)
    setMagicLinkSent(false)
    setSignupConfirmSent(false)
  }

  // ── Google OAuth ────────────────────────────────────────────────────────
  async function handleGoogleSignIn() {
    clearMessages()
    setOauthSubmitting(true)

    const supabase = getBrowserSupabaseClient()
    if (!supabase) {
      setError('Supabase 未設定')
      setOauthSubmitting(false)
      return
    }

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: getCallbackRedirect() },
    })

    if (oauthError) {
      setError(oauthError.message)
      setOauthSubmitting(false)
    }
    // success → full-page redirect to Google handled by Supabase
  }

  // ── Magic link ──────────────────────────────────────────────────────────
  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    clearMessages()

    const trimmed = email.trim()
    if (!trimmed) return setError('請輸入 email')

    setSubmitting(true)
    const supabase = getBrowserSupabaseClient()
    if (!supabase) {
      setError('Supabase 未設定')
      setSubmitting(false)
      return
    }

    const { error: authError } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: getCallbackRedirect() },
    })

    if (authError) {
      setError(authError.message)
      setSubmitting(false)
      return
    }

    setMagicLinkSent(true)
    setSubmitting(false)
  }

  // ── Password sign in ────────────────────────────────────────────────────
  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    clearMessages()

    const emailTrimmed = email.trim()
    if (!emailTrimmed) return setError('請輸入 email')
    if (!password) return setError('請輸入密碼')

    setSubmitting(true)
    const supabase = getBrowserSupabaseClient()
    if (!supabase) {
      setError('Supabase 未設定')
      setSubmitting(false)
      return
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: emailTrimmed,
      password,
    })

    if (signInError) {
      setError(`登入失敗：${signInError.message}`)
      setSubmitting(false)
      return
    }

    // Session cookie is set by @supabase/ssr. Full reload so Server
    // Components on the next page pick up the new session immediately.
    window.location.href = nextPath
  }

  // ── Password sign up ────────────────────────────────────────────────────
  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    clearMessages()

    const emailTrimmed = email.trim()
    if (!emailTrimmed) return setError('請輸入 email')
    if (password.length < PASSWORD_MIN) {
      return setError(`密碼至少 ${PASSWORD_MIN} 個字元`)
    }

    setSubmitting(true)
    const supabase = getBrowserSupabaseClient()
    if (!supabase) {
      setError('Supabase 未設定')
      setSubmitting(false)
      return
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: emailTrimmed,
      password,
      options: { emailRedirectTo: getCallbackRedirect() },
    })

    if (signUpError) {
      setError(`註冊失敗：${signUpError.message}`)
      setSubmitting(false)
      return
    }

    // Two cases depending on Supabase Dashboard "Confirm email" setting:
    //   - Confirmation OFF → data.session is populated → log in immediately
    //   - Confirmation ON  → data.session is null      → show "check inbox"
    if (data.session) {
      window.location.href = nextPath
      return
    }

    setSignupConfirmSent(true)
    setSubmitting(false)
  }

  const anySubmitting = submitting || oauthSubmitting

  // ── Magic link sent confirmation view ───────────────────────────────────
  if (magicLinkSent) {
    return (
      <SentBanner
        title="登入信已寄出"
        body={<>請到 <span className="font-mono break-all">{email}</span> 收信，點擊信中的連結即可完成登入。</>}
        hint="若沒收到，請檢查垃圾信件夾。連結通常 1 小時內有效。"
        onReset={clearMessages}
      />
    )
  }

  // ── Signup confirmation view ────────────────────────────────────────────
  if (signupConfirmSent) {
    return (
      <SentBanner
        title="註冊確認信已寄出"
        body={<>請到 <span className="font-mono break-all">{email}</span> 收信，點擊信中的確認連結後即可登入。</>}
        hint="若 Supabase 後台關閉了「Confirm email」，會直接登入而不寄信。"
        onReset={clearMessages}
      />
    )
  }

  // ── Main view ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      {/* Google OAuth — placed above email forms as the fastest path */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={anySubmitting}
        className="flex items-center justify-center gap-2.5 rounded-xl border border-card-border bg-white px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-100 disabled:opacity-60 transition-opacity"
      >
        {oauthSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleLogo className="h-4 w-4" />}
        {oauthSubmitting ? '導向 Google…' : '使用 Google 登入'}
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-card-border" />
        <p className="text-[10px] text-muted/60 uppercase tracking-wider">或使用 Email</p>
        <div className="h-px flex-1 bg-card-border" />
      </div>

      {/* Tab toggle: password vs magic link */}
      <div className="flex gap-1 rounded-xl border border-card-border bg-card p-1">
        <TabButton
          active={tab === 'password'}
          onClick={() => { setTab('password'); clearMessages() }}
        >
          密碼
        </TabButton>
        <TabButton
          active={tab === 'magiclink'}
          onClick={() => { setTab('magiclink'); clearMessages() }}
        >
          Magic Link
        </TabButton>
      </div>

      {tab === 'password' ? (
        <form
          onSubmit={passwordMode === 'signin' ? handleSignIn : handleSignUp}
          className="flex flex-col gap-3"
        >
          {/* signin vs signup toggle */}
          <div className="flex gap-2">
            <ModeRadio
              checked={passwordMode === 'signin'}
              onClick={() => { setPasswordMode('signin'); clearMessages() }}
            >
              登入
            </ModeRadio>
            <ModeRadio
              checked={passwordMode === 'signup'}
              onClick={() => { setPasswordMode('signup'); clearMessages() }}
            >
              註冊新帳號
            </ModeRadio>
          </div>

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

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted">
              密碼
              {passwordMode === 'signup' && (
                <span className="text-muted/50 ml-1">（至少 {PASSWORD_MIN} 字元）</span>
              )}
            </span>
            <input
              type="password"
              required
              autoComplete={passwordMode === 'signin' ? 'current-password' : 'new-password'}
              minLength={passwordMode === 'signup' ? PASSWORD_MIN : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={passwordMode === 'signup' ? `至少 ${PASSWORD_MIN} 個字元` : ''}
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
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : passwordMode === 'signin' ? (
              <KeyRound className="h-4 w-4" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            {submitting
              ? passwordMode === 'signin' ? '登入中…' : '註冊中…'
              : passwordMode === 'signin' ? '登入' : '註冊'}
          </button>

          <p className="text-[10px] text-muted/60 leading-relaxed">
            {passwordMode === 'signin'
              ? '使用既有帳號的 email 與密碼登入。「忘記密碼」功能稍後開放。'
              : `註冊後可能會收到一封確認信（依 Supabase「Confirm email」設定而定）。`}
          </p>
        </form>
      ) : (
        <form onSubmit={handleMagicLink} className="flex flex-col gap-3">
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
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────

function SentBanner({
  title,
  body,
  hint,
  onReset,
}: {
  title: string
  body: React.ReactNode
  hint: string
  onReset: () => void
}) {
  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <MailCheck className="h-4 w-4 text-emerald-400" />
        <p className="text-sm font-semibold text-emerald-300">{title}</p>
      </div>
      <p className="text-xs text-emerald-300/70 leading-relaxed">{body}</p>
      <p className="text-[10px] text-emerald-300/50 leading-relaxed">{hint}</p>
      <button
        type="button"
        onClick={onReset}
        className="self-start text-xs text-emerald-300 underline underline-offset-2 mt-1"
      >
        重新輸入
      </button>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
        active
          ? 'bg-violet/20 text-violet'
          : 'text-muted hover:text-text-base'
      }`}
    >
      {children}
    </button>
  )
}

function ModeRadio({
  checked,
  onClick,
  children,
}: {
  checked: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
        checked
          ? 'bg-primary/10 border-primary/40 text-primary'
          : 'border-card-border text-muted hover:text-text-base'
      }`}
    >
      {children}
    </button>
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

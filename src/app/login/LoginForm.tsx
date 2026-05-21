'use client'

import { useState } from 'react'
import Link from 'next/link'
import clsx from 'clsx'
import { Loader2, Mail, MailCheck, KeyRound, UserPlus } from 'lucide-react'
import { getBrowserSupabaseClient } from '@/lib/supabase/browserClient'

const PASSWORD_MIN = 8

const inputCls =
  'w-full rounded-[20px] border border-white/10 bg-black/10 px-4 py-3.5 text-sm text-white placeholder:text-white/28 focus:border-[#ff6cb7]/40 focus:outline-none transition-colors'
const panelCls = 'rounded-[24px] border border-white/8 bg-white/[0.035] p-4'

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
      <section className={panelCls}>
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-white/40">
          Primary Access
        </p>
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={anySubmitting}
          className="mt-3 flex w-full items-center justify-center gap-2.5 rounded-[20px] border border-white/10 bg-white px-4 py-3.5 text-sm font-semibold text-gray-900 transition-opacity hover:bg-gray-100 disabled:opacity-60"
        >
          {oauthSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleLogo className="h-4 w-4" />}
          {oauthSubmitting ? '導向 Google…' : '使用 Google 登入'}
        </button>
        <p className="mt-3 text-xs leading-6 text-white/46">
          想最快進入 archive，可以直接走 Google。下面也保留 email 密碼與 magic link。
        </p>
      </section>

      <section className={panelCls}>
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <p className="text-[10px] uppercase tracking-[0.24em] text-white/34">或使用 Email</p>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <div className="mt-4 flex gap-2 rounded-[22px] border border-white/8 bg-black/10 p-1">
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
            className="mt-4 flex flex-col gap-3"
          >
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

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-white/62">
                密碼
                {passwordMode === 'signup' && (
                  <span className="ml-1 text-white/36">（至少 {PASSWORD_MIN} 字元）</span>
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
              <p className="text-xs leading-6 text-red-200 break-all">{error}</p>
            )}

            <button
              type="submit"
              disabled={anySubmitting}
              className="mt-1 flex items-center justify-center gap-2 rounded-[20px] bg-[#ff4ca1] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_14px_40px_rgba(255,76,161,0.28)] transition-opacity disabled:opacity-60"
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

            {passwordMode === 'signin' && (
              <Link
                href="/forgot-password"
                className="self-start text-[11px] text-[#ff9ed3] underline underline-offset-2"
              >
                忘記密碼？
              </Link>
            )}

            <p className="text-[11px] leading-6 text-white/42">
              {passwordMode === 'signin'
                ? '使用既有帳號的 email 與密碼登入。'
                : '註冊後可能會收到確認信，實際流程依 Supabase 的 Confirm email 設定而定。'}
            </p>
          </form>
        ) : (
          <form onSubmit={handleMagicLink} className="mt-4 flex flex-col gap-3">
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
              disabled={anySubmitting}
              className="mt-1 flex items-center justify-center gap-2 rounded-[20px] bg-[#ff4ca1] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_14px_40px_rgba(255,76,161,0.28)] transition-opacity disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              {submitting ? '寄送中…' : '寄送登入連結'}
            </button>

            <p className="text-[11px] leading-6 text-white/42">
              點擊「寄送登入連結」後，請到信箱收信並點擊連結完成登入，不需要設定密碼。
            </p>
          </form>
        )}
      </section>
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
    <div className="rounded-[24px] border border-emerald-400/18 bg-emerald-400/10 p-4">
      <div className="flex items-center gap-2">
        <MailCheck className="h-4 w-4 text-emerald-300" />
        <p className="text-sm font-semibold text-emerald-100">{title}</p>
      </div>
      <p className="mt-2 text-xs leading-6 text-emerald-100/78">{body}</p>
      <p className="mt-1 text-[11px] leading-6 text-emerald-100/56">{hint}</p>
      <button
        type="button"
        onClick={onReset}
        className="mt-2 self-start text-xs text-emerald-100 underline underline-offset-2"
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
      className={clsx(
        'flex-1 rounded-[18px] px-3 py-2.5 text-xs font-semibold transition-colors',
        active
          ? 'bg-[#ff4ca1] text-white shadow-[0_10px_28px_rgba(255,76,161,0.24)]'
          : 'text-white/52 hover:text-white',
      )}
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
      className={clsx(
        'flex-1 rounded-full border px-3 py-2 text-xs font-semibold transition-colors',
        checked
          ? 'border-[#ff6cb7]/34 bg-[#ff4ca1]/14 text-[#ff9ed3]'
          : 'border-white/10 text-white/52 hover:text-white',
      )}
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

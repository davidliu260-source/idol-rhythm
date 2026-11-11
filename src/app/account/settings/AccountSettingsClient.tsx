'use client'

import { useState } from 'react'
import {
  AlertTriangle,
  Loader2,
  Mail,
  MailCheck,
  Trash2,
  X,
} from 'lucide-react'
import { getBrowserSupabaseClient } from '@/lib/supabase/browserClient'

const inputCls =
  'w-full rounded-[20px] border border-white/10 bg-black/10 px-4 py-3.5 text-sm text-white placeholder:text-white/28 focus:border-[#ff6cb7]/40 focus:outline-none transition-colors'

interface AccountSettingsClientProps {
  currentEmail: string | null
}

export default function AccountSettingsClient({
  currentEmail,
}: AccountSettingsClientProps) {
  return (
    <div className="flex flex-col gap-4">
      <CurrentAccountPanel currentEmail={currentEmail} />
      <ChangeEmailForm currentEmail={currentEmail} />
      <DangerZone currentEmail={currentEmail} />
    </div>
  )
}

// ── Current account read-only panel ────────────────────────────────────────

function CurrentAccountPanel({ currentEmail }: { currentEmail: string | null }) {
  return (
    <section className="rounded-[24px] border border-white/8 bg-white/[0.035] p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-white/40">
        Current Account
      </p>
      <div className="mt-3 flex flex-col gap-1.5">
        <span className="text-xs font-medium text-white/62">Email</span>
        <p className="break-all rounded-[18px] border border-white/8 bg-black/15 px-4 py-3 text-sm font-mono text-white/86">
          {currentEmail ?? '—'}
        </p>
      </div>
    </section>
  )
}

// ── Change-email form ──────────────────────────────────────────────────────

function ChangeEmailForm({ currentEmail }: { currentEmail: string | null }) {
  const [newEmail, setNewEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const trimmed = newEmail.trim()
    if (!trimmed) {
      setError('請輸入新的 email')
      return
    }
    if (
      currentEmail &&
      trimmed.toLowerCase() === currentEmail.toLowerCase()
    ) {
      setError('新 email 與目前 email 相同')
      return
    }

    setSubmitting(true)
    const supabase = getBrowserSupabaseClient()
    if (!supabase) {
      setError('Supabase 未設定')
      setSubmitting(false)
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({
      email: trimmed,
    })

    if (updateError) {
      setError(updateError.message)
      setSubmitting(false)
      return
    }

    setSent(trimmed)
    setNewEmail('')
    setSubmitting(false)
  }

  if (sent) {
    return (
      <section className="rounded-[24px] border border-emerald-400/18 bg-emerald-400/10 p-4">
        <div className="flex items-center gap-2">
          <MailCheck className="h-4 w-4 text-emerald-300" />
          <p className="text-sm font-semibold text-emerald-100">
            確認信已寄出
          </p>
        </div>
        <p className="mt-2 text-xs leading-6 text-emerald-100/80">
          請到 <span className="font-mono break-all">{sent}</span> 收信並點擊
          確認連結。連結點開後新 email 才會生效；在那之前，原 email
          仍然可用於登入。
        </p>
        <p className="mt-1 text-[11px] leading-6 text-emerald-100/56">
          沒收到？請檢查垃圾信件夾。連結通常 1 小時內有效。
        </p>
        <button
          type="button"
          onClick={() => {
            setSent(null)
            setError(null)
          }}
          className="mt-2 self-start text-xs text-emerald-100 underline underline-offset-2"
        >
          換一個 email 重試
        </button>
      </section>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[24px] border border-white/8 bg-white/[0.035] p-4"
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-white/40">
        Change Email
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-white/62">新 Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="new@example.com"
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
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Mail className="h-4 w-4" />
          )}
          {submitting ? '寄送中…' : '寄送確認信到新 email'}
        </button>

        <p className="text-[11px] leading-6 text-white/42">
          我們會寄一封確認連結到「新 email」。你必須到新信箱點擊連結後，
          email 才會正式更新。確認前，原 email 仍可登入。
        </p>
        <p className="text-[11px] leading-6 text-white/42">
          如果是 Google 等 OAuth 登入帳號，部分 provider 可能拒絕更動。
          若收到錯誤訊息，請直接以原帳號繼續使用。
        </p>
      </div>
    </form>
  )
}

// ── Danger zone (delete account) ───────────────────────────────────────────

function DangerZone({ currentEmail }: { currentEmail: string | null }) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <section className="rounded-[24px] border border-red-400/30 bg-red-500/8 p-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-red-300" />
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-red-200">
          Danger Zone
        </p>
      </div>

      <h2 className="mt-3 text-sm font-semibold text-white">刪除帳號</h2>

      <p className="mt-2 text-xs leading-6 text-white/72">
        此操作<strong className="text-red-200">不可復原</strong>。
        我們會永久刪除：
      </p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs leading-6 text-white/72">
        <li>追蹤的偶像（user_follows）</li>
        <li>收藏的活動（saved_events）</li>
        <li>個人提醒（reminders）</li>
        <li>站內通知（notifications）</li>
        <li>帳號本身（auth.users）</li>
      </ul>

      <p className="mt-2 text-[11px] leading-6 text-white/50">
        如果你以 Google 等 OAuth 登入，刪除帳號不會自動撤銷 Google
        端的授權。如有需要，請到 Google 帳戶安全性設定移除本網站存取權。
      </p>

      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[20px] border border-red-400/40 bg-red-500/15 px-4 py-3.5 text-sm font-semibold text-red-100 transition-colors hover:bg-red-500/25"
      >
        <Trash2 className="h-4 w-4" />
        刪除帳號
      </button>

      {confirmOpen && (
        <DeleteAccountModal
          currentEmail={currentEmail}
          onClose={() => setConfirmOpen(false)}
        />
      )}
    </section>
  )
}

function DeleteAccountModal({
  currentEmail,
  onClose,
}: {
  currentEmail: string | null
  onClose: () => void
}) {
  const [emailInput, setEmailInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const normalisedCurrent = (currentEmail ?? '').trim().toLowerCase()
  const normalisedInput = emailInput.trim().toLowerCase()
  const gatePassed =
    normalisedCurrent.length > 0 && normalisedInput === normalisedCurrent

  async function handleDelete() {
    if (!gatePassed) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Body intentionally empty — server uses session user only.
        // See work order §5.4 / §5.5 / §8.
      })

      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null

      if (!res.ok || !body?.ok) {
        setError(body?.error ?? '刪除失敗，請稍後再試')
        setSubmitting(false)
        return
      }

      // Drop the local session, then redirect away from authenticated areas.
      const supabase = getBrowserSupabaseClient()
      if (supabase) {
        await supabase.auth.signOut()
      }
      window.location.href = '/?account_deleted=1'
    } catch (e) {
      setError(e instanceof Error ? e.message : '刪除失敗，請稍後再試')
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-account-title"
    >
      <div className="relative w-full max-w-[440px] rounded-[24px] border border-red-400/30 bg-[#1b1117] p-5">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          aria-label="關閉"
          className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-white/64 transition-colors hover:text-white disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-300" />
          <p
            id="delete-account-title"
            className="text-sm font-semibold text-red-100"
          >
            刪除帳號（不可復原）
          </p>
        </div>

        <p className="mt-3 text-xs leading-6 text-white/72">
          確認後將立即永久刪除帳號 <br />
          <span className="font-mono break-all text-white">
            {currentEmail ?? '—'}
          </span>
          <br />
          以及所有追蹤、收藏、提醒、站內通知。
        </p>

        <label className="mt-4 flex flex-col gap-1.5">
          <span className="text-xs font-medium text-white/62">
            為了確認，請輸入目前帳號的 email
          </span>
          <input
            type="email"
            autoComplete="off"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder={currentEmail ?? '輸入目前 email'}
            disabled={submitting}
            className={inputCls}
          />
        </label>

        {error && (
          <p className="mt-2 text-xs leading-6 text-red-200 break-all">
            {error}
          </p>
        )}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="inline-flex flex-1 items-center justify-center rounded-[20px] border border-white/10 bg-white/[0.045] px-4 py-3 text-sm font-medium text-white/80 transition-colors hover:text-white disabled:opacity-60"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!gatePassed || submitting}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-[20px] border border-red-400/50 bg-red-500/25 px-4 py-3 text-sm font-semibold text-red-50 transition-colors hover:bg-red-500/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {submitting ? '刪除中…' : '永久刪除帳號'}
          </button>
        </div>

        <p className="mt-3 text-[10px] leading-5 text-white/40">
          確認鈕在你輸入完整且正確的目前 email 之前不會啟用。
        </p>
      </div>
    </div>
  )
}

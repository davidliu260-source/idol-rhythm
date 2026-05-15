'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase/client'

export default function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = getSupabaseClient()
    if (!supabase) {
      setError('Supabase 連線未設定，請確認環境變數。')
      setLoading(false)
      return
    }

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (authError) {
      // Don't expose the exact Supabase error message to the user
      setError('登入失敗，請確認帳號與密碼是否正確。')
      setLoading(false)
      return
    }

    // Auth succeeded — navigate to /admin.
    // The Server Component will call getCurrentAdmin() to verify admin_users.
    // A non-admin Auth user will see the guard notice, not the dashboard.
    router.push('/admin')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Email */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-xs font-medium text-muted">
          電子郵件
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@example.com"
          className="rounded-xl border border-card-border bg-bg px-3 py-2.5 text-sm text-text-base placeholder:text-muted/40 focus:outline-none focus:border-violet/60 transition-colors"
        />
      </div>

      {/* Password */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-xs font-medium text-muted">
          密碼
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="rounded-xl border border-card-border bg-bg px-3 py-2.5 text-sm text-text-base placeholder:text-muted/40 focus:outline-none focus:border-violet/60 transition-colors"
        />
      </div>

      {/* Error message */}
      {error && (
        <p className="text-xs text-red-400 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
          {error}
        </p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-violet px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 transition-opacity"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? '登入中…' : '登入後台'}
      </button>
    </form>
  )
}

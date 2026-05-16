export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { ArrowLeft, Mail, ShieldCheck } from 'lucide-react'
import { getCurrentUser } from '@/lib/supabase/auth'
import LoginForm from './LoginForm'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string }
}) {
  const user = await getCurrentUser()
  const next = searchParams.next && searchParams.next.startsWith('/') ? searchParams.next : '/me'

  // Already signed in
  if (user) {
    return (
      <div className="flex flex-col px-4 pt-12 pb-6 gap-4">
        <Link
          href="/me"
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-text-base"
        >
          <ArrowLeft className="h-3 w-3" />
          回到個人頁
        </Link>
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-start gap-3">
          <ShieldCheck className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-emerald-300">已登入</p>
            <p className="text-xs text-emerald-300/70 break-all">{user.email ?? '—'}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col px-4 pt-12 pb-6 gap-4">
      <Link
        href="/me"
        className="inline-flex items-center gap-1 text-xs text-muted hover:text-text-base"
      >
        <ArrowLeft className="h-3 w-3" />
        回到個人頁
      </Link>

      <div className="flex items-center gap-2">
        <Mail className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold text-text-base">登入會員</h1>
      </div>

      <p className="text-xs text-muted leading-relaxed">
        透過 email 收信登入，免密碼。登入後可以將收藏活動同步到你的帳號，
        更換裝置也能找到。
      </p>

      {searchParams.error && (
        <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2.5">
          <p className="text-xs text-red-400 leading-relaxed break-all">
            登入失敗：{searchParams.error}
          </p>
        </div>
      )}

      <LoginForm nextPath={next} />
    </div>
  )
}

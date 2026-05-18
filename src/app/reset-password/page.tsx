export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, KeyRound } from 'lucide-react'
import { getCurrentUser } from '@/lib/supabase/auth'
import ResetPasswordForm from './ResetPasswordForm'

/**
 * "Set new password" page reached after clicking the link in the password
 * reset email. The /auth/callback handler has already exchanged the PKCE
 * code for a session, so by the time we render this page the user is
 * authenticated. If somehow we land here without a session, redirect to
 * /forgot-password to restart the flow.
 *
 * The actual password update happens client-side via
 * supabase.auth.updateUser({ password }).
 */
export default async function ResetPasswordPage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/forgot-password?error=' + encodeURIComponent('連結已過期或無效，請重新申請重設密碼。'))
  }

  return (
    <div className="flex flex-col pt-12 pb-6 px-4 max-w-md mx-auto gap-6">
      <Link
        href="/me"
        className="inline-flex items-center gap-1 text-xs text-muted hover:text-text-base"
      >
        <ArrowLeft className="h-3 w-3" />
        返回我的
      </Link>

      <div className="flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold text-text-base">設定新密碼</h1>
      </div>

      <p className="text-xs text-muted leading-relaxed">
        為 <span className="font-mono text-text-base break-all">{user.email}</span> 設定新密碼。設定後即會以此密碼登入。
      </p>

      <ResetPasswordForm />
    </div>
  )
}

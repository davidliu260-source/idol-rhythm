export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { KeyRound } from 'lucide-react'
import AuthArchiveLayout from '@/components/AuthArchiveLayout'
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
    <AuthArchiveLayout
      backHref="/me"
      backLabel="返回我的"
      eyebrow="RECOVERY ACCESS"
      title="設定新密碼"
      description={
        <>
          為 <span className="break-all font-mono text-white">{user.email}</span>{' '}
          設定新密碼。更新後會保留目前 session，並帶你回到個人控制台。
        </>
      }
      icon={<KeyRound className="h-5 w-5" />}
      headerAside={
        <>
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/40">
            Session
          </p>
          <p className="mt-1 text-xs font-semibold text-white">Temporary Access</p>
        </>
      }
    >
      <ResetPasswordForm />
    </AuthArchiveLayout>
  )
}

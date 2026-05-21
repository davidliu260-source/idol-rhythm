export const dynamic = 'force-dynamic'

import { KeyRound } from 'lucide-react'
import AuthArchiveLayout from '@/components/AuthArchiveLayout'
import ForgotPasswordForm from './ForgotPasswordForm'

/**
 * Standalone "forgot password" request page.
 *
 * Anonymous: collects the user's email and triggers
 * supabase.auth.resetPasswordForEmail. Success state shows an inbox-check
 * banner. The email link redirects through /auth/callback?next=/reset-password
 * which sets a short-lived session, then /reset-password collects the new
 * password.
 *
 * Logged-in users can still access this page — useful if they want to send
 * themselves a reset link from a different device.
 */
export default function ForgotPasswordPage() {
  return (
    <AuthArchiveLayout
      backHref="/login"
      backLabel="返回登入"
      eyebrow="RECOVERY ACCESS"
      title="忘記密碼"
      description="輸入註冊時使用的 email，我們會寄一封重設密碼連結。點開連結後，就能回到 archive 內設定新密碼。"
      icon={<KeyRound className="h-5 w-5" />}
      headerAside={
        <>
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/40">
            Recovery
          </p>
          <p className="mt-1 text-xs font-semibold text-white">Reset Link</p>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthArchiveLayout>
  )
}

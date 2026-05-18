export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { ArrowLeft, KeyRound } from 'lucide-react'
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
    <div className="flex flex-col pt-12 pb-6 px-4 max-w-md mx-auto gap-6">
      <Link
        href="/login"
        className="inline-flex items-center gap-1 text-xs text-muted hover:text-text-base"
      >
        <ArrowLeft className="h-3 w-3" />
        返回登入
      </Link>

      <div className="flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold text-text-base">忘記密碼</h1>
      </div>

      <p className="text-xs text-muted leading-relaxed">
        輸入註冊時使用的 email，我們會寄一封重設密碼的連結給你。點擊連結後即可設定新密碼。
      </p>

      <ForgotPasswordForm />
    </div>
  )
}

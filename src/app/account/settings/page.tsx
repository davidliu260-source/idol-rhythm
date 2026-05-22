export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { Settings } from 'lucide-react'
import AuthArchiveLayout from '@/components/AuthArchiveLayout'
import { getCurrentUser } from '@/lib/supabase/auth'
import AccountSettingsClient from './AccountSettingsClient'

/**
 * /account/settings
 *
 * Authenticated-only account management surface for v1:
 *   - View current email
 *   - Change email (Supabase double-opt-in confirmation flow)
 *   - Delete account (irreversible; cascades user-scoped tables)
 *
 * SSR auth gate: unauth users are redirected to /login with returnUrl set
 * so they bounce back here after signing in.
 *
 * See ACCOUNT_SETTINGS_WORK_ORDER.md for the full plan, security
 * checklist, and cascade inventory.
 */
export default async function AccountSettingsPage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login?returnUrl=/account/settings')
  }

  return (
    <AuthArchiveLayout
      backHref="/me"
      backLabel="返回個人頁"
      eyebrow="ACCOUNT ARCHIVE"
      title="帳號設定"
      description="管理目前登入帳號的 email 與資料保存。刪除帳號為不可復原操作，請務必確認後再執行。"
      icon={<Settings className="h-5 w-5" />}
      headerAside={
        <>
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/40">
            Account
          </p>
          <p className="mt-1 text-xs font-semibold text-white">Settings v1</p>
        </>
      }
    >
      <AccountSettingsClient currentEmail={user.email} />
    </AuthArchiveLayout>
  )
}

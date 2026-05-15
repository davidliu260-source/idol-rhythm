import { Lock } from 'lucide-react'
import LoginForm from './LoginForm'

export default function AdminLoginPage() {
  return (
    <div className="flex flex-col pt-12 pb-6 px-4">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-violet" />
          <h1 className="text-xl font-bold text-text-base">管理員登入</h1>
        </div>
        <p className="text-xs text-muted mt-1">僅限已授權管理員使用</p>
      </div>

      {/* Login card */}
      <div className="rounded-xl bg-card border border-card-border px-5 py-5">
        <LoginForm />
      </div>

      {/* Notes */}
      <div className="mt-4 flex flex-col gap-1.5">
        <p className="text-[10px] text-muted/50 text-center leading-snug">
          登入成功後，系統仍會驗證 admin_users 管理員身份。
        </p>
        <p className="text-[10px] text-muted/40 text-center">
          不開放自行註冊。如需存取請聯繫系統管理員。
        </p>
      </div>
    </div>
  )
}

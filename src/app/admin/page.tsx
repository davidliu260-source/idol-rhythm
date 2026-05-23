export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { LayoutDashboard, Users, CalendarCheck, Clock, FileSearch, ChevronRight, Lock, ShieldCheck, Inbox, Database, BarChart2 } from 'lucide-react'
import { getAdminStats } from '@/lib/supabase/adminStats'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'

export default async function AdminPage() {
  const [{ isAdmin, user, diag }, stats] = await Promise.all([
    getCurrentAdmin(),
    getAdminStats(),
  ])

  const hasData = stats.activeIdols !== null || stats.publishedEvents !== null

  return (
    <div className="flex flex-col gap-0 pt-12 pb-6">
      {/* Header */}
      <div className="px-4 mb-4">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5 text-violet" />
          <h1 className="text-xl font-bold text-text-base">Admin Dashboard</h1>
        </div>
        <p className="text-xs text-muted mt-1">Idol Rhythm 後台概覽</p>
      </div>

      {/* Admin guard notice — shown when not logged in or not admin */}
      {!isAdmin && (
        <div className="px-4 mb-4 flex flex-col gap-2">
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 px-3 py-3 flex items-start gap-2.5">
            <Lock className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold text-amber-300">需要管理員登入</p>
              <p className="text-xs text-amber-300/70 leading-snug">
                {user
                  ? '您的帳號無後台管理權限。請確認已加入 admin_users 且 is_active = true。'
                  : '請先登入管理員帳號才能使用寫入功能。目前僅顯示只讀預覽。'}
              </p>
              {!user && (
                <Link
                  href="/admin/login"
                  className="mt-0.5 self-start text-xs font-semibold text-amber-300 underline underline-offset-2"
                >
                  前往管理員登入 →
                </Link>
              )}
            </div>
          </div>

          {/* Dev diagnostics — remove or hide once auth is confirmed working */}
          <div className="rounded-xl bg-card border border-card-border px-3 py-3 flex flex-col gap-1.5">
            <p className="text-[10px] font-semibold text-muted uppercase tracking-wide">Auth 診斷（開發用）</p>
            <DiagRow label="Supabase 連線" ok={diag.supabaseReady} value={diag.supabaseReady ? 'env OK' : 'env missing'} />
            <DiagRow label="Auth user" ok={diag.gotUser} value={
              diag.gotUser && user
                ? `${user.email ?? '—'} · uid: ${user.id.slice(0, 8)}…`
                : diag.userError ?? 'no session'
            } />
            <DiagRow
              label="admin_users row"
              ok={diag.adminRowFound === true}
              value={
                diag.adminRowFound === null
                  ? '未查詢（無 user）'
                  : diag.adminRowFound
                  ? '找到，is_active=true'
                  : diag.adminError
                  ? `找不到 — ${diag.adminError}`
                  : '找不到（user_id 不匹配或 RLS 阻擋）'
              }
            />
          </div>
        </div>
      )}

      {/* Admin confirmed banner — shown when logged in as admin */}
      {isAdmin && user && (
        <div className="px-4 mb-4">
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 px-3 py-2.5 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400 flex-shrink-0" />
            <p className="text-xs text-emerald-300">
              管理員已驗證
              {user.email && (
                <span className="text-emerald-300/60 ml-1">· {user.email}</span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Read-only preview banner */}
      <div className="px-4 mb-4">
        <div className="rounded-xl bg-violet/10 border border-violet/25 px-3 py-2.5 flex flex-col gap-0.5">
          <p className="text-xs font-semibold text-violet">Admin Preview｜Read-only dashboard</p>
          <p className="text-xs text-muted leading-snug">
            資料唯讀，不影響前台。寫入功能需管理員身份驗證（Phase 3）。
          </p>
        </div>
      </div>

      {/* Supabase unavailable state */}
      {!hasData && (
        <div className="px-4 mb-4">
          <div className="rounded-xl bg-card border border-card-border px-4 py-6 text-center">
            <p className="text-sm text-muted">Admin dashboard is read-only demo</p>
            <p className="text-xs text-muted/60 mt-1">
              Supabase 連線未設定或資料不可用，顯示空狀態。
            </p>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="px-4 grid grid-cols-2 gap-3">
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Active Idols"
          value={stats.activeIdols}
          description="is_active = true"
        />
        <StatCard
          icon={<CalendarCheck className="h-4 w-4" />}
          label="Published Events"
          value={stats.publishedEvents}
          description="official + media"
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Upcoming Events"
          value={stats.upcomingEvents}
          description="今日起已發布活動"
        />
        <StatCard
          icon={<FileSearch className="h-4 w-4" />}
          label="Pending Candidates"
          value={stats.pendingCandidates}
          description="需 admin auth 才可讀"
          requiresAuth
        />
      </div>

      {/* Quick nav */}
      <div className="px-4 mt-6 flex flex-col gap-2">
        <p className="text-xs font-semibold text-text-base mb-1">後台頁面</p>
        <Link
          href="/admin/events"
          className="flex items-center justify-between rounded-xl bg-card border border-card-border px-4 py-3 hover:border-violet/40 transition-colors"
        >
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-violet" />
            <span className="text-sm text-text-base">後台活動列表</span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted" />
        </Link>
        <Link
          href="/admin/idols"
          className="flex items-center justify-between rounded-xl bg-card border border-card-border px-4 py-3 hover:border-violet/40 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-violet" />
            <span className="text-sm text-text-base">後台偶像列表</span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted" />
        </Link>
        <Link
          href="/admin/event-candidates"
          className="flex items-center justify-between rounded-xl bg-card border border-card-border px-4 py-3 hover:border-violet/40 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Inbox className="h-4 w-4 text-violet" />
            <span className="text-sm text-text-base">候選活動審核</span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted" />
        </Link>
        <Link
          href="/admin/sources"
          className="flex items-center justify-between rounded-xl bg-card border border-card-border px-4 py-3 hover:border-violet/40 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-violet" />
            <span className="text-sm text-text-base">資料來源管理</span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted" />
        </Link>
        <Link
          href="/admin/analytics"
          className="flex items-center justify-between rounded-xl bg-card border border-card-border px-4 py-3 hover:border-violet/40 transition-colors"
        >
          <div className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-violet" />
            <span className="text-sm text-text-base">用戶統計</span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted" />
        </Link>
      </div>

      {/* Phase info */}
      <div className="px-4 mt-4">
        <div className="rounded-xl bg-card border border-card-border px-4 py-4 flex flex-col gap-2">
          <p className="text-xs font-semibold text-text-base">Admin Roadmap</p>
          <ul className="flex flex-col gap-1">
            {[
              '✅ Phase 1：只讀 Dashboard',
              '✅ Phase 2：Events 列表',
              '✅ Phase D：Admin Guard 基礎',
              '⏳ Phase C：/admin/login 登入頁',
              '🔒 Phase 3：Event 新增 / 編輯（需 auth）',
              '🔒 Phase 4：Idols 管理（需 auth）',
              '🔒 Phase 5：Candidates 審核（需 auth）',
            ].map((item) => (
              <li key={item} className="text-xs text-muted">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function DiagRow({ label, ok, value }: { label: string; ok: boolean; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className={`text-[10px] font-mono flex-shrink-0 ${ok ? 'text-emerald-400' : 'text-red-400'}`}>
        {ok ? '✓' : '✗'}
      </span>
      <span className="text-[10px] text-muted flex-shrink-0 w-24">{label}</span>
      <span className="text-[10px] text-muted/70 break-all">{value}</span>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  description,
  requiresAuth = false,
}: {
  icon: React.ReactNode
  label: string
  value: number | null
  description: string
  requiresAuth?: boolean
}) {
  return (
    <div className="rounded-xl bg-card border border-card-border px-4 py-4 flex flex-col gap-2">
      <div className={`flex items-center gap-1.5 ${requiresAuth ? 'text-muted/50' : 'text-violet'}`}>
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${requiresAuth && value === null ? 'text-muted/40' : 'text-text-base'}`}>
        {value === null ? '—' : value.toLocaleString()}
      </p>
      <p className="text-[10px] text-muted/60 leading-snug">{description}</p>
    </div>
  )
}

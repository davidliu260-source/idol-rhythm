export const dynamic = 'force-dynamic'

import { LayoutDashboard, Users, CalendarCheck, Clock, FileSearch } from 'lucide-react'
import { getAdminStats } from '@/lib/supabase/adminStats'

export default async function AdminPage() {
  const stats = await getAdminStats()
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

      {/* Status banner */}
      <div className="px-4 mb-4">
        <div className="rounded-xl bg-violet/10 border border-violet/25 px-3 py-2.5 flex flex-col gap-0.5">
          <p className="text-xs font-semibold text-violet">Admin Preview｜Read-only dashboard</p>
          <p className="text-xs text-muted leading-snug">
            No auth / no write actions in this phase．資料唯讀，不影響前台。
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

      {/* Phase info */}
      <div className="px-4 mt-6">
        <div className="rounded-xl bg-card border border-card-border px-4 py-4 flex flex-col gap-2">
          <p className="text-xs font-semibold text-text-base">Phase 1 範圍</p>
          <ul className="flex flex-col gap-1">
            {[
              '✅ 只讀 Supabase counts',
              '✅ env 缺失時顯示 empty state',
              '⏳ Events list（Phase 2）',
              '🔒 資料寫入（Phase 3，需 auth）',
              '🔒 Candidates 審核（Phase 5，需 auth）',
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

export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  BarChart2,
  ChevronLeft,
  Users,
  Heart,
  Bookmark,
  Bell,
  BellOff,
  CalendarCheck,
  CalendarX,
  Inbox,
  Database,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'
import { getAnalyticsStats } from '@/lib/supabase/analyticsStats'

export default async function AdminAnalyticsPage() {
  // ── Admin guard ──────────────────────────────────────────────────────────
  const { isAdmin } = await getCurrentAdmin()
  if (!isAdmin) {
    redirect('/admin/login')
  }

  // ── Data ─────────────────────────────────────────────────────────────────
  const s = await getAnalyticsStats()

  return (
    <div className="flex flex-col gap-0 pt-12 pb-10">
      {/* Header */}
      <div className="px-4 mb-5">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-text-base transition-colors mb-3"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          後台首頁
        </Link>
        <div className="flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-violet" />
          <h1 className="text-xl font-bold text-text-base">用戶統計</h1>
        </div>
        <p className="text-xs text-muted mt-1">
          全站聚合數字 — 僅限 admin 檢視，不含任何個人資料
        </p>
      </div>

      {/* service_role unavailable banner */}
      {!s.serviceRoleAvailable && (
        <div className="px-4 mb-4">
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 px-3 py-3 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-300">service_role 未設定</p>
              <p className="text-xs text-amber-300/70 mt-0.5 leading-snug">
                用戶統計、互動數、通知數、管理員數顯示 —。
                請確認 <span className="font-mono">SUPABASE_SERVICE_ROLE_KEY</span> 已在
                Vercel Production 設定（格式 <span className="font-mono">eyJ...</span>，不可加
                <span className="font-mono"> NEXT_PUBLIC_</span> 前綴）。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Users ──────────────────────────────────────────────────────────── */}
      <Section title="Users" subtitle="auth.users — 需 service_role">
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="總用戶" value={s.totalUsers} icon={<Users className="h-3.5 w-3.5" />} />
          <StatCard label="新增 7d" value={s.newUsers7d} icon={<Users className="h-3.5 w-3.5" />} delta />
          <StatCard label="新增 30d" value={s.newUsers30d} icon={<Users className="h-3.5 w-3.5" />} delta />
        </div>
        <ServiceRoleNote available={s.serviceRoleAvailable} />
      </Section>

      {/* ── Interactions ───────────────────────────────────────────────────── */}
      <Section title="互動數" subtitle="user_follows / saved_events / reminders — 全站聚合">
        <div className="flex flex-col gap-2">
          <MetricRow
            icon={<Heart className="h-3.5 w-3.5 text-[#e91e8c]" />}
            label="追蹤（user_follows）"
            value={s.totalFollows}
          />
          <MetricRow
            icon={<Bookmark className="h-3.5 w-3.5 text-violet" />}
            label="收藏（saved_events）"
            value={s.totalSaves}
          />
          <MetricRow
            icon={<Bell className="h-3.5 w-3.5 text-amber-400" />}
            label="提醒（reminders）"
            value={s.totalReminders}
          />
        </div>
        <ServiceRoleNote available={s.serviceRoleAvailable} />
      </Section>

      {/* ── Notifications ──────────────────────────────────────────────────── */}
      <Section title="通知" subtitle="notifications — 全站聚合">
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="通知總數" value={s.totalNotifications} icon={<Bell className="h-3.5 w-3.5" />} />
          <StatCard label="未讀通知" value={s.unreadNotifications} icon={<BellOff className="h-3.5 w-3.5" />} />
        </div>
        <ServiceRoleNote available={s.serviceRoleAvailable} />
      </Section>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <Section title="活動內容" subtitle="events">
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="已發布" value={s.publishedEvents} icon={<CalendarCheck className="h-3.5 w-3.5" />} />
          <StatCard label="草稿" value={s.draftEvents} icon={<CalendarX className="h-3.5 w-3.5" />} />
        </div>
      </Section>

      {/* ── Candidates ─────────────────────────────────────────────────────── */}
      <Section title="候選活動" subtitle="event_candidates">
        {/* By review_status */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <StatCard label="待審核" value={s.pendingCandidates} icon={<Inbox className="h-3.5 w-3.5" />} />
          <StatCard label="已核准" value={s.approvedCandidates} icon={<Inbox className="h-3.5 w-3.5" />} />
          <StatCard label="已拒絕" value={s.rejectedCandidates} icon={<Inbox className="h-3.5 w-3.5" />} />
        </div>

        {/* By source_type */}
        {s.candidatesBySourceType && (
          <div className="rounded-xl bg-black/20 border border-white/5 px-3 py-2.5">
            <p className="text-[10px] font-medium uppercase tracking-widest text-muted mb-2">來源類型分布</p>
            <div className="flex flex-col gap-1">
              {Object.entries(s.candidatesBySourceType)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-xs text-muted font-mono">{type}</span>
                    <span className="text-xs font-semibold text-text-base">{count.toLocaleString()}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </Section>

      {/* ── Crawler Sources ─────────────────────────────────────────────────── */}
      <Section title="爬蟲來源" subtitle="crawler_sources">
        <div className="grid grid-cols-2 gap-2 mb-3">
          <StatCard label="啟用中" value={s.activeSources} icon={<Database className="h-3.5 w-3.5" />} />
          <StatCard label="總計" value={s.totalSources} icon={<Database className="h-3.5 w-3.5" />} />
        </div>

        {s.sourcesByParserType && (
          <div className="rounded-xl bg-black/20 border border-white/5 px-3 py-2.5">
            <p className="text-[10px] font-medium uppercase tracking-widest text-muted mb-2">Parser 類型</p>
            <div className="flex flex-col gap-1">
              {Object.entries(s.sourcesByParserType)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-xs text-muted font-mono">{type}</span>
                    <span className="text-xs font-semibold text-text-base">{count}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </Section>

      {/* ── Admins ─────────────────────────────────────────────────────────── */}
      <Section title="管理員" subtitle="admin_users — 需 service_role">
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="管理員數" value={s.adminUsers} icon={<ShieldCheck className="h-3.5 w-3.5" />} />
        </div>
        <ServiceRoleNote available={s.serviceRoleAvailable} />
      </Section>

      {/* Privacy notice */}
      <div className="px-4 mt-2">
        <p className="text-[10px] text-muted/50 leading-5 text-center">
          此頁面所有數字均為全站聚合總計，不含任何個人 email、user_id 明細或行為記錄。
        </p>
      </div>
    </div>
  )
}

// ── Sub-components (Server Component — no 'use client') ────────────────────

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="px-4 mb-4">
      <div className="mb-2">
        <p className="text-xs font-semibold text-text-base">{title}</p>
        {subtitle && <p className="text-[10px] text-muted/60">{subtitle}</p>}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
  delta = false,
}: {
  label: string
  value: number | null
  icon: React.ReactNode
  delta?: boolean
}) {
  const display = value === null ? '—' : value.toLocaleString()
  const isPositive = delta && value !== null && value > 0

  return (
    <div className="rounded-xl bg-card border border-card-border px-3 py-3 flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-violet">{icon}</div>
      <p
        className={`text-xl font-bold tabular-nums ${
          value === null ? 'text-muted/40' : isPositive ? 'text-emerald-300' : 'text-text-base'
        }`}
      >
        {isPositive ? '+' : ''}{display}
      </p>
      <p className="text-[10px] text-muted/60 leading-snug">{label}</p>
    </div>
  )
}

function MetricRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: number | null
}) {
  return (
    <div className="rounded-xl bg-card border border-card-border px-3 py-2.5 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs text-muted">{label}</span>
      </div>
      <span
        className={`text-sm font-semibold tabular-nums ${
          value === null ? 'text-muted/40' : 'text-text-base'
        }`}
      >
        {value === null ? '—' : value.toLocaleString()}
      </span>
    </div>
  )
}

function ServiceRoleNote({ available }: { available: boolean }) {
  if (available) return null
  return (
    <p className="text-[10px] text-amber-400/60 mt-1">
      service_role 未設定，此區塊顯示 —
    </p>
  )
}

'use client'

import {
  User,
  Bell,
  Shield,
  ChevronRight,
  Star,
  Calendar,
  Heart,
  LogIn,
  LogOut,
  Loader2,
} from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { useAppState } from '@/lib/appState'
import { getBrowserSupabaseClient } from '@/lib/supabase/browserClient'
import IdolAvatar from '@/components/IdolAvatar'
import type { Idol } from '@/lib/mockIdols'
import type { Event } from '@/lib/mockEvents'

export default function MeClient({ idols, events }: { idols: Idol[]; events: Event[] }) {
  const { following, favorites, reminders, user, isUserLoading } = useAppState()

  // ── Loading auth state ───────────────────────────────────────────────────
  if (isUserLoading) {
    return (
      <div className="flex flex-col px-4 pt-12 pb-6 items-center text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin mb-2" />
        載入中…
      </div>
    )
  }

  // ── Anonymous: login prompt ──────────────────────────────────────────────
  if (!user) {
    return (
      <div className="flex flex-col px-4 pt-12 pb-6 gap-6">
        <div className="flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold text-text-base">會員</h1>
        </div>

        <div className="rounded-2xl border border-card-border bg-card p-6 flex flex-col items-center gap-3 text-center">
          <div className="h-16 w-16 rounded-full bg-gradient-to-br from-violet-700 to-primary flex items-center justify-center text-white">
            <User className="h-7 w-7" />
          </div>
          <p className="text-sm font-semibold text-text-base">尚未登入</p>
          <p className="text-xs text-muted leading-relaxed max-w-xs">
            登入後可將收藏活動同步到你的帳號，
            <br />
            更換裝置也找得到。
          </p>
          <Link
            href="/login?next=/me"
            className="mt-1 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white"
          >
            <LogIn className="h-4 w-4" />
            登入 / 註冊
          </Link>
        </div>

        <p className="text-center text-xs text-muted/40">Idol Rhythm v0.1.0 MVP · 星動時刻</p>
      </div>
    )
  }

  // ── Logged in ────────────────────────────────────────────────────────────
  const followingIdols = idols.filter((i) => following.has(i.id))
  const now = new Date()
  const upcomingCount = events.filter(
    (e) => following.has(e.idolId) && new Date(e.date) >= now,
  ).length

  return (
    <div className="flex flex-col px-4 pt-12 pb-6 gap-6">
      {/* Profile card */}
      <div className="rounded-2xl border border-card-border bg-card p-5 flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-gradient-to-br from-violet-700 to-primary flex items-center justify-center text-2xl font-bold text-white">
          粉
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-text-base">會員</p>
          <p className="text-xs text-muted mt-0.5 break-all">{user.email ?? '—'}</p>
          <span className="mt-2 inline-block rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] text-emerald-300 font-semibold">
            已登入
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<Star className="h-5 w-5 text-primary" />}
          label="追蹤偶像"
          value={following.ids.length}
        />
        <StatCard
          icon={<Calendar className="h-5 w-5 text-violet" />}
          label="近期行程"
          value={upcomingCount}
        />
        <StatCard
          icon={<Heart className="h-5 w-5 text-rose-400" />}
          label="已收藏"
          value={favorites.ids.length}
        />
        <StatCard
          icon={<Bell className="h-5 w-5 text-violet-400" />}
          label="已設提醒"
          value={reminders.ids.length}
        />
      </div>

      {/* Following idols (existing UI, still localStorage-backed in Milestone 1) */}
      {followingIdols.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-text-base">追蹤中的偶像</h2>
            <Link href="/idols" className="flex items-center gap-0.5 text-xs text-muted">
              管理 <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {followingIdols.map((idol) => (
              <div
                key={idol.id}
                className="flex items-center gap-3 rounded-xl border border-card-border bg-card px-4 py-3"
              >
                <IdolAvatar
                  name={idol.name}
                  avatarUrl={idol.avatarUrl}
                  color={idol.color}
                  size="xs"
                  className="!h-9 !w-9 !rounded-xl !text-sm"
                />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-text-base">{idol.name}</p>
                  <p className="text-xs text-muted">{idol.agency}</p>
                </div>
                <Link href="/idols" className="text-xs text-muted">
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Sign out */}
      <SignOutButton />

      {/* Settings preview (still mock) */}
      <section>
        <h2 className="text-sm font-semibold text-text-base mb-3">設定</h2>
        <div className="flex flex-col gap-1">
          <MenuRow icon={<Bell className="h-4 w-4" />} label="通知設定" desc="推播與提醒偏好" />
          <MenuRow icon={<Shield className="h-4 w-4" />} label="隱私與帳號" desc="資料安全" />
        </div>
      </section>

      <p className="text-center text-xs text-muted/40">Idol Rhythm v0.1.0 MVP · 星動時刻</p>
    </div>
  )
}

function SignOutButton() {
  const [submitting, setSubmitting] = useState(false)

  async function handleSignOut() {
    setSubmitting(true)
    const supabase = getBrowserSupabaseClient()
    if (supabase) {
      await supabase.auth.signOut()
    }
    // Full reload to clear any in-memory state
    window.location.href = '/me'
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={submitting}
      className="flex items-center justify-center gap-2 rounded-xl border border-card-border bg-card px-4 py-3 text-sm font-medium text-muted hover:text-text-base disabled:opacity-60 transition-colors"
    >
      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
      登出
    </button>
  )
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: number
}) {
  return (
    <div className="rounded-2xl border border-card-border bg-card p-4 flex flex-col items-center gap-2">
      {icon}
      <p className="text-xl font-bold text-text-base">{value}</p>
      <p className="text-[10px] text-muted text-center leading-tight">{label}</p>
    </div>
  )
}

function MenuRow({
  icon,
  label,
  desc,
}: {
  icon: React.ReactNode
  label: string
  desc: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-card-border bg-card px-4 py-3.5">
      <span className="text-muted">{icon}</span>
      <div className="flex-1">
        <p className="text-sm font-semibold text-text-base">{label}</p>
        <p className="text-xs text-muted">{desc}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted" />
    </div>
  )
}

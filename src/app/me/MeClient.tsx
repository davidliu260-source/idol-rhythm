'use client'

import {
  User,
  Bell,
  Shield,
  ChevronRight,
  Star,
  Calendar,
  Heart,
  Settings,
} from 'lucide-react'
import { useAppState } from '@/lib/appState'
import Link from 'next/link'
import type { Idol } from '@/lib/mockIdols'
import type { Event } from '@/lib/mockEvents'

export default function MeClient({ idols, events }: { idols: Idol[]; events: Event[] }) {
  const { following, favorites, reminders } = useAppState()

  const followingIdols = idols.filter((i) => following.has(i.id))
  const now = new Date()
  const upcomingCount = events.filter(
    (e) => following.has(e.idolId) && new Date(e.date) >= now,
  ).length

  return (
    <div className="flex flex-col px-4 pt-12 pb-6 gap-6">
      {/* Profile card (mock) */}
      <div className="rounded-2xl border border-card-border bg-card p-5 flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-gradient-to-br from-violet-700 to-primary flex items-center justify-center text-2xl font-bold text-white">
          粉
        </div>
        <div className="flex-1">
          <p className="font-bold text-text-base">粉絲朋友</p>
          <p className="text-xs text-muted mt-0.5">fan@example.com</p>
          <span className="mt-2 inline-block rounded-full bg-primary/15 border border-primary/30 px-2 py-0.5 text-[10px] text-primary font-semibold">
            免費版
          </span>
        </div>
        <button>
          <Settings className="h-5 w-5 text-muted" />
        </button>
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

      {/* Following idols */}
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
                <div
                  className="h-9 w-9 rounded-xl flex items-center justify-center text-sm font-bold text-white"
                  style={{ background: `linear-gradient(135deg, ${idol.color}88, ${idol.color})` }}
                >
                  {idol.name.charAt(0)}
                </div>
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

      {/* Menu */}
      <section>
        <h2 className="text-sm font-semibold text-text-base mb-3">設定</h2>
        <div className="flex flex-col gap-1">
          <MenuRow icon={<Bell className="h-4 w-4" />} label="通知設定" desc="推播與提醒偏好" />
          <MenuRow icon={<Shield className="h-4 w-4" />} label="隱私與帳號" desc="資料安全" />
          <MenuRow icon={<Star className="h-4 w-4" />} label="升級方案" desc="解鎖更多功能" highlight />
        </div>
      </section>

      <p className="text-center text-xs text-muted/40">Idol Rhythm v0.1.0 MVP · 星動時刻</p>
    </div>
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
  highlight = false,
}: {
  icon: React.ReactNode
  label: string
  desc: string
  highlight?: boolean
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 ${
        highlight ? 'border-primary/40 bg-primary-dim' : 'border-card-border bg-card'
      }`}
    >
      <span className={highlight ? 'text-primary' : 'text-muted'}>{icon}</span>
      <div className="flex-1">
        <p className={`text-sm font-semibold ${highlight ? 'text-primary' : 'text-text-base'}`}>
          {label}
        </p>
        <p className="text-xs text-muted">{desc}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted" />
    </div>
  )
}

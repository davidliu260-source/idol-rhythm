export const dynamic = 'force-dynamic'

import { Bell } from 'lucide-react'
import { getVisibleEvents, type Event } from '@/lib/mockEvents'
import { MOCK_IDOLS } from '@/lib/mockIdols'
import { getPublishedEvents, getActiveIdols } from '@/lib/supabase/events'
import HomePersonalized from '@/components/HomePersonalized'
import HomeTimeline from '@/components/HomeTimeline'

export default async function HomePage() {
  const [supabaseEvents, supabaseIdols] = await Promise.all([
    getPublishedEvents(),
    getActiveIdols(),
  ])

  const events: Event[] = supabaseEvents.length > 0 ? supabaseEvents : getVisibleEvents()
  const idols = supabaseIdols.length > 0 ? supabaseIdols : MOCK_IDOLS

  const today = new Date()
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  const dateStr = `${today.getMonth() + 1}月${today.getDate()}日 週${weekdays[today.getDay()]}`

  return (
    <div className="flex flex-col gap-6 px-4 pt-12 pb-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted">{dateStr}</p>
          <h1 className="text-xl font-bold text-text-base mt-0.5">
            星動時刻
            <span className="ml-2 text-xs font-normal text-primary">Idol Rhythm</span>
          </h1>
        </div>
        <button className="relative rounded-full bg-card border border-card-border p-2.5">
          <Bell className="h-5 w-5 text-muted" />
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
        </button>
      </header>

      {/* Demo data banner */}
      <div className="flex items-start gap-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 px-3 py-2.5">
        <span className="text-amber-400 text-sm leading-none mt-0.5">⚠️</span>
        <p className="text-xs text-amber-300 leading-snug">
          <span className="font-semibold">Demo 展示資料</span>
          ｜目前為展示資料，非真實官方行程，請勿作為購票或出行依據
        </p>
      </div>

      {/* Personalized: following strip + my countdown (client, localStorage / cloud) */}
      <HomePersonalized events={events} idols={idols} />

      {/* Timeline: followed-idol-aware sections (client) */}
      <HomeTimeline events={events} idols={idols} />
    </div>
  )
}

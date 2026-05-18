export const dynamic = 'force-dynamic'

import { Bell } from 'lucide-react'
import { getPublishedEvents, getActiveIdols } from '@/lib/supabase/events'
import HomePersonalized from '@/components/HomePersonalized'
import HomeTimeline from '@/components/HomeTimeline'

export default async function HomePage() {
  const [events, idols] = await Promise.all([
    getPublishedEvents(),
    getActiveIdols(),
  ])

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

      {/* Personalized: following strip + my countdown (client, localStorage / cloud) */}
      <HomePersonalized events={events} idols={idols} />

      {/* Timeline: followed-idol-aware sections (client) */}
      <HomeTimeline events={events} idols={idols} />
    </div>
  )
}

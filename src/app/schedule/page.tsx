export const dynamic = 'force-dynamic'

import { Calendar } from 'lucide-react'
import { getVisibleEvents, type Event } from '@/lib/mockEvents'
import { MOCK_IDOLS } from '@/lib/mockIdols'
import { getPublishedEvents, getActiveIdols } from '@/lib/supabase/events'
import type { Idol } from '@/lib/types'
import ScheduleClient from './ScheduleClient'

export default async function SchedulePage() {
  const [supabaseEvents, supabaseIdols] = await Promise.all([
    getPublishedEvents(),
    getActiveIdols(),
  ])

  const events: Event[] = supabaseEvents.length > 0 ? supabaseEvents : getVisibleEvents()
  const idols: Idol[] = supabaseIdols.length > 0 ? supabaseIdols : MOCK_IDOLS

  return (
    <div className="flex flex-col gap-0 pt-12 pb-6">
      {/* Header */}
      <div className="px-4 mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold text-text-base">行程時間軸</h1>
        </div>
        <p className="text-xs text-muted mt-1">
          共 {events.length} 筆已確認活動
        </p>
      </div>

      {/* Demo banner */}
      <div className="px-4 mb-4">
        <div className="flex items-start gap-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 px-3 py-2.5">
          <span className="text-amber-400 text-sm leading-none mt-0.5">⚠️</span>
          <p className="text-xs text-amber-300 leading-snug">
            <span className="font-semibold">Demo 展示資料</span>
            ｜僅顯示官方確認與媒體確認的活動，非真實官方行程
          </p>
        </div>
      </div>

      <ScheduleClient events={events} idols={idols} />
    </div>
  )
}

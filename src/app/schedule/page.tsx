export const dynamic = 'force-dynamic'

import { Calendar } from 'lucide-react'
import { getPublishedEvents, getActiveIdols } from '@/lib/supabase/events'
import ScheduleClient from './ScheduleClient'

export default async function SchedulePage() {
  const [events, idols] = await Promise.all([
    getPublishedEvents(),
    getActiveIdols(),
  ])

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

      <ScheduleClient events={events} idols={idols} />
    </div>
  )
}

export const dynamic = 'force-dynamic'

import { Calendar } from 'lucide-react'
import { getPublishedEvents } from '@/lib/supabase/events'
import ScheduleClient from './ScheduleClient'
import { SCHEDULE_ARCHIVE_SHELL } from './scheduleTheme'

export default async function SchedulePage() {
  const events = await getPublishedEvents()

  return (
    <div className="relative flex flex-col gap-0 overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(255,92,178,0.12),transparent_24%),linear-gradient(180deg,#140f18_0%,#0a0910_100%)] pt-8 pb-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_9%,rgba(255,95,177,0.1),transparent_18%)]" />

      <div className="px-3">
        <div className={SCHEDULE_ARCHIVE_SHELL}>
          <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,110,193,0.55),transparent)]" />

          <div className="px-4 pt-6 pb-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.34em] text-white/35">
                <span className="h-2 w-2 rounded-full border border-[#ff6bbd]/60" />
                <span>IDOL · RHYTHM</span>
              </div>
              <div className="text-[10px] font-medium uppercase tracking-[0.28em] text-white/24">
                VOL.05 · 2026
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-[#ff63bd]" />
                <h1 className="text-[34px] font-bold leading-none text-white">行程時間軸</h1>
              </div>
              <p className="mt-2 text-xs text-white/48">
                共 {events.length} 筆已確認活動
              </p>
            </div>
          </div>

          <ScheduleClient events={events} />
        </div>
      </div>
    </div>
  )
}

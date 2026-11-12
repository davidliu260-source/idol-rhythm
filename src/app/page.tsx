export const dynamic = 'force-dynamic'

import { countUpcomingByCategory } from '@/lib/upcomingFilters'
import { HomeCategoryFilterProvider, HomeCategoryFilterBar, HomeCategoryLegend } from '@/components/HomeCategoryFilter'
import { Fragment } from 'react'
import { getPublishedEvents, getActiveIdols } from '@/lib/supabase/events'
import { CATEGORY_NEUTRALS, EVENT_CATEGORY_ORDER, getEventCategory } from '@/lib/eventCategory'
import { countTomorrowTickets, getDaysUntil, getHomeSubtitleClauses, selectNextEvent } from '@/lib/nextEventHero'
import HomeNotificationBell from '@/components/HomeNotificationBell'
import HomePersonalized from '@/components/HomePersonalized'
import HomeFollowedIdols from '@/components/HomeFollowedIdols'
import HomeUpcomingList from '@/components/HomeUpcomingList'
import { listUpcomingEvents } from '@/lib/upcomingEvents'
import HomeNextEventHero from '@/components/HomeNextEventHero'

import HomeWeekStrip from '@/components/HomeWeekStrip'
import HomeLatestPublished from '@/components/HomeLatestPublished'
import { countEndedEvents, getWeekDays, getWeekDots, hasWeekEvents, listLatestPublished } from '@/lib/homeWeekAndFeed'
import type { CategoryFilter } from '@/lib/upcomingFilters'

export default async function HomePage() {
  const [events, idols] = await Promise.all([
    getPublishedEvents(),
    getActiveIdols(),
  ])
  const now = new Date()
  const upcomingEvents = listUpcomingEvents(events, now)
  const categoryCounts = countUpcomingByCategory(upcomingEvents, now)
  const showCategoryFilter = categoryCounts.total > 0
  const dateStr = formatToday(now)
  const nextEvent = selectNextEvent(events, now)
  const subtitleClauses = getHomeSubtitleClauses({
    tomorrowTicketCount: countTomorrowTickets(events, (event) => getEventCategory(event) === 'ticket', now),
    nextEventDays: nextEvent ? getDaysUntil(nextEvent, now) : null,
  })
  const showWeek = hasWeekEvents(events, now)
  const weekDays = getWeekDays(now)
  const weekDotsByFilter = Object.fromEntries(
    (['all', ...EVENT_CATEGORY_ORDER] as CategoryFilter[]).map(id => [id, getWeekDots(events, now, id)]),
  ) as Record<CategoryFilter, ReturnType<typeof getWeekDots>>
  const latestEvents = listLatestPublished(events, now)
  const endedCount = countEndedEvents(events, now)
  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_12%_0%,rgba(255,90,174,0.16),transparent_24%),linear-gradient(180deg,#17111d_0%,#09070d_100%)] pb-28 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:34px_34px] opacity-24" />

      <div className="relative mx-auto flex w-full max-w-[520px] flex-col gap-5 px-4 pt-[18px]">
        <HomeCategoryFilterProvider>
        <header>
          <div className="flex items-center justify-between gap-4">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.32em] text-white/60">
              IDOL <span className="text-[#ff2d95]">·</span> RHYTHM
            </p>
            <HomeNotificationBell />
          </div>
          <div className="mt-6">
            <p className="text-[14px] leading-[1.5] text-[#a09db4]">{dateStr}</p>
            <h1 className="mt-1 text-[44px] font-black leading-[1.1] tracking-[-0.01em] text-white">
              今日活動
            </h1>
            {subtitleClauses.length > 0 && (
              <p className="mt-[10px] text-[15px] leading-[1.5] text-[#a09db4]">
                {subtitleClauses.map((clause, index) => (
                  <Fragment key={clause.strong}>
                    {index > 0 && '，'}
                    {clause.lead}
                    <strong className="font-bold text-white">{clause.strong}</strong>
                  </Fragment>
                ))}
              </p>
            )}
          </div>
        </header>

        {showCategoryFilter && <HomeCategoryFilterBar counts={categoryCounts} />}
        <HomeNextEventHero event={nextEvent} now={now} />

        {showWeek && <HomeWeekStrip days={weekDays} dotsByFilter={weekDotsByFilter} />}
        <HomeUpcomingList events={upcomingEvents} />
        {showCategoryFilter && <HomeCategoryLegend counts={categoryCounts} />}
        <HomeFollowedIdols idols={idols} />
        {latestEvents.length > 0 && <HomeLatestPublished events={latestEvents} now={now} />}
        <HomePersonalized events={events} />
        {endedCount > 0 && (
          <div className="flex items-center justify-between border-t py-5 text-[15px]" style={{ borderColor: CATEGORY_NEUTRALS.line, color: CATEGORY_NEUTRALS.muted }}>
            <span>已結束</span>
            <span><b className="font-bold" style={{ color: CATEGORY_NEUTRALS.text }}>{endedCount}</b> 場</span>
          </div>
        )}
        </HomeCategoryFilterProvider>
      </div>
    </div>
  )
}

function formatToday(date: Date): string {
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日 週${weekdays[date.getDay()]}`
}

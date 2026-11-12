import Link from 'next/link'
import type { Event } from '@/lib/types'
import { CATEGORY_NEUTRALS, EVENT_CATEGORIES, getCategoryTokens, getEventCategory } from '@/lib/eventCategory'
import { getHeroDateParts } from '@/lib/nextEventHero'
import { isNewlyPublished } from '@/lib/homeWeekAndFeed'
import CategoryIcon from './category/CategoryIcon'

export default function HomeLatestPublished({ events, now }: { events: Event[]; now: Date }) {
  if (events.length === 0) return null
  return <section aria-labelledby="home-latest-title">
    <div className="flex items-baseline justify-between">
      <h2 id="home-latest-title" className="text-2xl font-black">最新發佈</h2>
      <Link href="/schedule" className="text-sm" style={{ color: CATEGORY_NEUTRALS.muted }}>全部 ›</Link>
    </div>
    <div className="mt-[6px]">
      {events.map(event => {
        const category = getEventCategory(event)
        const tokens = getCategoryTokens(category)
        const date = getHeroDateParts(event)
        if (!date) return null
        return <Link key={event.id} href={`/events/${event.id}`} className="flex items-center gap-4 py-4 [&:not(:last-child)]:border-b" style={{ borderColor: CATEGORY_NEUTRALS.line }}>
          <div className="flex w-[50px] flex-none flex-col items-center text-center">
            <span className="pl-[2px] text-[15px] font-extrabold leading-[1.3]" style={{ color: tokens.accent }}>{date.month}月</span>
            <b className="pr-[1.5px] text-[30px] font-black leading-[1.05] tracking-[-0.02em] tabular-nums text-white">{date.day}</b>
            <span className="text-[12.5px] font-semibold leading-[1.3]" style={{ color: CATEGORY_NEUTRALS.muted }}>週{date.weekday}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[20px] font-black leading-[1.2]">
              {isNewlyPublished(event, now) && <span className="mr-[6px] inline-block rounded-[6px] px-[6px] py-px align-[2px] text-[10px] font-black tracking-[0.08em] text-white" style={{ background: CATEGORY_NEUTRALS.brandPink }}>NEW</span>}
              {event.idolName}
            </div>
            <div className="mt-[3px] flex items-center gap-2 text-sm" style={{ color: CATEGORY_NEUTRALS.muted }}>
              <span className="inline-flex flex-none items-center gap-1 font-extrabold" style={{ color: tokens.accent }}><CategoryIcon category={category} size={14} />{EVENT_CATEGORIES[category].label}</span>
              <span className="min-w-0 truncate">{event.title}</span>
            </div>
          </div>
          <span aria-hidden="true" className="flex-none text-2xl" style={{ color: CATEGORY_NEUTRALS.faint }}>›</span>
        </Link>
      })}
    </div>
  </section>
}

import Link from 'next/link'
import type { Event } from '@/lib/types'
import { CATEGORY_NEUTRALS, EVENT_CATEGORIES, getCategoryTokens, getEventCategory } from '@/lib/eventCategory'
import { getHeroDateParts, getHeroVenueLabel } from '@/lib/nextEventHero'
import { formatListMeta } from '@/lib/upcomingEvents'
import CategoryIcon from './category/CategoryIcon'
import CategoryGlyph from './category/CategoryGlyph'

export default function UpcomingEventCard({ event }: { event: Event }) {
  const category = getEventCategory(event)
  const tokens = getCategoryTokens(category)
  const date = getHeroDateParts(event)
  if (!date) return null
  return (
    <Link href={`/events/${event.id}`} className="relative flex items-center gap-[14px] overflow-hidden rounded-[22px] py-[14px] pl-[14px] pr-3" style={{ background: tokens.cardBackground, boxShadow: `inset 0 0 0 1px ${tokens.cardBorder}` }}>
      <span aria-hidden="true" className="pointer-events-none absolute -right-[30px] -top-10 h-[150px] w-[150px] rounded-full" style={{ background: tokens.cardGlow }} />
      <div data-date-tile className="relative z-[1] flex w-14 flex-none flex-col items-center rounded-2xl pb-[6px] pt-[7px] text-center" style={{ background: tokens.tileBackground, boxShadow: `inset 0 0 0 1px ${tokens.tileBorder}` }}>
        <span data-date-month className="pl-[2px] text-[15px] font-extrabold leading-[1.3]" style={{ color: tokens.accent }}>{date.month}月</span>
        {/* A trailing tabular 1 has a wider right side bearing in the system font. */}
        <b data-date-day style={{ transform: date.day % 10 === 1 ? `translateX(${date.day > 11 ? 3 : 2}px)` : undefined }} className="pr-[1.5px] text-[32px] font-black leading-[1.05] tracking-[-0.02em] text-white tabular-nums">{date.day}</b>
        <span data-date-weekday className="text-[12.5px] font-semibold leading-[1.3]" style={{ color: tokens.tileWeekday }}>週{date.weekday}</span>
      </div>
      <div className="relative z-[1] min-w-0 flex-1">
        <div className="inline-flex items-center gap-[5px] text-xs font-extrabold tracking-[0.04em]" style={{ color: tokens.accent }}><CategoryIcon category={category} size={14} />{EVENT_CATEGORIES[category].label}</div>
        <div className="mt-[2px] truncate text-[21px] font-black leading-[1.15] tracking-[-0.01em]">{event.idolName}</div>
        <div className="mt-[2px] truncate text-sm font-bold text-[#d9d6e8]">{event.title}</div>
        <div className="mt-px whitespace-nowrap text-[12.5px]" style={{ color: CATEGORY_NEUTRALS.muted }}>{formatListMeta(date.timeLabel, getHeroVenueLabel(event))}</div>
      </div>
      <CategoryGlyph category={category} size={66} className="relative z-[1] mr-[2px] flex-none rotate-[7deg]" style={{ color: tokens.glyphColor, filter: 'drop-shadow(0 6px 10px rgba(0,0,0,.3))' }} />
    </Link>
  )
}

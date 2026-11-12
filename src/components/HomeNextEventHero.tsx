import Link from 'next/link'
import { CalendarDays } from 'lucide-react'
import type { Event } from '@/lib/types'
import { EVENT_CATEGORIES, HERO_SCRIM_ALPHA, getCategoryTokens, getEventCategory, withAlpha } from '@/lib/eventCategory'
import { HERO_SCRIM_END_ALPHA, heroScrimBackground, getDaysUntil, getHeroCountdownLabel, getHeroDateParts, getHeroVenueLabel, getTrustLabel, getHeroAriaLabel } from '@/lib/nextEventHero'
import CategoryGlyph from '@/components/category/CategoryGlyph'
import CategoryIcon from '@/components/category/CategoryIcon'
import CategoryMotif from '@/components/category/CategoryMotif'
import HeroBeams from '@/components/category/HeroBeams'

export default function HomeNextEventHero({ event, now }: { event: Event | null; now: Date }) {
  const days = event ? getDaysUntil(event, now) : null
  const date = event ? getHeroDateParts(event) : null
  if (!event || days === null || date === null) return (
<section
  aria-label="下一場活動"
  className="flex items-start gap-4 rounded-[28px] border border-white/[0.07] bg-[#15141d] px-[22px] py-6"
>
  <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[14px] bg-[#1c1b27] text-[#a09db4]">
    <CalendarDays aria-hidden="true" className="h-5 w-5" />
  </span>
  <p className="text-[15px] leading-6 text-[#a09db4]">
    目前沒有可顯示的公開確認行程，資料更新後會出現在這裡。
  </p>
</section>
  )
  const category = getEventCategory(event)
  const tokens = getCategoryTokens(category)
  const categoryLabel = EVENT_CATEGORIES[category].label
  const stops = EVENT_CATEGORIES[category].heroStops
  const lastStopColor = stops[stops.length - 1].color
  const countdownLabel = getHeroCountdownLabel(days)
  const venueLabel = getHeroVenueLabel(event)
  const trustLabel = getTrustLabel(event.source?.level)
  const ariaLabel = getHeroAriaLabel({ countdownLabel, categoryLabel, date, idolName: event.idolName, title: event.title, venueLabel, trustLabel })
  return (
<Link
  href={`/events/${event.id}`}
  aria-label={ariaLabel}
  className="relative block min-h-[440px] overflow-hidden rounded-[28px] px-[22px] pb-6 pt-[22px] text-white transition-transform active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#09070d]"
  style={{
    background: tokens.heroBackground,
    boxShadow: `0 26px 44px -22px ${withAlpha(lastStopColor, 0.6)}`,
  }}
>
  {category === 'concert' ? (
    <HeroBeams gradientId="t30b-home-hero-beam" />
  ) : (
    <>
      <CategoryMotif
        category={category}
        className="pointer-events-none absolute -right-10 -top-5 h-[280px] w-[280px] text-white opacity-[0.16]"
      />
      <CategoryGlyph
        category={category}
        size={112}
        className="pointer-events-none absolute right-[22px] top-[118px]"
        style={{
          color: category === 'other' ? tokens.glyphColor : '#ffffff',
          opacity: category === 'other' ? 0.6 : 0.92,
          transform: 'rotate(8deg)',
          filter: 'drop-shadow(0 12px 18px rgba(0, 0, 0, 0.25))',
        }}
      />
    </>
  )}

  <div
    aria-hidden="true"
    className="pointer-events-none absolute inset-0"
    style={{ background: heroScrimBackground(HERO_SCRIM_ALPHA, HERO_SCRIM_END_ALPHA) }}
  />

  <div className="relative">
    <span className="inline-flex h-[30px] items-center gap-2 rounded-[15px] bg-black/[0.26] pl-[11px] pr-[13px] text-[13px] font-bold">
      <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full bg-white shadow-[0_0_0_4px_rgba(255,255,255,0.25)]" />
      下一場活動　{countdownLabel}
    </span>

    <div className="mt-[26px]">
      <p className="-ml-[2px] text-[22px] font-extrabold leading-none tracking-[0.01em]">
        {date.month}月
        <span className="ml-[6px] font-semibold">週{date.weekday} · {date.timeLabel}</span>
      </p>
      <p className="-ml-[10px] mt-[6px] text-[132px] font-black leading-[0.86] tracking-[-0.05em] tabular-nums">
        {date.day}
      </p>
      {date.rangeEndLabel && (
        <p className="mt-[10px] text-[22px] font-extrabold leading-none">{date.rangeEndLabel}</p>
      )}
    </div>

    <p className="ml-0 mt-[26px] line-clamp-2 break-words text-[34px] font-black leading-[1.05] tracking-[-0.01em]">
      {event.idolName}
    </p>
    <p className="mt-2 truncate text-[19px] font-bold leading-[1.3]">{event.title}</p>
    {venueLabel && <p className="mt-[6px] truncate text-[14.5px] leading-[1.5]">{venueLabel}</p>}

    <div className="mt-[18px] flex flex-wrap gap-2">
      <span className="inline-flex h-[30px] items-center gap-[6px] rounded-[15px] bg-black/[0.26] pl-[10px] pr-3 text-[13px] font-bold">
        <CategoryIcon category={category} size={15} />
        {categoryLabel}
      </span>
      {trustLabel && (
        <span className="inline-flex h-[30px] items-center rounded-[15px] bg-white px-3 text-[13px] font-bold text-[#18102c]">
          {trustLabel}
        </span>
      )}
    </div>
  </div>
</Link>
  )
}

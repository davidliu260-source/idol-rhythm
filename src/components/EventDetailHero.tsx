import type { Event } from '@/lib/types'
import { getEventCategory, getCategoryTokens, EVENT_CATEGORIES, HERO_SCRIM_ALPHA } from '@/lib/eventCategory'
import { getHeroDateParts, getTrustBadgeLabel, heroScrimBackground, HERO_SCRIM_END_ALPHA, HERO_FADE_BACKGROUND, HERO_TYPE_CHIP_BACKGROUND, HERO_TRUST_CHIP } from '@/lib/eventDetailHero'
import HeroBeams from '@/components/category/HeroBeams'
import CategoryMotif from '@/components/category/CategoryMotif'
import CategoryGlyph from '@/components/category/CategoryGlyph'
import CategoryIcon from '@/components/category/CategoryIcon'
import { EventDetailBackBtn, EventDetailReminderBtn, EventDetailFavoriteBtn } from '@/components/EventDetailActions'

export default function EventDetailHero({ event }: { event: Event }) {
  const category = getEventCategory(event)
  const tokens = getCategoryTokens(category)
  const parts = getHeroDateParts(event)
  const trust = getTrustBadgeLabel(event.source?.level)
  return (
<section
  aria-label="活動重點"
  className="relative isolate min-h-[500px] overflow-hidden px-[22px] pb-[70px] pt-[14px] text-white"
  style={{ background: tokens.heroBackground }}
>
  {category === 'concert' ? (
    <HeroBeams className="!h-[520px]" gradientId="t30f-detail-hero-beam" />
  ) : (
    <>
      <CategoryMotif category={category}
        className="pointer-events-none absolute right-[-60px] top-10 h-[340px] w-[340px] text-white opacity-[0.12]" />
      <CategoryGlyph category={category} size={136}
        className="pointer-events-none absolute right-6 top-[112px]"
        style={{ color: '#ffffff', opacity: 0.92, transform: 'rotate(8deg)', filter: 'drop-shadow(0 12px 18px rgba(0,0,0,0.25))' }} />
    </>
  )}
  <div aria-hidden="true" className="pointer-events-none absolute inset-0"
       style={{ background: heroScrimBackground(HERO_SCRIM_ALPHA, HERO_SCRIM_END_ALPHA) }} />
  <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[110px]"
       style={{ background: HERO_FADE_BACKGROUND }} />

  <div className="relative z-[2]">
    {/* nav2 */}
    <div className="flex items-center justify-between">
      <EventDetailBackBtn variant="hero" />
      <div className="flex gap-2">
        <EventDetailReminderBtn eventId={event.id} variant="hero" />
        <EventDetailFavoriteBtn eventId={event.id} variant="hero" />
      </div>
    </div>

    {/* hdate */}
    <div className="mt-9">
      {parts ? (
        <>
          <p className="text-[22px] font-extrabold leading-none tracking-[0.01em]">
            {parts.monthLabel}
            <span className="ml-1.5 font-semibold opacity-[0.85]">{parts.metaLabel}</span>
          </p>
          <p className="ml-[-8px] mt-1.5 text-[140px] font-black leading-[0.86] tracking-[-0.05em] tabular-nums" aria-hidden="true">
            {parts.dayLabel}
          </p>
        </>
      ) : (
        <p className="text-[22px] font-extrabold leading-none">日期未定</p>
      )}
    </div>

    <h1 className="mt-[22px] min-w-0">
      <span className="ml-[-1px] block truncate text-[36px] font-black leading-[1.05]">{event.idolName}</span>
      <span className="mt-2 block truncate text-[21px] font-bold leading-[1.3]">{event.title}</span>
    </h1>

    <div className="mt-[18px] flex flex-wrap gap-2">
      <span className="inline-flex h-[30px] items-center gap-1.5 rounded-[15px] pl-2.5 pr-3 text-[13px] font-bold"
            style={{ background: HERO_TYPE_CHIP_BACKGROUND }}>
        <CategoryIcon category={category} size={15} />
        {EVENT_CATEGORIES[category].label}
      </span>
      {trust && (
        <span className="inline-flex h-[30px] items-center rounded-[15px] px-3 text-[13px] font-bold"
              style={{ background: HERO_TRUST_CHIP.background, color: HERO_TRUST_CHIP.color }}>
          {trust}
        </span>
      )}
    </div>
  </div>
</section>
  )
}

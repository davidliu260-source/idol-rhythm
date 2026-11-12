'use client'

import Link from 'next/link'
import { useHomeCategoryFilter } from './HomeCategoryFilter'
import { CATEGORY_NEUTRALS, EVENT_CATEGORIES, getCategoryTokens } from '@/lib/eventCategory'
import type { WeekDay, WeekDayDots } from '@/lib/homeWeekAndFeed'
import type { CategoryFilter } from '@/lib/upcomingFilters'

export default function HomeWeekStrip({ days, dotsByFilter }: { days: WeekDay[]; dotsByFilter: Record<CategoryFilter, WeekDayDots[]> }) {
  const { selected } = useHomeCategoryFilter()
  const dots = dotsByFilter[selected] ?? dotsByFilter.all
  return <section aria-labelledby="home-week-title">
    <div className="flex items-baseline justify-between">
      <h2 id="home-week-title" className="text-2xl font-black">本週</h2>
      <Link href="/schedule" className="text-sm" style={{ color: CATEGORY_NEUTRALS.muted }}>全部 ›</Link>
    </div>
    <ol className="mt-4 flex justify-between">
      {days.map(({ key, month, day, label, isToday }) => {
        const categories = dots.find(dot => dot.key === key)?.categories ?? []
        return <li key={key} className="w-11 text-center">
          <span className="sr-only">{month}月{day}日{isToday ? '，今天' : ''}{categories.length ? `，有${categories.map(id => EVENT_CATEGORIES[id].label).join('、')}` : ''}</span>
          <span aria-hidden="true" className="mb-[6px] block text-xs font-semibold" style={{ color: isToday ? CATEGORY_NEUTRALS.brandPink : CATEGORY_NEUTRALS.faint }}>{label}</span>
          <b aria-hidden="true" className="mx-auto grid h-[42px] w-[42px] place-items-center rounded-full text-[17px] font-extrabold tabular-nums text-white" style={{ background: isToday ? CATEGORY_NEUTRALS.brandPink : undefined }}>{day}</b>
          <div aria-hidden="true" className="mt-2 flex h-[6px] justify-center gap-1">
            {categories.map(id => <span key={id} className="h-[6px] w-[6px] rounded-full" style={{ background: getCategoryTokens(id).accent }} />)}
          </div>
        </li>
      })}
    </ol>
  </section>
}

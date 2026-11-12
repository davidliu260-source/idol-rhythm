'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { ALL_CATEGORY, CATEGORY_NEUTRALS, EVENT_CATEGORIES, getCategoryTokens } from '@/lib/eventCategory'
import { getVisibleCategories, type CategoryFilter, type UpcomingCategoryCounts } from '@/lib/upcomingFilters'
import CategoryIcon from './category/CategoryIcon'
import CategoryGlyph from './category/CategoryGlyph'

const Context = createContext<{ selected: CategoryFilter; setSelected: (next: CategoryFilter) => void }>({ selected: 'all', setSelected: () => {} })
const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'

export function HomeCategoryFilterProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<CategoryFilter>('all')
  return <Context.Provider value={{ selected, setSelected }}>{children}</Context.Provider>
}
export function useHomeCategoryFilter() { return useContext(Context) }

export function HomeCategoryFilterBar({ counts }: { counts: UpcomingCategoryCounts }) {
  const { selected, setSelected } = useHomeCategoryFilter()
  return <div role="group" aria-label="依活動類型篩選" className="-mx-4 flex gap-2 overflow-x-auto px-4 py-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
    {(['all', ...getVisibleCategories(counts, selected)] as CategoryFilter[]).map(id => {
      const tokens = id === 'all' ? null : getCategoryTokens(id)
      const on = selected === id
      return <button key={id} type="button" aria-pressed={on} onClick={() => setSelected(id)} className={`relative inline-flex h-[42px] flex-none items-center gap-2 whitespace-nowrap rounded-[21px] pl-[7px] pr-[15px] text-[14.5px] font-bold before:absolute before:inset-x-0 before:-inset-y-px before:content-[''] ${focus}`} style={{ background: on ? tokens?.chipActiveBackground ?? '#fff' : CATEGORY_NEUTRALS.surface, color: on ? tokens ? '#fff' : '#14102a' : ALL_CATEGORY.accent, boxShadow: on ? tokens ? `inset 0 0 0 1.5px ${tokens.accent}` : 'none' : `inset 0 0 0 1px ${CATEGORY_NEUTRALS.line}` }}>
        <span aria-hidden="true" className="grid h-7 w-7 place-items-center rounded-full text-white" style={{ background: tokens?.chipIconBackground ?? ALL_CATEGORY.chipIconBackground }}><CategoryIcon category={id} size={16} /></span>
        {id === 'all' ? ALL_CATEGORY.label : EVENT_CATEGORIES[id].label}
      </button>
    })}
  </div>
}

export function HomeCategoryLegend({ counts }: { counts: UpcomingCategoryCounts }) {
  const { selected, setSelected } = useHomeCategoryFilter()
  function apply(next: CategoryFilter) {
    setSelected(next)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    requestAnimationFrame(() => document.getElementById('home-upcoming')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }))
  }
  return <section aria-label="活動類型">
    <div className="flex items-baseline justify-between"><h2 className="text-2xl font-black">活動類型</h2></div>
    <div className="mt-[18px] grid grid-cols-4 gap-[10px]">
      {([...getVisibleCategories(counts, selected), 'all'] as CategoryFilter[]).map(id => {
        const label = id === 'all' ? ALL_CATEGORY.label : EVENT_CATEGORIES[id].label
        const n = id === 'all' ? counts.total : counts.byCategory[id]
        return <button key={id} type="button" aria-pressed={selected === id} aria-label={`${label}，${n} 場，套用篩選`} onClick={() => apply(id)} className={`relative h-[98px] overflow-hidden rounded-[18px] pt-[11px] text-center text-white ${focus}`} style={{ background: id === 'all' ? ALL_CATEGORY.legendBackground : getCategoryTokens(id).heroBackground, boxShadow: id === 'all' ? `inset 0 0 0 1px ${CATEGORY_NEUTRALS.line}` : undefined }}>
          {id !== 'all' && <span aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(90% 70% at 0% 0%, rgba(255,255,255,.22), transparent 65%)' }} />}
          <CategoryGlyph category={id} size={34} className="relative mx-auto block" style={{ color: '#fff' }} />
          <b style={id === 'popup' ? { textShadow: '0 1px 2px rgba(0,0,0,.35)' } : undefined} className="relative mt-[6px] block text-[13px] font-extrabold leading-[1.2]">{label}</b>
          <span style={id === 'popup' ? { textShadow: '0 1px 2px rgba(0,0,0,.35)' } : undefined} className="relative block text-[11.5px] leading-[1.3] opacity-80">{n} 場</span>
        </button>
      })}
    </div>
  </section>
}

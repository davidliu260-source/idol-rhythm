'use client'

import { useEffect, useRef, useState } from 'react'
import type { Event } from '@/lib/types'
import { useAppState } from '@/lib/appState'
import { CATEGORY_NEUTRALS } from '@/lib/eventCategory'
import { filterFollowedEvents, getRemainingCount, getVisibleEvents, INITIAL_VISIBLE } from '@/lib/upcomingEvents'
import UpcomingEventCard from './UpcomingEventCard'

export default function HomeUpcomingList({ events }: { events: Event[] }) {
  const { following } = useAppState()
  const [mounted, setMounted] = useState(false)
  const [tab, setTab] = useState<'all' | 'following'>('all')
  const [expanded, setExpanded] = useState(false)
  const automaticSelectionDone = useRef(false)
  const manuallySelected = useRef(false)
  const focusAfterExpand = useRef(false)
  const list = useRef<HTMLDivElement>(null)
  const hasFollowing = mounted && following.ids.length > 0

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    if (!mounted) return
    if (!following.ids.length) {
      setTab('all')
      setExpanded(false)
    } else if (!automaticSelectionDone.current && !manuallySelected.current) {
      automaticSelectionDone.current = true
      setTab('following')
      setExpanded(false)
    }
  }, [mounted, following.ids])
  useEffect(() => {
    if (expanded && focusAfterExpand.current) {
      list.current?.querySelectorAll<HTMLAnchorElement>('a')[INITIAL_VISIBLE]?.focus()
      focusAfterExpand.current = false
    }
  }, [expanded])

  const activeTab = hasFollowing ? tab : 'all'
  const filtered = activeTab === 'following' ? filterFollowedEvents(events, following.ids) : events
  const visible = getVisibleEvents(filtered, expanded)
  const remaining = getRemainingCount(filtered.length, expanded)
  function selectTab(next: 'all' | 'following') {
    manuallySelected.current = true
    setTab(next)
    setExpanded(false)
  }

  return (
    <section aria-label="接下來的活動">
      <div className="flex items-baseline justify-between">
        <h2 className="text-2xl font-black">接下來<small className="ml-2 text-sm font-semibold" style={{ color: CATEGORY_NEUTRALS.faint }}>{filtered.length} 場</small></h2>
        {hasFollowing && <div className="flex items-baseline text-sm">
          <button type="button" aria-pressed={activeTab === 'all'} className={activeTab === 'all' ? 'font-bold text-white' : ''} style={{ color: activeTab === 'all' ? undefined : CATEGORY_NEUTRALS.muted }} onClick={() => selectTab('all')}>全部</button>
          <span aria-hidden="true" style={{ color: CATEGORY_NEUTRALS.muted }}>｜</span>
          <button type="button" aria-pressed={activeTab === 'following'} className={activeTab === 'following' ? 'font-bold text-white' : ''} style={{ color: activeTab === 'following' ? undefined : CATEGORY_NEUTRALS.muted }} onClick={() => selectTab('following')}>我追蹤的</button>
        </div>}
      </div>
      <div ref={list} className="mt-4 flex flex-col gap-[10px]">
        {visible.map(event => <UpcomingEventCard key={event.id} event={event} />)}
        {filtered.length === 0 && <div className="py-6 text-sm" style={{ color: CATEGORY_NEUTRALS.muted }}>
          <p>{activeTab === 'following' ? '追蹤的偶像目前沒有公開行程' : '目前沒有即將到來的活動'}</p>
          {activeTab === 'following' && <button type="button" className="mt-2 text-white" onClick={() => selectTab('all')}>查看完整行程 →</button>}
        </div>}
      </div>
      {remaining > 0 && <button type="button" className="mt-3 block h-[46px] w-full rounded-[23px] text-center text-[14.5px] font-bold leading-[46px]" style={{ color: CATEGORY_NEUTRALS.muted, boxShadow: `inset 0 0 0 1px ${CATEGORY_NEUTRALS.line}` }} onClick={() => { focusAfterExpand.current = true; setExpanded(true) }}>再看 {remaining} 場</button>}
    </section>
  )
}

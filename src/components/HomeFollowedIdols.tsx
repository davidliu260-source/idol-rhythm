'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { type Idol } from '@/lib/mockIdols'
import { useAppState } from '@/lib/appState'
import { avatarFallbackBackground, getRingColor, RING_BG } from '@/lib/idolRingColor'

const focus = 'rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70'

export default function HomeFollowedIdols({ idols }: { idols: Idol[] }) {
  const { following } = useAppState()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const followed = mounted ? idols.filter((i) => following.has(i.id)) : []

  return (
    <section aria-labelledby="home-followed-title">
      <div className="flex items-baseline justify-between">
        <h2 id="home-followed-title" className="text-2xl font-black text-white">我追蹤的</h2>
        <Link href="/idols" className="-my-2 inline-flex min-h-[44px] items-center py-2 text-[14px] text-[#a09db4]">偶像名冊 ›</Link>
      </div>
      <ul className="-mx-4 mt-[10px] flex gap-[10px] overflow-x-auto px-4 pt-2 pb-1 scrollbar-none">
        {followed.map((idol) => (
          <li key={idol.id} className="flex-none">
            <Link href={typeof idol.id === 'string' && idol.id ? `/idols/${encodeURIComponent(idol.id)}` : '/idols'} aria-label={idol.name} className={`flex min-w-[72px] max-w-[96px] flex-col items-center text-center ${focus}`}>
              <FollowedAvatar idol={idol} />
              <span className="mt-3 block w-full truncate whitespace-nowrap text-[13px] font-bold text-white">{idol.name}</span>
            </Link>
          </li>
        ))}
        <li className="flex-none">
          <Link href="/idols" aria-label="加入追蹤偶像" className={`flex min-w-[72px] flex-col items-center ${focus}`}>
            <div aria-hidden="true" className="grid h-[58px] w-[58px] place-items-center rounded-full border-[1.5px] border-dashed border-white/25 text-[26px] font-normal text-[#a09db4]">+</div>
            <span className="mt-3 block text-[13px] font-bold text-white">加入</span>
          </Link>
        </li>
      </ul>
      {mounted && !following.isLoading && followed.length === 0 && (
        <Link href="/idols" className="mt-3 block text-[13px] leading-5 text-[#a09db4]">追蹤偶像後，這裡會優先顯示你的專屬行程</Link>
      )}
    </section>
  )
}

function FollowedAvatar({ idol }: { idol: Idol }) {
  const [failed, setFailed] = useState(false)
  const ring = getRingColor(idol.color, idol.name)
  const boxShadow = `0 0 0 3px ${RING_BG}, 0 0 0 5px ${ring}`
  if (idol.avatarUrl && !failed) {
    return <img src={idol.avatarUrl} alt="" loading="lazy" className="h-[58px] w-[58px] rounded-full object-cover" onError={() => setFailed(true)} style={{ boxShadow }} />
  }
  return (
    <div aria-hidden="true" className="grid h-[58px] w-[58px] place-items-center rounded-full text-[16px] font-black text-white select-none" style={{ background: avatarFallbackBackground(ring), boxShadow }}>
      {(idol.name || '?').trim().charAt(0).toUpperCase() || '?'}
    </div>
  )
}

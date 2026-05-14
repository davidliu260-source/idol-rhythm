'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Timer, ChevronRight } from 'lucide-react'
import { MOCK_EVENTS, VISIBLE_TRUST_LEVELS, type Event } from '@/lib/mockEvents'
import { MOCK_IDOLS, getIdolById } from '@/lib/mockIdols'
import { useAppState } from '@/lib/appState'

export default function HomePersonalized() {
  const { following } = useAppState()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const followingIdols = MOCK_IDOLS.filter((idol) => following.has(idol.id))

  const myCountdown = !mounted
    ? []
    : followingIdols
        .map((idol) => {
          const now = new Date()
          const next = MOCK_EVENTS.filter(
            (e) =>
              e.idolId === idol.id &&
              VISIBLE_TRUST_LEVELS.includes(e.source.level) &&
              new Date(e.date) >= now,
          ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0]
          if (!next) return null
          const daysUntil = Math.ceil(
            (new Date(next.date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
          )
          return { event: next, daysUntil }
        })
        .filter((x): x is { event: Event; daysUntil: number } => x !== null)

  return (
    <>
      {/* Following idols strip */}
      {followingIdols.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-text-base">我追的偶像</h2>
            <Link href="/idols" className="flex items-center gap-0.5 text-xs text-muted">
              管理 <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-none pb-3">
            {followingIdols.map((idol) => (
              <Link
                key={idol.id}
                href="/idols"
                className="flex flex-col items-center gap-1.5 flex-shrink-0"
              >
                <div
                  className="h-14 w-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white ring-2 ring-primary/30"
                  style={{ background: `linear-gradient(135deg, ${idol.color}88, ${idol.color})` }}
                >
                  {idol.name.charAt(0)}
                </div>
                <span className="text-xs text-muted max-w-[56px] truncate text-center">
                  {idol.name}
                </span>
              </Link>
            ))}
            <Link href="/idols" className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <div className="h-14 w-14 rounded-2xl border-2 border-dashed border-card-border flex items-center justify-center text-muted text-xl">
                +
              </div>
              <span className="text-xs text-muted">追蹤</span>
            </Link>
          </div>
        </section>
      )}

      {/* My countdown */}
      {myCountdown.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Timer className="h-4 w-4 text-violet-400" />
            <h2 className="text-sm font-semibold text-text-base">我的倒數</h2>
            <Link href="/schedule" className="ml-auto flex items-center gap-0.5 text-xs text-muted">
              全部 <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-none pb-3">
            {myCountdown.map(({ event, daysUntil }) => (
              <CountdownCard key={event.id} event={event} daysUntil={daysUntil} />
            ))}
          </div>
        </section>
      )}
    </>
  )
}

function CountdownCard({ event, daysUntil }: { event: Event; daysUntil: number }) {
  const idol = getIdolById(event.idolId)
  const bgStyle = idol
    ? `linear-gradient(135deg, ${idol.color}88, ${idol.color})`
    : 'linear-gradient(135deg, #4c1d95, #6366f1)'

  return (
    <Link href={`/events/${event.id}`} className="flex-shrink-0 w-40">
      <div className="rounded-2xl border border-card-border bg-card p-3 flex flex-col gap-2 active:scale-[0.98] transition-transform">
        <div className="flex items-center gap-2">
          <div
            className="h-8 w-8 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
            style={{ background: bgStyle }}
          >
            {event.idolName.charAt(0)}
          </div>
          <span className="text-xs font-semibold text-primary truncate">{event.idolName}</span>
        </div>
        <p className="text-xs text-text-base line-clamp-2 leading-snug flex-1">{event.title}</p>
        <div className="flex items-baseline gap-1">
          {daysUntil === 0 ? (
            <span className="text-sm font-bold text-primary">今天！</span>
          ) : (
            <>
              <span className="text-2xl font-bold text-primary leading-none">{daysUntil}</span>
              <span className="text-xs text-muted">天後</span>
            </>
          )}
        </div>
      </div>
    </Link>
  )
}

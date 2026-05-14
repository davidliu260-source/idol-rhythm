import Link from 'next/link'
import { Bell, ChevronRight, Zap, Star, Play, Newspaper, Timer } from 'lucide-react'
import {
  MOCK_EVENTS,
  VISIBLE_TRUST_LEVELS,
  getTodayEvents,
  getEventsByTypes,
  type Event,
} from '@/lib/mockEvents'
import { getFollowingIdols, getIdolById } from '@/lib/mockIdols'
import EventCard from '@/components/EventCard'

export default function HomePage() {
  const today = new Date()
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  const dateStr = `${today.getMonth() + 1}月${today.getDate()}日 週${weekdays[today.getDay()]}`

  const todayEvents = getTodayEvents()
  const weekHighlights = getEventsByTypes(['concert', 'brand'], 7)
  const streamableEvents = getEventsByTypes(['livestream', 'streaming'], 14)
  const newsEvents = getEventsByTypes(['official', 'media'], 14)

  const followingIdols = getFollowingIdols()

  const myCountdown = followingIdols
    .map((idol) => {
      const next = MOCK_EVENTS.filter(
        (e) =>
          e.idolId === idol.id &&
          VISIBLE_TRUST_LEVELS.includes(e.source.level) &&
          new Date(e.date) >= today,
      ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0]
      if (!next) return null
      const daysUntil = Math.ceil(
        (new Date(next.date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      )
      return { event: next, daysUntil }
    })
    .filter((x): x is { event: Event; daysUntil: number } => x !== null)

  return (
    <div className="flex flex-col gap-6 px-4 pt-12 pb-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted">{dateStr}</p>
          <h1 className="text-xl font-bold text-text-base mt-0.5">
            星動時刻
            <span className="ml-2 text-xs font-normal text-primary">Idol Rhythm</span>
          </h1>
        </div>
        <button className="relative rounded-full bg-card border border-card-border p-2.5">
          <Bell className="h-5 w-5 text-muted" />
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
        </button>
      </header>

      {/* Demo data banner */}
      <div className="flex items-start gap-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 px-3 py-2.5">
        <span className="text-amber-400 text-sm leading-none mt-0.5">⚠️</span>
        <p className="text-xs text-amber-300 leading-snug">
          <span className="font-semibold">Demo 展示資料</span>
          ｜目前為展示資料，非真實官方行程，請勿作為購票或出行依據
        </p>
      </div>

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

      {/* Section 1: 今日不能錯過 */}
      <section>
        <SectionHeader
          icon={<Zap className="h-4 w-4 text-primary" />}
          title="今日不能錯過"
          count={todayEvents.length}
          href="/schedule"
        />
        {todayEvents.length > 0 ? (
          <div className="flex flex-col gap-2">
            {todayEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-card-border bg-card px-4 py-5 text-center">
            <p className="text-sm text-muted">今天沒有公開確認的活動</p>
            <Link href="/schedule" className="mt-1 inline-block text-xs text-primary">
              查看完整行程 →
            </Link>
          </div>
        )}
      </section>

      {/* Section 2: 本週重點 */}
      {weekHighlights.length > 0 && (
        <section>
          <SectionHeader
            icon={<Star className="h-4 w-4 text-yellow-400" />}
            title="本週重點"
            count={weekHighlights.length}
            href="/schedule"
          />
          <div className="flex flex-col gap-2">
            {weekHighlights.slice(0, 3).map((event) => (
              <EventCard key={event.id} event={event} compact />
            ))}
          </div>
        </section>
      )}

      {/* Section 3: 我的倒數 */}
      {myCountdown.length > 0 && (
        <section>
          <SectionHeader
            icon={<Timer className="h-4 w-4 text-violet-400" />}
            title="我的倒數"
            href="/schedule"
          />
          <div className="flex gap-3 overflow-x-auto scrollbar-none pb-3">
            {myCountdown.map(({ event, daysUntil }) => (
              <CountdownCard key={event.id} event={event} daysUntil={daysUntil} />
            ))}
          </div>
        </section>
      )}

      {/* Section 4: 最近可看 */}
      {streamableEvents.length > 0 && (
        <section>
          <SectionHeader
            icon={<Play className="h-4 w-4 text-red-400" />}
            title="最近可看"
            count={streamableEvents.length}
            href="/schedule"
          />
          <div className="flex flex-col gap-2">
            {streamableEvents.slice(0, 3).map((event) => (
              <EventCard key={event.id} event={event} compact />
            ))}
          </div>
        </section>
      )}

      {/* Section 5: 最新情報 */}
      {newsEvents.length > 0 && (
        <section>
          <SectionHeader
            icon={<Newspaper className="h-4 w-4 text-sky-400" />}
            title="最新情報"
            count={newsEvents.length}
            href="/schedule"
          />
          <div className="flex flex-col gap-2">
            {newsEvents.slice(0, 3).map((event) => (
              <EventCard key={event.id} event={event} compact />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function SectionHeader({
  icon,
  title,
  count,
  href,
}: {
  icon: React.ReactNode
  title: string
  count?: number
  href: string
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {icon}
      <h2 className="text-sm font-semibold text-text-base">{title}</h2>
      {count !== undefined && count > 0 && (
        <span className="text-xs text-primary font-medium">{count} 場</span>
      )}
      <Link href={href} className="ml-auto flex items-center gap-0.5 text-xs text-muted">
        全部 <ChevronRight className="h-3 w-3" />
      </Link>
    </div>
  )
}

function CountdownCard({
  event,
  daysUntil,
}: {
  event: Event
  daysUntil: number
}) {
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

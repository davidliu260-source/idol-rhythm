import Link from 'next/link'
import { Bell, ChevronRight, Zap } from 'lucide-react'
import {
  MOCK_EVENTS,
  getTodayEvents,
  getUpcomingEvents,
  getFavoritedEvents,
} from '@/lib/mockEvents'
import { getFollowingIdols } from '@/lib/mockIdols'
import EventCard from '@/components/EventCard'

export default function HomePage() {
  const today = new Date()
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  const dateStr = `${today.getMonth() + 1}月${today.getDate()}日 週${weekdays[today.getDay()]}`

  const todayEvents = getTodayEvents()
  const upcomingEvents = getUpcomingEvents(7)
  const followingIdols = getFollowingIdols()
  const followingIds = new Set(followingIdols.map((i) => i.id))
  const myEvents = MOCK_EVENTS.filter((e) => followingIds.has(e.idolId))
    .filter((e) => new Date(e.date) >= today)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5)

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

      {/* Today's highlight */}
      {todayEvents.length > 0 ? (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-text-base">今日活動</h2>
            <span className="ml-auto text-xs text-primary font-medium">{todayEvents.length} 場</span>
          </div>
          <div className="flex flex-col gap-2">
            {todayEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      ) : (
        <div className="rounded-2xl border border-card-border bg-card px-4 py-5 text-center">
          <p className="text-sm text-muted">今天沒有追蹤偶像的活動</p>
          <Link href="/schedule" className="mt-1 inline-block text-xs text-primary">
            查看完整行程 →
          </Link>
        </div>
      )}

      {/* Following idols quick strip */}
      {followingIdols.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-text-base">我追的偶像</h2>
            <Link href="/idols" className="flex items-center gap-0.5 text-xs text-muted">
              管理 <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1">
            {followingIdols.map((idol) => (
              <Link
                key={idol.id}
                href={`/idols`}
                className="flex flex-col items-center gap-1.5 flex-shrink-0"
              >
                <div
                  className="h-14 w-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white ring-2 ring-primary/30"
                  style={{ background: `linear-gradient(135deg, ${idol.color}88, ${idol.color})` }}
                >
                  {idol.name.charAt(0)}
                </div>
                <span className="text-xs text-muted max-w-[56px] truncate text-center">{idol.name}</span>
              </Link>
            ))}
            <Link
              href="/idols"
              className="flex flex-col items-center gap-1.5 flex-shrink-0"
            >
              <div className="h-14 w-14 rounded-2xl border-2 border-dashed border-card-border flex items-center justify-center text-muted">
                +
              </div>
              <span className="text-xs text-muted">追蹤</span>
            </Link>
          </div>
        </section>
      )}

      {/* My idols upcoming events */}
      {myEvents.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-text-base">近期行程</h2>
            <Link href="/schedule" className="flex items-center gap-0.5 text-xs text-muted">
              全部 <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {myEvents.map((event) => (
              <EventCard key={event.id} event={event} compact />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming hot events */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-text-base">近 7 天熱門活動</h2>
          <Link href="/schedule" className="flex items-center gap-0.5 text-xs text-muted">
            全部 <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="flex flex-col gap-2">
          {upcomingEvents.slice(0, 4).map((event) => (
            <EventCard key={event.id} event={event} compact />
          ))}
        </div>
      </section>
    </div>
  )
}

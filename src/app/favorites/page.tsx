import { Heart, ChevronRight } from 'lucide-react'
import { getFavoritedEvents, MOCK_EVENTS, formatEventDate } from '@/lib/mockEvents'
import EventCard from '@/components/EventCard'
import Link from 'next/link'

export default function FavoritesPage() {
  const now = new Date()
  const favorited = getFavoritedEvents()
  const upcoming = favorited
    .filter((e) => new Date(e.date) >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const past = favorited
    .filter((e) => new Date(e.date) < now)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <div className="flex flex-col px-4 pt-12 pb-6 gap-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-primary fill-primary" />
          <h1 className="text-xl font-bold text-text-base">收藏活動</h1>
        </div>
        <p className="text-xs text-muted mt-1">共收藏 {favorited.length} 場</p>
      </div>

      {favorited.length === 0 ? (
        <div className="py-16 flex flex-col items-center gap-3 text-center">
          <Heart className="h-12 w-12 text-card-border" />
          <p className="text-sm text-muted">還沒有收藏的活動</p>
          <Link href="/schedule" className="text-xs text-primary">
            去瀏覽行程 →
          </Link>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-muted mb-3">即將到來 · {upcoming.length} 場</h2>
              <div className="flex flex-col gap-2">
                {upcoming.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-muted mb-3">已結束 · {past.length} 場</h2>
              <div className="flex flex-col gap-2 opacity-60">
                {past.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

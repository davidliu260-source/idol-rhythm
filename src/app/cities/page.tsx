import Link from 'next/link'
import { CalendarDays, MapPin } from 'lucide-react'

export default function CitiesPage() {
  return (
    <div className="min-h-screen px-4 pb-28 pt-8 text-text-base">
      <section className="rounded-3xl border border-card-border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary-light" />
            <h1 className="text-2xl font-black">城市</h1>
          </div>
          <span className="rounded-full border border-warn/30 bg-warn/10 px-3 py-1 text-xs font-semibold text-warn">
            尚未開放
          </span>
        </div>
        <p className="mt-4 text-sm leading-6 text-muted">
          之後可以選你的城市，看本週附近的演唱會、快閃和生咖
        </p>
        <Link
          href="/schedule"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-light"
        >
          <CalendarDays className="h-4 w-4" />
          先看行事曆
        </Link>
      </section>
    </div>
  )
}

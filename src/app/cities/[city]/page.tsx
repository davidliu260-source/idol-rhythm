import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { cache } from 'react'
import clsx from 'clsx'
import { ArrowLeft, MapPin } from 'lucide-react'
import { PAGE_HERO_SHELL } from '@/app/schedule/scheduleTheme'
import EventCard from '@/components/EventCard'
import { cityHref, decodeCityParam, getCityEvents, resolveCityParam } from '@/lib/cities'
import { buildCityMeta } from '@/lib/seo/metadata'
import { getPublishedEvents } from '@/lib/supabase/events'

export const dynamic = 'force-dynamic'

const getEvents = cache(() => getPublishedEvents())

type CityPageProps = { params: Promise<{ city: string }> }

export async function generateMetadata({ params }: CityPageProps): Promise<Metadata> {
  const { city } = await params
  const events = await getEvents()
  const name = resolveCityParam(city, events)
  return name ? buildCityMeta(name, getCityEvents(events, name).length) : { title: '城市' }
}

export default async function CityPage({ params }: CityPageProps) {
  const { city } = await params
  const events = await getEvents()
  const name = resolveCityParam(city, events)
  if (!name) return notFound()
  if (decodeCityParam(city) !== name) redirect(cityHref(name))

  const upcoming = getCityEvents(events, name)
  return (
    <>
      <Link href="/cities" className="inline-flex min-h-[44px] items-center gap-2 self-start rounded-full border border-white/8 bg-white/[0.04] px-3 text-sm font-medium text-white/72 hover:text-white">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        返回城市列表
      </Link>

      <header className={clsx(PAGE_HERO_SHELL, 'p-5')}>
        <div className="flex items-center gap-2">
          <MapPin aria-hidden="true" className="h-5 w-5 shrink-0 text-[#ff8bc8]" />
          <h1 className="break-all text-2xl font-black">{name}</h1>
        </div>
        <p className="mt-2 text-sm font-semibold text-[#ff8bc8]">{upcoming.length} 場</p>
      </header>

      {upcoming.length > 0 ? (
        <div className="space-y-2">
          {upcoming.map(event => <EventCard key={event.id} event={event} />)}
        </div>
      ) : (
        <section className="rounded-[26px] border border-white/8 bg-white/[0.035] p-5">
          <h2 className="break-words text-base font-bold">{name}目前沒有公開場次</h2>
          <p className="mt-2 text-sm leading-6 text-white/72">
            活動資料來自官方與公開來源，我們不會自己編場次。有新公告時會出現在這裡。
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/schedule" className="inline-flex min-h-[44px] items-center rounded-xl bg-white/10 px-4 text-sm font-bold hover:bg-white/15">
              看全部行事曆
            </Link>
            <Link href="/idols" className="inline-flex min-h-[44px] items-center rounded-xl border border-white/15 px-4 text-sm font-semibold text-[#ff8bc8] hover:bg-white/10">
              追蹤偶像
            </Link>
            <Link href="/cities" className="inline-flex min-h-[44px] items-center rounded-xl border border-white/15 px-4 text-sm font-semibold text-white/80 hover:bg-white/10">
              回城市列表
            </Link>
          </div>
        </section>
      )}
    </>
  )
}

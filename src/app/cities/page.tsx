import { pageMetadata } from '@/lib/seo/metadata'

import Link from 'next/link'
import clsx from 'clsx'
import { CalendarDays, ChevronRight, MapPin } from 'lucide-react'
import { PAGE_HERO_SHELL } from '@/app/schedule/scheduleTheme'
import FanWishForm from '@/components/FanWishForm'
import { buildCityDirectory, cityHref, type CityDirectoryEntry } from '@/lib/cities'
import { getPublishedEvents } from '@/lib/supabase/events'

export const dynamic = 'force-dynamic'

export const metadata = pageMetadata('/cities', '台灣各城市偶像活動', '依城市查看台北、高雄等地的偶像演唱會、見面會與官方活動，查看目前未結束的公開場次。資料整理自官方與可信媒體等公開來源，活動時間及地點以主辦公告為準。')

export default async function CitiesPage() {
  const events = await getPublishedEvents()
  const { taiwanCities, otherCities, unlabeledCount } = buildCityDirectory(events)
  const isEmpty = otherCities.length === 0 && taiwanCities.every(city => city.count === 0)

  return (
    <>
      <header className={clsx(PAGE_HERO_SHELL, 'p-5')}>
        <div className="flex items-center gap-2">
          <MapPin aria-hidden="true" className="h-5 w-5 text-[#ff8bc8]" />
          <h1 className="text-2xl font-black">城市</h1>
        </div>
        <p className="mt-3 text-sm leading-6 text-white/72">
          資料來自官方與公開來源，每場都標示來源等級；日期、場地以主辦公告為準
        </p>
      </header>

      {isEmpty && (
        <section className="rounded-[26px] border border-white/8 bg-white/[0.035] p-5">
          <h2 className="text-base font-bold">目前還沒有標註城市的公開場次</h2>
          <p className="mt-2 text-sm leading-6 text-white/72">
            活動資料來自官方與公開來源，我們不會自己編場次。有新公告時，城市會自動出現場次。
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/schedule" className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-bold hover:bg-white/15">
              <CalendarDays aria-hidden="true" className="h-4 w-4" />
              看行事曆
            </Link>
            <Link href="/idols" className="inline-flex min-h-[44px] items-center rounded-xl border border-white/15 px-4 text-sm font-semibold text-[#ff8bc8] hover:bg-white/10">
              追蹤偶像
            </Link>
          </div>
        </section>
      )}

      <section aria-labelledby="taiwan-cities-heading">
        <h2 id="taiwan-cities-heading" className="mb-2 text-base font-bold">台灣城市</h2>
        <CityGrid cities={taiwanCities} />
      </section>

      {otherCities.length > 0 && (
        <section>
          <h2 className="mb-2 text-base font-bold">其他城市</h2>
          <CityGrid cities={otherCities} />
        </section>
      )}

      {unlabeledCount > 0 && (
        <p className="rounded-[22px] border border-white/8 bg-white/[0.035] px-4 py-3 text-sm leading-6 text-white/72">
          另有 {unlabeledCount} 場活動還沒有標註城市（例如線上活動，或主辦還沒公布場地），可以在行事曆查看。
          <Link href="/schedule" className="flex min-h-[44px] w-fit items-center gap-1 font-semibold text-[#ff8bc8] hover:underline">
            前往行事曆
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </p>
      )}

      <FanWishForm defaultKind="add_city" />
    </>
  )
}

function CityGrid({ cities }: { cities: CityDirectoryEntry[] }) {
  return (
    <ul className="grid grid-cols-2 gap-2">
      {cities.map(({ name, count, nextDate }) => (
        <li key={name}>
          <Link
            href={cityHref(name)}
            className={clsx(
              'flex h-full min-h-[44px] flex-col gap-2 rounded-[20px] border p-4 transition-colors hover:bg-white/10',
              count > 0 ? 'border-[#ff6cb7]/20 bg-[#ff4ca1]/10' : 'border-white/8 bg-white/[0.035] text-white/72',
            )}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="break-all font-bold">{name}</span>
              <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0" />
            </span>
            {nextDate ? (
              <span className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-white/80">
                <span className="font-semibold text-[#ff8bc8]">{count} 場</span>
                <span>最近 {Number(nextDate.slice(5, 7))}/{Number(nextDate.slice(8, 10))}</span>
              </span>
            ) : (
              <span className="text-sm">目前沒有公開場次</span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  )
}

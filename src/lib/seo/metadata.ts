import { cityHref } from '../cities'
import { formatTaipeiDateLabel, toDateKey } from '../taipeiDate'
import type { Event, Idol } from '../types'

// 更換正式網域時，只要修改這一行。
export const SITE_URL = 'https://idol-rhythm.vercel.app'
export const SITE_NAME = '星動時刻 Idol Rhythm'
export const DEFAULT_TITLE = `${SITE_NAME}｜韓流偶像台灣行程`
export const DEFAULT_DESCRIPTION = '整理韓流偶像在台灣的演唱會、見面會、售票與官方活動行程，方便查閱近期公開場次。資料來自官方與可信媒體等公開資訊，活動日期、場地及入場資訊以主辦公告為準。'

const ORGANIZER_NOTICE = '以主辦公告為準。'

export function truncateText(text: string, limit: number): string {
  const characters = Array.from(text)
  return characters.length > limit ? `${characters.slice(0, limit - 1).join('').trimEnd()}…` : text
}

function descriptionWithNotice(text: string, noticeSubject = ''): string {
  const notice = `${noticeSubject}${ORGANIZER_NOTICE}`
  const content = truncateText(text, 120 - notice.length - 1)
  const separator = /[。！？…]$/.test(content) ? '' : '。'
  return `${content}${separator}${notice}`
}

export function pageMetadata(path: string, title: string, description: string, imagePath = '') {
  const ogImage = `${imagePath}/opengraph-image`
  const twitterImage = `${imagePath}/twitter-image`
  const socialTitle = `${title}｜星動時刻`
  const alt = imagePath ? `${title}分享預覽` : '星動時刻 Idol Rhythm 分享預覽'
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website' as const,
      title: socialTitle,
      description,
      siteName: SITE_NAME,
      locale: 'zh_TW',
      url: path,
      images: [{ url: ogImage, width: 1200, height: 630, alt }],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title: socialTitle,
      description,
      images: [{ url: twitterImage, alt }],
    },
  }
}

export function buildIdolMeta(idol: Pick<Idol, 'name' | 'koreanName' | 'id'>, upcomingCount: number) {
  const koreanName = idol.koreanName.trim()
  const name = koreanName ? `${idol.name}（${koreanName}）` : idol.name
  const count = upcomingCount > 0 ? `目前有 ${upcomingCount} 場未結束活動` : '目前沒有公開場次'
  return pageMetadata(
    `/idols/${encodeURIComponent(idol.id)}`,
    `${idol.name} 台灣演唱會・活動行程`,
    descriptionWithNotice(`${truncateText(name, 48)}在台灣的演唱會、見面會、售票與官方活動行程，${count}。資料整理自官方與可信媒體等公開資訊`, '活動日期及場地'),
    `/idols/${encodeURIComponent(idol.id)}`,
  )
}

export function eventDateLabel(date: string): string | undefined {
  const key = toDateKey(date)
  if (key) return formatTaipeiDateLabel(new Date(`${key}T00:00:00+08:00`))
}

export function eventPlace(event: Pick<Event, 'city' | 'venueName' | 'location'>): string | undefined {
  return event.city?.trim() || event.venueName?.trim() || event.location?.trim() || undefined
}

export function buildEventMeta(event: Pick<Event, 'id' | 'idolName' | 'title' | 'date' | 'city' | 'venueName' | 'location' | 'displaySummaryZh' | 'description'>) {
  const details = [event.idolName, eventDateLabel(event.date), eventPlace(event)].filter(Boolean).join('・')
  const summary = event.displaySummaryZh?.trim() || event.description.trim()
  const path = `/events/${encodeURIComponent(event.id)}`
  const description = summary
    ? descriptionWithNotice(`${details}。${summary}`)
    : descriptionWithNotice(details, '活動資訊')
  return pageMetadata(path, `${event.title}｜${event.idolName}`, description, path)
}

export function buildCityMeta(city: string, count: number) {
  return pageMetadata(
    cityHref(city),
    `${city}偶像演唱會與活動`,
    descriptionWithNotice(`查看${city}的偶像演唱會、見面會、售票與官方活動，目前有 ${count} 場未結束的公開活動。場次資訊整理自官方與可信媒體等公開來源`, '活動時間、場地及入場方式'),
  )
}

import { cityHref } from '../cities'
import { getEventOfficialNoticeUrl } from '../officialNotice'
import { formatTaipeiDateLabel, toDateKey } from '../taipeiDate'
import type { Event, Idol } from '../types'

// 正式站公開網址。未設 NEXT_PUBLIC_SITE_URL 時預設 https://idolrhythm.com。
// 預覽部署若未另設此變數，canonical、og:url、sitemap、robots 會指向正式網域，這是刻意的。
// 分享圖（og:image／twitter:image）在 Vercel 預覽部署時，Next.js 仍可能改用預覽主機，這是框架行為。
// 不要把這個變數設成預覽主機：預覽網址不該寫進 canonical 與搜尋結果。
export const DEFAULT_SITE_URL = 'https://idolrhythm.com'

function isAllowedHostname(hostname: string): boolean {
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return true
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(hostname)
}

export function getSiteUrl(raw: string | undefined = process.env.NEXT_PUBLIC_SITE_URL): string {
  const trimmed = raw?.trim() ?? ''
  if (!trimmed) return DEFAULT_SITE_URL
  const hasScheme = /^https?:\/\//i.test(trimmed)
  if (!hasScheme && /[@$\\]/.test(trimmed)) return DEFAULT_SITE_URL
  try {
    const url = new URL(hasScheme ? trimmed : `https://${trimmed}`)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return DEFAULT_SITE_URL
    if (!isAllowedHostname(url.hostname)) return DEFAULT_SITE_URL
    return url.origin
  } catch {
    return DEFAULT_SITE_URL
  }
}

export const SITE_URL = getSiteUrl()
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

export function buildEventMeta(event: Pick<Event, 'id' | 'idolName' | 'title' | 'date' | 'city' | 'venueName' | 'location' | 'displaySummaryZh' | 'description'> & Partial<Pick<Event, 'officialNoticeUrl' | 'source'>>) {
  const details = [event.idolName, eventDateLabel(event.date), eventPlace(event)].filter(Boolean).join('・')
  // MUST #10：YG／SMTOWN 公告只留事實，SEO 描述不帶正文或摘要。
  const summary = getEventOfficialNoticeUrl(event) ? '' : event.displaySummaryZh?.trim() || event.description.trim()
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

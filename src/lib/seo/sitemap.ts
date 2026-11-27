import { hasMinimumContentOrOfficialNotice } from '../autoPublish/minimumContent'
import { getEventOfficialNoticeUrl } from '../officialNotice'
import { buildCityDirectory, cityHref } from '../cities'
import type { Event, Idol } from '../types'
import { listCurrentEvents } from '../upcomingEvents'
import { LEGAL_PAGE_PATHS } from '../legal'
import { SITE_URL } from './metadata'

export function buildSitemapEntries({ idols, events, now }: {
  idols: readonly Pick<Idol, 'id'>[]
  // Only public, published database events belong in this input.
  events: readonly Event[]
  now: Date
}): { url: string; lastModified?: string }[] {
  const entries = new Map<string, { url: string; lastModified?: string }>()
  function add(path: string, lastModified?: string) {
    const url = new URL(path, SITE_URL).href
    entries.set(url, lastModified ? { url, lastModified } : { url })
  }

  for (const path of ['/', '/schedule', '/idols', '/cities', ...LEGAL_PAGE_PATHS]) add(path)
  for (const idol of idols) add(`/idols/${encodeURIComponent(idol.id)}`)

  const currentEvents = listCurrentEvents(events, now).filter(event => event.status !== 'cancelled')
  const { taiwanCities, otherCities } = buildCityDirectory(currentEvents, now)
  for (const city of [...taiwanCities, ...otherCities]) {
    if (city.count > 0) add(cityHref(city.name))
  }

  for (const event of currentEvents) {
    // MUST #10：YG／SMTOWN 公告不算正文與摘要，改把官方公告連結算進最低內容。
    const officialNoticeUrl = getEventOfficialNoticeUrl(event)
    if (hasMinimumContentOrOfficialNotice({
      time: event.time,
      location: event.location,
      venue_name: event.venueName,
      city: event.city,
      address: event.address,
      description: event.description,
      display_summary_zh: event.displaySummaryZh,
      ticket_url: event.ticketUrl,
      stream_url: event.streamUrl,
    }, { factsOnlyNotice: !!officialNoticeUrl, officialNoticeUrl })) add(`/events/${encodeURIComponent(event.id)}`, event.publishedAt)
  }
  return [...entries.values()]
}

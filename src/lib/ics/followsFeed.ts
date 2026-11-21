import type { Event } from '../types'
import { addDaysToKey, taipeiToday } from '../taipeiDate'
import { CALENDAR_NOTIFY_TRUST_LEVELS } from '../trustLevels'
import { buildIcs } from './buildIcs'

export const FEED_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/

export function parseFeedTokenParam(param: string): string | null {
  const token = param.endsWith('.ics') ? param.slice(0, -4) : param
  return FEED_TOKEN_RE.test(token) ? token : null
}

const alarmSettings = {
  none: [],
  day_before: ['day_before'],
  week_before: ['week_before'],
  both: ['day_before', 'week_before'],
} as const

export type FeedAlarm = keyof typeof alarmSettings

export function isFeedAlarm(value: unknown): value is FeedAlarm {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(alarmSettings, value)
}

export function alarmsFromSetting(alarm: FeedAlarm) {
  return alarmSettings[alarm]
}

export type FeedStore = {
  findByToken(token: string): Promise<{ userId: string; alarm: FeedAlarm } | null>
  followedIdolSlugs(userId: string): Promise<string[]>
  publishedEvents(): Promise<Event[]>
  touch(userId: string): Promise<void>
}

export function filterCalendarEvents(events: Event[], now: Date): Event[] {
  const cutoff = addDaysToKey(taipeiToday(now), -30)
  return events.filter(
    (event) =>
      CALENDAR_NOTIFY_TRUST_LEVELS.some((level) => level === event.source.level) &&
      (event.endDate ?? event.startDate ?? event.date) >= cutoff,
  )
}

export function feedNotFound() {
  return { status: 404 as const, body: 'Not Found', headers: { 'Cache-Control': 'no-store' } }
}

export async function buildFollowsFeedResponse({
  param, store, origin, now,
}: {
  param: string
  store: FeedStore
  origin: string
  now: Date
}): Promise<{ status: 200 | 404; body: string; headers: Record<string, string> }> {
  const token = parseFeedTokenParam(param)
  if (!token) return feedNotFound()

  try {
    const feed = await store.findByToken(token)
    if (!feed) return feedNotFound()

    const slugs = new Set(await store.followedIdolSlugs(feed.userId))
    const events = slugs.size
      ? filterCalendarEvents((await store.publishedEvents()).filter((event) => slugs.has(event.idolId)), now)
      : []
    const body = buildIcs('', events, origin, {
      calendarName: '我追蹤的行程｜星動時刻',
      alarms: alarmsFromSetting(feed.alarm),
    })
    try {
      await store.touch(feed.userId)
    } catch {
      console.error('Calendar feed access update failed', token.slice(0, 4))
    }

    return {
      status: 200,
      body,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="idol-rhythm-following.ics"',
        'Cache-Control': 'private, max-age=900',
      },
    }
  } catch {
    console.error('Calendar feed failed', token.slice(0, 4))
    return feedNotFound()
  }
}

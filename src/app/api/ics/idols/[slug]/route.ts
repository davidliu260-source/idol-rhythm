import { CALENDAR_NOTIFY_TRUST_LEVELS } from '@/lib/trustLevels'
import { addDaysToKey, taipeiToday } from '@/lib/taipeiDate'
import { NextResponse } from 'next/server'
import { buildIcs } from '@/lib/ics/buildIcs'
import { getIdolBySlug, getPublishedEvents } from '@/lib/supabase/events'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const idol = await getIdolBySlug(slug)
  if (!idol) return new NextResponse('Not Found', { status: 404 })

  const cutoffDate = addDaysToKey(taipeiToday(), -30)
  const events = (await getPublishedEvents()).filter(
    (event) =>
      event.idolId === slug &&
      CALENDAR_NOTIFY_TRUST_LEVELS.some(level => level === event.source.level) &&
      (event.endDate ?? event.startDate ?? event.date) >= cutoffDate,
  )
  const origin = new URL(request.url).origin
  const body = buildIcs(idol.name, events, origin)

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="${slug}.ics"`,
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}

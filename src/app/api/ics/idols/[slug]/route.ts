import { CALENDAR_NOTIFY_TRUST_LEVELS } from '@/lib/trustLevels'
import { addDaysToKey, taipeiToday } from '@/lib/taipeiDate'
import { NextResponse } from 'next/server'
import { buildIcs } from '@/lib/ics/buildIcs'
import { PUBLIC_ICS_UNCACHEABLE_HEADERS, publicIdolIcsHeaders } from '@/lib/ics/publicIcsCache'
import { SITE_URL } from '@/lib/seo/metadata'
import { getIdolBySlug, getPublishedEvents } from '@/lib/supabase/events'

// 1 hour CDN cache via Cache-Control + CDN-Cache-Control (Must #12).
// Do not set force-dynamic: that stopped the public cache headers from
// taking effect on Vercel. Do not set force-static: 404s must not be
// cached. Origin comes from SITE_URL so this handler does not read
// request.url (a dynamic API). revalidate is documented intent; the
// route may still be dynamic because it reads Supabase.
export const revalidate = 3600

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const idol = await getIdolBySlug(slug)
  if (!idol) {
    return new NextResponse('Not Found', { status: 404, headers: PUBLIC_ICS_UNCACHEABLE_HEADERS })
  }

  try {
    const cutoffDate = addDaysToKey(taipeiToday(), -30)
    const events = (await getPublishedEvents({ throwOnError: true })).filter(
      (event) =>
        event.idolId === slug &&
        CALENDAR_NOTIFY_TRUST_LEVELS.some(level => level === event.source.level) &&
        (event.endDate ?? event.startDate ?? event.date) >= cutoffDate,
    )
    const body = buildIcs(idol.name, events, SITE_URL)

    return new NextResponse(body, {
      headers: publicIdolIcsHeaders(slug),
    })
  } catch {
    return new NextResponse('Service Unavailable', {
      status: 503,
      headers: PUBLIC_ICS_UNCACHEABLE_HEADERS,
    })
  }
}

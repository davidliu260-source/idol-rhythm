import { NextResponse } from 'next/server'
import { buildIcs } from '@/lib/ics/buildIcs'
import { getIdolBySlug, getPublishedEvents } from '@/lib/supabase/events'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: { slug: string } }) {
  const idol = await getIdolBySlug(params.slug)
  if (!idol) return new NextResponse('Not Found', { status: 404 })

  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - 30)
  const cutoffDate = cutoff.toISOString().slice(0, 10)
  const events = (await getPublishedEvents()).filter(
    (event) =>
      event.idolId === params.slug &&
      (event.endDate ?? event.startDate ?? event.date) >= cutoffDate,
  )
  const origin = new URL(request.url).origin
  const body = buildIcs(idol.name, events, origin)

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="${params.slug}.ics"`,
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}

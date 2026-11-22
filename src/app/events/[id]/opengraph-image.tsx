import { dynamicShareImageHeaders, shareImage } from '../../_share/image'
import { resolveIdolColor } from '@/lib/idolMarks'
import { eventDateLabel, eventPlace } from '@/lib/seo/metadata'
import { getPublicEvent } from './data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const alt = '偶像活動標題、日期與地點分享預覽'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OpenGraphImage({ params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const event = await getPublicEvent(id)
    if (event) {
      return await shareImage(size, {
        title: event.title,
        subtitle: event.idolName,
        date: eventDateLabel(event.date),
        place: eventPlace(event),
        accent: resolveIdolColor({ slug: event.idolId, color: event.idolColor, name: event.idolName }),
      }, dynamicShareImageHeaders)
    }
  } catch {
    // A share crawler still gets the site image when the lookup fails.
  }
  return shareImage(size, undefined, dynamicShareImageHeaders)
}

import { dynamicShareImageHeaders, shareImage } from '../../_share/image'
import { resolveIdolColor } from '@/lib/idolMarks'
import { eventDateLabel } from '@/lib/seo/metadata'
import { getIdolDetail } from './data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const alt = '偶像台灣演唱會與活動行程分享預覽'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const detail = await getIdolDetail(slug, true)
    if (detail) {
      const { idol, upcoming } = detail
      const next = upcoming[0]
      const date = next && eventDateLabel(next.date)
      return await shareImage(size, {
        title: idol.name,
        subtitle: '台灣演唱會・活動行程',
        date: date ? `下一場 ${date}` : undefined,
        accent: resolveIdolColor({ slug: idol.id, color: idol.color, name: idol.name }),
      }, dynamicShareImageHeaders)
    }
  } catch {
    // A share crawler still gets the site image when the lookup fails.
  }
  return shareImage(size, undefined, dynamicShareImageHeaders)
}

import { pageMetadata } from '@/lib/seo/metadata'

export const dynamic = 'force-dynamic'

import { getActiveIdols } from '@/lib/supabase/events'
import IdolsClient from './IdolsClient'

export const metadata = pageMetadata('/idols', '偶像名冊', '瀏覽星動時刻追蹤的偶像團體與歌手，點選藝人即可查看各自的台灣演唱會、見面會、售票與官方活動行程。場次整理自官方與可信媒體等公開資訊，活動細節以主辦公告為準。')

export default async function IdolsPage() {
  const idols = await getActiveIdols()
  return <IdolsClient idols={idols} />
}

import { pageMetadata } from '@/lib/seo/metadata'

// 與 #253 首頁、行事曆相同：ISR 5 分鐘。不可使用 cookies()／headers()／登入資料。
// 追蹤狀態在 IdolsClient（client 元件）用瀏覽器登入狀態取得，不會烤進共用 HTML。
export const revalidate = 300

import { getActiveIdols } from '@/lib/supabase/events'
import IdolsClient from './IdolsClient'

export const metadata = pageMetadata('/idols', '偶像名冊', '瀏覽星動時刻追蹤的偶像團體與歌手，點選藝人即可查看各自的台灣演唱會、見面會、售票與官方活動行程。場次整理自官方與可信媒體等公開資訊，活動細節以主辦公告為準。')

export default async function IdolsPage() {
  const idols = await getActiveIdols({ throwOnQueryError: true })
  return <IdolsClient idols={idols} />
}

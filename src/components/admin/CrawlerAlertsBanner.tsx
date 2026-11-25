import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { buildAlertViews, loadCrawlerHealth } from '@/lib/crawlers/crawlerSourceAlerts'
import CrawlerAlertList from './CrawlerAlertList'

/**
 * MUST #10：/admin 首頁頂端的爬蟲故障橫幅。
 *
 * 除了讀未解決的提醒列，也用來源列的計數即時算出應顯示的故障
 *（例如排程整天沒跑、沒人開單的「長時間沒有成功」）。
 * migration 072 尚未套用、或讀取失敗時整塊不顯示，不影響頁面其他部分。
 */
export default async function CrawlerAlertsBanner() {
  const supabase = getSupabaseServerClient()
  if (!supabase) return null

  const health = await loadCrawlerHealth(supabase)
  if (!health.available) return null

  const views = buildAlertViews(health.sources, health.alerts)
  if (views.length === 0) return null

  return (
    <div className="px-4 mb-4">
      <CrawlerAlertList views={views} />
    </div>
  )
}

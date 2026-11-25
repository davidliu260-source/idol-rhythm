export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { ArrowLeft, Database } from 'lucide-react'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'
import SourcesClient, { type SourceRow } from './SourcesClient'
import CrawlerAlertList from '@/components/admin/CrawlerAlertList'
import {
  buildAlertViews,
  formatTaipeiDateTime,
  isKpopOfficialSource,
  loadCrawlerHealth,
  type AlertView,
} from '@/lib/crawlers/crawlerSourceAlerts'

async function getSources(): Promise<{
  sources: SourceRow[]
  alertViews: AlertView[]
  error: string | null
}> {
  const supabase = getSupabaseServerClient()
  if (!supabase) {
    return { sources: [], alertViews: [], error: 'Supabase 環境變數未設定' }
  }

  const { data, error } = await supabase
    .from('crawler_sources')
    .select(
      'id, name, source_key, source_type, parser_type, is_active, last_run_at, last_status, idols(name)',
    )
    .order('created_at', { ascending: true })

  if (error) {
    return {
      sources: [],
      alertViews: [],
      error: `查詢資料來源失敗：${error.code ? `[${error.code}] ` : ''}${error.message}`,
    }
  }

  // MUST #10：健康欄與未解決提醒另外讀。migration 072 尚未套用時 available=false，
  // 列表照常顯示，只是沒有健康資訊。
  const health = await loadCrawlerHealth(supabase)
  const healthById = new Map(health.sources.map((row) => [row.id, row]))
  const alertViews = health.available ? buildAlertViews(health.sources, health.alerts) : []

  const sources: SourceRow[] = (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    sourceKey: row.source_key as string,
    idolName: ((row.idols as unknown) as { name: string } | null)?.name ?? null,
    sourceType: row.source_type as string,
    parserType: row.parser_type as string,
    isActive: row.is_active as boolean,
    lastRunAt: row.last_run_at as string | null,
    lastStatus: row.last_status as string | null,
    isKpopOfficial: isKpopOfficialSource({
      source_key: row.source_key as string,
      parser_type: row.parser_type as string,
    }),
    health: (() => {
      const h = healthById.get(row.id as string)
      if (!h) return null
      return {
        consecutiveErrorCount: h.consecutive_error_count,
        consecutiveZeroFetchCount: h.consecutive_zero_fetch_count,
        lastSuccessLabel: h.last_success_at ? formatTaipeiDateTime(h.last_success_at) : null,
        lastFetchedCount: h.last_fetched_count,
      }
    })(),
    alerts: alertViews
      .filter((view) => view.sourceId === row.id)
      .map((view) => ({ kind: view.kind, severity: view.severity, status: view.status })),
  }))

  return { sources, alertViews, error: null }
}

export default async function AdminSourcesPage() {
  const [{ isAdmin }, { sources, alertViews, error }] = await Promise.all([
    getCurrentAdmin(),
    getSources(),
  ])

  return (
    <div className="flex flex-col gap-0 pt-12 pb-6">
      <div className="px-4 mb-4">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-text-base mb-3"
        >
          <ArrowLeft className="h-3 w-3" />
          Admin Dashboard
        </Link>
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-violet-500" />
          <h1 className="text-xl font-bold text-text-base">資料來源管理</h1>
        </div>
        <p className="text-xs text-muted mt-1">
          {isAdmin
            ? '管理爬蟲與外部資料來源（只讀，新增與編輯尚未開放）'
            : '需要管理員身份才能查看'}
        </p>
      </div>

      {!isAdmin && (
        <div className="px-4 mb-4">
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 px-3 py-2.5">
            <p className="text-xs text-amber-300 leading-snug">
              需要管理員身份才能查看資料來源。
              <Link
                href="/admin/login"
                className="underline underline-offset-2 ml-1 font-semibold"
              >
                前往登入 →
              </Link>
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="px-4 mb-4">
          <div className="rounded-xl bg-red-500/10 border border-red-500/25 px-3 py-3">
            <p className="text-xs font-semibold text-red-400 mb-1">
              資料來源載入失敗
            </p>
            <p className="text-xs text-red-400/80 break-all leading-relaxed">
              {error}
            </p>
          </div>
        </div>
      )}

      {/* MUST #10：未解決的爬蟲故障／警告 */}
      {isAdmin && alertViews.length > 0 && (
        <div className="px-4 mb-4">
          <CrawlerAlertList views={alertViews} />
        </div>
      )}

      {/* Empty state when there are no sources at all */}
      {sources.length === 0 && !error && (
        <div className="px-4">
          <div className="rounded-xl bg-card border border-card-border px-4 py-8 text-center">
            <p className="text-sm text-muted">目前尚未建立資料來源</p>
            <p className="text-xs text-muted/60 mt-1">
              {isAdmin
                ? '執行 migration 019 後，第一筆資料來源會顯示在這裡。'
                : '請先以管理員身份登入。'}
            </p>
          </div>
        </div>
      )}

      {/* Tabs + search + list */}
      {sources.length > 0 && <SourcesClient sources={sources} />}
    </div>
  )
}

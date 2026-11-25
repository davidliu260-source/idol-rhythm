import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import {
  ALERT_KIND_LABELS,
  ALERT_SEVERITY_LABELS,
  KPOPOFFICIAL_LABEL,
  formatTaipeiDateTime,
  type AlertView,
} from '@/lib/crawlers/crawlerSourceAlerts'
import CrawlerAlertActions from './CrawlerAlertActions'

/**
 * MUST #10：未解決的爬蟲故障／警告清單（/admin 橫幅、來源列表、來源詳情共用）。
 *
 * - 尚未看過的故障最醒目（紅），警告次之（琥珀）。
 * - 已看過但尚未解決的收進可展開區塊、顏色較淡。
 * - 純提醒：不會、也不應該因此更動任何活動。
 */
export default function CrawlerAlertList({
  views,
  title = '爬蟲故障提醒',
  linkToSource = true,
}: {
  views: AlertView[]
  title?: string
  linkToSource?: boolean
}) {
  if (views.length === 0) return null

  const unseen = views.filter((view) => view.status === 'open')
  const unseenFaults = unseen.filter((view) => view.severity === 'fault')
  const unseenWarnings = unseen.filter((view) => view.severity === 'warning')
  const acknowledged = views.filter((view) => view.status === 'acknowledged')

  return (
    <section aria-label={title} className="flex flex-col gap-2">
      {unseenFaults.length > 0 && (
        <div role="alert" className="rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-3 flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
            <p className="text-xs font-semibold text-red-300">
              {title}：{unseenFaults.length} 個故障尚未處理
            </p>
          </div>
          {unseenFaults.map((view) => (
            <AlertItem key={view.key} view={view} linkToSource={linkToSource} />
          ))}
          <p className="text-[10px] text-red-300/70 leading-snug">
            來源故障期間，既有活動維持原狀；請檢查來源後再處理。
          </p>
        </div>
      )}

      {unseenWarnings.length > 0 && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 px-3 py-3 flex flex-col gap-2.5">
          <p className="text-xs font-semibold text-amber-300">
            {unseenWarnings.length} 個警告（需要留意）
          </p>
          {unseenWarnings.map((view) => (
            <AlertItem key={view.key} view={view} linkToSource={linkToSource} />
          ))}
        </div>
      )}

      {acknowledged.length > 0 && (
        <details className="rounded-xl bg-card border border-card-border px-3 py-2.5">
          <summary className="text-xs text-muted cursor-pointer">
            已看過、尚未解決（{acknowledged.length}）
          </summary>
          <div className="flex flex-col gap-2.5 mt-2.5 opacity-80">
            {acknowledged.map((view) => (
              <AlertItem key={view.key} view={view} linkToSource={linkToSource} />
            ))}
          </div>
        </details>
      )}
    </section>
  )
}

function AlertItem({ view, linkToSource }: { view: AlertView; linkToSource: boolean }) {
  const isFault = view.severity === 'fault'
  return (
    <div className="flex flex-col gap-1.5 border-t border-card-border/60 pt-2.5 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span
          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
            isFault
              ? 'bg-red-500/15 border-red-500/30 text-red-300'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          }`}
        >
          {ALERT_SEVERITY_LABELS[view.severity]}
        </span>
        {view.isKpopOfficial && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-fuchsia-500/15 border-fuchsia-500/40 text-fuchsia-300">
            {KPOPOFFICIAL_LABEL}
          </span>
        )}
        <span className="text-[10px] text-muted">{ALERT_KIND_LABELS[view.kind]}</span>
        {view.status === 'acknowledged' && <span className="text-[10px] text-muted">· 已看過</span>}
      </div>
      {linkToSource ? (
        <Link
          href={`/admin/sources/${view.sourceId}`}
          className="text-sm font-semibold text-text-base underline underline-offset-2"
        >
          {view.sourceName}
        </Link>
      ) : (
        <p className="text-sm font-semibold text-text-base">{view.sourceName}</p>
      )}
      <p className="text-xs text-text-base/90 leading-snug break-words">{view.detail}</p>
      {view.lastTriggeredAt && (
        <p className="text-[10px] text-muted">最近一次發生：{formatTaipeiDateTime(view.lastTriggeredAt)}（台北時間）</p>
      )}
      {view.id !== null ? (
        <CrawlerAlertActions alertId={view.id} canAcknowledge={view.status === 'open'} />
      ) : (
        <p className="text-[10px] text-muted leading-snug">
          依來源狀態即時算出，尚未建立提醒紀錄；下次每日排程執行後才能標記「已看過」。
        </p>
      )}
    </div>
  )
}

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { ERROR_REPORT_REASONS, type ErrorReportReason } from '@/lib/eventErrorReports'
import { formatTaipeiDateTime } from '@/lib/taipeiDate'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'

const loadError = '無法載入錯誤回報，請稍後再試。'
const linkClass = 'underline underline-offset-2'

async function ReportsList() {
  const supabase = getSupabaseServerClient()
  if (!supabase) return <p role="alert">{loadError}</p>

  const { data: reports, error } = await supabase
    .from('event_error_reports')
    .select('id, event_id, reason, note, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    const missing = ['42P01', 'PGRST205'].includes(error.code) ||
      /relation .* does not exist|could not find (?:the )?(?:table|relation)/i.test(error.message)
    return <p role="alert">{missing ? '尚未套用 migration 071（貼上單 M078）' : loadError}</p>
  }

  if (!reports?.length) return <p>目前沒有回報</p>

  const eventIds = [...new Set(reports.map(report => report.event_id))]
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('id, title, display_title_zh, idol_name, date')
    .in('id', eventIds)

  if (eventsError) return <p role="alert">{loadError}</p>
  const eventsById = new Map(events?.map(event => [event.id, event]))

  return (
    <div className="overflow-x-auto rounded-xl border border-card-border bg-card">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-card-border">
          <tr>
            <th scope="col" className="whitespace-nowrap p-3">時間（台北時間）</th>
            <th scope="col" className="p-3">活動</th>
            <th scope="col" className="whitespace-nowrap p-3">類型</th>
            <th scope="col" className="whitespace-nowrap p-3">備註</th>
          </tr>
        </thead>
        <tbody>
          {reports.map(report => {
            const event = eventsById.get(report.event_id)
            const title = event
              ? `${event.idol_name} · ${event.display_title_zh?.trim() || event.title}`
              : report.event_id
            return (
              <tr key={report.id} className="border-b border-card-border align-top last:border-0">
                <td className="whitespace-nowrap p-3">{formatTaipeiDateTime(report.created_at) ?? '—'}</td>
                <td className="p-3">
                  <Link href={`/admin/events/${report.event_id}`} className={linkClass}>{title}</Link>
                  <Link href={`/events/${report.event_id}`} className={`ml-2 whitespace-nowrap ${linkClass}`}>前台</Link>
                </td>
                <td className="p-3">{ERROR_REPORT_REASONS[report.reason as ErrorReportReason] ?? report.reason}</td>
                <td className="min-w-32 break-words p-3">{report.note ?? '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default async function AdminReportsPage() {
  const { isAdmin } = await getCurrentAdmin()

  return (
    <div className="px-4 pb-6 pt-12 text-text-base">
      <Link href="/admin" className={`text-xs text-muted ${linkClass}`}>Admin Dashboard</Link>
      <h1 className="mb-4 mt-3 text-xl font-bold">錯誤回報</h1>
      {isAdmin ? <ReportsList /> : (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-300">
          需要管理員登入
          <Link href="/admin/login" className={`ml-2 ${linkClass}`}>前往管理員登入 →</Link>
        </div>
      )}
    </div>
  )
}

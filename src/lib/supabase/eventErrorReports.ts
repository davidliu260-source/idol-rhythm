import { classifyReportRpcError, resolveReportResult, type ErrorReportReason, type ReportResult } from '../eventErrorReports'
import { getBrowserSupabaseClient } from './browserClient'

let unavailable = false
let availability: Promise<boolean> | undefined

async function probe(): Promise<boolean> {
  try {
    const client = getBrowserSupabaseClient()
    if (!client) return false
    const { data, error } = await client.rpc('event_error_reports_enabled')
    if (classifyReportRpcError(error) === 'missing') unavailable = true
    return !unavailable && !error && data === true
  } catch {
    return false
  }
}

export function checkEventErrorReportsAvailable(): Promise<boolean> {
  if (unavailable) return Promise.resolve(false)
  availability ??= probe()
  return availability
}

export async function submitEventErrorReport(
  eventId: string,
  reason: ErrorReportReason,
  note: string | null,
  scope: string,
  deviceId: string | null,
): Promise<ReportResult> {
  if (unavailable) return { kind: 'gone' }
  try {
    const client = getBrowserSupabaseClient()
    if (!client) return { kind: 'gone' }
    const { data, error } = await client.rpc('submit_event_error_report', {
      p_event_id: eventId,
      p_reason: reason,
      p_note: note,
      p_device_id: scope === 'anon' ? deviceId : null,
    })
    if (classifyReportRpcError(error) === 'missing') unavailable = true
    return error ? { kind: 'gone' } : resolveReportResult(data?.[0])
  } catch {
    return { kind: 'gone' }
  }
}

import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'
import { isMissingHealthSchemaError } from '@/lib/crawlers/crawlerSourceAlerts'

/**
 * MUST #10 爬蟲故障提醒：管理員把提醒標成「已看過」或「已解決」。
 *
 * 只 UPDATE crawler_source_alerts 的 status／acknowledged_at／resolved_at
 *（migration 072 的欄位級 GRANT + RLS）。不新增、不刪除提醒列，
 * 也不會更動任何活動或來源設定。
 */

type AlertAction = 'acknowledge' | 'resolve'

interface AlertActionResponse {
  ok: true
  id: number
  status: 'acknowledged' | 'resolved'
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<AlertActionResponse | { ok: false; error: string }>> {
  const { isAdmin } = await getCurrentAdmin()
  if (!isAdmin) {
    return NextResponse.json({ ok: false, error: '未授權：需要管理員身份' }, { status: 401 })
  }

  let body: { id?: unknown; action?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: '無效的請求格式' }, { status: 400 })
  }

  const id = typeof body?.id === 'number' ? body.id : Number.NaN
  const action = body?.action as AlertAction
  if (!Number.isSafeInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: 'id 不合法' }, { status: 400 })
  }
  if (action !== 'acknowledge' && action !== 'resolve') {
    return NextResponse.json({ ok: false, error: 'action 不合法' }, { status: 400 })
  }

  const supabase = getSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'Supabase 環境變數未設定' }, { status: 500 })
  }

  const now = new Date().toISOString()
  // 已看過：只對尚未看過的提醒生效（仍算未解決）。已解決：需要 resolved_at。
  const query = action === 'acknowledge'
    ? supabase
        .from('crawler_source_alerts')
        .update({ status: 'acknowledged', acknowledged_at: now })
        .eq('id', id)
        .eq('status', 'open')
    : supabase
        .from('crawler_source_alerts')
        .update({ status: 'resolved', resolved_at: now })
        .eq('id', id)
        .in('status', ['open', 'acknowledged'])
  const { data, error } = await query.select('id, source_id, status')

  if (error) {
    const message = isMissingHealthSchemaError(error)
      ? '尚未套用 migration 072（貼上單 M081）'
      : `更新提醒失敗：${error.code ? `[${error.code}] ` : ''}${error.message}`
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
  const row = data?.[0] as { id: number; source_id: string; status: 'acknowledged' | 'resolved' } | undefined
  if (!row) {
    return NextResponse.json(
      { ok: false, error: '找不到可更新的提醒（可能已處理，或沒有權限）' },
      { status: 404 },
    )
  }

  revalidatePath('/admin')
  revalidatePath('/admin/sources')
  revalidatePath(`/admin/sources/${row.source_id}`)

  return NextResponse.json({ ok: true, id: row.id, status: row.status })
}

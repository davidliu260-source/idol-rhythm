import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/serviceClient'

export const dynamic = 'force-dynamic'

// ── Response shapes ───────────────────────────────────────────────────────────

interface CronOkResponse {
  ok: true
  trigger: 'vercel-cron'
  dispatched: number      // notifications 實際新插入筆數
  skipped_dedup: number   // 因 ON CONFLICT 略過筆數
  marked_sent: number     // reminders.is_sent 標為 true 的筆數
}

interface CronErrResponse {
  ok: false
  trigger: 'vercel-cron'
  error: string
}

// ── Internal types ────────────────────────────────────────────────────────────

interface PendingReminder {
  reminder_id: string
  user_id: string
  event_id: string
  reminder_type: 'day_before' | 'week_before'
  idol_id: string | null
  idol_name: string
  event_title: string
}

// Supabase returns joined relations as arrays even for to-one joins with !inner
type EventShape = {
  idol_id: string | null
  idol_name: string
  title: string
  date: string
  is_published: boolean
  trust_level: string
}
type RawReminderRow = {
  id: string
  user_id: string
  event_id: string
  type: string
  events: EventShape | EventShape[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildTitle(eventTitle: string, reminderType: 'day_before' | 'week_before'): string {
  const truncated = eventTitle.length > 80 ? eventTitle.slice(0, 80) + '…' : eventTitle
  return reminderType === 'day_before'
    ? `《${truncated}》明天登場！`
    : `《${truncated}》下週登場！`
}

function buildBody(idolName: string, reminderType: 'day_before' | 'week_before'): string {
  return reminderType === 'day_before'
    ? `${idolName} 的活動明天即將開始，記得準備好！`
    : `${idolName} 的活動一週後即將開始，可以開始安排計畫了。`
}

/** UTC date string YYYY-MM-DD offset by `days` from now */
function utcDateOffsetString(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ── Route ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/cron/dispatch-reminders
 *
 * Vercel Cron — schedule: "0 * * * *" (每小時頂部觸發)
 *
 * 掃描 reminders 表中 is_sent = false 的 day_before / week_before reminder，
 * 對符合時間視窗的活動插入 notifications。
 * 時區策略：以 DB CURRENT_DATE 為準，date-level only；hour_before 留到 N6b。
 *
 * Auth: Authorization: Bearer {CRON_SECRET}
 * Idempotent: ON CONFLICT (user_id, dedupe_key) DO NOTHING + is_sent flag。
 */
export async function GET(
  request: NextRequest,
): Promise<NextResponse<CronOkResponse | CronErrResponse>> {
  // ── Secret guard ─────────────────────────────────────────────────────────
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json(
      { ok: false, trigger: 'vercel-cron', error: 'CRON_SECRET 未設定（請在 Vercel Project Settings 加入）' },
      { status: 500 },
    )
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json(
      { ok: false, trigger: 'vercel-cron', error: '未授權：Authorization header 無效' },
      { status: 401 },
    )
  }

  // ── Service client ────────────────────────────────────────────────────────
  let supabase: ReturnType<typeof getSupabaseServiceClient>
  try {
    supabase = getSupabaseServiceClient()
  } catch (e) {
    return NextResponse.json(
      { ok: false, trigger: 'vercel-cron', error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }

  // ── Step ①②: 查詢待派送 reminders ──────────────────────────────────────
  // 時區策略：以 JS UTC date 計算視窗字串，與 DB CURRENT_DATE 行為一致。
  const tomorrowStr = utcDateOffsetString(1)   // day_before 視窗
  const weekLaterStr = utcDateOffsetString(7)  // week_before 視窗

  const { data: rawRows, error: queryError } = await supabase
    .from('reminders')
    .select(`
      id,
      user_id,
      event_id,
      type,
      events!inner (
        idol_id,
        idol_name,
        title,
        date,
        is_published,
        trust_level
      )
    `)
    .eq('is_sent', false)
    .in('type', ['day_before', 'week_before'])

  if (queryError) {
    return NextResponse.json(
      { ok: false, trigger: 'vercel-cron', error: `查詢 reminders 失敗：${queryError.message}` },
      { status: 500 },
    )
  }

  // Filter in JS: published + trust_level + date window
  const reminders: PendingReminder[] = ((rawRows ?? []) as unknown as RawReminderRow[])
    .flatMap((r) => {
      const e = Array.isArray(r.events) ? r.events[0] : r.events
      if (!e) return []
      if (!e.is_published) return []
      if (!['official', 'media'].includes(e.trust_level)) return []
      if (r.type === 'day_before' && e.date !== tomorrowStr) return []
      if (r.type === 'week_before' && e.date !== weekLaterStr) return []
      return [{
        reminder_id: r.id,
        user_id: r.user_id,
        event_id: r.event_id,
        reminder_type: r.type as 'day_before' | 'week_before',
        idol_id: e.idol_id,
        idol_name: e.idol_name,
        event_title: e.title,
      }]
    })

  // ── Step ③: 若無待派送 reminder ──────────────────────────────────────────
  if (reminders.length === 0) {
    return NextResponse.json(
      { ok: true, trigger: 'vercel-cron', dispatched: 0, skipped_dedup: 0, marked_sent: 0 },
      { status: 200 },
    )
  }

  const N = reminders.length

  // ── Step ④: 建構 notifications payload ──────────────────────────────────
  const notificationsPayload = reminders.map((r) => ({
    user_id: r.user_id,
    type: 'event_reminder' as const,
    event_id: r.event_id,
    idol_id: r.idol_id,
    title: buildTitle(r.event_title, r.reminder_type),
    body: buildBody(r.idol_name, r.reminder_type),
    dedupe_key: `event_reminder:${r.event_id}:${r.reminder_type}`,
    payload: { reminder_type: r.reminder_type },
  }))

  // ── Step ⑤: 批次 upsert（ON CONFLICT DO NOTHING）──────────────────────
  // ignoreDuplicates: true → 等效於 ON CONFLICT DO NOTHING
  // .select('id') → 只回傳實際插入的 rows（dedup 略過的不回）
  const { data: inserted, error: upsertError } = await supabase
    .from('notifications')
    .upsert(notificationsPayload, {
      onConflict: 'user_id,dedupe_key',
      ignoreDuplicates: true,
    })
    .select('id')

  // 若 upsert 發生真正錯誤，不標 is_sent，直接回 500
  if (upsertError) {
    return NextResponse.json(
      { ok: false, trigger: 'vercel-cron', error: `INSERT notifications 失敗：${upsertError.message}` },
      { status: 500 },
    )
  }

  const insertedCount = inserted?.length ?? 0

  // ── Step ⑥: 標記 reminders.is_sent = true ────────────────────────────────
  // insert 成功 + dedup 略過都標 true（只有 upsert 真正失敗才不標，已在上方 return）
  const reminderIds = reminders.map((r) => r.reminder_id)
  const { error: updateError } = await supabase
    .from('reminders')
    .update({ is_sent: true })
    .in('id', reminderIds)

  // is_sent 更新失敗不影響本輪 notifications（已插入），但下輪 cron 會再撈到同一筆
  // 因 notifications dedupe 不會重複派送，屬可接受降級行為
  const markedSent = updateError ? 0 : N

  // ── Step ⑦: 回傳 ─────────────────────────────────────────────────────────
  return NextResponse.json(
    {
      ok: true,
      trigger: 'vercel-cron',
      dispatched: insertedCount,
      skipped_dedup: N - insertedCount,
      marked_sent: markedSent,
    },
    { status: 200 },
  )
}

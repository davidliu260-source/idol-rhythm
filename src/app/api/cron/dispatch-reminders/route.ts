import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/serviceClient'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

interface CronOkResponse {
  ok: true
  trigger: 'vercel-cron'
  dispatched: number     // notifications actually inserted
  skipped_dedup: number  // skipped due to ON CONFLICT
  marked_sent: number    // reminders.is_sent set to true
}

interface CronErrResponse {
  ok: false
  trigger: 'vercel-cron'
  error: string
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/** UTC date string YYYY-MM-DD, offset by `days` from now */
function utcDateOffsetString(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

/**
 * GET /api/cron/dispatch-reminders
 *
 * Vercel Cron schedule (vercel.json): "30 1 * * *"  -- 09:30 Asia/Taipei (UTC+8) daily
 * Note: Vercel Hobby plan only allows daily cron jobs. date-level reminders run once/day.
 *
 * Scans reminders with is_sent=false and reminder_type in (day_before, week_before).
 * Inserts event_reminder notifications for events whose date matches the window.
 * Timezone strategy: date-level only, based on UTC CURRENT_DATE. hour_before deferred to N6b.
 *
 * Auth:      Authorization: Bearer {CRON_SECRET}
 * Idempotent: ON CONFLICT (user_id, dedupe_key) DO NOTHING + is_sent flag
 */
export async function GET(
  request: NextRequest,
): Promise<NextResponse<CronOkResponse | CronErrResponse>> {
  // -- Secret guard ----------------------------------------------------------
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json(
      {
        ok: false,
        trigger: 'vercel-cron',
        error: 'CRON_SECRET 未設定（請在 Vercel Project Settings 加入）',
      },
      { status: 500 },
    )
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json(
      {
        ok: false,
        trigger: 'vercel-cron',
        error: '未授權：Authorization header 無效',
      },
      { status: 401 },
    )
  }

  // -- Service client --------------------------------------------------------
  let supabase: ReturnType<typeof getSupabaseServiceClient>
  try {
    supabase = getSupabaseServiceClient()
  } catch (e) {
    return NextResponse.json(
      { ok: false, trigger: 'vercel-cron', error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }

  // -- Step 1+2: Query pending reminders ------------------------------------
  // Date window: day_before = tomorrow UTC, week_before = 7 days from now UTC
  const tomorrowStr = utcDateOffsetString(1)
  const weekLaterStr = utcDateOffsetString(7)

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
      {
        ok: false,
        trigger: 'vercel-cron',
        error: `查詢 reminders 失敗：${queryError.message}`,
      },
      { status: 500 },
    )
  }

  // Filter in JS: published + trust_level in (official, media) + date window
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

  // -- Step 3: Nothing to dispatch ------------------------------------------
  if (reminders.length === 0) {
    return NextResponse.json(
      { ok: true, trigger: 'vercel-cron', dispatched: 0, skipped_dedup: 0, marked_sent: 0 },
      { status: 200 },
    )
  }

  const N = reminders.length

  // -- Step 4: Build notifications payload ----------------------------------
  // dedupe_key = event_reminder:{event_id}:{reminder_type}
  // This allows week_before and day_before for the same event to coexist.
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

  // -- Step 5: Batch upsert (ON CONFLICT DO NOTHING) ------------------------
  // ignoreDuplicates: true  => ON CONFLICT DO NOTHING
  // .select('id')           => only inserted rows returned (not dedup-skipped ones)
  const { data: inserted, error: upsertError } = await supabase
    .from('notifications')
    .upsert(notificationsPayload, {
      onConflict: 'user_id,dedupe_key',
      ignoreDuplicates: true,
    })
    .select('id')

  // Real upsert error: do NOT mark is_sent, return 500
  if (upsertError) {
    return NextResponse.json(
      {
        ok: false,
        trigger: 'vercel-cron',
        error: `INSERT notifications 失敗：${upsertError.message}`,
      },
      { status: 500 },
    )
  }

  const insertedCount = inserted?.length ?? 0

  // -- Step 6: Mark reminders.is_sent = true --------------------------------
  // Both "inserted" and "dedup-skipped" reminders are marked sent.
  // Only a real upsert error (handled above) prevents marking.
  const reminderIds = reminders.map((r) => r.reminder_id)
  const { error: updateError } = await supabase
    .from('reminders')
    .update({ is_sent: true })
    .in('id', reminderIds)

  // If is_sent update fails, return 500.
  // notifications have already been inserted (or dedup-skipped), so next cron
  // run will re-query these reminders but dedupe will prevent duplicate notifications.
  if (updateError) {
    return NextResponse.json(
      {
        ok: false,
        trigger: 'vercel-cron',
        error: `notifications 已處理（dispatched: ${insertedCount}, skipped_dedup: ${N - insertedCount}），但 reminders.is_sent 標記失敗：${updateError.message}。下輪 cron 會重試，dedupe 可避免重複通知。`,
      },
      { status: 500 },
    )
  }

  // -- Step 7: Return -------------------------------------------------------
  return NextResponse.json(
    {
      ok: true,
      trigger: 'vercel-cron',
      dispatched: insertedCount,
      skipped_dedup: N - insertedCount,
      marked_sent: N,
    },
    { status: 200 },
  )
}

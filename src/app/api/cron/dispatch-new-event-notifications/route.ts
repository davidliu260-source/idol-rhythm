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
}

interface CronErrResponse {
  ok: false
  trigger: 'vercel-cron'
  error: string
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

// Supabase returns joined relations as arrays even for to-one joins with !inner
type EventShape = {
  id: string
  idol_id: string
  idol_name: string
  title: string
  type: string
  date: string
  published_at: string
}

type RawRow = {
  user_id: string
  events: EventShape | EventShape[]
}

interface PendingDispatch {
  user_id: string
  event_id: string
  idol_id: string
  idol_name: string
  event_title: string
  event_type: string
  event_date: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildTitle(idolName: string): string {
  return `${idolName} 有新活動!`
}

function buildBody(eventTitle: string, eventDate: string): string {
  const truncated = eventTitle.length > 80 ? eventTitle.slice(0, 80) + '...' : eventTitle
  // Format date: "2026-07-12" -> "2026/07/12"
  const dateLabel = eventDate.replace(/-/g, '/')
  return `《${truncated}》${dateLabel}`
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

/**
 * GET /api/cron/dispatch-new-event-notifications
 *
 * Vercel Cron schedule (vercel.json): "0 2 * * *"  -- 10:00 Asia/Taipei daily
 * Runs 30 min after dispatch-reminders ("30 1 * * *") to avoid overlap.
 *
 * Scans events published in the last 25 hours, finds users who follow the
 * event's idol, and inserts followed_idol_new_event notifications.
 *
 * Key invariants:
 * - No backfill: only notifies if published_at >= user_follows.created_at
 * - Idempotent: ON CONFLICT (user_id, dedupe_key) DO NOTHING
 * - dedupe_key = followed_idol_new_event:{event_id}
 *
 * Auth: Authorization: Bearer {CRON_SECRET}
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
        error: 'CRON_SECRET 未設定 (請在 Vercel Project Settings 加入)',
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
        error: '未授權: Authorization header 無效',
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

  // -- Step 1+2: Query new published events with followers -------------------
  // Scan window: past 25 hours (24h + 1h buffer for cron delay)
  // No backfill: published_at >= user_follows.created_at
  const { data: rawRows, error: queryError } = await supabase
    .from('user_follows')
    .select(`
      user_id,
      events!inner (
        id,
        idol_id,
        idol_name,
        title,
        type,
        date,
        published_at,
        is_published,
        trust_level
      )
    `)
    .not('events.published_at', 'is', null)
    .eq('events.is_published', true)
    .in('events.trust_level', ['official', 'media'])

  if (queryError) {
    return NextResponse.json(
      {
        ok: false,
        trigger: 'vercel-cron',
        error: `查詢 user_follows 失敗: ${queryError.message}`,
      },
      { status: 500 },
    )
  }

  // Filter in JS: published within 25h window + no-backfill guard
  const windowMs = 25 * 60 * 60 * 1000
  const windowCutoff = new Date(Date.now() - windowMs)

  type RawFollowRow = {
    user_id: string
    created_at: string
    events: EventShape | EventShape[]
  }

  const dispatches: PendingDispatch[] = ((rawRows ?? []) as unknown as RawFollowRow[])
    .flatMap((row) => {
      const e = Array.isArray(row.events) ? row.events[0] : row.events
      if (!e) return []
      if (!e.published_at) return []

      const publishedAt = new Date(e.published_at)
      const followedAt = new Date(row.created_at)

      // Must be within 25-hour scan window
      if (publishedAt < windowCutoff) return []
      // No backfill: skip if event was published before user followed
      if (publishedAt < followedAt) return []

      return [{
        user_id: row.user_id,
        event_id: e.id,
        idol_id: e.idol_id,
        idol_name: e.idol_name,
        event_title: e.title,
        event_type: e.type,
        event_date: e.date,
      }]
    })

  // -- Step 3: Nothing to dispatch ------------------------------------------
  if (dispatches.length === 0) {
    return NextResponse.json(
      { ok: true, trigger: 'vercel-cron', dispatched: 0, skipped_dedup: 0 },
      { status: 200 },
    )
  }

  const N = dispatches.length

  // -- Step 4: Build notifications payload ----------------------------------
  // dedupe_key = followed_idol_new_event:{event_id}
  // unique constraint (user_id, dedupe_key) ensures one notification per user per event
  const notificationsPayload = dispatches.map((d) => ({
    user_id: d.user_id,
    type: 'followed_idol_new_event' as const,
    event_id: d.event_id,
    idol_id: d.idol_id,
    title: buildTitle(d.idol_name),
    body: buildBody(d.event_title, d.event_date),
    dedupe_key: `followed_idol_new_event:${d.event_id}`,
    payload: { event_type: d.event_type, event_date: d.event_date },
  }))

  // -- Step 5: Batch upsert (ON CONFLICT DO NOTHING) ------------------------
  // ignoreDuplicates: true  => ON CONFLICT DO NOTHING
  // .select('id')           => only inserted rows returned (not dedup-skipped)
  const { data: inserted, error: upsertError } = await supabase
    .from('notifications')
    .upsert(notificationsPayload, {
      onConflict: 'user_id,dedupe_key',
      ignoreDuplicates: true,
    })
    .select('id')

  if (upsertError) {
    return NextResponse.json(
      {
        ok: false,
        trigger: 'vercel-cron',
        error: `INSERT notifications 失敗: ${upsertError.message}`,
      },
      { status: 500 },
    )
  }

  const insertedCount = inserted?.length ?? 0

  // -- Step 6: Return -------------------------------------------------------
  return NextResponse.json(
    {
      ok: true,
      trigger: 'vercel-cron',
      dispatched: insertedCount,
      skipped_dedup: N - insertedCount,
    },
    { status: 200 },
  )
}

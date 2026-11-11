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

interface EventRow {
  id: string
  idol_id: string
  idol_name: string
  title: string
  type: string
  date: string
  published_at: string
}

interface FollowRow {
  user_id: string
  idol_id: string
  created_at: string
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
 * Step A: Query events published in the last 25 hours
 *         (is_published, trust_level in official/media, published_at not null)
 * Step B: Query user_follows by idol_id IN events.idol_id list
 *         (must select created_at for the no-backfill guard)
 * Step C: Pair events and follows by idol_id in JS, apply no-backfill rule
 * Step D: Batch upsert notifications with ON CONFLICT DO NOTHING
 *
 * Key invariants:
 * - No backfill: only notifies if event.published_at >= user_follows.created_at
 * - Idempotent: ON CONFLICT (user_id, dedupe_key) DO NOTHING
 * - dedupe_key = followed_idol_new_event:{event_id}
 *   (unique constraint is (user_id, dedupe_key), no need to embed user_id)
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

  // -- Step A: Query recently published events ------------------------------
  // Scan window: past 25 hours (24h + 1h buffer for cron delay)
  const windowMs = 25 * 60 * 60 * 1000
  const windowCutoffIso = new Date(Date.now() - windowMs).toISOString()

  const { data: eventRows, error: eventErr } = await supabase
    .from('events')
    .select('id, idol_id, idol_name, title, type, date, published_at')
    .eq('is_published', true)
    .in('trust_level', ['official', 'media'])
    .not('published_at', 'is', null)
    .gte('published_at', windowCutoffIso)

  if (eventErr) {
    return NextResponse.json(
      {
        ok: false,
        trigger: 'vercel-cron',
        error: `查詢 events 失敗: ${eventErr.message}`,
      },
      { status: 500 },
    )
  }

  const events: EventRow[] = (eventRows ?? []) as EventRow[]

  // No new events in window -> nothing to dispatch
  if (events.length === 0) {
    return NextResponse.json(
      { ok: true, trigger: 'vercel-cron', dispatched: 0, skipped_dedup: 0 },
      { status: 200 },
    )
  }

  // -- Step B: Query user_follows by idol_id list ---------------------------
  // Must select created_at for the no-backfill guard.
  const idolIds = Array.from(new Set(events.map((e) => e.idol_id)))

  const { data: followRows, error: followErr } = await supabase
    .from('user_follows')
    .select('user_id, idol_id, created_at')
    .in('idol_id', idolIds)

  if (followErr) {
    return NextResponse.json(
      {
        ok: false,
        trigger: 'vercel-cron',
        error: `查詢 user_follows 失敗: ${followErr.message}`,
      },
      { status: 500 },
    )
  }

  const follows: FollowRow[] = (followRows ?? []) as FollowRow[]

  if (follows.length === 0) {
    return NextResponse.json(
      { ok: true, trigger: 'vercel-cron', dispatched: 0, skipped_dedup: 0 },
      { status: 200 },
    )
  }

  // -- Step C: Pair events and follows in JS --------------------------------
  // Group follows by idol_id for O(1) lookup
  const followsByIdol = new Map<string, FollowRow[]>()
  for (const f of follows) {
    const list = followsByIdol.get(f.idol_id) ?? []
    list.push(f)
    followsByIdol.set(f.idol_id, list)
  }

  const dispatches: PendingDispatch[] = []
  for (const ev of events) {
    const publishedAt = new Date(ev.published_at)
    const matchingFollows = followsByIdol.get(ev.idol_id) ?? []
    for (const f of matchingFollows) {
      // No backfill: skip if event was published before user followed
      const followedAt = new Date(f.created_at)
      if (publishedAt < followedAt) continue

      dispatches.push({
        user_id: f.user_id,
        event_id: ev.id,
        idol_id: ev.idol_id,
        idol_name: ev.idol_name,
        event_title: ev.title,
        event_type: ev.type,
        event_date: ev.date,
      })
    }
  }

  if (dispatches.length === 0) {
    return NextResponse.json(
      { ok: true, trigger: 'vercel-cron', dispatched: 0, skipped_dedup: 0 },
      { status: 200 },
    )
  }

  const N = dispatches.length

  // -- Step D: Build notifications payload and upsert -----------------------
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

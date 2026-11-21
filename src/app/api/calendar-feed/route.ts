import { randomBytes } from 'node:crypto'
import { FEED_TOKEN_RE, isFeedAlarm, type FeedAlarm } from '@/lib/ics/followsFeed'
import { isSameOriginRequest } from '@/lib/ics/sameOriginRequest'
import { getCurrentUser } from '@/lib/supabase/auth'
import { getSupabaseServiceClient } from '@/lib/supabase/serviceClient'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type FeedSettings = { token: string | null; alarm: FeedAlarm }

function json(body: ({ ok: true } & FeedSettings) | { ok: false; error: string }, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

function failure() {
  return json({ ok: false, error: '暫時無法處理行事曆訂閱，請稍後再試。' }, 500)
}

function generateToken() {
  const token = randomBytes(32).toString('base64url')
  if (!FEED_TOKEN_RE.test(token)) throw new Error('Invalid generated feed token')
  return token
}

async function readSettings(supabase: ReturnType<typeof getSupabaseServiceClient>, userId: string) {
  const { data, error } = await supabase
    .from('calendar_feed_tokens')
    .select('token, alarm')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error('Feed settings lookup failed')
  if (!data) return { token: null, alarm: 'day_before' } as const
  const { token, alarm } = data
  if (typeof token !== 'string' || !FEED_TOKEN_RE.test(token) || !isFeedAlarm(alarm)) {
    throw new Error('Invalid stored feed settings')
  }
  return { token, alarm }
}

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return json({ ok: false, error: '未登入' }, 401)
    return json({ ok: true, ...await readSettings(getSupabaseServiceClient(), user.id) })
  } catch {
    return failure()
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request.headers, request.url)) {
    return json({ ok: false, error: '不允許的來源' }, 403)
  }

  try {
    const user = await getCurrentUser()
    if (!user) return json({ ok: false, error: '未登入' }, 401)

    const contentType = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()
    const body: { action?: unknown; alarm?: unknown } | null = contentType === 'application/json'
      ? await request.json().catch(() => null)
      : null
    const action = body?.action
    const alarm = body?.alarm
    if (
      (action !== 'create' && action !== 'rotate' && action !== 'set_alarm') ||
      (alarm !== undefined && !isFeedAlarm(alarm)) ||
      (action === 'set_alarm' && !isFeedAlarm(alarm))
    ) {
      return json({ ok: false, error: '無效的行事曆訂閱設定。' }, 400)
    }

    const supabase = getSupabaseServiceClient()
    const table = () => supabase.from('calendar_feed_tokens')

    if (action === 'rotate') {
      const { error } = await table().upsert({
        user_id: user.id,
        token: generateToken(),
        rotated_at: new Date().toISOString(),
      }, { onConflict: 'user_id', defaultToNull: false })
      if (error) throw new Error('Feed rotation failed')
    } else {
      const settings = await readSettings(supabase, user.id)
      if (action === 'create' && settings.token) return json({ ok: true, ...settings })

      if (!settings.token) {
        // Ignore a concurrent create or rotate so it keeps its token.
        const { error } = await table().upsert({
          user_id: user.id,
          token: generateToken(),
          ...(action === 'set_alarm' ? { alarm } : {}),
        }, { onConflict: 'user_id', ignoreDuplicates: true, defaultToNull: false })
        if (error) throw new Error('Feed creation failed')
      }

      if (action === 'set_alarm') {
        const { error } = await table().update({ alarm }).eq('user_id', user.id)
        if (error) throw new Error('Feed alarm update failed')
      }
    }

    return json({ ok: true, ...await readSettings(supabase, user.id) })
  } catch {
    return failure()
  }
}

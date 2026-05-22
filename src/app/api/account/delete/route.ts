import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/auth'
import { getSupabaseServiceClient } from '@/lib/supabase/serviceClient'

export const dynamic = 'force-dynamic'

interface DeleteResponse {
  ok: boolean
  error?: string
}

function buildResponse(
  body: DeleteResponse,
  status: number,
): NextResponse<DeleteResponse> {
  return NextResponse.json(body, { status })
}

/**
 * POST /api/account/delete
 *
 * Deletes the currently authenticated user's account. Body is intentionally
 * ignored — the target is ALWAYS the session user (see
 * ACCOUNT_SETTINGS_WORK_ORDER.md §5.4 / §5.5 / §8).
 *
 * Cascade behaviour (verified pre-implementation; see §6.1 + §10):
 *   - user_follows / saved_events / reminders / notifications / admin_users
 *     all use ON DELETE CASCADE → auto-removed by Supabase when the
 *     auth.users row is deleted.
 *   - event_candidates / event_sources / user_activity_logs use ON DELETE
 *     SET NULL → user_id becomes NULL, audit rows survive. Correct.
 *
 * Errors:
 *   - 401 if no session
 *   - 500 if service client cannot be constructed (env missing) or the
 *     admin delete call fails. Raw Supabase error stays server-side.
 *
 * After success the client must call `supabase.auth.signOut()` and
 * redirect away from authenticated areas.
 */
export async function POST(): Promise<NextResponse<DeleteResponse>> {
  const user = await getCurrentUser()
  if (!user) {
    return buildResponse({ ok: false, error: '未登入' }, 401)
  }

  let service
  try {
    service = getSupabaseServiceClient()
  } catch (e) {
    // getSupabaseServiceClient throws loudly when env is misconfigured.
    // Log server-side, return a generic 500.
    console.error(
      '[account/delete] service client init failed:',
      e instanceof Error ? e.message : e,
    )
    return buildResponse(
      { ok: false, error: '帳號刪除暫不可用，請稍後再試' },
      500,
    )
  }

  const { error } = await service.auth.admin.deleteUser(user.id)
  if (error) {
    console.error('[account/delete] admin.deleteUser failed:', {
      userId: user.id,
      code: error.status,
      message: error.message,
    })
    return buildResponse(
      { ok: false, error: '帳號刪除失敗，請稍後再試' },
      500,
    )
  }

  return buildResponse({ ok: true }, 200)
}

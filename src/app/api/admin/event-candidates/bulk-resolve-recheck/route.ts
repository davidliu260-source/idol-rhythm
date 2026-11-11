/**
 * Bulk resolve `needs_recheck` flag on event_candidates.
 *
 * Mirrors the single-row `resolveRecheck` server action
 * (src/app/admin/event-candidates/[id]/actions.ts) but applied across a
 * caller-provided array of ids. Per-row failures do NOT abort the batch.
 *
 * Per-row order of operations (identical to single resolveRecheck):
 *   A. If review_status === 'approved' AND approved_event_id IS NOT NULL:
 *      1. Sync candidate's Chinese display fields to the linked event:
 *         display_title_zh, display_summary_zh, location_name_zh,
 *         translation_status, translation_source, translation_updated_at.
 *      2. If event sync fails: count as error, DO NOT clear needs_recheck.
 *      3. If event sync succeeds OR no Chinese fields to sync: clear flag.
 *   B. Otherwise (pending / rejected / no approved_event_id):
 *      Clear needs_recheck directly.
 *
 * Why per-row processing instead of one bulk UPDATE:
 *   - Need to read each candidate's review_status + approved_event_id
 *     before deciding whether to sync, and the sync target differs per row.
 *   - Per-row failures (e.g. RLS or missing event) must be surfaced
 *     without poisoning the rest of the batch.
 *   - Total batch size is bounded by the admin UI (selection within one
 *     filtered view), so the O(N) round-trips are acceptable.
 *
 * Auth + ids array validation up front. RLS is still the enforcement
 * layer; this route uses the cookie-based server client (not service_role)
 * so all updates go through the admin's session.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'

interface BulkResolveRecheckRequest {
  ids: string[]
}

interface BulkResolveRecheckResponse {
  ok: boolean
  total: number
  /** Rows whose needs_recheck flag was cleared this call. */
  resolved: number
  /** Of `resolved`, how many also synced Chinese fields to a linked event. */
  synced: number
  failed: number
  errors: { id: string; message: string }[]
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<BulkResolveRecheckResponse | { ok: false; error: string }>> {
  const { isAdmin } = await getCurrentAdmin()
  if (!isAdmin) {
    return NextResponse.json(
      { ok: false, error: '未授權：需要管理員身份' },
      { status: 401 },
    )
  }

  let body: BulkResolveRecheckRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: '無效的請求格式' },
      { status: 400 },
    )
  }

  const { ids } = body
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'ids 不可為空' },
      { status: 400 },
    )
  }

  const supabase = getSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: 'Supabase 環境變數未設定' },
      { status: 500 },
    )
  }

  const errors: { id: string; message: string }[] = []
  let resolved = 0
  let synced = 0
  const affectedEventIds = new Set<string>()

  for (const id of ids) {
    try {
      // Fetch fields needed to decide sync target + payload.
      const { data: candidate, error: fetchError } = await supabase
        .from('event_candidates')
        .select(
          'review_status, approved_event_id, display_title_zh, display_summary_zh, location_name_zh, translation_status, translation_source',
        )
        .eq('id', id)
        .single()

      if (fetchError || !candidate) {
        errors.push({
          id,
          message: `找不到候選：${fetchError?.message ?? '無資料'}`,
        })
        continue
      }

      // Path A: approved + has linked event → sync Chinese fields first.
      let didSync = false
      if (
        candidate.review_status === 'approved' &&
        candidate.approved_event_id
      ) {
        const approvedEventId = candidate.approved_event_id as string

        type EventUpdatePayload = {
          display_title_zh?: string | null
          display_summary_zh?: string | null
          location_name_zh?: string | null
          translation_status?: string | null
          translation_source?: string | null
          translation_updated_at?: string | null
        }
        const syncPayload: EventUpdatePayload = {}

        if (candidate.display_title_zh != null)
          syncPayload.display_title_zh = candidate.display_title_zh as string
        if (candidate.display_summary_zh != null)
          syncPayload.display_summary_zh = candidate.display_summary_zh as string
        if (candidate.location_name_zh != null)
          syncPayload.location_name_zh = candidate.location_name_zh as string
        if (candidate.translation_status != null)
          syncPayload.translation_status = candidate.translation_status as string
        if (candidate.translation_source != null)
          syncPayload.translation_source = candidate.translation_source as string

        if (Object.keys(syncPayload).length > 0) {
          syncPayload.translation_updated_at = new Date().toISOString()

          const { error: syncError } = await supabase
            .from('events')
            .update(syncPayload)
            .eq('id', approvedEventId)

          if (syncError) {
            // Sync failed → do NOT clear needs_recheck; surface error.
            errors.push({
              id,
              message: `事件欄位同步失敗 [${syncError.code ?? '?'}] ${syncError.message}`,
            })
            continue
          }
          didSync = true
          affectedEventIds.add(approvedEventId)
        }
      }

      // Clear the needs_recheck flag.
      const { error: clearError } = await supabase
        .from('event_candidates')
        .update({ needs_recheck: false })
        .eq('id', id)

      if (clearError) {
        errors.push({
          id,
          message: `清除 needs_recheck 失敗 [${clearError.code ?? '?'}] ${clearError.message}`,
        })
        continue
      }

      resolved += 1
      if (didSync) synced += 1
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push({ id, message: msg })
    }
  }

  // Revalidate admin candidate list + each affected event detail page.
  revalidatePath('/admin/event-candidates')
  affectedEventIds.forEach((eventId) => {
    revalidatePath(`/admin/events/${eventId}`)
  })

  return NextResponse.json({
    ok: errors.length === 0,
    total: ids.length,
    resolved,
    synced,
    failed: errors.length,
    errors,
  })
}

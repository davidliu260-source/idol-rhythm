'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'

// ── Guard ──────────────────────────────────────────────────────────────────────

async function requireActiveAdmin(): Promise<void> {
  const { isAdmin } = await getCurrentAdmin()
  if (!isAdmin) {
    throw new Error('Unauthorized: active admin required')
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function revalidateCandidatePaths(id: string): void {
  revalidatePath('/admin/event-candidates')
  revalidatePath(`/admin/event-candidates/${id}`)
}

// ── Actions ───────────────────────────────────────────────────────────────────

/**
 * Marks the candidate as rejected.
 * Only operates on candidates whose review_status is currently 'pending'.
 * No event is created. No candidate row is deleted.
 */
export async function rejectCandidate(id: string): Promise<void> {
  await requireActiveAdmin()

  const supabase = getSupabaseServerClient()
  if (!supabase) throw new Error('Supabase 未設定')

  const { error } = await supabase
    .from('event_candidates')
    .update({ review_status: 'rejected' })
    .eq('id', id)
    .eq('review_status', 'pending') // safety: only update pending rows

  if (error) {
    throw new Error(
      `reject 失敗：${error.code ? `[${error.code}] ` : ''}${error.message}`,
    )
  }

  revalidateCandidatePaths(id)
  redirect(`/admin/event-candidates/${id}`)
}

/**
 * Approves the candidate:
 *   1. Reads and validates the candidate (must be pending + have detected_idol_id)
 *   2. Fetches the idol name
 *   3. INSERTs a draft events row (is_published = false)
 *   4. INSERTs a matching event_sources row
 *   5. UPDATEs the candidate (review_status → 'approved', approved_event_id → new event id)
 *   6. Redirects to /admin/events/[newEventId]
 *
 * The newly created event is a draft — it will NOT appear on the frontend
 * until an admin explicitly publishes it AND changes trust_level to official/media.
 */
export async function approveCandidate(id: string): Promise<void> {
  await requireActiveAdmin()

  const supabase = getSupabaseServerClient()
  if (!supabase) throw new Error('Supabase 未設定')

  // ── Step 1: fetch candidate ────────────────────────────────────────────────

  const { data: candidate, error: fetchError } = await supabase
    .from('event_candidates')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !candidate) {
    throw new Error(
      `找不到候選活動：${fetchError?.message ?? '無資料'}`,
    )
  }

  if (candidate.review_status !== 'pending') {
    throw new Error(
      `此候選活動已完成審核（狀態：${candidate.review_status}），不可重複操作。`,
    )
  }

  if (!candidate.detected_idol_id) {
    throw new Error(
      '此候選活動缺少偶像對應（detected_idol_id 為空），無法建立活動。請手動建立草稿。',
    )
  }

  // ── Step 2: fetch idol ─────────────────────────────────────────────────────

  const { data: idol, error: idolError } = await supabase
    .from('idols')
    .select('id, name')
    .eq('id', candidate.detected_idol_id)
    .single()

  if (idolError || !idol) {
    throw new Error(
      `找不到對應偶像（ID: ${candidate.detected_idol_id}），無法建立活動。`,
    )
  }

  // ── Step 3: create draft event ─────────────────────────────────────────────
  // trust_level = 'pending' so this event will NOT appear on the frontend even
  // if published. Admin must change trust_level to 'official' or 'media' before
  // it can reach public pages.

  const today = new Date().toISOString().slice(0, 10)

  const { data: eventData, error: eventError } = await supabase
    .from('events')
    .insert({
      idol_id: idol.id,
      idol_name: idol.name,
      title: candidate.raw_title,
      type: candidate.detected_event_type ?? 'official',
      sub_type: null,
      status: 'confirmed',
      trust_level: 'pending',
      date: candidate.detected_date ?? today,
      time: null,
      country: '',
      country_flag: '',
      location: null,
      description: candidate.raw_content ?? null,
      tags: [],
      ticket_url: null,
      stream_url: null,
      is_published: false,
      published_at: null,
    })
    .select('id')
    .single()

  if (eventError || !eventData) {
    throw new Error(
      `建立活動失敗：${eventError?.code ? `[${eventError.code}] ` : ''}${eventError?.message ?? '未知錯誤'}`,
    )
  }

  const newEventId = eventData.id as string

  // ── Step 4: create event_source ───────────────────────────────────────────

  const { error: sourceError } = await supabase
    .from('event_sources')
    .insert({
      event_id: newEventId,
      level: 'pending',
      label: (candidate.source_name as string | null) ?? '候選來源',
      type: (candidate.source_type as string | null) ?? 'unknown',
      url: (candidate.source_url as string | null) ?? null,
    })

  if (sourceError) {
    throw new Error(
      `活動已建立（ID: ${newEventId}），但來源寫入失敗：${sourceError.message}。請至 /admin/events/${newEventId} 補充來源。`,
    )
  }

  // ── Step 5: mark candidate as approved ────────────────────────────────────

  const { error: updateError } = await supabase
    .from('event_candidates')
    .update({
      review_status: 'approved',
      approved_event_id: newEventId,
    })
    .eq('id', id)

  if (updateError) {
    throw new Error(
      `活動已建立（ID: ${newEventId}），但候選狀態更新失敗：${updateError.message}`,
    )
  }

  revalidateCandidatePaths(id)
  revalidatePath('/admin/events')

  // redirect() throws a special Next.js error — must not be inside try/catch
  redirect(`/admin/events/${newEventId}`)
}

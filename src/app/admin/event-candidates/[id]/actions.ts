'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'
import { generateChineseDisplayWithClaude } from '@/lib/ai/generateChineseDisplay'

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

function isProtectedTranslationStatus(status: unknown): boolean {
  return status === 'manual' || status === 'reviewed'
}

export interface GenerateChineseActionResult {
  ok: boolean
  error?: string
}

export interface ResolveRecheckActionResult {
  ok: boolean
  error?: string
  synced?: boolean // true when display fields were synced to the approved event
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

export async function generateCandidateChineseDisplay(
  id: string,
): Promise<GenerateChineseActionResult> {
  try {
    await requireActiveAdmin()

    const supabase = getSupabaseServerClient()
    if (!supabase) throw new Error('Supabase 未設定')

    const { data: candidate, error: fetchError } = await supabase
      .from('event_candidates')
      .select('*, idols(name)')
      .eq('id', id)
      .single()

    if (fetchError || !candidate) {
      throw new Error(`找不到候選活動：${fetchError?.message ?? '無資料'}`)
    }

    if (candidate.review_status !== 'pending') {
      throw new Error('只有待審核候選可以產生繁中顯示文案')
    }

    if (isProtectedTranslationStatus(candidate.translation_status)) {
      throw new Error('此候選的中文欄位已是人工編輯或已審閱狀態，為避免覆蓋不自動產生')
    }

    if (
      candidate.display_title_zh ||
      candidate.display_summary_zh ||
      candidate.location_name_zh
    ) {
      throw new Error('此候選已有中文顯示欄位，第一版不支援覆蓋既有內容')
    }

    const dateText =
      (candidate.detected_date_label as string | null) ||
      [
        candidate.detected_start_date as string | null,
        candidate.detected_end_date as string | null,
      ].filter(Boolean).join(' - ') ||
      (candidate.detected_date as string | null)

    const locationText = [
      candidate.detected_city as string | null,
      candidate.detected_venue_name as string | null,
      candidate.detected_address as string | null,
    ].filter(Boolean).join(' / ')

    const generated = await generateChineseDisplayWithClaude({
      title: candidate.raw_title as string,
      content: candidate.raw_content as string | null,
      idolName: ((candidate.idols as unknown) as { name: string } | null)?.name ?? null,
      eventType: candidate.detected_event_type as string | null,
      eventSubType: candidate.detected_event_sub_type as string | null,
      dateText,
      locationText,
      sourceName: candidate.source_name as string | null,
      sourceType: candidate.source_type as string | null,
    })

    const { error: updateError } = await supabase
      .from('event_candidates')
      .update({
        display_title_zh: generated.displayTitleZh,
        display_summary_zh: generated.displaySummaryZh,
        location_name_zh: generated.locationNameZh,
        translation_status: 'machine',
        translation_source: 'ai',
        translation_updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      throw new Error(
        `寫入繁中欄位失敗：${updateError.code ? `[${updateError.code}] ` : ''}${updateError.message}`,
      )
    }

    revalidateCandidatePaths(id)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function markCandidateChineseReviewed(
  id: string,
): Promise<GenerateChineseActionResult> {
  try {
    await requireActiveAdmin()

    const supabase = getSupabaseServerClient()
    if (!supabase) throw new Error('Supabase 未設定')

    const { data: candidate, error: fetchError } = await supabase
      .from('event_candidates')
      .select('translation_status, display_title_zh, display_summary_zh, location_name_zh')
      .eq('id', id)
      .single()

    if (fetchError || !candidate) {
      throw new Error(`找不到候選活動：${fetchError?.message ?? '無資料'}`)
    }

    if (candidate.translation_status !== 'machine') {
      throw new Error('只有機器產生狀態可以標記已審閱')
    }

    if (
      !candidate.display_title_zh &&
      !candidate.display_summary_zh &&
      !candidate.location_name_zh
    ) {
      throw new Error('缺少中文欄位，無法標記已審閱')
    }

    const { error: updateError } = await supabase
      .from('event_candidates')
      .update({
        translation_status: 'reviewed',
        translation_updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('translation_status', 'machine')

    if (updateError) {
      throw new Error(
        `標記已審閱失敗：${updateError.code ? `[${updateError.code}] ` : ''}${updateError.message}`,
      )
    }

    revalidateCandidatePaths(id)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
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
  const eventDate =
    (candidate.detected_start_date as string | null) ??
    (candidate.detected_date as string | null) ??
    today

  const { data: eventData, error: eventError } = await supabase
    .from('events')
    .insert({
      idol_id: idol.id,
      idol_name: idol.name,
      title: candidate.raw_title,
      type: candidate.detected_event_type ?? 'official',
      sub_type: (candidate.detected_event_sub_type as string | null) ?? null,
      status: 'confirmed',
      trust_level: 'pending',
      date: eventDate,
      time: null,
      country: '',
      country_flag: '',
      location: null,
      description: candidate.raw_content ?? null,
      display_title_zh: (candidate.display_title_zh as string | null) ?? null,
      display_summary_zh: (candidate.display_summary_zh as string | null) ?? null,
      location_name_zh: (candidate.location_name_zh as string | null) ?? null,
      translation_status: (candidate.translation_status as string | null) ?? 'none',
      translation_source: (candidate.translation_source as string | null) ?? null,
      translation_updated_at: (candidate.translation_updated_at as string | null) ?? null,
      start_date: eventDate,
      end_date: (candidate.detected_end_date as string | null) ?? null,
      date_label: (candidate.detected_date_label as string | null) ?? null,
      city: (candidate.detected_city as string | null) ?? null,
      venue_name: (candidate.detected_venue_name as string | null) ?? null,
      address: (candidate.detected_address as string | null) ?? null,
      map_url: (candidate.detected_map_url as string | null) ?? null,
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

/**
 * Resolves the needs_recheck flag on a candidate:
 *   1. Clears needs_recheck to false
 *   2. If the candidate is approved and has an approved_event_id, syncs
 *      Chinese display fields (display_title_zh, display_summary_zh,
 *      location_name_zh, translation_status, translation_source) from the
 *      candidate to the linked event — approved event auto-sync strategy.
 *
 * Sync is unconditional for non-null candidate fields: the candidate is the
 * source of truth for display content; admin resolving the recheck implies
 * they have reviewed/updated the candidate and want the event to reflect it.
 */
export async function resolveRecheck(id: string): Promise<ResolveRecheckActionResult> {
  try {
    await requireActiveAdmin()

    const supabase = getSupabaseServerClient()
    if (!supabase) throw new Error('Supabase 未設定')

    // Fetch candidate fields needed for sync decision
    const { data: candidate, error: fetchError } = await supabase
      .from('event_candidates')
      .select(
        'review_status, approved_event_id, display_title_zh, display_summary_zh, location_name_zh, translation_status, translation_source',
      )
      .eq('id', id)
      .single()

    if (fetchError || !candidate) {
      throw new Error(`找不到候選活動：${fetchError?.message ?? '無資料'}`)
    }

    // Step 1: Clear needs_recheck flag
    const { error: updateError } = await supabase
      .from('event_candidates')
      .update({ needs_recheck: false })
      .eq('id', id)

    if (updateError) {
      throw new Error(
        `清除重審標記失敗：${updateError.code ? `[${updateError.code}] ` : ''}${updateError.message}`,
      )
    }

    // Step 2: Sync display fields to approved event (if applicable)
    let synced = false
    if (
      candidate.review_status === 'approved' &&
      candidate.approved_event_id
    ) {
      // Build sync payload from non-null candidate display fields
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
          .eq('id', candidate.approved_event_id)

        if (syncError) {
          // Non-fatal: candidate flag is already cleared; log in return value
          revalidateCandidatePaths(id)
          return {
            ok: true,
            synced: false,
            error: `已清除重審標記，但活動欄位同步失敗：${syncError.message}`,
          }
        }
        synced = true
        revalidatePath(`/admin/events/${candidate.approved_event_id as string}`)
      }
    }

    revalidateCandidatePaths(id)
    return { ok: true, synced }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

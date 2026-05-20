'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'
import { inferTrustLevelFromSource } from '@/lib/admin/sourceReview'

// ── Payload type ──────────────────────────────────────────────────────────────

export interface UpdateDraftPayload {
  idolId: string
  idolName: string
  title: string
  type: string
  subType: string
  status: string
  date: string
  startDate: string
  endDate: string
  dateLabel: string
  time: string
  country: string
  countryFlag: string
  location: string
  city: string
  venueName: string
  address: string
  mapUrl: string
  description: string
  displayTitleZh: string
  displaySummaryZh: string
  locationNameZh: string
  translationStatus: string
  tags: string[]
  ticketUrl: string
  streamUrl: string
  // Source (single source — Phase G uses delete-all + re-insert)
  sourceLabel: string
  sourceType: string
  sourceUrl: string
}

// ── Action ────────────────────────────────────────────────────────────────────

/**
 * Updates a DRAFT event and replaces its event_sources (delete-all + re-insert).
 *
 * Returns { error } on validation / DB failure.
 * On success, calls redirect() — so the return type is effectively never in
 * the success path (Next.js redirect throws a special error caught by the runtime).
 */
export async function updateDraftEvent(
  eventId: string,
  payload: UpdateDraftPayload,
): Promise<{ error: string }> {
  // ── Application-layer guard (RLS is the enforcement layer) ─────────────────
  const { isAdmin } = await getCurrentAdmin()
  if (!isAdmin) return { error: 'Unauthorized: active admin required' }

  const supabase = getSupabaseServerClient()
  if (!supabase) return { error: 'Supabase 未設定' }

  // ── Input validation ───────────────────────────────────────────────────────
  if (!payload.sourceLabel.trim()) return { error: '來源名稱不可空白' }
  if (!payload.title.trim())       return { error: '活動標題不可空白' }
  if (!payload.date)               return { error: '日期不可空白' }
  if (!payload.idolId)             return { error: '請選擇偶像' }
  const startDate = payload.startDate || payload.date
  if (payload.endDate && payload.endDate < startDate) {
    return { error: '結束日期不可早於開始日期' }
  }
  const trustLevel = inferTrustLevelFromSource({
    sourceName: payload.sourceLabel,
    sourceType: payload.sourceType,
    sourceUrl: payload.sourceUrl,
  })

  // ── Verify event exists and is a draft ────────────────────────────────────
  const { data: existing, error: fetchError } = await supabase
    .from('events')
    .select('id, is_published')
    .eq('id', eventId)
    .single()

  if (fetchError || !existing) {
    return { error: `找不到活動：${fetchError?.message ?? '未知錯誤'}` }
  }
  if (existing.is_published) {
    return { error: '已發布活動不支援透過此頁編輯，請先下架再編輯' }
  }

  // ── Step 1: UPDATE events content fields ──────────────────────────────────
  // updated_at is handled automatically by the trg_events_updated_at trigger.
  const { error: updateError } = await supabase
    .from('events')
    .update({
      idol_id:      payload.idolId,
      idol_name:    payload.idolName,
      title:        payload.title.trim(),
      type:         payload.type,
      sub_type:     payload.subType || null,
      status:       payload.status,
      trust_level:  trustLevel,
      date:         startDate,
      time:         payload.time || null,
      country:      payload.country.trim(),
      country_flag: payload.countryFlag.trim(),
      location:     payload.location.trim() || null,
      description:  payload.description.trim() || null,
      display_title_zh:      payload.displayTitleZh.trim() || null,
      display_summary_zh:    payload.displaySummaryZh.trim() || null,
      location_name_zh:      payload.locationNameZh.trim() || null,
      translation_status:    payload.translationStatus || 'none',
      translation_source:    payload.translationStatus === 'manual' ? 'admin' : null,
      translation_updated_at:
        payload.displayTitleZh.trim() ||
        payload.displaySummaryZh.trim() ||
        payload.locationNameZh.trim()
          ? new Date().toISOString()
          : null,
      start_date:   startDate,
      end_date:     payload.endDate || null,
      date_label:   payload.dateLabel.trim() || null,
      city:         payload.city.trim() || null,
      venue_name:   payload.venueName.trim() || null,
      address:      payload.address.trim() || null,
      map_url:      payload.mapUrl.trim() || null,
      tags:         payload.tags,
      ticket_url:   payload.ticketUrl.trim() || null,
      stream_url:   payload.streamUrl.trim() || null,
    })
    .eq('id', eventId)

  if (updateError) {
    return {
      error: `更新活動失敗：${updateError.code ? `[${updateError.code}] ` : ''}${updateError.message}`,
    }
  }

  // ── Step 2: DELETE all existing event_sources for this event ──────────────
  // RLS DELETE policy only allows this when the parent event is a draft.
  const { error: deleteError } = await supabase
    .from('event_sources')
    .delete()
    .eq('event_id', eventId)

  if (deleteError) {
    return {
      error: `刪除舊來源失敗：${deleteError.code ? `[${deleteError.code}] ` : ''}${deleteError.message}（活動資訊已更新，來源未變動）`,
    }
  }

  // ── Step 3: INSERT new event_source ───────────────────────────────────────
  const { error: insertError } = await supabase
    .from('event_sources')
    .insert({
      event_id: eventId,
      level:    trustLevel,
      label:    payload.sourceLabel.trim(),
      type:     payload.sourceType,
      url:      payload.sourceUrl.trim() || null,
    })

  if (insertError) {
    return {
      error: `新增來源失敗：${insertError.code ? `[${insertError.code}] ` : ''}${insertError.message}（活動資訊已更新，但來源已被清空，請重試）`,
    }
  }

  // ── Revalidate and redirect ───────────────────────────────────────────────
  revalidatePath('/admin/events')
  revalidatePath(`/admin/events/${eventId}`)
  revalidatePath(`/admin/events/${eventId}/edit`)
  redirect(`/admin/events/${eventId}`)
}

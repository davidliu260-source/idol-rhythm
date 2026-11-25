'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'
import { planDraftSourceChanges, applyDraftSourcePlan, type DraftSourceFormRow } from '@/lib/admin/sourceReview'
import { planTicketSaleChanges, validateTicketSaleRows, type TicketSaleFormRow } from '@/lib/admin/ticketSalesForm'
import { resolveCountryFields } from '@/lib/regions'
import { isHttpUrl } from '@/lib/ticketPlatforms'

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
  /** T35：'' = 其他（country_code = NULL，保留手填的 country／country_flag） */
  countryCode: string
  timeStatus: string
  /** T35：null = 編輯器未載入，本次不變更售票階段 */
  ticketSales: TicketSaleFormRow[] | null
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
  sources: DraftSourceFormRow[]
}

// ── Action ────────────────────────────────────────────────────────────────────

/**
 * 先插入、成功後刪除來源；trust_level 最後依全部來源寫入。
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
  if (!payload.title.trim())       return { error: '活動標題不可空白' }
  if (!payload.date)               return { error: '日期不可空白' }
  if (!payload.idolId)             return { error: '請選擇偶像' }
  const startDate = payload.startDate || payload.date
  if (payload.endDate && payload.endDate < startDate) {
    return { error: '結束日期不可早於開始日期' }
  }
  if (!['unknown', 'announced', 'tba'].includes(payload.timeStatus)) return { error: '時間狀態不正確' }
  if (payload.ticketUrl.trim() && !isHttpUrl(payload.ticketUrl)) return { error: '票務 URL 必須是 http(s) 網址' }
  const countryFields = resolveCountryFields({ countryCode: payload.countryCode, country: payload.country, countryFlag: payload.countryFlag })
  if (!countryFields.country) return { error: '國家 / 地區不可空白' }
  const salesValidation = payload.ticketSales === null ? null : validateTicketSaleRows(payload.ticketSales)
  if (salesValidation && !salesValidation.ok) return { error: salesValidation.error }
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

  const { data: sources, error: sourcesError } = await supabase
    .from('event_sources').select('id, label, type, url').eq('event_id', eventId)
  if (sourcesError) {
    return { error: `讀取現有來源失敗：${sourcesError.code ? `[${sourcesError.code}] ` : ''}${sourcesError.message}（未做任何變更）` }
  }
  const planned = planDraftSourceChanges(sources ?? [], payload.sources)
  if (!planned.ok) return { error: planned.error }
  const { plan } = planned

  // T35：售票階段存檔計畫（以 id 比對；(event_id, stage, label) 唯一鍵已在表單驗證擋重複）
  let salesPlan: Extract<ReturnType<typeof planTicketSaleChanges>, { ok: true }> | null = null
  if (salesValidation?.ok) {
    const { data: existingSales, error: salesError } = await supabase
      .from('event_ticket_sales').select('id').eq('event_id', eventId)
    if (salesError) {
      return { error: `讀取現有售票階段失敗：${salesError.code ? `[${salesError.code}] ` : ''}${salesError.message}（未做任何變更）` }
    }
    const p = planTicketSaleChanges((existingSales ?? []).map((r) => r.id as string), salesValidation.rows)
    if (!p.ok) return { error: p.error }
    salesPlan = p
  }

  // ── Step A: UPDATE events content fields ──────────────────────────────────
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
      date:         startDate,
      time:         payload.time || null,
      country:      countryFields.country,
      country_flag: countryFields.country_flag,
      country_code: countryFields.country_code,
      time_status:  payload.timeStatus,
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
      error: `更新活動失敗：${updateError.code ? `[${updateError.code}] ` : ''}${updateError.message}（來源未變動）`,
    }
  }

  // Step B: 先插入、成功後才刪除指定的舊來源。
  const result = await applyDraftSourcePlan(plan, {
    insertSources: async (rows) => {
      const { data, error } = await supabase.from('event_sources')
        .insert(rows.map((r) => ({ event_id: eventId, level: r.level, label: r.label, type: r.type, url: r.url })))
        .select('id')
      if (error) return { error: `${error.code ? `[${error.code}] ` : ''}${error.message}` }
      return { ids: (data ?? []).map((r) => r.id as string) }
    },
    deleteSources: async (ids) => {
      const { data, error } = await supabase.from('event_sources')
        .delete().eq('event_id', eventId).in('id', ids).select('id')
      if (error) return { error: `${error.code ? `[${error.code}] ` : ''}${error.message}` }
      return { deletedIds: (data ?? []).map((r) => r.id as string) }
    },
  })
  if (!result.ok) return { error: `活動資訊已更新，但${result.error}` }

  // Step B2（T35）：售票階段——先刪、再改、最後新增。
  if (salesPlan) {
    const fmt = (e: { code?: string; message: string }) => `${e.code ? `[${e.code}] ` : ''}${e.message}`
    if (salesPlan.deleteIds.length) {
      const { error } = await supabase.from('event_ticket_sales').delete().eq('event_id', eventId).in('id', salesPlan.deleteIds)
      if (error) return { error: `活動資訊與來源已更新，但刪除售票階段失敗：${fmt(error)}。請重新整理後再存一次` }
    }
    for (const { id, ...row } of salesPlan.updates) {
      const { error } = await supabase.from('event_ticket_sales').update(row).eq('event_id', eventId).eq('id', id)
      if (error) return { error: `活動資訊與來源已更新，但更新售票階段「${row.label}」失敗：${fmt(error)}。請重新整理後再存一次` }
    }
    if (salesPlan.inserts.length) {
      const { error } = await supabase.from('event_ticket_sales').insert(salesPlan.inserts.map((row) => ({ ...row, event_id: eventId })))
      if (error) return { error: `活動資訊與來源已更新，但新增售票階段失敗：${fmt(error)}。請重新整理後再存一次` }
    }
  }

  // Step C: 即使來源未變動，也以全部來源校正可信度。
  const { error: trustError } = await supabase.from('events')
    .update({ trust_level: plan.trustLevel }).eq('id', eventId)
  if (trustError) {
    return { error: `來源已更新，但可信度更新失敗：${trustError.code ? `[${trustError.code}] ` : ''}${trustError.message}，請重新整理頁面後再按一次儲存` }
  }

  // ── Revalidate and redirect ───────────────────────────────────────────────
  revalidatePath('/admin/events')
  revalidatePath(`/admin/events/${eventId}`)
  revalidatePath(`/admin/events/${eventId}/edit`)
  redirect(`/admin/events/${eventId}`)
}

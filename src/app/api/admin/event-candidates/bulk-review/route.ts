import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'

interface BulkReviewRequest {
  ids: string[]
  action: 'approve' | 'reject'
}

interface BulkReviewResponse {
  ok: boolean
  action: 'approve' | 'reject'
  total: number
  succeeded: number
  failed: number
  errors: { id: string; message: string }[]
}

export async function POST(request: NextRequest): Promise<NextResponse<BulkReviewResponse | { ok: false; error: string }>> {
  const { isAdmin } = await getCurrentAdmin()
  if (!isAdmin) {
    return NextResponse.json({ ok: false, error: '未授權：需要管理員身份' }, { status: 401 })
  }

  let body: BulkReviewRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: '無效的請求格式' }, { status: 400 })
  }

  const { ids, action } = body
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ ok: false, error: 'ids 不可為空' }, { status: 400 })
  }
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ ok: false, error: 'action 必須是 approve 或 reject' }, { status: 400 })
  }

  const supabase = getSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'Supabase 環境變數未設定' }, { status: 500 })
  }

  const errors: { id: string; message: string }[] = []
  let succeeded = 0

  if (action === 'reject') {
    const { error } = await supabase
      .from('event_candidates')
      .update({ review_status: 'rejected' })
      .in('id', ids)
      .eq('review_status', 'pending')

    if (error) {
      return NextResponse.json(
        { ok: false, error: `批量拒絕失敗：${error.message}` },
        { status: 500 },
      )
    }
    succeeded = ids.length
  } else {
    // approve: process each candidate individually
    for (const id of ids) {
      try {
        const { data: candidate, error: fetchErr } = await supabase
          .from('event_candidates')
          .select('*')
          .eq('id', id)
          .eq('review_status', 'pending')
          .single()

        if (fetchErr || !candidate) {
          errors.push({ id, message: '找不到待審核候選（可能已審核過）' })
          continue
        }
        if (!candidate.detected_idol_id) {
          errors.push({ id, message: `「${candidate.raw_title}」缺少偶像對應，無法批量核准` })
          continue
        }

        const { data: idol, error: idolErr } = await supabase
          .from('idols')
          .select('id, name')
          .eq('id', candidate.detected_idol_id)
          .single()

        if (idolErr || !idol) {
          errors.push({ id, message: `找不到對應偶像（ID: ${candidate.detected_idol_id}）` })
          continue
        }

        const today = new Date().toISOString().slice(0, 10)
        const eventDate =
          (candidate.detected_start_date as string | null) ??
          (candidate.detected_date as string | null) ??
          today
        const { data: eventData, error: eventErr } = await supabase
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

        if (eventErr || !eventData) {
          errors.push({ id, message: `建立活動失敗：${eventErr?.message ?? '未知錯誤'}` })
          continue
        }

        const newEventId = eventData.id as string

        await supabase.from('event_sources').insert({
          event_id: newEventId,
          level: 'pending',
          label: (candidate.source_name as string | null) ?? '候選來源',
          type: (candidate.source_type as string | null) ?? 'unknown',
          url: (candidate.source_url as string | null) ?? null,
        })

        const { error: updateErr } = await supabase
          .from('event_candidates')
          .update({ review_status: 'approved', approved_event_id: newEventId })
          .eq('id', id)

        if (updateErr) {
          errors.push({ id, message: `活動已建立（${newEventId}），但候選狀態更新失敗` })
          continue
        }

        succeeded++
      } catch (e) {
        errors.push({ id, message: e instanceof Error ? e.message : String(e) })
      }
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    action,
    total: ids.length,
    succeeded,
    failed: errors.length,
    errors,
  })
}

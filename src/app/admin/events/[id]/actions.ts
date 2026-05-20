'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'
import { inferTrustLevelFromSource } from '@/lib/admin/sourceReview'
import { generateChineseDisplayWithClaude } from '@/lib/ai/generateChineseDisplay'

// ── Guard ──────────────────────────────────────────────────────────────────────

async function requireActiveAdmin(): Promise<void> {
  const { isAdmin } = await getCurrentAdmin()
  if (!isAdmin) {
    // Application-layer guard — RLS is the enforcement layer.
    // Throwing here gives a clear error instead of a silent RLS denial.
    throw new Error('Unauthorized: active admin required')
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function revalidateEventPaths(id: string): void {
  revalidatePath('/admin/events')
  revalidatePath(`/admin/events/${id}`)
  // Public-facing pages that may cache this event
  revalidatePath('/')
  revalidatePath('/schedule')
  revalidatePath(`/events/${id}`)
}

function isProtectedTranslationStatus(status: unknown): boolean {
  return status === 'manual' || status === 'reviewed'
}

export interface GenerateChineseActionResult {
  ok: boolean
  error?: string
}

// ── Actions ───────────────────────────────────────────────────────────────────

/**
 * Sets is_published = true and records published_at = now().
 * After revalidation, redirects back to the admin event detail page.
 * updated_at is handled automatically by the trg_events_updated_at trigger.
 */
export async function publishEvent(id: string): Promise<void> {
  await requireActiveAdmin()

  const supabase = getSupabaseServerClient()
  if (!supabase) throw new Error('Supabase 未設定')

  const { data: sources, error: sourceError } = await supabase
    .from('event_sources')
    .select('label, type, url')
    .eq('event_id', id)
    .limit(1)

  if (sourceError) {
    throw new Error(`讀取來源失敗：${sourceError.code ? `[${sourceError.code}] ` : ''}${sourceError.message}`)
  }

  const primarySource = sources?.[0]
  const trustLevel = inferTrustLevelFromSource({
    sourceName: primarySource?.label ?? null,
    sourceType: primarySource?.type ?? null,
    sourceUrl: primarySource?.url ?? null,
  })

  if (trustLevel === 'pending') {
    throw new Error('發布被擋下：來源仍是聚合 / 社群 / 未知來源，請先補官方、售票、主辦、場館或可靠媒體來源。')
  }

  const { error } = await supabase
    .from('events')
    .update({
      is_published: true,
      published_at: new Date().toISOString(),
      trust_level: trustLevel,
    })
    .eq('id', id)

  if (error) {
    throw new Error(`發布失敗：${error.code ? `[${error.code}] ` : ''}${error.message}`)
  }

  revalidateEventPaths(id)
  redirect(`/admin/events/${id}`)
}

/**
 * Sets is_published = false and clears published_at.
 * After revalidation, redirects back to the admin event detail page.
 * updated_at is handled automatically by the trg_events_updated_at trigger.
 */
export async function unpublishEvent(id: string): Promise<void> {
  await requireActiveAdmin()

  const supabase = getSupabaseServerClient()
  if (!supabase) throw new Error('Supabase 未設定')

  const { error } = await supabase
    .from('events')
    .update({
      is_published: false,
      published_at: null,
    })
    .eq('id', id)

  if (error) {
    throw new Error(`下架失敗：${error.code ? `[${error.code}] ` : ''}${error.message}`)
  }

  revalidateEventPaths(id)
  redirect(`/admin/events/${id}`)
}

export async function generateEventChineseDisplay(
  id: string,
): Promise<GenerateChineseActionResult> {
  try {
    await requireActiveAdmin()

    const supabase = getSupabaseServerClient()
    if (!supabase) throw new Error('Supabase 未設定')

    const { data: event, error: fetchError } = await supabase
      .from('events')
      .select('*, event_sources(label, type, url)')
      .eq('id', id)
      .single()

    if (fetchError || !event) {
      throw new Error(`找不到活動：${fetchError?.message ?? '無資料'}`)
    }

    if (event.is_published) {
      throw new Error('已發布活動不支援直接產生繁中欄位，請先下架或改用人工編輯流程')
    }

    if (isProtectedTranslationStatus(event.translation_status)) {
      throw new Error('此活動的中文欄位已是人工編輯或已審閱狀態，為避免覆蓋不自動產生')
    }

    if (
      event.display_title_zh ||
      event.display_summary_zh ||
      event.location_name_zh
    ) {
      throw new Error('此活動已有中文顯示欄位，第一版不支援覆蓋既有內容')
    }

    const sources = (event.event_sources ?? []) as Array<{
      label: string | null
      type: string | null
      url: string | null
    }>
    const primarySource = sources[0]
    const dateText =
      (event.date_label as string | null) ||
      [
        event.start_date as string | null,
        event.end_date as string | null,
      ].filter(Boolean).join(' - ') ||
      (event.date as string | null)
    const locationText = [
      event.location as string | null,
      event.city as string | null,
      event.venue_name as string | null,
      event.address as string | null,
    ].filter(Boolean).join(' / ')

    const generated = await generateChineseDisplayWithClaude({
      title: event.title as string,
      content: event.description as string | null,
      idolName: event.idol_name as string | null,
      eventType: event.type as string | null,
      eventSubType: event.sub_type as string | null,
      dateText,
      locationText,
      sourceName: primarySource?.label ?? null,
      sourceType: primarySource?.type ?? null,
    })

    const { error: updateError } = await supabase
      .from('events')
      .update({
        display_title_zh: generated.displayTitleZh,
        display_summary_zh: generated.displaySummaryZh,
        location_name_zh: generated.locationNameZh,
        translation_status: 'machine',
        translation_source: 'ai',
        translation_updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('is_published', false)

    if (updateError) {
      throw new Error(
        `寫入繁中欄位失敗：${updateError.code ? `[${updateError.code}] ` : ''}${updateError.message}`,
      )
    }

    revalidateEventPaths(id)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

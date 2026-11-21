'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'
import { inferTrustLevelFromSources } from '@/lib/admin/sourceReview'
import { translateEvent } from '@/lib/ai/autoTranslate'
import { claudeTranslator } from '@/lib/ai/claudeTranslator'
import { createSupabaseAutoTranslateStore } from '@/lib/ai/supabaseAutoTranslateStore'

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

  if (sourceError) {
    throw new Error(`讀取來源失敗：${sourceError.code ? `[${sourceError.code}] ` : ''}${sourceError.message}`)
  }

  const trustLevel = inferTrustLevelFromSources(
    (sources ?? []).map((source) => ({
      sourceName: source?.label ?? null,
      sourceType: source?.type ?? null,
      sourceUrl: source?.url ?? null,
    })),
  )

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
/** 下架同時封鎖後續自動上架；不讀熔斷開關。 */
export async function unpublishEvent(id: string): Promise<void> {
  await requireActiveAdmin()

  const supabase = getSupabaseServerClient()
  if (!supabase) throw new Error('Supabase 未設定')

  const { error } = await supabase
    .from('events')
    .update({
      is_published: false,
      auto_publish_blocked: true,
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

    const result = await translateEvent(
      { store: createSupabaseAutoTranslateStore(supabase), translator: claudeTranslator, clock: Date.now },
      id,
      { resetAttempts: true },
    )
    if (result.outcome !== 'translated') {
      return { ok: false, error: result.message ?? '活動已變更或正在翻譯，請重新整理後再試' }
    }

    revalidateEventPaths(id)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function markEventChineseReviewed(
  id: string,
): Promise<GenerateChineseActionResult> {
  try {
    await requireActiveAdmin()

    const supabase = getSupabaseServerClient()
    if (!supabase) throw new Error('Supabase 未設定')

    const { data: event, error: fetchError } = await supabase
      .from('events')
      .select('translation_status, display_title_zh, display_summary_zh, location_name_zh')
      .eq('id', id)
      .single()

    if (fetchError || !event) {
      throw new Error(`找不到活動：${fetchError?.message ?? '無資料'}`)
    }

    if (event.translation_status !== 'machine') {
      throw new Error('只有機器產生狀態可以標記已審閱')
    }

    if (
      !event.display_title_zh &&
      !event.display_summary_zh &&
      !event.location_name_zh
    ) {
      throw new Error('缺少中文欄位，無法標記已審閱')
    }

    const { error: updateError } = await supabase
      .from('events')
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

    revalidateEventPaths(id)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'
import { inferTrustLevelFromSource } from '@/lib/admin/sourceReview'

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

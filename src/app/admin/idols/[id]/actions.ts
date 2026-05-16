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

function revalidateIdolPaths(id: string): void {
  revalidatePath('/admin/idols')
  revalidatePath(`/admin/idols/${id}`)
  // Public-facing pages that may cache idol data
  revalidatePath('/idols')
  revalidatePath('/')
}

// ── Actions ───────────────────────────────────────────────────────────────────

/**
 * Sets is_active = true so the idol appears on the frontend.
 * After revalidation, redirects back to the admin idol detail page.
 * updated_at is handled automatically by the trg_idols_updated_at trigger.
 */
export async function activateIdol(id: string): Promise<void> {
  await requireActiveAdmin()

  const supabase = getSupabaseServerClient()
  if (!supabase) throw new Error('Supabase 未設定')

  const { error } = await supabase
    .from('idols')
    .update({ is_active: true })
    .eq('id', id)

  if (error) {
    throw new Error(`啟用失敗：${error.code ? `[${error.code}] ` : ''}${error.message}`)
  }

  revalidateIdolPaths(id)
  redirect(`/admin/idols/${id}`)
}

/**
 * Sets is_active = false so the idol is hidden from the frontend.
 * After revalidation, redirects back to the admin idol detail page.
 * updated_at is handled automatically by the trg_idols_updated_at trigger.
 */
export async function deactivateIdol(id: string): Promise<void> {
  await requireActiveAdmin()

  const supabase = getSupabaseServerClient()
  if (!supabase) throw new Error('Supabase 未設定')

  const { error } = await supabase
    .from('idols')
    .update({ is_active: false })
    .eq('id', id)

  if (error) {
    throw new Error(`停用失敗：${error.code ? `[${error.code}] ` : ''}${error.message}`)
  }

  revalidateIdolPaths(id)
  redirect(`/admin/idols/${id}`)
}

'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import {
  previewPublishedBackfill, runPublishedBackfill, translationErrorMessage,
} from '@/lib/ai/autoTranslate'
import { claudeTranslator } from '@/lib/ai/claudeTranslator'
import { createSupabaseAutoTranslateStore } from '@/lib/ai/supabaseAutoTranslateStore'

async function requireActiveAdmin() {
  const { isAdmin } = await getCurrentAdmin()
  if (!isAdmin) throw new Error('需要管理員權限')

  const supabase = getSupabaseServerClient()
  if (!supabase) throw new Error('Supabase 未設定')
  return createSupabaseAutoTranslateStore(supabase)
}

export async function previewBackfill() {
  try {
    const store = await requireActiveAdmin()
    return { ok: true as const, preview: await previewPublishedBackfill(store, new Date()) }
  } catch (error) {
    return { ok: false as const, error: translationErrorMessage(error) }
  }
}

export async function runBackfill() {
  try {
    const store = await requireActiveAdmin()
    const { summary, eventIds } = await runPublishedBackfill({ store, translator: claudeTranslator, clock: Date.now })
    revalidatePath('/admin/events')
    if (summary.translated) {
      revalidatePath('/')
      revalidatePath('/schedule')
      for (const id of eventIds) {
        revalidatePath(`/admin/events/${id}`)
        revalidatePath(`/events/${id}`)
      }
    }
    return { ok: true as const, summary }
  } catch (error) {
    return { ok: false as const, error: translationErrorMessage(error) }
  }
}

'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'

// ── Payload type ──────────────────────────────────────────────────────────────

export interface UpdateIdolPayload {
  name: string
  koreanName: string
  type: string
  gender: string
  category: string
  agency: string
  debutDate: string
  color: string
  genres: string[]
  memberCount: string   // string from <input type="number">, converted server-side
  description: string
}

// ── Server Action ─────────────────────────────────────────────────────────────

export async function updateIdol(
  idolId: string,
  payload: UpdateIdolPayload,
): Promise<{ error: string } | undefined> {
  // Guard 1: admin identity
  const { isAdmin } = await getCurrentAdmin()
  if (!isAdmin) return { error: '需要管理員身份才能編輯偶像資料。' }

  const supabase = getSupabaseServerClient()
  if (!supabase) return { error: 'Supabase 未設定，請檢查環境變數。' }

  // Guard 2: name must not be empty (slug is immutable — never sent)
  if (!payload.name.trim()) return { error: '名稱不可為空。' }

  const { error } = await supabase
    .from('idols')
    .update({
      name:         payload.name.trim(),
      korean_name:  payload.koreanName.trim() || null,
      type:         payload.type || null,
      gender:       payload.gender || null,
      category:     payload.category || null,
      agency:       payload.agency.trim() || null,
      debut_date:   payload.debutDate || null,
      color:        payload.color.trim() || null,
      genres:       payload.genres,
      member_count: payload.memberCount ? parseInt(payload.memberCount, 10) : null,
      description:  payload.description.trim() || null,
      // slug, is_active, id, created_at are intentionally omitted
    })
    .eq('id', idolId)

  if (error) {
    return {
      error: `更新失敗：${error.code ? `[${error.code}] ` : ''}${error.message}`,
    }
  }

  revalidatePath('/admin/idols')
  revalidatePath(`/admin/idols/${idolId}`)
  revalidatePath('/idols')

  // redirect() throws a special Next.js error — must not be inside try/catch
  redirect(`/admin/idols/${idolId}`)
}

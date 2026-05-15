'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'

// ── Payload type ──────────────────────────────────────────────────────────────

export interface CreateIdolPayload {
  slug: string
  name: string
  koreanName: string
  type: string        // 'group' | 'solo'
  gender: string      // 'male' | 'female' | 'mixed' | 'unknown' | ''
  category: string    // 'kpop' | 'cpop' | 'jpop' | 'idol' | 'other' | ''
  agency: string
  debutDate: string
  color: string
  genres: string[]
  memberCount: string // string from input, convert to number or null
  description: string
  isActive: boolean
}

// ── Slug validation ───────────────────────────────────────────────────────────

const SLUG_RE = /^[a-z0-9-]+$/

// ── Action ────────────────────────────────────────────────────────────────────

/**
 * Inserts a new idol row.
 * Returns { error } on failure; calls redirect() on success.
 */
export async function createIdol(
  payload: CreateIdolPayload,
): Promise<{ error: string }> {
  // ── Application-layer guard ────────────────────────────────────────────────
  const { isAdmin } = await getCurrentAdmin()
  if (!isAdmin) return { error: 'Unauthorized: active admin required' }

  const supabase = getSupabaseServerClient()
  if (!supabase) return { error: 'Supabase 未設定' }

  // ── Input validation ───────────────────────────────────────────────────────
  if (!payload.name.trim())  return { error: '名稱不可空白' }
  if (!payload.slug.trim())  return { error: 'Slug 不可空白' }
  if (!SLUG_RE.test(payload.slug)) {
    return { error: 'Slug 只能包含小寫英文、數字、hyphen（-），不允許空白、中文、底線' }
  }
  if (!payload.type) return { error: '請選擇組合 / 個人' }

  const memberCount =
    payload.memberCount && payload.memberCount.trim() !== ''
      ? parseInt(payload.memberCount, 10)
      : null

  if (payload.memberCount && payload.memberCount.trim() !== '' && isNaN(memberCount!)) {
    return { error: '成員人數必須是整數' }
  }

  // ── INSERT idol ────────────────────────────────────────────────────────────
  const { data, error } = await supabase
    .from('idols')
    .insert({
      slug:         payload.slug.trim(),
      name:         payload.name.trim(),
      korean_name:  payload.koreanName.trim() || null,
      type:         payload.type as 'group' | 'solo',
      gender:       (payload.gender || null) as 'male' | 'female' | 'mixed' | 'unknown' | null,
      category:     (payload.category || null) as 'kpop' | 'cpop' | 'jpop' | 'idol' | 'other' | null,
      agency:       payload.agency.trim() || null,
      debut_date:   payload.debutDate || null,
      color:        payload.color.trim() || null,
      genres:       payload.genres,
      member_count: memberCount,
      description:  payload.description.trim() || null,
      is_active:    payload.isActive,
    })
    .select('id')
    .single()

  if (error) {
    // Slug duplicate → friendly message
    if (error.code === '23505') {
      return { error: `Slug「${payload.slug}」已被使用，請選擇其他 slug` }
    }
    return {
      error: `新增偶像失敗：${error.code ? `[${error.code}] ` : ''}${error.message}`,
    }
  }

  if (!data?.id) return { error: '新增成功但無法取得 ID，請至列表確認' }

  // ── Revalidate and redirect ────────────────────────────────────────────────
  revalidatePath('/admin/idols')
  revalidatePath('/idols')
  redirect(`/admin/idols/${data.id}`)
}

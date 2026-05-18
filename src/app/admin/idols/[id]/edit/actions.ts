'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'

// ── Avatar upload constants (I1b-A) ──────────────────────────────────────────
const AVATAR_BUCKET = 'idol-avatars'
const AVATAR_MAX_BYTES = 2 * 1024 * 1024 // 2 MiB — matches storage.buckets.file_size_limit
const AVATAR_ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp']
const AVATAR_MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
}

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
  avatarUrl: string
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
      avatar_url:   payload.avatarUrl.trim() || null,
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

// ── I1b-A: Avatar file upload to Supabase Storage ────────────────────────────

export interface UploadAvatarResult {
  ok: boolean
  avatarUrl?: string
  error?: string
}

/**
 * Uploads a local image file to the `idol-avatars` bucket and writes the
 * resulting public URL into idols.avatar_url.
 *
 * Storage RLS (migration 027) enforces admin-only writes. We also do an
 * application-level admin guard here to surface a clean 401 message before
 * round-tripping to Storage.
 *
 * I1b-A scope: no AI search, no remote URL download, no image compression.
 * The browser sends the raw file in FormData, the server validates size /
 * MIME, then uploads as-is. Image resizing / compression is reserved for
 * I1b-B.
 */
export async function uploadIdolAvatar(
  idolId: string,
  formData: FormData,
): Promise<UploadAvatarResult> {
  const { isAdmin } = await getCurrentAdmin()
  if (!isAdmin) return { ok: false, error: '需要管理員身份才能上傳頭像。' }

  const supabase = getSupabaseServerClient()
  if (!supabase) return { ok: false, error: 'Supabase 未設定，請檢查環境變數。' }

  const fileEntry = formData.get('file')
  if (!(fileEntry instanceof File) || fileEntry.size === 0) {
    return { ok: false, error: '請選擇要上傳的圖片檔案。' }
  }
  const file = fileEntry

  if (!AVATAR_ALLOWED_MIME.includes(file.type)) {
    return {
      ok: false,
      error: `不支援的檔案格式（${file.type || '未知'}）。僅接受 JPEG / PNG / WebP。`,
    }
  }
  if (file.size > AVATAR_MAX_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(2)
    return { ok: false, error: `檔案 ${mb} MB 超過 2 MB 上限，請壓縮後再試。` }
  }

  // Look up slug for a human-friendly filename + the existing avatar so we
  // can clean up the old object when it lives in our bucket.
  const { data: idol, error: lookupError } = await supabase
    .from('idols')
    .select('slug, avatar_url')
    .eq('id', idolId)
    .single<{ slug: string; avatar_url: string | null }>()

  if (lookupError || !idol) {
    return {
      ok: false,
      error: `找不到偶像或讀取失敗：${lookupError?.message ?? 'unknown'}`,
    }
  }

  const ext = AVATAR_MIME_EXT[file.type] ?? 'bin'
  const newPath = `${idol.slug}-${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(newPath, file, {
      contentType: file.type,
      upsert: false,
      cacheControl: '3600',
    })

  if (uploadError) {
    return { ok: false, error: `上傳到 Storage 失敗：${uploadError.message}` }
  }

  const { data: publicUrlData } = supabase.storage
    .from(AVATAR_BUCKET)
    .getPublicUrl(newPath)
  const publicUrl = publicUrlData.publicUrl

  const { error: dbError } = await supabase
    .from('idols')
    .update({ avatar_url: publicUrl })
    .eq('id', idolId)

  if (dbError) {
    // Best-effort: orphan the just-uploaded object. Not removing it because
    // we can't be 100% sure the upload succeeded but the DB write failed —
    // user can re-upload and we don't risk deleting the only good copy.
    return {
      ok: false,
      error: `寫回 idols.avatar_url 失敗：${dbError.code ? `[${dbError.code}] ` : ''}${dbError.message}`,
    }
  }

  // Best-effort cleanup of the previous avatar if it lives in our bucket.
  // External URLs (or already-removed paths) are left alone silently.
  if (idol.avatar_url) {
    const oldPath = extractAvatarBucketPath(idol.avatar_url)
    if (oldPath && oldPath !== newPath) {
      await supabase.storage.from(AVATAR_BUCKET).remove([oldPath])
    }
  }

  revalidatePath('/admin/idols')
  revalidatePath(`/admin/idols/${idolId}`)
  revalidatePath(`/admin/idols/${idolId}/edit`)
  revalidatePath('/idols')
  revalidatePath('/')
  revalidatePath('/schedule')

  return { ok: true, avatarUrl: publicUrl }
}

/**
 * If `url` is a public Storage URL pointing at the idol-avatars bucket,
 * returns the in-bucket path. Returns null for any other URL (external CDN,
 * pasted Wikipedia image, etc.) so the cleanup step skips them.
 */
function extractAvatarBucketPath(url: string): string | null {
  const marker = `/storage/v1/object/public/${AVATAR_BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx < 0) return null
  const path = url.substring(idx + marker.length)
  return path.length > 0 ? path : null
}

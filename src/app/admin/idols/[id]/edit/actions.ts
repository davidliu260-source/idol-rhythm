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
  altNames: string[]
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

  // I1b-C: if the avatar URL changed via this form (admin pasted a public
  // URL by hand), mark source as 'manual_url'. Look up current state first
  // so we only flip metadata on real change — saving other fields shouldn't
  // wipe Wikimedia attribution out.
  const newAvatarUrl = payload.avatarUrl.trim() || null
  const { data: existing } = await supabase
    .from('idols')
    .select('avatar_url')
    .eq('id', idolId)
    .single<{ avatar_url: string | null }>()
  const avatarChanged = (existing?.avatar_url ?? null) !== newAvatarUrl

  type IdolUpdate = {
    name: string
    korean_name: string | null
    type: string | null
    gender: string | null
    category: string | null
    agency: string | null
    debut_date: string | null
    color: string | null
    genres: string[]
    member_count: number | null
    description: string | null
    avatar_url: string | null
    alt_names: string[]
    avatar_source_url?: string | null
    avatar_source_provider?: string | null
    avatar_source_license?: string | null
    avatar_source_author?: string | null
    avatar_source_note?: string | null
  }

  const updatePayload: IdolUpdate = {
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
    avatar_url:   newAvatarUrl,
    alt_names:    payload.altNames,
    // slug, is_active, id, created_at are intentionally omitted
  }

  if (avatarChanged) {
    if (newAvatarUrl) {
      updatePayload.avatar_source_url = newAvatarUrl
      updatePayload.avatar_source_provider = 'manual_url'
      updatePayload.avatar_source_license = null
      updatePayload.avatar_source_author = null
      updatePayload.avatar_source_note = 'manual URL confirmed by admin'
    } else {
      // Admin cleared the URL — clear provenance too.
      updatePayload.avatar_source_url = null
      updatePayload.avatar_source_provider = null
      updatePayload.avatar_source_license = null
      updatePayload.avatar_source_author = null
      updatePayload.avatar_source_note = null
    }
  }

  const { error } = await supabase
    .from('idols')
    .update(updatePayload)
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

  // I1b-C: record provenance alongside avatar_url so admin can audit the
  // image's origin later. Manual local upload → provider='manual_upload'.
  const { error: dbError } = await supabase
    .from('idols')
    .update({
      avatar_url: publicUrl,
      avatar_source_url: null,
      avatar_source_provider: 'manual_upload',
      avatar_source_license: null,
      avatar_source_author: null,
      avatar_source_note: 'uploaded by admin',
    })
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


// ── I1b-B: Avatar from remote URL (AI search result) ─────────────────────────
//
// Wikimedia search returns Commons file URLs. This action takes that URL +
// the idol id, server-side fetches the image, validates it, resizes via sharp
// to 512x512 WebP, and re-uses the I1b-A Storage upload + DB write flow.
//
// Why the resize: Wikipedia thumbnails for popular acts can be 2000+ px and
// blow past the 2 MiB bucket limit. WebP 512x512 is enough for the IdolAvatar
// component (which renders at most ~96px on mobile) and keeps every avatar
// at a predictable size for CDN caching.
//
// Why "cover" + center: idol portraits are usually centered; cover crop
// avoids letterboxing while preserving the face area in most cases.

const REMOTE_FETCH_TIMEOUT_MS = 10_000
/** Hard cap on the source image we'll download before resizing. */
const REMOTE_MAX_DOWNLOAD_BYTES = 15 * 1024 * 1024 // 15 MiB

/**
 * Attribution metadata for I1b-C source tracking. All fields optional —
 * unknowns are stored as null. `provider` defaults to 'manual_url' when
 * the caller doesn't tell us where the URL came from (e.g. admin pasting
 * a public photo URL).
 */
export interface AvatarSourceMeta {
  /** The page where the image was found (Wikipedia article, etc.).
   *  Distinct from the imageUrl which is the direct file URL we download. */
  attributionSourceUrl?: string | null
  provider?: 'wikimedia' | 'manual_upload' | 'manual_url' | 'other'
  license?: string | null
  author?: string | null
  note?: string | null
}

export async function uploadIdolAvatarFromUrl(
  idolId: string,
  sourceUrl: string,
  meta?: AvatarSourceMeta,
): Promise<UploadAvatarResult> {
  const { isAdmin } = await getCurrentAdmin()
  if (!isAdmin) return { ok: false, error: '需要管理員身份才能上傳頭像。' }

  // Validate the URL shape early so we don't waste a Storage round-trip.
  let parsed: URL
  try {
    parsed = new URL(sourceUrl)
  } catch {
    return { ok: false, error: '圖片網址格式錯誤。' }
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, error: '圖片網址必須是 http(s)。' }
  }

  const supabase = getSupabaseServerClient()
  if (!supabase) return { ok: false, error: 'Supabase 未設定，請檢查環境變數。' }

  // ── 1. Download the source image ──────────────────────────────────────────
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REMOTE_FETCH_TIMEOUT_MS)
  let sourceBuffer: ArrayBuffer
  let sourceMime: string | null = null
  try {
    const res = await fetch(sourceUrl, {
      headers: {
        'User-Agent': 'IdolRhythm-Admin-Bot/0.1 (+https://idol-rhythm.vercel.app)',
        Accept: 'image/*',
      },
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!res.ok) {
      return { ok: false, error: `圖片下載失敗，請換一張（HTTP ${res.status}）。` }
    }
    sourceMime = res.headers.get('content-type')?.split(';')[0]?.trim() ?? null
    // Read with size guard so a 100 MB PNG can't OOM the route.
    sourceBuffer = await res.arrayBuffer()
    if (sourceBuffer.byteLength > REMOTE_MAX_DOWNLOAD_BYTES) {
      return {
        ok: false,
        error: `圖片過大（${(sourceBuffer.byteLength / 1024 / 1024).toFixed(1)} MiB），請換一張。`,
      }
    }
  } catch (e) {
    return {
      ok: false,
      error: `圖片下載失敗，請換一張（${e instanceof Error ? e.message : 'unknown'}）。`,
    }
  } finally {
    clearTimeout(timer)
  }

  // Surface MIME mismatch early. sharp can still handle most things, but
  // unfamiliar formats (SVG, AVIF, HEIC) deserve a clear "請換一張" message.
  if (sourceMime && !sourceMime.startsWith('image/')) {
    return {
      ok: false,
      error: `下載到的不是圖片格式（${sourceMime}），請換一張。`,
    }
  }

  // ── 2. Resize + transcode with sharp ──────────────────────────────────────
  // Import lazily so sharp isn't pulled into edge bundles.
  let resized: Buffer
  try {
    const sharp = (await import('sharp')).default
    resized = await sharp(Buffer.from(sourceBuffer))
      .rotate() // honour EXIF orientation
      .resize(512, 512, { fit: 'cover', position: 'attention' })
      .webp({ quality: 82 })
      .toBuffer()
  } catch (e) {
    return {
      ok: false,
      error: `圖片處理失敗（${e instanceof Error ? e.message : 'unknown'}），請換一張。`,
    }
  }

  if (resized.byteLength > AVATAR_MAX_BYTES) {
    // Extremely unlikely at 512x512 webp q82, but guard anyway.
    return {
      ok: false,
      error: `處理後圖片仍大於 ${AVATAR_MAX_BYTES / 1024 / 1024} MiB，請換一張。`,
    }
  }

  // ── 3. Look up the idol slug for path naming, mirror uploadIdolAvatar ────
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

  const newPath = `${idol.slug}-${Date.now()}.webp`

  // ── 4. Upload to Storage ──────────────────────────────────────────────────
  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(newPath, resized, {
      contentType: 'image/webp',
      upsert: false,
      cacheControl: '3600',
    })

  if (uploadError) {
    return {
      ok: false,
      error: `圖片上傳失敗，請稍後再試（${uploadError.message}）。`,
    }
  }

  const { data: publicUrlData } = supabase.storage
    .from(AVATAR_BUCKET)
    .getPublicUrl(newPath)
  const publicUrl = publicUrlData.publicUrl

  // ── 5. Write back idols.avatar_url + I1b-C source metadata ───────────────
  const provider = meta?.provider ?? 'manual_url'
  const fallbackNote =
    provider === 'wikimedia'
      ? 'selected from Wikimedia by admin'
      : provider === 'manual_url'
        ? 'manual URL confirmed by admin'
        : null
  const { error: dbError } = await supabase
    .from('idols')
    .update({
      avatar_url: publicUrl,
      avatar_source_url: meta?.attributionSourceUrl ?? sourceUrl,
      avatar_source_provider: provider,
      avatar_source_license: meta?.license ?? null,
      avatar_source_author: meta?.author ?? null,
      avatar_source_note: meta?.note ?? fallbackNote,
    })
    .eq('id', idolId)

  if (dbError) {
    return {
      ok: false,
      error: `寫回 idols.avatar_url 失敗：${dbError.code ? `[${dbError.code}] ` : ''}${dbError.message}`,
    }
  }

  // ── 6. Clean up the previous bucket-hosted avatar (best-effort) ──────────
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

'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'
import { computeSourceHash } from '@/lib/crawlers/sourceHash'

// ── Allowed enum values (must match supabase/migrations/001_initial_schema.sql) ──

const EVENT_TYPES = [
  'concert',
  'ticketing',
  'livestream',
  'streaming',
  'media',
  'brand',
  'official',
] as const
type EventType = (typeof EVENT_TYPES)[number]

const SOURCE_TYPES = [
  'official_sns',
  'official_website',
  'media_outlet',
  'fan_account',
  'community',
  'unknown',
] as const
type SourceType = (typeof SOURCE_TYPES)[number]

// ── Payload type ──────────────────────────────────────────────────────────────

export interface CreateCandidatePayload {
  rawTitle: string
  rawContent: string
  detectedIdolId: string // '' = none selected
  detectedEventType: string // '' = none
  detectedDate: string // 'YYYY-MM-DD' | ''
  sourceUrl: string
  sourceName: string
  sourceType: string
  aiConfidence: string // string from input; '' = null
  reviewerNote: string
}

// ── Action ────────────────────────────────────────────────────────────────────

/**
 * Manually creates an event_candidates row from admin-supplied raw data.
 *
 * Always writes review_status = 'pending' and approved_event_id = null.
 * Never creates an event. Never publishes anything. Never touches trust_level.
 * The existing approveCandidate / rejectCandidate actions are the only
 * routes from this row to a draft event.
 *
 * Returns { error } on failure; calls redirect() on success.
 */
export async function createCandidate(
  payload: CreateCandidatePayload,
): Promise<{ error: string }> {
  // ── Application-layer admin guard ─────────────────────────────────────────
  const { isAdmin } = await getCurrentAdmin()
  if (!isAdmin) return { error: 'Unauthorized: active admin required' }

  const supabase = getSupabaseServerClient()
  if (!supabase) return { error: 'Supabase 未設定' }

  // ── Required fields ────────────────────────────────────────────────────────

  const rawTitle = payload.rawTitle.trim()
  const sourceName = payload.sourceName.trim()
  const sourceType = payload.sourceType.trim()

  if (!rawTitle) return { error: '標題不可空白' }
  if (!sourceName) return { error: '來源名稱不可空白' }
  if (!sourceType) return { error: '請選擇來源類型' }

  if (!SOURCE_TYPES.includes(sourceType as SourceType)) {
    return { error: `來源類型不合法（${sourceType}）` }
  }

  // ── Optional fields validation ─────────────────────────────────────────────

  const detectedEventType = payload.detectedEventType.trim()
  if (
    detectedEventType !== '' &&
    !EVENT_TYPES.includes(detectedEventType as EventType)
  ) {
    return { error: `活動類型不合法（${detectedEventType}）` }
  }

  const detectedDate = payload.detectedDate.trim()
  if (detectedDate !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(detectedDate)) {
    return { error: '日期格式須為 YYYY-MM-DD' }
  }

  let aiConfidence: number | null = null
  if (payload.aiConfidence.trim() !== '') {
    const v = Number(payload.aiConfidence)
    if (!Number.isFinite(v) || v < 0 || v > 1) {
      return { error: '信心值需為 0 到 1 之間的數字（手動匯入可留空）' }
    }
    // Schema column is numeric(3, 2); round to 2 decimals to be safe.
    aiConfidence = Math.round(v * 100) / 100
  }

  // ── Compute source_hash (J4 dedupe) ───────────────────────────────────────
  // Manual imports may or may not have a source_url. computeSourceHash falls
  // back to (title + date + idol + source_name + source_type) when no URL is
  // supplied. Returns null only if title is also empty — guarded above.

  const sourceUrl = payload.sourceUrl.trim() || null
  const detectedIdolId = payload.detectedIdolId.trim() || null

  const sourceHash = computeSourceHash({
    sourceUrl,
    rawTitle,
    detectedDate: detectedDate || null,
    detectedIdolId,
    sourceName,
    sourceType,
  })
  // computeSourceHash returns null only when both URL and title are empty;
  // rawTitle is required, so this should never be null here. Defensive guard:
  if (!sourceHash) {
    return { error: '無法產生 source_hash，請至少填入標題或來源網址' }
  }

  // raw_data for manual imports: minimal { source: 'manual' } stamp. We do
  // not echo the form fields here — they are already in the row's first-
  // class columns. Keeps the jsonb small and avoids duplication.
  const rawData = { source: 'manual' as const }

  // ── INSERT ────────────────────────────────────────────────────────────────
  // Note: do NOT supply id / created_at / updated_at / review_status /
  // approved_event_id. The DB default for review_status is 'pending' and
  // approved_event_id is null — both are exactly what we want.

  const { data, error } = await supabase
    .from('event_candidates')
    .insert({
      raw_title: rawTitle,
      raw_content: payload.rawContent.trim() || null,
      detected_idol_id: detectedIdolId,
      detected_event_type: (detectedEventType || null) as EventType | null,
      detected_date: detectedDate || null,
      source_url: sourceUrl,
      source_name: sourceName,
      source_type: sourceType as SourceType,
      ai_confidence: aiConfidence,
      reviewer_note: payload.reviewerNote.trim() || null,
      source_hash: sourceHash,
      raw_data: rawData,
    })
    .select('id')
    .single()

  if (error) {
    // 23505 = unique_violation on event_candidates_source_hash_unique.
    // Surface as a friendly "可能已存在" hint rather than a DB error.
    if (error.code === '23505') {
      return {
        error:
          '這筆候選可能已存在（source_hash 重複）。請至候選列表查找是否已收錄。',
      }
    }
    return {
      error: `新增候選失敗：${error.code ? `[${error.code}] ` : ''}${error.message}`,
    }
  }

  if (!data?.id) return { error: '新增成功但無法取得 ID，請至列表確認' }

  revalidatePath('/admin/event-candidates')
  redirect(`/admin/event-candidates/${data.id}`)
}

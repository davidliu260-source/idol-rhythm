'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'
import { computeSourceHash } from '@/lib/crawlers/sourceHash'
import {
  EVENT_TYPES,
  SOURCE_TYPES,
  type EventType,
  type SourceType,
  RAW_TEXT_MAX_CHARS,
} from '@/lib/ai/parseCandidate'

// ── Payload shape (what the client sends after user confirms preview) ──────

export interface CommitAiCandidatePayload {
  rawText: string
  parsed: {
    detected_idol_slug: string | null
    detected_idol_id: string | null
    detected_event_type: EventType | null
    detected_date: string | null
    source_name: string | null
    source_type: SourceType | null
    confidence: number
    reason: string
    model: string
  }
}

function firstNonEmptyLine(text: string, maxLen = 200): string {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const first = lines[0] ?? text.trim()
  if (first.length <= maxLen) return first
  return first.slice(0, maxLen).trimEnd() + '…'
}

/**
 * Commit a previously-parsed candidate into event_candidates.
 *
 * This is the only path that writes. It re-validates the parsed payload
 * server-side (defence in depth — the client could lie), re-hashes for
 * dedupe, and stamps raw_data with the AI audit trail.
 */
export async function commitAiCandidate(
  payload: CommitAiCandidatePayload,
): Promise<{ error: string }> {
  // ── Admin guard ──────────────────────────────────────────────────────────
  const { isAdmin } = await getCurrentAdmin()
  if (!isAdmin) return { error: '未授權：需要管理員身份' }

  const supabase = getSupabaseServerClient()
  if (!supabase) return { error: 'Supabase 未設定' }

  const rawText = (payload.rawText ?? '').trim()
  if (!rawText) return { error: '原始公告文字不可空白' }
  if (rawText.length > RAW_TEXT_MAX_CHARS) {
    return { error: `公告文字過長（上限 ${RAW_TEXT_MAX_CHARS} 字）` }
  }

  const p = payload.parsed

  // ── Re-validate enum fields (don't trust the client) ─────────────────────
  const detectedEventType: EventType | null =
    p.detected_event_type &&
    (EVENT_TYPES as readonly string[]).includes(p.detected_event_type)
      ? (p.detected_event_type as EventType)
      : null

  const detectedSourceType: SourceType =
    p.source_type && (SOURCE_TYPES as readonly string[]).includes(p.source_type)
      ? (p.source_type as SourceType)
      : 'unknown'

  const detectedDate =
    typeof p.detected_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.detected_date)
      ? p.detected_date
      : null

  const confidence =
    typeof p.confidence === 'number' && Number.isFinite(p.confidence)
      ? Math.max(0, Math.min(1, Math.round(p.confidence * 100) / 100))
      : 0

  // ── Re-resolve idol slug → UUID server-side ──────────────────────────────
  let detectedIdolId: string | null = null
  let detectedIdolSlug: string | null = null
  if (typeof p.detected_idol_slug === 'string' && p.detected_idol_slug.trim()) {
    const { data: idolRow } = await supabase
      .from('idols')
      .select('id, slug')
      .eq('slug', p.detected_idol_slug.trim())
      .eq('is_active', true)
      .maybeSingle()
    if (idolRow) {
      detectedIdolId = (idolRow as { id: string }).id
      detectedIdolSlug = (idolRow as { slug: string }).slug
    }
  }

  // ── Compose candidate fields ─────────────────────────────────────────────
  const rawTitle = firstNonEmptyLine(rawText, 200)
  const sourceName =
    typeof p.source_name === 'string' && p.source_name.trim()
      ? p.source_name.trim()
      : 'AI parsed announcement'
  const reviewerNote = 'AI parsed candidate; please review manually'

  // No source_url in this flow → fallback hash over content fields.
  const sourceHash = computeSourceHash({
    sourceUrl: null,
    rawTitle,
    detectedDate,
    detectedIdolId,
    sourceName,
    sourceType: detectedSourceType,
  })
  if (!sourceHash) {
    return { error: '無法產生 source_hash（內容過於空白）' }
  }

  const rawData = {
    source: 'ai-parse' as const,
    model: p.model || 'unknown',
    confidence,
    reason: typeof p.reason === 'string' ? p.reason.slice(0, 1000) : '',
    input_text: rawText.slice(0, RAW_TEXT_MAX_CHARS),
    parsed: {
      detected_idol_slug: detectedIdolSlug,
      detected_event_type: detectedEventType,
      detected_date: detectedDate,
      source_name: sourceName,
      source_type: detectedSourceType,
    },
  }

  // ── INSERT ───────────────────────────────────────────────────────────────
  const { data, error } = await supabase
    .from('event_candidates')
    .insert({
      raw_title: rawTitle,
      raw_content: rawText,
      detected_idol_id: detectedIdolId,
      detected_event_type: detectedEventType,
      detected_date: detectedDate,
      source_url: null,
      source_name: sourceName,
      source_type: detectedSourceType,
      ai_confidence: confidence,
      reviewer_note: reviewerNote,
      source_hash: sourceHash,
      raw_data: rawData,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return {
        error:
          '這筆候選可能已存在（source_hash 重複），請到候選列表確認是否已收錄。',
      }
    }
    return {
      error: `寫入候選失敗：${error.code ? `[${error.code}] ` : ''}${error.message}`,
    }
  }

  if (!data?.id) return { error: '寫入成功但無法取得 ID，請至列表確認' }

  revalidatePath('/admin/event-candidates')
  redirect(`/admin/event-candidates/${data.id}`)
}

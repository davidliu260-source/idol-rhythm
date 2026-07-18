import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'
import { getReviewSourceInfo } from '@/lib/admin/sourceReview'
import { verifyCandidate, type CandidateRow, VERIFICATION_CONFIG } from '@/lib/admin/aggregatorVerification'

export const maxDuration = 300

const DEFAULT_MAX_VERIFY_PER_RUN = 5
const MAX_VERIFY_PER_RUN_HARD_CAP = 50
const BATCH_TIME_BUDGET_MS = maxDuration * 1_000
const MIN_REMAINING_TIME_MS = 100_000

function maxVerifyPerRun(): number {
  const configured = Number.parseInt(process.env.MAX_VERIFY_PER_RUN ?? '', 10)
  if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_MAX_VERIFY_PER_RUN
  return Math.min(configured, MAX_VERIFY_PER_RUN_HARD_CAP)
}

type VerifyResponse = {
  ok: boolean
  total: number
  succeeded: number
  failed: number
  results: { id: string; status: string; error?: string }[]
  error?: string
}

export async function POST(request: NextRequest): Promise<NextResponse<VerifyResponse>> {
  const { isAdmin } = await getCurrentAdmin()
  if (!isAdmin) {
    return NextResponse.json({ ok: false, total: 0, succeeded: 0, failed: 0, results: [], error: '未授權：需要管理員身份' }, { status: 401 })
  }

  let body: { ids?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, total: 0, succeeded: 0, failed: 0, results: [], error: '無效的請求格式' }, { status: 400 })
  }
  const ids = body && Array.isArray(body.ids) ? Array.from(new Set(body.ids.filter((id): id is string => typeof id === 'string' && id.length > 0))) : []
  const max = maxVerifyPerRun()
  if (ids.length === 0) {
    return NextResponse.json({ ok: false, total: 0, succeeded: 0, failed: 0, results: [], error: 'ids 不可為空' }, { status: 400 })
  }
  if (ids.length > max) {
    return NextResponse.json({ ok: false, total: ids.length, succeeded: 0, failed: ids.length, results: [], error: `單次最多求證 ${max} 筆` }, { status: 400 })
  }

  const supabase = getSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json({ ok: false, total: ids.length, succeeded: 0, failed: ids.length, results: [], error: 'Supabase 環境變數未設定' }, { status: 500 })
  }

  const { data, error } = await supabase
    .from('event_candidates')
    .select('id, raw_title, detected_idol_id, detected_date, detected_start_date, detected_end_date, detected_date_label, detected_city, detected_venue_name, source_name, source_type, source_url, review_status, idols(name)')
    .in('id', ids)
  if (error) {
    return NextResponse.json({ ok: false, total: ids.length, succeeded: 0, failed: ids.length, results: [], error: `查詢候選失敗：${error.message}` }, { status: 500 })
  }

  type CandidateWithIdol = CandidateRow & { review_status: string; idols: { name: string } | null }
  const rows = new Map((data ?? []).map((row) => {
    const raw = row as unknown as CandidateWithIdol & { idols: { name: string }[] | { name: string } | null }
    const candidate = { ...raw, idols: Array.isArray(raw.idols) ? raw.idols[0] ?? null : raw.idols } as CandidateWithIdol
    return [candidate.id, candidate] as const
  }))
  const results: VerifyResponse['results'] = []
  const batchStartedAt = Date.now()
  const batchDeadline = batchStartedAt + BATCH_TIME_BUDGET_MS - MIN_REMAINING_TIME_MS
  for (const id of ids) {
    if (Date.now() >= batchDeadline) {
      results.push(...ids.slice(results.length).map((remainingId) => ({ id: remainingId, status: 'skipped', error: '整批時間預算不足，未呼叫求證' })))
      break
    }
    const candidate = rows.get(id)
    if (!candidate || candidate.review_status !== 'pending') {
      results.push({ id, status: 'skipped', error: '找不到待審核候選（可能已審核過）' })
      continue
    }
    const sourceInfo = getReviewSourceInfo({ sourceName: candidate.source_name, sourceType: candidate.source_type, sourceUrl: candidate.source_url })
    if (!sourceInfo.needsOriginalSource) {
      results.push({ id, status: 'skipped', error: '只有聚合 / 社群來源候選可自動求證' })
      continue
    }
    const artist = candidate.idols?.name ?? null
    if (!artist || !candidate.detected_venue_name || !candidate.detected_city || !candidateDatesPresent(candidate)) {
      results.push({ id, status: 'skipped', error: '候選缺少可求證的藝人、ISO 日期、城市或場館' })
      continue
    }

    const result = await verifyCandidate(candidate, artist)
    const verifiedAt = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('event_candidates')
      .update({ verification_status: result.status, verified_at: verifiedAt, verification_evidence: result.evidence, verification_provider_meta: result.providerMeta })
      .eq('id', id)
      .eq('review_status', 'pending')
    if (updateError) {
      results.push({ id, status: 'provider_error', error: `求證結果寫回失敗：${updateError.message}` })
    } else {
      results.push({ id, status: result.status })
    }
  }

  revalidatePath('/admin/event-candidates')
  revalidatePath('/admin/event-candidates/[id]', 'page')
  const failed = results.filter((result) => result.status === 'provider_error').length
  return NextResponse.json({ ok: failed === 0, total: ids.length, succeeded: ids.length - failed, failed, results })
}

function candidateDatesPresent(candidate: CandidateRow): boolean {
  return isParseableIsoDate(candidate.detected_start_date ?? candidate.detected_date)
}

function isParseableIsoDate(value: string | null): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)) return false
  const date = new Date(value)
  return !Number.isNaN(date.getTime())
}

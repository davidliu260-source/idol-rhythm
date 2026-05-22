export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { ArrowLeft, FileSearch, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'
import { getReviewSourceInfo } from '@/lib/admin/sourceReview'
import EventTypeBadge from '@/components/EventTypeBadge'
import { approveCandidate, rejectCandidate } from './actions'
import GenerateChineseButton from './GenerateChineseButton'
import MarkReviewedButton from './MarkReviewedButton'
import ResolveRecheckButton from './ResolveRecheckButton'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CandidateDetail {
  id: string
  rawTitle: string
  rawContent: string | null
  detectedIdolId: string | null
  idolName: string | null
  detectedEventType: string | null
  detectedEventSubType: string | null
  detectedDate: string | null
  detectedStartDate: string | null
  detectedEndDate: string | null
  detectedDateLabel: string | null
  detectedCity: string | null
  detectedVenueName: string | null
  detectedAddress: string | null
  displayTitleZh: string | null
  displaySummaryZh: string | null
  locationNameZh: string | null
  translationStatus: string
  translationSource: string | null
  sourceUrl: string | null
  sourceName: string | null
  sourceType: string | null
  sourceHash: string | null
  aiConfidence: number | null
  reviewStatus: 'pending' | 'approved' | 'rejected'
  reviewerNote: string | null
  approvedEventId: string | null
  approvedEventTitle: string | null
  createdAt: string
  updatedAt: string
  needsRecheck: boolean
}

// ── Data fetcher ──────────────────────────────────────────────────────────────

async function getCandidate(id: string): Promise<CandidateDetail | null> {
  const supabase = getSupabaseServerClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('event_candidates')
    .select('*, idols(name)')
    .eq('id', id)
    .single()

  if (error || !data) return null

  const row = data as {
    id: string
    raw_title: string
    raw_content: string | null
    detected_idol_id: string | null
    detected_event_type: string | null
    detected_event_sub_type: string | null
    detected_date: string | null
    detected_start_date: string | null
    detected_end_date: string | null
    detected_date_label: string | null
    detected_city: string | null
    detected_venue_name: string | null
    detected_address: string | null
    display_title_zh: string | null
    display_summary_zh: string | null
    location_name_zh: string | null
    translation_status: string | null
    translation_source: string | null
    source_url: string | null
    source_name: string | null
    source_type: string | null
    source_hash: string | null
    ai_confidence: number | null
    review_status: string
    reviewer_note: string | null
    approved_event_id: string | null
    created_at: string
    updated_at: string
    needs_recheck: boolean | null
    idols: { name: string } | null
  }

  // Fetch approved event title if relevant
  let approvedEventTitle: string | null = null
  if (row.approved_event_id) {
    const { data: ev } = await supabase
      .from('events')
      .select('title')
      .eq('id', row.approved_event_id)
      .single()
    approvedEventTitle = (ev as { title: string } | null)?.title ?? null
  }

  return {
    id: row.id,
    rawTitle: row.raw_title,
    rawContent: row.raw_content,
    detectedIdolId: row.detected_idol_id,
    idolName: row.idols?.name ?? null,
    detectedEventType: row.detected_event_type,
    detectedEventSubType: row.detected_event_sub_type,
    detectedDate: row.detected_date,
    detectedStartDate: row.detected_start_date,
    detectedEndDate: row.detected_end_date,
    detectedDateLabel: row.detected_date_label,
    detectedCity: row.detected_city,
    detectedVenueName: row.detected_venue_name,
    detectedAddress: row.detected_address,
    displayTitleZh: row.display_title_zh,
    displaySummaryZh: row.display_summary_zh,
    locationNameZh: row.location_name_zh,
    translationStatus: row.translation_status ?? 'none',
    translationSource: row.translation_source,
    sourceUrl: row.source_url,
    sourceName: row.source_name,
    sourceType: row.source_type,
    sourceHash: row.source_hash,
    aiConfidence: row.ai_confidence,
    reviewStatus: row.review_status as 'pending' | 'approved' | 'rejected',
    reviewerNote: row.reviewer_note,
    approvedEventId: row.approved_event_id,
    approvedEventTitle,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    needsRecheck: row.needs_recheck ?? false,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDatetime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('zh-TW', {
      timeZone: 'Asia/Taipei',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

const TRANSLATION_STATUS_LABELS: Record<string, string> = {
  none: '未產生',
  machine: '機器產生',
  reviewed: '已審閱',
  manual: '人工編輯',
}

function getCandidateChineseDisabledReason(candidate: CandidateDetail): string | null {
  if (candidate.reviewStatus !== 'pending') {
    return '只有待審核候選可以產生繁中顯示文案'
  }
  if (candidate.translationStatus === 'manual' || candidate.translationStatus === 'reviewed') {
    return '中文欄位已是人工編輯或已審閱狀態，不自動覆蓋'
  }
  if (candidate.displayTitleZh || candidate.displaySummaryZh || candidate.locationNameZh) {
    return '已有中文顯示欄位，第一版不支援覆蓋既有內容'
  }
  return null
}

function getCandidateReviewedDisabledReason(candidate: CandidateDetail): string | null {
  if (candidate.translationStatus !== 'machine') {
    return '只有機器產生狀態可以標記已審閱'
  }
  if (!candidate.displayTitleZh && !candidate.displaySummaryZh && !candidate.locationNameZh) {
    return '缺少中文欄位，無法標記已審閱'
  }
  return null
}

function sourceBadgeClass(risk: string): string {
  switch (risk) {
    case 'official':
      return 'bg-sky-500/10 border-sky-500/25 text-sky-300'
    case 'media':
      return 'bg-teal-500/10 border-teal-500/25 text-teal-300'
    case 'aggregator':
      return 'bg-amber-500/10 border-amber-500/30 text-amber-300'
    default:
      return 'bg-card border-card-border text-muted'
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminCandidateDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const { id } = params

  const [{ isAdmin }, candidate] = await Promise.all([
    getCurrentAdmin(),
    getCandidate(id),
  ])

  if (!candidate) {
    return (
      <div className="flex flex-col gap-0 pt-12 pb-6 px-4">
        <Link
          href="/admin/event-candidates"
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-text-base mb-6"
        >
          <ArrowLeft className="h-3 w-3" />
          返回候選列表
        </Link>
        <div className="rounded-xl bg-card border border-card-border px-4 py-8 text-center">
          <p className="text-sm text-muted">找不到候選活動</p>
          <p className="text-xs text-muted/60 mt-1">ID: {id}</p>
        </div>
      </div>
    )
  }

  const isPending  = candidate.reviewStatus === 'pending'
  const isApproved = candidate.reviewStatus === 'approved'
  const isRejected = candidate.reviewStatus === 'rejected'
  const hasIdol    = !!candidate.detectedIdolId
  const sourceInfo = getReviewSourceInfo(candidate)
  const chineseDisabledReason = getCandidateChineseDisabledReason(candidate)
  const reviewedDisabledReason = getCandidateReviewedDisabledReason(candidate)

  return (
    <div className="flex flex-col gap-0 pt-12 pb-6">
      {/* Header */}
      <div className="px-4 mb-4">
        <Link
          href="/admin/event-candidates"
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-text-base mb-3"
        >
          <ArrowLeft className="h-3 w-3" />
          返回候選列表
        </Link>
        <div className="flex items-center gap-2">
          <FileSearch className="h-5 w-5 text-violet" />
          <h1 className="text-xl font-bold text-text-base">候選活動詳情</h1>
        </div>
      </div>

      {/* Status banner */}
      <div className="px-4 mb-4">
        <div className={`rounded-xl px-3 py-2.5 flex items-center gap-2 border ${
          isPending  ? 'bg-amber-500/10 border-amber-500/25' :
          isApproved ? 'bg-emerald-500/10 border-emerald-500/25' :
                       'bg-card border-card-border'
        }`}>
          <span className={`h-2 w-2 rounded-full flex-shrink-0 ${
            isPending  ? 'bg-amber-400' :
            isApproved ? 'bg-emerald-400' :
                         'bg-muted/40'
          }`} />
          <p className={`text-xs font-medium ${
            isPending  ? 'text-amber-300' :
            isApproved ? 'text-emerald-300' :
                         'text-muted'
          }`}>
            {isPending ? '待審核' : isApproved ? '已核准' : '已拒絕'}
          </p>
        </div>
      </div>

      {/* needs_recheck banner — only when crawler detected content drift */}
      {candidate.needsRecheck && (
        <div className="px-4 mb-2">
          <div className="rounded-xl bg-orange-500/10 border border-orange-500/30 px-3 py-2.5 flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-orange-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-orange-300 leading-snug">
              <span className="font-semibold">內容已變更</span>
              ｜爬蟲偵測到此候選的來源內容在首次擷取後有更動，建議重新審核。詳細變更時間請見下方 reviewer note。
            </p>
          </div>
        </div>
      )}

      {/* needs_recheck resolve button — admin only */}
      {isAdmin && candidate.needsRecheck && (
        <div className="px-4 mb-4">
          <ResolveRecheckButton
            candidateId={candidate.id}
            isApproved={isApproved}
          />
        </div>
      )}

      {sourceInfo.needsOriginalSource && (
        <div className="px-4 mb-4">
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2.5 flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300 leading-snug">
              <span className="font-semibold">{sourceInfo.shortLabel}</span>
              ｜{sourceInfo.hint}
            </p>
          </div>
        </div>
      )}

      {/* ── Admin action area: pending ─── */}
      {isAdmin && isPending && (
        <div className="px-4 mb-4 flex flex-col gap-2">

          {/* No idol warning — shown when approve is impossible */}
          {!hasIdol && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 px-3 py-2.5 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300 leading-snug">
                此候選活動<span className="font-semibold">缺少偶像對應</span>（detected_idol_id 為空），
                無法 Approve。請手動新增草稿，或先確認偶像資料。
              </p>
            </div>
          )}

          {/* Approve button — only shown when idol exists */}
          {hasIdol && (
            <form action={approveCandidate.bind(null, candidate.id)}>
              <button
                type="submit"
                className="w-full flex items-center gap-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-3 py-2.5 hover:bg-emerald-500/25 transition-colors text-left"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                <span className="text-xs font-semibold text-emerald-400">
                  核准候選（建立草稿活動）
                </span>
              </button>
            </form>
          )}

          {/* Reject button — always shown for pending */}
          <form action={rejectCandidate.bind(null, candidate.id)}>
            <button
              type="submit"
              className="w-full flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/25 px-3 py-2.5 hover:bg-red-500/20 transition-colors text-left"
            >
              <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
              <span className="text-xs font-semibold text-red-400">
                拒絕候選（不建立活動）
              </span>
            </button>
          </form>
        </div>
      )}

      {/* ── Approved: link to created event ─── */}
      {isApproved && candidate.approvedEventId && (
        <div className="px-4 mb-4">
          <Link
            href={`/admin/events/${candidate.approvedEventId}`}
            className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 px-3 py-2.5 hover:bg-emerald-500/15 transition-colors"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-emerald-300">
                已核准 → 查看建立的草稿活動
              </span>
              {candidate.approvedEventTitle && (
                <span className="text-[10px] text-emerald-300/60">
                  {candidate.approvedEventTitle}
                </span>
              )}
            </div>
          </Link>
        </div>
      )}

      {/* ── Rejected: notice ─── */}
      {isRejected && (
        <div className="px-4 mb-4">
          <div className="rounded-xl bg-card border border-card-border px-3 py-2.5">
            <p className="text-xs text-muted leading-snug">此候選已拒絕，未建立任何活動。</p>
          </div>
        </div>
      )}

      {/* ── Non-admin read-only notice for pending ─── */}
      {!isAdmin && isPending && (
        <div className="px-4 mb-4">
          <div className="rounded-xl bg-violet/10 border border-violet/25 px-3 py-2.5">
            <p className="text-xs text-muted leading-snug">
              只讀詳情預覽｜需要管理員身份才能審核
            </p>
          </div>
        </div>
      )}

      {/* Detail cards */}
      <div className="px-4 flex flex-col gap-3">

        {/* Original data */}
        <div className="rounded-xl bg-card border border-card-border px-4 py-4 flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide">原始資料</p>
          <Field label="標題">{candidate.rawTitle}</Field>
          {candidate.rawContent && (
            <>
              <Divider />
              <div className="flex flex-col gap-1">
                <p className="text-xs text-muted">原始內容</p>
                <p className="text-xs text-text-base leading-relaxed">{candidate.rawContent}</p>
              </div>
            </>
          )}
        </div>

        {/* Chinese display metadata */}
        <div className="rounded-xl bg-card border border-card-border px-4 py-4 flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide">中文顯示</p>
          {isAdmin && (
            <>
              <GenerateChineseButton
                candidateId={candidate.id}
                disabledReason={chineseDisabledReason}
              />
              {candidate.translationStatus === 'machine' && (
                <MarkReviewedButton
                  candidateId={candidate.id}
                  disabledReason={reviewedDisabledReason}
                />
              )}
              <Divider />
            </>
          )}
          <Field label="中文標題">{candidate.displayTitleZh || <span className="text-muted/60">尚未填寫</span>}</Field>
          {candidate.displaySummaryZh && (
            <>
              <Divider />
              <Field label="中文摘要">{candidate.displaySummaryZh}</Field>
            </>
          )}
          {candidate.locationNameZh && (
            <>
              <Divider />
              <Field label="中文地點">{candidate.locationNameZh}</Field>
            </>
          )}
          <Divider />
          <Field label="翻譯狀態">
            {TRANSLATION_STATUS_LABELS[candidate.translationStatus] ?? candidate.translationStatus}
            {candidate.translationSource ? ` / ${candidate.translationSource}` : ''}
          </Field>
        </div>

        {/* Detection results */}
        <div className="rounded-xl bg-card border border-card-border px-4 py-4 flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide">偵測結果</p>
          <Field label="偶像">
            {candidate.idolName ? (
              <span className="text-text-base">{candidate.idolName}</span>
            ) : (
              <span className="text-red-400">未對應（detected_idol_id 為空）</span>
            )}
          </Field>
          {candidate.detectedEventType && (
            <>
              <Divider />
              <Field label="活動類型">
                <EventTypeBadge
                  type={candidate.detectedEventType}
                  subType={candidate.detectedEventSubType}
                />
              </Field>
            </>
          )}
          {candidate.detectedDate && (
            <>
              <Divider />
              <Field label="偵測日期">{candidate.detectedDate.slice(0, 10)}</Field>
            </>
          )}
          {(candidate.detectedStartDate || candidate.detectedEndDate || candidate.detectedDateLabel) && (
            <>
              <Divider />
              <Field label="日期區間">
                {candidate.detectedDateLabel ||
                  [candidate.detectedStartDate, candidate.detectedEndDate].filter(Boolean).join(' - ')}
              </Field>
            </>
          )}
          {(candidate.detectedCity || candidate.detectedVenueName || candidate.detectedAddress) && (
            <>
              <Divider />
              <Field label="地點細節">
                {[candidate.detectedCity, candidate.detectedVenueName, candidate.detectedAddress].filter(Boolean).join(' / ')}
              </Field>
            </>
          )}
          {candidate.aiConfidence !== null && (
            <>
              <Divider />
              <Field label="AI 信心度">
                <span className={
                  candidate.aiConfidence >= 0.7 ? 'text-emerald-400' :
                  candidate.aiConfidence >= 0.4 ? 'text-amber-400' :
                  'text-red-400'
                }>
                  {Math.round(candidate.aiConfidence * 100)}%
                </span>
              </Field>
            </>
          )}
        </div>

        {/* Source info */}
        <div className="rounded-xl bg-card border border-card-border px-4 py-4 flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide">來源資訊</p>
          <Field label="來源名稱">{candidate.sourceName ?? '—'}</Field>
          {candidate.sourceType && (
            <>
              <Divider />
              <Field label="來源類型">
                <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold ${sourceBadgeClass(sourceInfo.risk)}`}>
                  {sourceInfo.label}
                </span>
              </Field>
            </>
          )}
          {candidate.sourceUrl && (
            <>
              <Divider />
              <Field label="來源 URL">
                <a
                  href={candidate.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-violet underline underline-offset-2 break-all"
                >
                  {candidate.sourceUrl}
                </a>
              </Field>
            </>
          )}
          {candidate.sourceHash && (
            <>
              <Divider />
              <Field label="Source Hash">
                <span
                  className="font-mono text-[10px] text-muted/60"
                  title={candidate.sourceHash}
                >
                  {candidate.sourceHash.slice(0, 12)}…
                </span>
              </Field>
            </>
          )}
        </div>

        {/* Reviewer note */}
        {candidate.reviewerNote && (
          <div className="rounded-xl bg-card border border-card-border px-4 py-4 flex flex-col gap-2">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide">審核備注</p>
            <p className="text-xs text-text-base leading-relaxed">{candidate.reviewerNote}</p>
          </div>
        )}

        {/* Timestamps */}
        <div className="rounded-xl bg-card border border-card-border px-4 py-4 flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide">時間紀錄</p>
          <Field label="建立時間">{formatDatetime(candidate.createdAt)}</Field>
          <Divider />
          <Field label="最後更新">{formatDatetime(candidate.updatedAt)}</Field>
        </div>

        {/* IDs */}
        <div className="rounded-xl bg-card border border-card-border px-4 py-3 flex flex-col gap-2">
          <Field label="Candidate ID">
            <span className="font-mono text-[10px] text-muted/60 break-all">{candidate.id}</span>
          </Field>
          {candidate.detectedIdolId && (
            <>
              <Divider />
              <Field label="Idol ID">
                <span className="font-mono text-[10px] text-muted/60 break-all">
                  {candidate.detectedIdolId}
                </span>
              </Field>
            </>
          )}
          {candidate.approvedEventId && (
            <>
              <Divider />
              <Field label="Event ID">
                <span className="font-mono text-[10px] text-muted/60 break-all">
                  {candidate.approvedEventId}
                </span>
              </Field>
            </>
          )}
        </div>

      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <p className="text-xs text-muted flex-shrink-0 w-20">{label}</p>
      <div className="text-xs text-text-base text-right flex-1">{children}</div>
    </div>
  )
}

function Divider() {
  return <div className="h-px bg-card-border" />
}

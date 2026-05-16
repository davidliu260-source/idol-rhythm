export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { ArrowLeft, FileSearch, ChevronRight, Plus } from 'lucide-react'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'
import CrawlerButton from './CrawlerButton'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Candidate {
  id: string
  rawTitle: string
  idolName: string | null
  detectedDate: string | null
  sourceName: string | null
  reviewStatus: 'pending' | 'approved' | 'rejected'
  aiConfidence: number | null
  createdAt: string
}

// ── Data fetcher ──────────────────────────────────────────────────────────────

async function getCandidates(): Promise<{ candidates: Candidate[]; error: string | null }> {
  const supabase = getSupabaseServerClient()
  if (!supabase) {
    return { candidates: [], error: 'Supabase 環境變數未設定' }
  }

  const { data, error } = await supabase
    .from('event_candidates')
    .select('id, raw_title, detected_date, source_name, review_status, ai_confidence, created_at, idols(name)')
    .order('created_at', { ascending: false })

  if (error) {
    return {
      candidates: [],
      error: `查詢候選失敗：${error.code ? `[${error.code}] ` : ''}${error.message}`,
    }
  }

  const raw = data ?? []

  const candidates: Candidate[] = raw.map((row) => ({
    id: row.id as string,
    rawTitle: row.raw_title as string,
    idolName: ((row.idols as unknown) as { name: string } | null)?.name ?? null,
    detectedDate: row.detected_date as string | null,
    sourceName: row.source_name as string | null,
    reviewStatus: row.review_status as 'pending' | 'approved' | 'rejected',
    aiConfidence: row.ai_confidence as number | null,
    createdAt: row.created_at as string,
  }))

  // Sort: pending first, then approved, then rejected; within group by created_at desc
  const ORDER: Record<string, number> = { pending: 0, approved: 1, rejected: 2 }
  candidates.sort((a, b) => (ORDER[a.reviewStatus] ?? 3) - (ORDER[b.reviewStatus] ?? 3))

  return { candidates, error: null }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminCandidatesPage() {
  const [{ isAdmin }, { candidates, error }] = await Promise.all([
    getCurrentAdmin(),
    getCandidates(),
  ])

  const pendingCount = candidates.filter((c) => c.reviewStatus === 'pending').length
  const approvedCount = candidates.filter((c) => c.reviewStatus === 'approved').length
  const rejectedCount = candidates.filter((c) => c.reviewStatus === 'rejected').length

  return (
    <div className="flex flex-col gap-0 pt-12 pb-6">
      {/* Header */}
      <div className="px-4 mb-4">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-text-base mb-3"
        >
          <ArrowLeft className="h-3 w-3" />
          Admin Dashboard
        </Link>
        <div className="flex items-center gap-2">
          <FileSearch className="h-5 w-5 text-violet" />
          <h1 className="text-xl font-bold text-text-base">候選活動審核</h1>
          {isAdmin && (
            <Link
              href="/admin/event-candidates/new"
              className="ml-auto inline-flex items-center gap-1 rounded-lg bg-violet px-2.5 py-1.5 text-[11px] font-semibold text-white active:opacity-80 transition-opacity"
            >
              <Plus className="h-3 w-3" />
              新增候選
            </Link>
          )}
        </div>
        <p className="text-xs text-muted mt-1">
          共 {candidates.length} 筆候選
          {pendingCount > 0 && (
            <span className="ml-1 text-amber-400">（{pendingCount} 待審核）</span>
          )}
        </p>
      </div>

      {/* Auth guard */}
      {!isAdmin && (
        <div className="px-4 mb-4">
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 px-3 py-2.5">
            <p className="text-xs text-amber-300 leading-snug">
              需要管理員身份才能審核候選活動。
              <Link href="/admin/login" className="underline underline-offset-2 ml-1 font-semibold">
                前往登入 →
              </Link>
            </p>
          </div>
        </div>
      )}

      {/* Query error */}
      {error && (
        <div className="px-4 mb-4">
          <div className="rounded-xl bg-red-500/10 border border-red-500/25 px-3 py-3">
            <p className="text-xs font-semibold text-red-400 mb-1">候選清單載入失敗</p>
            <p className="text-xs text-red-400/80 break-all leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {/* Crawler trigger — admin only */}
      {isAdmin && (
        <div className="px-4 mb-4">
          <CrawlerButton />
        </div>
      )}

      {/* Summary stats */}
      {candidates.length > 0 && (
        <div className="px-4 grid grid-cols-3 gap-2 mb-4">
          <MiniStat label="待審核" value={pendingCount} color="text-amber-400" />
          <MiniStat label="已核准" value={approvedCount} color="text-emerald-400" />
          <MiniStat label="已拒絕" value={rejectedCount} color="text-muted" />
        </div>
      )}

      {/* Candidates list */}
      <div className="px-4 flex flex-col gap-2">
        {candidates.length === 0 && !error && (
          <div className="rounded-xl bg-card border border-card-border px-4 py-8 text-center">
            <p className="text-sm text-muted">尚無候選活動</p>
            <p className="text-xs text-muted/60 mt-1">
              {isAdmin
                ? '執行 migration 012 後，seed 資料的 3 筆候選會顯示在這裡。'
                : '請先以管理員身份登入。'}
            </p>
          </div>
        )}
        {candidates.map((c) => (
          <CandidateRow key={c.id} candidate={c} />
        ))}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: '待審核', color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20' },
  approved: { label: '已核准', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  rejected: { label: '已拒絕', color: 'text-muted',       bg: 'bg-card border-card-border' },
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl bg-card border border-card-border px-3 py-3 text-center">
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-muted mt-0.5">{label}</p>
    </div>
  )
}

function CandidateRow({ candidate }: { candidate: Candidate }) {
  const statusCfg = STATUS_CONFIG[candidate.reviewStatus] ?? STATUS_CONFIG.pending

  return (
    <Link
      href={`/admin/event-candidates/${candidate.id}`}
      className="rounded-xl bg-card border border-card-border px-4 py-3 flex flex-col gap-1.5 active:opacity-70 transition-opacity"
    >
      {/* Top row: status badge + date */}
      <div className="flex items-center gap-2">
        <span
          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${statusCfg.bg} ${statusCfg.color}`}
        >
          {statusCfg.label}
        </span>
        {candidate.detectedDate && (
          <span className="text-[10px] text-muted tabular-nums ml-auto">
            {candidate.detectedDate.slice(0, 10)}
          </span>
        )}
      </div>

      {/* Title + chevron */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-text-base leading-snug">{candidate.rawTitle}</p>
        <ChevronRight className="h-4 w-4 text-muted flex-shrink-0 mt-0.5" />
      </div>

      {/* Bottom row: idol · source · confidence */}
      <div className="flex items-center gap-1.5 text-xs text-muted flex-wrap">
        {candidate.idolName && <span>{candidate.idolName}</span>}
        {candidate.idolName && candidate.sourceName && <span>·</span>}
        {candidate.sourceName && <span>{candidate.sourceName}</span>}
        {candidate.aiConfidence !== null && (
          <span className="ml-auto text-[10px] text-muted/60 flex-shrink-0">
            信心 {Math.round(candidate.aiConfidence * 100)}%
          </span>
        )}
      </div>
    </Link>
  )
}

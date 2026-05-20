export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { ArrowLeft, FileSearch, Plus, Sparkles, Database } from 'lucide-react'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'
import CrawlerButton from './CrawlerButton'
import CandidatesClient from './CandidatesClient'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Candidate {
  id: string
  rawTitle: string
  idolName: string | null
  detectedDate: string | null
  sourceName: string | null
  sourceType: string | null
  sourceUrl: string | null
  reviewStatus: 'pending' | 'approved' | 'rejected'
  aiConfidence: number | null
  hasIdol: boolean
  createdAt: string
  needsRecheck: boolean
}

// ── Data fetcher ──────────────────────────────────────────────────────────────

async function getCandidates(): Promise<{ candidates: Candidate[]; error: string | null }> {
  const supabase = getSupabaseServerClient()
  if (!supabase) {
    return { candidates: [], error: 'Supabase 環境變數未設定' }
  }

  const { data, error } = await supabase
    .from('event_candidates')
    .select('id, raw_title, detected_idol_id, detected_date, source_name, source_type, source_url, review_status, ai_confidence, created_at, needs_recheck, idols(name)')
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
    sourceType: row.source_type as string | null,
    sourceUrl: row.source_url as string | null,
    reviewStatus: row.review_status as 'pending' | 'approved' | 'rejected',
    aiConfidence: row.ai_confidence as number | null,
    hasIdol: !!row.detected_idol_id,
    createdAt: row.created_at as string,
    needsRecheck: (row.needs_recheck as boolean | null) ?? false,
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
  const recheckCount = candidates.filter((c) => c.needsRecheck).length

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
          {recheckCount > 0 && (
            <span className="ml-1 text-orange-400">（{recheckCount} 需重審）</span>
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

      {/* AI parse entry — admin only */}
      {isAdmin && (
        <div className="px-4 mb-3">
          <Link
            href="/admin/event-candidates/parse"
            className="inline-flex items-center gap-2 rounded-xl border border-violet/40 bg-violet/10 px-3 py-2.5 text-xs font-semibold text-violet-200 active:opacity-80 transition-opacity"
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI 解析公告
          </Link>
        </div>
      )}

      {/* Crawler trigger — admin only */}
      {isAdmin && (
        <div className="px-4 mb-4">
          <CrawlerButton />
        </div>
      )}

      {/* Crawler sources management entry — admin only */}
      {isAdmin && (
        <div className="px-4 mb-4">
          <Link
            href="/admin/sources"
            className="inline-flex items-center gap-2 rounded-xl border border-card-border bg-card px-3 py-2.5 text-xs font-semibold text-text-base active:opacity-80 transition-opacity"
          >
            <Database className="h-3.5 w-3.5 text-violet" />
            資料來源管理
          </Link>
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

      {/* Candidates list with checkbox + bulk actions */}
      <CandidatesClient candidates={candidates} isAdmin={isAdmin} />
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl bg-card border border-card-border px-3 py-3 text-center">
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-muted mt-0.5">{label}</p>
    </div>
  )
}

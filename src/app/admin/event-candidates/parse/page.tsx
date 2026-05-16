export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { ArrowLeft, Sparkles, Lock } from 'lucide-react'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'
import ParseClient from './ParseClient'

export default async function AdminParseCandidatePage() {
  const { isAdmin } = await getCurrentAdmin()

  if (!isAdmin) {
    return (
      <div className="flex flex-col pt-12 pb-6 px-4 gap-4">
        <Link
          href="/admin/event-candidates"
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-text-base"
        >
          <ArrowLeft className="h-3 w-3" />
          候選活動列表
        </Link>
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 px-4 py-4 flex items-start gap-3">
          <Lock className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-semibold text-amber-300">需要管理員登入</p>
            <p className="text-xs text-amber-300/70">此頁面僅限已驗證管理員使用。</p>
            <Link
              href="/admin/login"
              className="self-start text-xs font-semibold text-amber-300 underline underline-offset-2"
            >
              前往管理員登入 →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0 pt-12 pb-6">
      {/* Header */}
      <div className="px-4 mb-4">
        <Link
          href="/admin/event-candidates"
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-text-base mb-3"
        >
          <ArrowLeft className="h-3 w-3" />
          候選活動列表
        </Link>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-violet" />
          <h1 className="text-xl font-bold text-text-base">AI 解析公告</h1>
        </div>
        <p className="text-xs text-muted mt-1">
          貼上一段公告，AI 解析後預覽，確認再寫入候選池
        </p>
      </div>

      {/* Info banner */}
      <div className="px-4 mb-4">
        <div className="rounded-xl bg-violet/10 border border-violet/25 px-3 py-2.5">
          <p className="text-xs text-muted leading-snug">
            AI 只負責「猜」欄位 — 結果一律存為{' '}
            <span className="font-semibold text-text-base">pending</span> 候選，
            不會自動 Approve、不會建立活動、也不會發布到前台。
          </p>
        </div>
      </div>

      {/* Client form */}
      <div className="px-4">
        <ParseClient />
      </div>
    </div>
  )
}

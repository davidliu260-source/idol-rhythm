export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { ArrowLeft, UserPlus, Lock } from 'lucide-react'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'
import NewIdolForm from './NewIdolForm'

export default async function AdminNewIdolPage() {
  const { isAdmin } = await getCurrentAdmin()

  if (!isAdmin) {
    return (
      <div className="flex flex-col pt-12 pb-6 px-4 gap-4">
        <Link
          href="/admin/idols"
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-text-base"
        >
          <ArrowLeft className="h-3 w-3" />
          Idols 列表
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
          href="/admin/idols"
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-text-base mb-3"
        >
          <ArrowLeft className="h-3 w-3" />
          Idols 列表
        </Link>
        <div className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-violet" />
          <h1 className="text-xl font-bold text-text-base">新增偶像</h1>
        </div>
        <p className="text-xs text-muted mt-1">建立後即可在活動新增表單中選用此偶像</p>
      </div>

      {/* Slug warning banner */}
      <div className="px-4 mb-4">
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 px-3 py-2.5">
          <p className="text-xs text-amber-300/90 leading-snug">
            <span className="font-semibold">Slug 建立後暫不支援修改</span>，將作為前台路由路徑（/idols/[slug]）。請確認格式正確再送出。
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="px-4">
        <NewIdolForm />
      </div>
    </div>
  )
}

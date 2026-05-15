export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { ArrowLeft, FilePlus, Lock } from 'lucide-react'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import NewEventForm from './NewEventForm'

async function getIdolsForForm(): Promise<{ id: string; name: string }[]> {
  const supabase = getSupabaseServerClient()
  if (!supabase) return []
  const { data } = await supabase
    .from('idols')
    .select('id, name')
    .eq('is_active', true)
    .order('name')
  return (data ?? []) as { id: string; name: string }[]
}

export default async function AdminNewEventPage() {
  const [{ isAdmin }, idols] = await Promise.all([
    getCurrentAdmin(),
    getIdolsForForm(),
  ])

  if (!isAdmin) {
    return (
      <div className="flex flex-col pt-12 pb-6 px-4 gap-4">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-text-base"
        >
          <ArrowLeft className="h-3 w-3" />
          Admin Dashboard
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
          href="/admin/events"
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-text-base mb-3"
        >
          <ArrowLeft className="h-3 w-3" />
          後台活動列表
        </Link>
        <div className="flex items-center gap-2">
          <FilePlus className="h-5 w-5 text-violet" />
          <h1 className="text-xl font-bold text-text-base">新增草稿活動</h1>
        </div>
        <p className="text-xs text-muted mt-1">預設不公開，送出後仍不會出現在前台</p>
      </div>

      {/* Warning banner */}
      <div className="px-4 mb-4">
        <div className="rounded-xl bg-violet/10 border border-violet/25 px-3 py-2.5">
          <p className="text-xs text-muted leading-snug">
            建立後 <span className="font-semibold text-text-base">is_published = false</span>，需管理員手動發布才會出現在前台。trust_level 只能選 official 或 media。
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="px-4">
        <NewEventForm idols={idols} />
      </div>
    </div>
  )
}

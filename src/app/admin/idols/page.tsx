export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { ArrowLeft, Users, UserPlus, ChevronRight } from 'lucide-react'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminIdol {
  id: string
  slug: string
  name: string
  korean_name: string | null
  type: string | null
  category: string | null
  agency: string | null
  is_active: boolean
}

// ── Data fetcher ──────────────────────────────────────────────────────────────

async function getAdminIdols(): Promise<{ idols: AdminIdol[]; error: string | null }> {
  const supabase = getSupabaseServerClient()
  if (!supabase) {
    return {
      idols: [],
      error: 'Supabase 環境變數未設定',
    }
  }

  const { data, error } = await supabase
    .from('idols')
    .select('id, slug, name, korean_name, type, category, agency, is_active')
    .order('name')

  if (error) {
    return {
      idols: [],
      error: `查詢偶像失敗：${error.code ? `[${error.code}] ` : ''}${error.message}`,
    }
  }

  return { idols: (data ?? []) as AdminIdol[], error: null }
}

// ── Page ──────────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  kpop: 'K-Pop', cpop: 'C-Pop', jpop: 'J-Pop', idol: 'Idol', other: 'Other',
}

export default async function AdminIdolsPage() {
  const [{ isAdmin }, { idols, error }] = await Promise.all([
    getCurrentAdmin(),
    getAdminIdols(),
  ])

  const activeCount   = idols.filter((i) => i.is_active).length
  const inactiveCount = idols.filter((i) => !i.is_active).length

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
          <Users className="h-5 w-5 text-violet" />
          <h1 className="text-xl font-bold text-text-base">後台偶像列表</h1>
        </div>
        <p className="text-xs text-muted mt-1">
          共 {idols.length} 筆
          {idols.length > 0 && (
            <span className="ml-1">
              （<span className="text-emerald-400">{activeCount} 啟用</span>
              {inactiveCount > 0 && (
                <>{' / '}<span className="text-muted/60">{inactiveCount} 停用</span></>
              )}）
            </span>
          )}
        </p>
      </div>

      {/* New idol button / read-only banner */}
      <div className="px-4 mb-4">
        {isAdmin ? (
          <Link
            href="/admin/idols/new"
            className="flex items-center gap-2 rounded-xl bg-violet/15 border border-violet/30 px-3 py-2.5 hover:bg-violet/20 transition-colors"
          >
            <UserPlus className="h-4 w-4 text-violet flex-shrink-0" />
            <span className="text-xs font-semibold text-violet">新增偶像</span>
          </Link>
        ) : (
          <div className="rounded-xl bg-violet/10 border border-violet/25 px-3 py-2.5">
            <p className="text-xs text-muted leading-snug">
              只讀預覽｜新增 / 編輯需要管理員登入
            </p>
          </div>
        )}
      </div>

      {/* Query error */}
      {error && (
        <div className="px-4 mb-4">
          <div className="rounded-xl bg-red-500/10 border border-red-500/25 px-3 py-3">
            <p className="text-xs font-semibold text-red-400 mb-1">偶像列表載入失敗</p>
            <p className="text-xs text-red-400/80 break-all leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {idols.length === 0 && !error && (
        <div className="px-4">
          <div className="rounded-xl bg-card border border-card-border px-4 py-8 text-center">
            <p className="text-sm text-muted">尚無偶像資料</p>
            {isAdmin && (
              <p className="text-xs text-muted/60 mt-1">請使用上方「新增偶像」建立第一筆資料。</p>
            )}
          </div>
        </div>
      )}

      {/* Idols list */}
      <div className="px-4 flex flex-col gap-2">
        {idols.map((idol) => (
          <Link
            key={idol.id}
            href={`/admin/idols/${idol.id}`}
            className={`rounded-xl bg-card border border-card-border px-4 py-3 flex items-center gap-3 active:opacity-70 transition-opacity ${!idol.is_active ? 'opacity-50' : ''}`}
          >
            {/* Active indicator */}
            <span className={`h-2 w-2 rounded-full flex-shrink-0 ${idol.is_active ? 'bg-emerald-400' : 'bg-muted/40'}`} />

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-text-base truncate">{idol.name}</p>
                {idol.korean_name && (
                  <p className="text-xs text-muted truncate">{idol.korean_name}</p>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-[10px] text-muted font-mono">{idol.slug}</span>
                {idol.category && (
                  <span className="text-[10px] text-muted border border-card-border rounded px-1.5 py-0.5">
                    {CATEGORY_LABELS[idol.category] ?? idol.category}
                  </span>
                )}
                {idol.type && (
                  <span className="text-[10px] text-muted">
                    {idol.type === 'group' ? '團體' : '個人'}
                  </span>
                )}
                {idol.agency && (
                  <span className="text-[10px] text-muted/60 truncate">{idol.agency}</span>
                )}
              </div>
            </div>

            <ChevronRight className="h-4 w-4 text-muted flex-shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  )
}

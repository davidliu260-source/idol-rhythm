export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { ArrowLeft, FileEdit, Lock } from 'lucide-react'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'
import EditIdolForm from './EditIdolForm'

// ── Types ─────────────────────────────────────────────────────────────────────

interface IdolDetail {
  id: string
  slug: string
  name: string
  korean_name: string | null
  type: string | null
  gender: string | null
  category: string | null
  agency: string | null
  debut_date: string | null
  color: string | null
  genres: string[]
  member_count: number | null
  description: string | null
  is_active: boolean
  avatar_url: string | null
  alt_names: string[]
}

// ── Data fetcher ──────────────────────────────────────────────────────────────

async function getIdolById(id: string): Promise<IdolDetail | null> {
  const supabase = getSupabaseServerClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('idols')
    .select('id, slug, name, korean_name, type, gender, category, agency, debut_date, color, genres, member_count, description, is_active, avatar_url, alt_names')
    .eq('id', id)
    .single()

  if (error || !data) return null
  return data as IdolDetail
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminEditIdolPage({
  params,
}: {
  params: { id: string }
}) {
  const { id } = params

  const [{ isAdmin }, idol] = await Promise.all([
    getCurrentAdmin(),
    getIdolById(id),
  ])

  // Guard: non-admin
  if (!isAdmin) {
    return (
      <div className="flex flex-col pt-12 pb-6 px-4 gap-4">
        <Link
          href={`/admin/idols/${id}`}
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-text-base"
        >
          <ArrowLeft className="h-3 w-3" />
          返回偶像詳情
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

  // Guard: idol not found
  if (!idol) {
    return (
      <div className="flex flex-col gap-0 pt-12 pb-6 px-4">
        <Link
          href="/admin/idols"
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-text-base mb-6"
        >
          <ArrowLeft className="h-3 w-3" />
          返回偶像列表
        </Link>
        <div className="rounded-xl bg-card border border-card-border px-4 py-8 text-center">
          <p className="text-sm text-muted">找不到偶像</p>
          <p className="text-xs text-muted/60 mt-1">ID: {id}</p>
        </div>
      </div>
    )
  }

  // Map DB row → form initial values
  const initial = {
    slug:        idol.slug,
    name:        idol.name,
    koreanName:  idol.korean_name ?? '',
    type:        idol.type ?? 'group',
    gender:      idol.gender ?? '',
    category:    idol.category ?? '',
    agency:      idol.agency ?? '',
    debutDate:   idol.debut_date ?? '',
    color:       idol.color ?? '',
    genres:      idol.genres.join(', '),
    memberCount: idol.member_count !== null ? String(idol.member_count) : '',
    description: idol.description ?? '',
    avatarUrl:   idol.avatar_url ?? '',
    altNames:    (idol.alt_names ?? []).join('\n'),
  }

  return (
    <div className="flex flex-col gap-0 pt-12 pb-6">
      {/* Header */}
      <div className="px-4 mb-4">
        <Link
          href={`/admin/idols/${id}`}
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-text-base mb-3"
        >
          <ArrowLeft className="h-3 w-3" />
          返回偶像詳情
        </Link>
        <div className="flex items-center gap-2">
          <FileEdit className="h-5 w-5 text-violet" />
          <h1 className="text-xl font-bold text-text-base">編輯偶像資料</h1>
        </div>
        <p className="text-xs text-muted mt-1">{idol.name}</p>
      </div>

      {/* Slug warning */}
      <div className="px-4 mb-4">
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 px-3 py-2.5">
          <p className="text-xs text-amber-300/90 leading-snug">
            <span className="font-semibold">Slug 不可修改</span>，已鎖定為前台路由路徑（/idols/{idol.slug}）。
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="px-4">
        <EditIdolForm idolId={id} initial={initial} />
      </div>
    </div>
  )
}

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { ArrowLeft, User } from 'lucide-react'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'

// ── Data fetcher ──────────────────────────────────────────────────────────────

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
  created_at: string
  updated_at: string
}

async function getIdolById(id: string): Promise<IdolDetail | null> {
  const supabase = getSupabaseServerClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('idols')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) return null
  return data as IdolDetail
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

const CATEGORY_LABELS: Record<string, string> = {
  kpop: 'K-Pop', cpop: 'C-Pop', jpop: 'J-Pop', idol: 'Idol', other: 'Other',
}
const TYPE_LABELS:     Record<string, string> = { group: '團體 Group', solo: '個人 Solo' }
const GENDER_LABELS:   Record<string, string> = {
  male: '男 Male', female: '女 Female', mixed: '混合 Mixed', unknown: '不明 Unknown',
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminIdolDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const { id } = params
  const idol = await getIdolById(id)

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

  return (
    <div className="flex flex-col gap-0 pt-12 pb-6">
      {/* Header */}
      <div className="px-4 mb-4">
        <Link
          href="/admin/idols"
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-text-base mb-3"
        >
          <ArrowLeft className="h-3 w-3" />
          返回偶像列表
        </Link>
        <div className="flex items-center gap-2">
          <User className="h-5 w-5 text-violet" />
          <h1 className="text-xl font-bold text-text-base">偶像詳情</h1>
        </div>
      </div>

      {/* Status banner */}
      <div className="px-4 mb-4">
        <div className={`rounded-xl px-3 py-2.5 flex items-center gap-2 border ${
          idol.is_active
            ? 'bg-emerald-500/10 border-emerald-500/25'
            : 'bg-muted/10 border-card-border'
        }`}>
          <span className={`h-2 w-2 rounded-full flex-shrink-0 ${idol.is_active ? 'bg-emerald-400' : 'bg-muted/40'}`} />
          <p className={`text-xs font-medium ${idol.is_active ? 'text-emerald-300' : 'text-muted'}`}>
            {idol.is_active ? '已啟用（出現在前台）' : '已停用（不出現在前台）'}
          </p>
        </div>
      </div>

      {/* Read-only banner */}
      <div className="px-4 mb-4">
        <div className="rounded-xl bg-violet/10 border border-violet/25 px-3 py-2.5">
          <p className="text-xs text-muted leading-snug">只讀詳情預覽｜編輯 / 啟用 / 停用功能規劃中（Phase H3/H4）</p>
        </div>
      </div>

      {/* Detail cards */}
      <div className="px-4 flex flex-col gap-3">

        {/* Identity */}
        <div className="rounded-xl bg-card border border-card-border px-4 py-4 flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide">基本識別</p>
          <Field label="名稱">{idol.name}</Field>
          {idol.korean_name && <><Divider /><Field label="原文名稱">{idol.korean_name}</Field></>}
          <Divider />
          <Field label="Slug">
            <span className="font-mono text-xs">{idol.slug}</span>
          </Field>
        </div>

        {/* Classification */}
        <div className="rounded-xl bg-card border border-card-border px-4 py-4 flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide">分類</p>
          <Field label="組合 / 個人">{idol.type ? (TYPE_LABELS[idol.type] ?? idol.type) : '—'}</Field>
          {idol.gender && <><Divider /><Field label="性別">{GENDER_LABELS[idol.gender] ?? idol.gender}</Field></>}
          {idol.category && <><Divider /><Field label="音樂分類">{CATEGORY_LABELS[idol.category] ?? idol.category}</Field></>}
          {idol.member_count !== null && <><Divider /><Field label="成員人數">{idol.member_count} 人</Field></>}
        </div>

        {/* Details */}
        <div className="rounded-xl bg-card border border-card-border px-4 py-4 flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide">詳細資訊</p>
          <Field label="事務所">{idol.agency ?? '—'}</Field>
          {idol.debut_date && <><Divider /><Field label="出道日期">{idol.debut_date}</Field></>}
          {idol.color && (
            <>
              <Divider />
              <Field label="主色調">
                <span className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full border border-card-border flex-shrink-0"
                    style={{ backgroundColor: idol.color }}
                  />
                  <span className="font-mono text-xs">{idol.color}</span>
                </span>
              </Field>
            </>
          )}
          {idol.genres.length > 0 && (
            <>
              <Divider />
              <Field label="音樂類型">
                <div className="flex flex-wrap gap-1.5 justify-end">
                  {idol.genres.map((g) => (
                    <span key={g} className="text-[10px] border border-card-border rounded-full px-2 py-0.5 text-muted">
                      {g}
                    </span>
                  ))}
                </div>
              </Field>
            </>
          )}
          {idol.description && (
            <>
              <Divider />
              <div className="flex flex-col gap-1">
                <p className="text-xs text-muted">說明</p>
                <p className="text-xs text-text-base leading-relaxed">{idol.description}</p>
              </div>
            </>
          )}
        </div>

        {/* Timestamps */}
        <div className="rounded-xl bg-card border border-card-border px-4 py-4 flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide">時間紀錄</p>
          <Field label="建立時間">{formatDatetime(idol.created_at)}</Field>
          <Divider />
          <Field label="最後更新">{formatDatetime(idol.updated_at)}</Field>
        </div>

        {/* Idol ID */}
        <div className="rounded-xl bg-card border border-card-border px-4 py-3">
          <Field label="Idol ID">
            <span className="font-mono text-[10px] text-muted/60 break-all">{idol.id}</span>
          </Field>
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

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { ArrowLeft, Database, ChevronRight } from 'lucide-react'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'

interface SourceRow {
  id: string
  name: string
  sourceKey: string
  idolName: string | null
  sourceType: string
  parserType: string
  isActive: boolean
  lastRunAt: string | null
  lastStatus: string | null
}

async function getSources(): Promise<{
  sources: SourceRow[]
  error: string | null
}> {
  const supabase = getSupabaseServerClient()
  if (!supabase) {
    return { sources: [], error: 'Supabase 環境變數未設定' }
  }

  const { data, error } = await supabase
    .from('crawler_sources')
    .select(
      'id, name, source_key, source_type, parser_type, is_active, last_run_at, last_status, idols(name)',
    )
    .order('created_at', { ascending: true })

  if (error) {
    return {
      sources: [],
      error: `查詢資料來源失敗：${error.code ? `[${error.code}] ` : ''}${error.message}`,
    }
  }

  const sources: SourceRow[] = (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    sourceKey: row.source_key as string,
    idolName: ((row.idols as unknown) as { name: string } | null)?.name ?? null,
    sourceType: row.source_type as string,
    parserType: row.parser_type as string,
    isActive: row.is_active as boolean,
    lastRunAt: row.last_run_at as string | null,
    lastStatus: row.last_status as string | null,
  }))

  return { sources, error: null }
}

export default async function AdminSourcesPage() {
  const [{ isAdmin }, { sources, error }] = await Promise.all([
    getCurrentAdmin(),
    getSources(),
  ])

  return (
    <div className="flex flex-col gap-0 pt-12 pb-6">
      <div className="px-4 mb-4">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-text-base mb-3"
        >
          <ArrowLeft className="h-3 w-3" />
          Admin Dashboard
        </Link>
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-violet" />
          <h1 className="text-xl font-bold text-text-base">資料來源管理</h1>
        </div>
        <p className="text-xs text-muted mt-1">
          {isAdmin
            ? '管理爬蟲與外部資料來源（只讀，新增與編輯尚未開放）'
            : '需要管理員身份才能查看'}
        </p>
      </div>

      {!isAdmin && (
        <div className="px-4 mb-4">
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 px-3 py-2.5">
            <p className="text-xs text-amber-300 leading-snug">
              需要管理員身份才能查看資料來源。
              <Link
                href="/admin/login"
                className="underline underline-offset-2 ml-1 font-semibold"
              >
                前往登入 →
              </Link>
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="px-4 mb-4">
          <div className="rounded-xl bg-red-500/10 border border-red-500/25 px-3 py-3">
            <p className="text-xs font-semibold text-red-400 mb-1">
              資料來源載入失敗
            </p>
            <p className="text-xs text-red-400/80 break-all leading-relaxed">
              {error}
            </p>
          </div>
        </div>
      )}

      <div className="px-4 flex flex-col gap-2">
        {sources.length === 0 && !error && (
          <div className="rounded-xl bg-card border border-card-border px-4 py-8 text-center">
            <p className="text-sm text-muted">目前尚未建立資料來源</p>
            <p className="text-xs text-muted/60 mt-1">
              {isAdmin
                ? '執行 migration 019 後，第一筆資料來源會顯示在這裡。'
                : '請先以管理員身份登入。'}
            </p>
          </div>
        )}
        {sources.map((s) => (
          <SourceRowItem key={s.id} source={s} />
        ))}
      </div>
    </div>
  )
}

function SourceRowItem({ source }: { source: SourceRow }) {
  return (
    <Link
      href={`/admin/sources/${source.id}`}
      className="rounded-xl bg-card border border-card-border px-4 py-3 flex flex-col gap-1.5 active:opacity-70 transition-opacity"
    >
      <div className="flex items-center gap-2">
        <span
          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
            source.isActive
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-card border-card-border text-muted'
          }`}
        >
          {source.isActive ? '啟用中' : '已停用'}
        </span>
        <span className="text-[10px] text-muted ml-auto font-mono">
          {source.parserType}
        </span>
      </div>

      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-text-base leading-snug">
          {source.name}
        </p>
        <ChevronRight className="h-4 w-4 text-muted flex-shrink-0 mt-0.5" />
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted flex-wrap">
        {source.idolName && <span>{source.idolName}</span>}
        {source.idolName && <span>·</span>}
        <span>{source.sourceType}</span>
        {source.lastRunAt && (
          <span className="ml-auto text-[10px] text-muted/60 flex-shrink-0">
            上次：{source.lastRunAt.slice(0, 10)}
          </span>
        )}
      </div>
    </Link>
  )
}

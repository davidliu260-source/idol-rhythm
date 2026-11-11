export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Database, ExternalLink } from 'lucide-react'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'
import RunSourceButton from './RunSourceButton'

interface SourceDetail {
  id: string
  name: string
  sourceKey: string
  idolName: string | null
  idolSlug: string | null
  sourceUrl: string
  sourceType: string
  parserType: string
  isActive: boolean
  config: Record<string, unknown>
  lastRunAt: string | null
  lastStatus: string | null
  lastError: string | null
  createdAt: string
  updatedAt: string
}

async function getSource(id: string): Promise<SourceDetail | null> {
  const supabase = getSupabaseServerClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('crawler_sources')
    .select(
      'id, name, source_key, source_url, source_type, parser_type, is_active, config, last_run_at, last_status, last_error, created_at, updated_at, idols(name, slug)',
    )
    .eq('id', id)
    .single()

  if (error || !data) return null

  const idol = (data.idols as unknown) as { name: string; slug: string } | null

  return {
    id: data.id as string,
    name: data.name as string,
    sourceKey: data.source_key as string,
    idolName: idol?.name ?? null,
    idolSlug: idol?.slug ?? null,
    sourceUrl: data.source_url as string,
    sourceType: data.source_type as string,
    parserType: data.parser_type as string,
    isActive: data.is_active as boolean,
    config: ((data.config ?? {}) as Record<string, unknown>),
    lastRunAt: data.last_run_at as string | null,
    lastStatus: data.last_status as string | null,
    lastError: data.last_error as string | null,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  }
}

export default async function AdminSourceDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const [{ isAdmin }, source] = await Promise.all([
    getCurrentAdmin(),
    getSource(params.id),
  ])

  if (!source) notFound()

  return (
    <div className="flex flex-col gap-0 pt-12 pb-6">
      <div className="px-4 mb-4">
        <Link
          href="/admin/sources"
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-text-base mb-3"
        >
          <ArrowLeft className="h-3 w-3" />
          資料來源列表
        </Link>
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-violet" />
          <h1 className="text-xl font-bold text-text-base">{source.name}</h1>
        </div>
        <p className="text-xs text-muted mt-1 font-mono">{source.sourceKey}</p>
      </div>

      {!isAdmin && (
        <div className="px-4 mb-4">
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 px-3 py-2.5">
            <p className="text-xs text-amber-300 leading-snug">
              需要管理員身份才能查看詳情。
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

      {isAdmin && (source.isActive || source.parserType === 'generic_webpage') && (
        <div className="px-4 mb-4">
          <RunSourceButton
            parserType={source.parserType}
            sourceKey={source.sourceKey}
            sourceName={source.name}
          />
        </div>
      )}

      <div className="px-4 flex flex-col gap-3">
        <Section title="狀態">
          <Row
            label="啟用狀態"
            value={
              <span
                className={
                  source.isActive ? 'text-emerald-400' : 'text-muted'
                }
              >
                {source.isActive ? '啟用中' : '已停用'}
              </span>
            }
          />
          <Row
            label="上次執行"
            value={source.lastRunAt ? formatDateTime(source.lastRunAt) : '尚未執行'}
          />
          <Row label="上次狀態" value={formatLastStatus(source.lastStatus)} />
          {source.lastError && (
            <Row
              label="上次錯誤"
              value={
                <span className="text-red-400 break-all">{source.lastError}</span>
              }
            />
          )}
        </Section>

        <Section title="基本資料">
          <Row label="對應偶像" value={source.idolName ?? '（未指定）'} />
          <Row label="來源類型" value={source.sourceType} />
          <Row
            label="parser_type"
            value={<span className="font-mono">{source.parserType}</span>}
          />
          <Row
            label="來源網址"
            value={
              <a
                href={source.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-violet underline underline-offset-2 break-all"
              >
                {source.sourceUrl}
                <ExternalLink className="h-3 w-3 flex-shrink-0" />
              </a>
            }
          />
        </Section>

        <Section title="parser 設定 (config)">
          {Object.keys(source.config).length === 0 ? (
            <Row label="（空）" value={<span className="text-muted">尚未設定</span>} />
          ) : (
            Object.entries(source.config).map(([k, v]) => (
              <Row
                key={k}
                label={k}
                value={
                  <span className="font-mono break-all">
                    {typeof v === 'string' ? v : JSON.stringify(v)}
                  </span>
                }
              />
            ))
          )}
        </Section>

        <Section title="時間紀錄">
          <Row label="建立時間" value={formatDateTime(source.createdAt)} />
          <Row label="更新時間" value={formatDateTime(source.updatedAt)} />
          <Row label="id" value={<span className="font-mono break-all">{source.id}</span>} />
        </Section>
      </div>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl bg-card border border-card-border px-4 py-3 flex flex-col gap-2">
      <p className="text-[10px] font-semibold text-muted uppercase tracking-wide">
        {title}
      </p>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-muted flex-shrink-0 w-24">{label}</span>
      <span className="text-xs text-text-base flex-1">{value}</span>
    </div>
  )
}

function formatLastStatus(status: string | null): React.ReactNode {
  if (!status) return '尚未執行'
  switch (status) {
    case 'success':
      return <span className="text-emerald-400">成功</span>
    case 'partial_error':
      return <span className="text-amber-400">部分錯誤</span>
    case 'error':
      return <span className="text-red-400">失敗</span>
    case 'skipped':
      return <span className="text-muted">略過（來源停用）</span>
    default:
      return <span className="font-mono">{status}</span>
  }
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

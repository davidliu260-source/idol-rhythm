'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Loader2 } from 'lucide-react'

interface CrawlerResponse {
  ok: boolean
  summary?: {
    totalSources: number
    successCount: number
    errorCount: number
    totalFetched: number
    totalInserted: number
    totalSkipped: number
    totalRecheck: number
  }
  results?: Array<{
    sourceName: string | null
    sourceKey: string | null
    fetched: number
    inserted: number
    skipped: number
    recheck: number
    errors: string[]
  }>
  error?: string
}

/**
 * Admin-only button that triggers the active crawler-source fan-out.
 * Shows a Chinese summary of fetched / inserted / skipped / errors and
 * refreshes the route so the new candidates appear in the list.
 */
export default function CrawlerButton() {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<CrawlerResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleRun() {
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/admin/crawlers/sync-all/run', {
        method: 'POST',
      })
      const body = (await res.json()) as CrawlerResponse
      setResult(body)
      if ((body.summary?.totalInserted ?? 0) > 0) {
        // Refresh the server component so new rows appear.
        router.refresh()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleRun}
        disabled={running}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet/40 bg-violet/10 px-3 py-2.5 text-xs font-semibold text-violet-200 disabled:opacity-60 active:opacity-80 transition-opacity"
      >
        {running ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
        {running ? '同步中…' : '手動同步所有資料來源'}
      </button>

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/25 px-3 py-2">
          <p className="text-xs text-red-400 break-all leading-relaxed">
            執行失敗：{error}
          </p>
        </div>
      )}

      {result && (
        <div
          className={`rounded-xl border px-3 py-2 ${
            result.ok
              ? 'bg-emerald-500/10 border-emerald-500/25'
              : 'bg-amber-500/10 border-amber-500/25'
            }`}
        >
          {result.summary ? (
            <>
              <p
                className={`text-xs font-semibold mb-1 ${
                  result.ok ? 'text-emerald-300' : 'text-amber-300'
                }`}
              >
                跑完 {result.summary.totalSources} 個來源，成功{' '}
                {result.summary.successCount} 個，錯誤{' '}
                {result.summary.errorCount} 個；抓到{' '}
                {result.summary.totalFetched} 筆，新增{' '}
                {result.summary.totalInserted} 筆，略過{' '}
                {result.summary.totalSkipped} 筆，需重審{' '}
                {result.summary.totalRecheck} 筆
              </p>
              {(result.results ?? [])
                .filter((r) => r.errors.length > 0)
                .map((r) => (
                  <div
                    key={r.sourceKey ?? r.sourceName ?? 'unknown'}
                    className="text-[10px] text-amber-300/80 leading-relaxed break-all mt-1"
                  >
                    {r.sourceName ?? r.sourceKey ?? '未知來源'}：{r.errors.join('；')}
                  </div>
                ))}
            </>
          ) : (
            <p className="text-xs font-semibold mb-1 text-amber-300">
              {result.error ?? '同步失敗'}
            </p>
          )}
          {(result.summary?.totalInserted ?? 0) > 0 && (
            <p className="text-[10px] text-muted mt-1">
              新候選已加入下方列表（review_status = pending）。
            </p>
          )}
        </div>
      )}
    </div>
  )
}

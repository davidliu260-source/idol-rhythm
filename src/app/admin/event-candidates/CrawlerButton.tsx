'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Loader2 } from 'lucide-react'

interface CrawlerResponse {
  ok: boolean
  source: string
  fetched: number
  inserted: number
  skipped: number
  errors: string[]
}

/**
 * Admin-only button that triggers the BLACKPINK official tour fetcher.
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
      const res = await fetch('/api/admin/crawlers/blackpink-tour/run', {
        method: 'POST',
      })
      const body = (await res.json()) as CrawlerResponse
      setResult(body)
      if (body.inserted > 0) {
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
        {running ? '抓取中…' : '抓取 BLACKPINK 官方巡演'}
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
          <p
            className={`text-xs font-semibold mb-1 ${
              result.ok ? 'text-emerald-300' : 'text-amber-300'
            }`}
          >
            抓到 {result.fetched} 筆，新增 {result.inserted} 筆，略過{' '}
            {result.skipped} 筆，錯誤 {result.errors.length} 筆
          </p>
          {result.errors.length > 0 && (
            <ul className="text-[10px] text-amber-300/80 leading-relaxed list-disc list-inside space-y-0.5">
              {result.errors.map((msg, i) => (
                <li key={i} className="break-all">
                  {msg}
                </li>
              ))}
            </ul>
          )}
          {result.inserted > 0 && (
            <p className="text-[10px] text-muted mt-1">
              新候選已加入下方列表（review_status = pending）。
            </p>
          )}
        </div>
      )}
    </div>
  )
}

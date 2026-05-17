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

interface RunPlan {
  endpoint: string
  /** Optional JSON body for the POST (used by platform-level runners). */
  body?: Record<string, unknown>
}

/**
 * Maps a source row to the API endpoint + body used to run it.
 *
 * Platform-level parsers (jyp_schedule, …) share one route and pass the
 * source_key in the body — adding a new artist on an existing platform
 * never needs a new endpoint. Artist-specific parsers
 * (blackpink_official_tour, …) still have their own route until they get
 * platformised.
 *
 * Returning null hides the run button entirely.
 */
function planForSource(
  parserType: string,
  sourceKey: string,
): RunPlan | null {
  switch (parserType) {
    case 'jyp_schedule':
      return {
        endpoint: '/api/admin/crawlers/jyp-schedule/run',
        body: { sourceKey },
      }
    case 'blackpink_official_tour':
      return { endpoint: '/api/admin/crawlers/blackpink-tour/run' }
    default:
      return null
  }
}

/**
 * Admin-only manual-run trigger on /admin/sources/[id].
 *
 * Dispatches to a per-platform run endpoint based on `parserType` and
 * forwards `sourceKey` for platform-level runners. Hidden when the parser
 * has no wired runner.
 */
export default function RunSourceButton({
  parserType,
  sourceKey,
  sourceName,
}: {
  parserType: string
  sourceKey: string
  sourceName: string
}) {
  const plan = planForSource(parserType, sourceKey)
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<CrawlerResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!plan) return null

  async function handleRun() {
    if (!plan) return
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const init: RequestInit = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }
      if (plan.body) init.body = JSON.stringify(plan.body)
      const res = await fetch(plan.endpoint, init)
      const body = (await res.json()) as CrawlerResponse
      setResult(body)
      router.refresh()
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
        {running ? '抓取中…' : `手動執行：${sourceName}`}
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
              新候選已加入 /admin/event-candidates（review_status = pending）。
            </p>
          )}
        </div>
      )}
    </div>
  )
}

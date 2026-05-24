'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Database, Download, Loader2 } from 'lucide-react'

interface CrawlerResponse {
  ok: boolean
  source: string
  /** Standard crawlers: number of rows fetched from the upstream source.
   *  generic_webpage preview: not used (omitted). */
  fetched?: number
  /** Standard crawlers: rows inserted into event_candidates.
   *  generic_webpage preview: not used (omitted; P1-B1 never writes).
   *  generic_webpage commit: derived from summary.inserted. */
  inserted?: number
  /** Standard crawlers: rows skipped due to dedupe / non-event filter.
   *  generic_webpage preview: not used. */
  skipped?: number
  errors: string[]
  /** generic_webpage preview only: number of candidate events Claude proposed. */
  previewEvents?: number
  /** generic_webpage preview only: page relevance verdict. */
  pageRelevance?: 'high' | 'medium' | 'low' | 'none' | null
  /** generic_webpage commit only: structured commit summary. */
  commitSummary?: {
    candidatesFromClaude: number
    inserted: number
    deduped: number
    skippedLowConfidence: number
    skippedUnsupportedType: number
    skippedPageRelevanceNone: number
  }
  /** generic_webpage commit only: human-readable warnings (date missing, too-many, etc.). */
  warnings?: string[]
  /** Marks which mode produced this response — gates the display logic. */
  mode?: 'preview' | 'commit' | null
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
    case 'kpopofficial_concerts':
      return {
        endpoint: '/api/admin/crawlers/kpopofficial-concerts/run',
        body: { sourceKey },
      }
    case 'yg_artist_schedule':
      return {
        endpoint: '/api/admin/crawlers/yg-artist-schedule/run',
        body: { sourceKey },
      }
    case 'generic_webpage':
      // P1-B1 preview body. Commit is a separate handler (handleCommit) that
      // sends mode='commit' + confirmCommit=true to the SAME endpoint.
      return {
        endpoint: '/api/admin/crawlers/generic-webpage/run',
        body: { sourceKey, mode: 'preview' },
      }
    default:
      return null
  }
}

function normaliseResponse(raw: Record<string, unknown>): CrawlerResponse {
  // generic_webpage preview returns events + pageRelevance + pageTitle.
  // generic_webpage commit returns summary + warnings (no events array).
  // Other crawlers return {fetched, inserted, skipped}.
  // Normalise into one CrawlerResponse so display logic can branch cleanly.
  const body: CrawlerResponse = {
    ok: raw.ok === true,
    source: typeof raw.source === 'string' ? raw.source : 'unknown',
    errors: Array.isArray(raw.errors)
      ? (raw.errors as unknown[]).filter(
          (x): x is string => typeof x === 'string',
        )
      : [],
  }
  if (raw.mode === 'preview' || raw.mode === 'commit') body.mode = raw.mode
  if (typeof raw.fetched === 'number') body.fetched = raw.fetched
  if (typeof raw.inserted === 'number') body.inserted = raw.inserted
  if (typeof raw.skipped === 'number') body.skipped = raw.skipped
  if (Array.isArray(raw.events)) {
    body.previewEvents = (raw.events as unknown[]).length
  }
  if (
    raw.pageRelevance === 'high' ||
    raw.pageRelevance === 'medium' ||
    raw.pageRelevance === 'low' ||
    raw.pageRelevance === 'none' ||
    raw.pageRelevance === null
  ) {
    body.pageRelevance = raw.pageRelevance
  }
  if (Array.isArray(raw.warnings)) {
    body.warnings = (raw.warnings as unknown[]).filter(
      (x): x is string => typeof x === 'string',
    )
  }
  if (raw.summary && typeof raw.summary === 'object') {
    const s = raw.summary as Record<string, unknown>
    const num = (v: unknown) => (typeof v === 'number' ? v : 0)
    body.commitSummary = {
      candidatesFromClaude: num(s.candidatesFromClaude),
      inserted: num(s.inserted),
      deduped: num(s.deduped),
      skippedLowConfidence: num(s.skippedLowConfidence),
      skippedUnsupportedType: num(s.skippedUnsupportedType),
      skippedPageRelevanceNone: num(s.skippedPageRelevanceNone),
    }
    body.inserted = body.commitSummary.inserted
  }
  return body
}

/**
 * Admin-only manual-run trigger on /admin/sources/[id].
 *
 * Dispatches to a per-platform run endpoint based on `parserType` and
 * forwards `sourceKey` for platform-level runners. Hidden when the parser
 * has no wired runner.
 *
 * For `generic_webpage` only: renders a second "Commit" button (amber) next
 * to Preview. Commit sends `{mode:'commit', confirmCommit:true}` to the same
 * endpoint and triggers a `window.confirm` dialog first. Preview behaviour is
 * unchanged — preview NEVER writes to event_candidates.
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
  const [committing, setCommitting] = useState(false)
  const [result, setResult] = useState<CrawlerResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!plan) return null

  const isGenericWebpage = parserType === 'generic_webpage'

  // Commit gate: only allow Commit when the most recent run was a SUCCESSFUL
  // preview with zero errors. Forces admin to inspect preview output before
  // any DB write. After a commit (or after switching sources / hard refresh /
  // a failed preview) the gate closes again and the admin must re-preview.
  const commitGateOpen =
    isGenericWebpage &&
    result !== null &&
    result.mode === 'preview' &&
    result.ok &&
    result.errors.length === 0

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
      const raw = (await res.json()) as Record<string, unknown>
      setResult(normaliseResponse(raw))
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }

  async function handleCommit() {
    if (!plan) return
    // Two-step confirmation — irreversible DB write (modulo dedupe).
    if (typeof window === 'undefined') return
    const confirmed = window.confirm(
      [
        `即將 commit：${sourceName}`,
        '',
        '請先確認上方 Preview 結果（pageRelevance / events 內容）正確。',
        '',
        '本次 commit 規則：',
        '・最多寫入 3 筆候選（超過會整批拒寫）',
        '・只寫入 event_candidates，review_status=pending',
        '・需於 /admin/event-candidates 人工審核才會發布',
        '・重複資料（source_hash 相同）會自動 dedupe，不會重複寫入',
        '',
        '確認執行？',
      ].join('\n'),
    )
    if (!confirmed) return
    setCommitting(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch(plan.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceKey,
          mode: 'commit',
          confirmCommit: true,
        }),
      })
      const raw = (await res.json()) as Record<string, unknown>
      setResult(normaliseResponse(raw))
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setCommitting(false)
    }
  }

  const anyBusy = running || committing

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={handleRun}
          disabled={anyBusy}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-violet/40 bg-violet/10 px-3 py-2.5 text-xs font-semibold text-violet-200 disabled:opacity-60 active:opacity-80 transition-opacity"
        >
          {running ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          {running
            ? '抓取中…'
            : isGenericWebpage
              ? `Preview：${sourceName}`
              : `手動執行：${sourceName}`}
        </button>

        {isGenericWebpage && (
          <button
            type="button"
            onClick={handleCommit}
            disabled={anyBusy || !commitGateOpen}
            title={
              commitGateOpen
                ? '把目前 Preview 結果寫入 event_candidates（review_status=pending）'
                : '請先成功跑一次 Preview（無錯誤）才能寫入候選'
            }
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs font-semibold text-amber-200 disabled:opacity-50 disabled:cursor-not-allowed active:opacity-80 transition-opacity"
          >
            {committing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Database className="h-3.5 w-3.5" />
            )}
            {committing ? '寫入中…' : `寫入候選：${sourceName}`}
          </button>
        )}
      </div>

      {isGenericWebpage && !commitGateOpen && (
        <p className="text-[10px] text-muted leading-relaxed">
          ※ Commit 按鈕需先成功執行 Preview（且無錯誤）才會開放。
        </p>
      )}

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
            {result.mode === 'commit' && result.commitSummary ? (
              <>
                Commit：插入 {result.commitSummary.inserted} 筆（去重{' '}
                {result.commitSummary.deduped}，低 confidence 略過{' '}
                {result.commitSummary.skippedLowConfidence}，型別不支援略過{' '}
                {result.commitSummary.skippedUnsupportedType}
                {result.commitSummary.skippedPageRelevanceNone > 0
                  ? `，pageRelevance=none 略過 ${result.commitSummary.skippedPageRelevanceNone}`
                  : ''}
                ），錯誤 {result.errors.length} 筆
              </>
            ) : result.previewEvents !== undefined ? (
              <>
                Preview：pageRelevance={result.pageRelevance ?? '—'}，
                {result.previewEvents} events 建議，
                錯誤 {result.errors.length} 筆
              </>
            ) : (
              <>
                抓到 {result.fetched ?? 0} 筆，新增 {result.inserted ?? 0} 筆，
                略過 {result.skipped ?? 0} 筆，
                錯誤 {result.errors.length} 筆
              </>
            )}
          </p>
          {result.warnings && result.warnings.length > 0 && (
            <ul className="text-[10px] text-amber-300/80 leading-relaxed list-disc list-inside space-y-0.5 mb-1">
              {result.warnings.map((msg, i) => (
                <li key={`w-${i}`} className="break-all">
                  ⚠ {msg}
                </li>
              ))}
            </ul>
          )}
          {result.errors.length > 0 && (
            <ul className="text-[10px] text-amber-300/80 leading-relaxed list-disc list-inside space-y-0.5">
              {result.errors.map((msg, i) => (
                <li key={`e-${i}`} className="break-all">
                  {msg}
                </li>
              ))}
            </ul>
          )}
          {(result.inserted ?? 0) > 0 && (
            <p className="text-[10px] text-muted mt-1">
              新候選已加入 /admin/event-candidates（review_status = pending）。
            </p>
          )}
          {result.mode === 'preview' && result.previewEvents !== undefined && (
            <p className="text-[10px] text-muted mt-1">
              Preview only：未寫入 event_candidates。完整 JSON 請看
              Network panel 或瀏覽器 console。
            </p>
          )}
        </div>
      )}
    </div>
  )
}

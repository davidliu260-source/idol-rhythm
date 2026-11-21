'use client'

import { useState } from 'react'
import type { TranslationSummary, previewPublishedBackfill } from '@/lib/ai/autoTranslate'
import { previewBackfill, runBackfill } from './backfillActions'

const buttonClass = 'rounded-lg border border-violet-500/30 px-3 py-2 text-xs font-semibold text-text-base disabled:opacity-50'

export default function BackfillTranslation() {
  const [busy, setBusy] = useState<'preview' | 'run' | null>(null)
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewPublishedBackfill>> | null>(null)
  const [summary, setSummary] = useState<TranslationSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadPreview() {
    setBusy('preview')
    setError(null)
    setPreview(null)
    setSummary(null)
    try {
      const result = await previewBackfill()
      if (result.ok) setPreview(result.preview)
      else setError(result.error)
    } catch {
      setError('無法載入補翻預覽，請再試一次')
    } finally {
      setBusy(null)
    }
  }

  async function execute() {
    setBusy('run')
    setError(null)
    try {
      const result = await runBackfill()
      if (result.ok) {
        setSummary(result.summary)
        setPreview(null)
      } else {
        setError(result.error)
      }
    } catch {
      setError('未收到補翻結果，請重新預覽確認剩餘筆數')
      setPreview(null)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="mx-4 mb-4 flex flex-col gap-2 rounded-xl border border-card-border bg-card p-3">
      <h2 className="text-sm font-semibold text-text-base">補翻已上架</h2>
      <p className="text-xs text-muted">分批翻譯尚未結束且沒有中文顯示的活動。</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass} disabled={busy !== null} onClick={loadPreview}>
          {busy === 'preview' ? '預覽中…' : '預覽補翻'}
        </button>
        {preview && preview.batchCount > 0 && (
          <button type="button" className={buttonClass} disabled={busy !== null} onClick={execute}>
            {busy === 'run' ? '補翻中…' : `執行補翻（最多 ${preview.batchCount} 筆）`}
          </button>
        )}
      </div>
      <div className="space-y-1 text-xs text-muted" aria-live="polite">
        {preview && (
          <>
            <p>符合條件 {preview.eligible} 筆，本批最多 {preview.batchCount} 筆。</p>
            <p>費用估算（美元）典型 US${preview.estimatedTypicalUsd.toFixed(4)}，保守 US${preview.estimatedConservativeUsd.toFixed(4)}。</p>
            <p>已達失敗上限 {preview.exhausted} 筆，請到單筆活動頁手動重試。</p>
          </>
        )}
        {summary && (
          <>
            <p>成功 {summary.translated} 筆、跳過 {summary.skipped} 筆、失敗 {summary.failed} 筆。</p>
            {summary.stoppedBy === 'time' && <p>已達時間上限，可重新預覽下一批。</p>}
            {summary.stoppedBy === 'config' && <p>翻譯設定有誤，本批已停止。</p>}
            {summary.stoppedBy === 'api' && <p>連續三次 AI 呼叫失敗，本批已停止。</p>}
            {summary.failures.length > 0 && (
              <ul className="space-y-1">
                {summary.failures.map(({ eventId, step, message }) => (
                  <li key={eventId}>
                    <a className="underline" href={`/admin/events/${eventId}`}>{eventId}</a>
                    {' '}（{step}）{message}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        {error && <p className="text-red-400">{error}</p>}
      </div>
    </section>
  )
}

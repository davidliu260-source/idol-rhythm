'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { createCandidate } from './actions'

const EVENT_TYPE_OPTIONS = [
  { value: '', label: '（不選 / 未確定）' },
  { value: 'concert', label: '演唱會 / 見面會' },
  { value: 'ticketing', label: '開票售票' },
  { value: 'livestream', label: '直播' },
  { value: 'streaming', label: '串流' },
  { value: 'media', label: '媒體' },
  { value: 'brand', label: '代言品牌' },
  { value: 'official', label: '官方發布' },
]

const SOURCE_TYPE_OPTIONS = [
  { value: 'official_sns', label: '官方 SNS' },
  { value: 'official_website', label: '官方網站' },
  { value: 'media_outlet', label: '媒體報導' },
  { value: 'fan_account', label: '粉絲帳號' },
  { value: 'community', label: '社群討論' },
  { value: 'unknown', label: '不明' },
]

const inputCls =
  'w-full rounded-xl border border-card-border bg-bg px-3 py-2.5 text-sm text-text-base placeholder:text-muted/40 focus:outline-none focus:border-violet/60 transition-colors'

const selectCls = inputCls + ' cursor-pointer'

const labelCls = 'flex flex-col gap-1.5'
const labelTextCls = 'text-xs font-semibold text-text-base'
const labelHintCls = 'text-[10px] text-muted'

export default function NewCandidateForm({
  idols,
}: {
  idols: { id: string; name: string }[]
}) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [rawTitle, setRawTitle] = useState('')
  const [rawContent, setRawContent] = useState('')
  const [detectedIdolId, setDetectedIdolId] = useState('')
  const [detectedEventType, setDetectedEventType] = useState('')
  const [detectedDate, setDetectedDate] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [sourceName, setSourceName] = useState('')
  const [sourceType, setSourceType] = useState('official_website')
  const [aiConfidence, setAiConfidence] = useState('')
  const [reviewerNote, setReviewerNote] = useState('manual import')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const result = await createCandidate({
      rawTitle,
      rawContent,
      detectedIdolId,
      detectedEventType,
      detectedDate,
      sourceUrl,
      sourceName,
      sourceType,
      aiConfidence,
      reviewerNote,
    })

    // On success, the server action calls redirect() which throws — we never
    // reach this line. If we do, an error string is present.
    if (result?.error) {
      setError(result.error)
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Error banner */}
      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/25 px-3 py-2.5">
          <p className="text-xs font-semibold text-red-400 mb-0.5">送出失敗</p>
          <p className="text-xs text-red-400/80 break-all leading-relaxed">{error}</p>
        </div>
      )}

      {/* raw_title — required */}
      <label className={labelCls}>
        <span className={labelTextCls}>
          標題 <span className="text-rose-400">*</span>
        </span>
        <input
          type="text"
          required
          value={rawTitle}
          onChange={(e) => setRawTitle(e.target.value)}
          placeholder="例：BLACKPINK 2026 World Tour 香港站開票"
          className={inputCls}
        />
      </label>

      {/* raw_content */}
      <label className={labelCls}>
        <span className={labelTextCls}>內文 / 摘要</span>
        <span className={labelHintCls}>原始公告內容，可直接貼上</span>
        <textarea
          value={rawContent}
          onChange={(e) => setRawContent(e.target.value)}
          rows={4}
          placeholder="貼上來源公告全文或重點摘要"
          className={inputCls + ' resize-y min-h-[88px]'}
        />
      </label>

      {/* detected_idol_id */}
      <label className={labelCls}>
        <span className={labelTextCls}>對應偶像</span>
        <span className={labelHintCls}>
          可留空。留空後此候選需先補對應偶像才能 Approve。
        </span>
        <select
          value={detectedIdolId}
          onChange={(e) => setDetectedIdolId(e.target.value)}
          className={selectCls}
        >
          <option value="">（尚未對應 idol）</option>
          {idols.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </label>

      {/* detected_event_type */}
      <label className={labelCls}>
        <span className={labelTextCls}>活動類型</span>
        <select
          value={detectedEventType}
          onChange={(e) => setDetectedEventType(e.target.value)}
          className={selectCls}
        >
          {EVENT_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      {/* detected_date */}
      <label className={labelCls}>
        <span className={labelTextCls}>日期</span>
        <span className={labelHintCls}>YYYY-MM-DD；不確定可留空</span>
        <input
          type="date"
          value={detectedDate}
          onChange={(e) => setDetectedDate(e.target.value)}
          className={inputCls}
        />
      </label>

      {/* source_name — required */}
      <label className={labelCls}>
        <span className={labelTextCls}>
          來源名稱 <span className="text-rose-400">*</span>
        </span>
        <span className={labelHintCls}>例：HYBE 官方公告、Mnet 新聞</span>
        <input
          type="text"
          required
          value={sourceName}
          onChange={(e) => setSourceName(e.target.value)}
          placeholder="HYBE 官方公告"
          className={inputCls}
        />
      </label>

      {/* source_type — required */}
      <label className={labelCls}>
        <span className={labelTextCls}>
          來源類型 <span className="text-rose-400">*</span>
        </span>
        <select
          required
          value={sourceType}
          onChange={(e) => setSourceType(e.target.value)}
          className={selectCls}
        >
          {SOURCE_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      {/* source_url */}
      <label className={labelCls}>
        <span className={labelTextCls}>來源網址</span>
        <input
          type="url"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          placeholder="https://..."
          className={inputCls}
        />
      </label>

      {/* ai_confidence */}
      <label className={labelCls}>
        <span className={labelTextCls}>信心值（0–1）</span>
        <span className={labelHintCls}>
          手動匯入可留空；非 AI 產生時不必填入假數值。
        </span>
        <input
          type="number"
          step="0.01"
          min="0"
          max="1"
          value={aiConfidence}
          onChange={(e) => setAiConfidence(e.target.value)}
          placeholder="留空"
          className={inputCls}
        />
      </label>

      {/* reviewer_note */}
      <label className={labelCls}>
        <span className={labelTextCls}>備註</span>
        <span className={labelHintCls}>建議標示 manual import 以便日後辨識</span>
        <input
          type="text"
          value={reviewerNote}
          onChange={(e) => setReviewerNote(e.target.value)}
          className={inputCls}
        />
      </label>

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-violet px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 active:opacity-80 transition-opacity"
      >
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitting ? '送出中…' : '建立候選'}
      </button>

      <p className="text-[10px] text-muted leading-relaxed mt-1">
        建立後 review_status = pending，approved_event_id 為空。仍需走既有
        Approve / Reject 流程；Approve 後產生的 event 仍是 draft，前台不會看到。
      </p>
    </form>
  )
}

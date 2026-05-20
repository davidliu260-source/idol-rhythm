'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { getReviewSourceInfo } from '@/lib/admin/sourceReview'
import { updateDraftEvent } from './actions'

// ── Option lists (same as NewEventForm) ──────────────────────────────────────

const EVENT_TYPE_OPTIONS = [
  { value: 'concert',    label: '演唱會 / 見面會' },
  { value: 'ticketing',  label: '開票售票' },
  { value: 'livestream', label: '直播' },
  { value: 'streaming',  label: '串流' },
  { value: 'media',      label: '媒體' },
  { value: 'brand',      label: '代言品牌' },
  { value: 'official',   label: '官方發布' },
]

const EVENT_SUBTYPE_OPTIONS = [
  { value: '',             label: '（不選）' },
  { value: 'fanmeet',     label: '粉絲見面' },
  { value: 'fansign',     label: '簽名會' },
  { value: 'musicshow',   label: '音樂節目' },
  { value: 'variety',     label: '綜藝節目' },
  { value: 'interview',   label: '採訪宣傳' },
  { value: 'award',       label: '頒獎典禮' },
  { value: 'release',     label: '專輯發行' },
  { value: 'announcement', label: '官方公告' },
  { value: 'magazine',    label: '雜誌媒體' },
]

const SOURCE_TYPE_OPTIONS = [
  { value: 'official_sns',     label: '官方 SNS' },
  { value: 'official_website', label: '官方網站' },
  { value: 'media_outlet',     label: '媒體報導' },
  { value: 'fan_account',      label: '粉絲帳號' },
  { value: 'community',        label: '社群討論' },
  { value: 'unknown',          label: '不明' },
]

// ── Prop types ────────────────────────────────────────────────────────────────

export interface EditEventFormProps {
  eventId: string
  idols: { id: string; name: string }[]
  initial: {
    idolId: string
    title: string
    type: string
    subType: string
    status: string
    date: string
    time: string
    country: string
    countryFlag: string
    location: string
    description: string
    tags: string        // comma-separated string for display
    ticketUrl: string
    streamUrl: string
    sourceLabel: string
    sourceType: string
    sourceUrl: string
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-xl border border-card-border bg-bg px-3 py-2.5 text-sm text-text-base placeholder:text-muted/40 focus:outline-none focus:border-violet/60 transition-colors'

const selectCls = inputCls + ' cursor-pointer'

// ── Component ─────────────────────────────────────────────────────────────────

export default function EditEventForm({ eventId, idols, initial }: EditEventFormProps) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)

  // Form state — initialized from existing event data
  const [idolId,       setIdolId]       = useState(initial.idolId)
  const [title,        setTitle]        = useState(initial.title)
  const [type,         setType]         = useState(initial.type)
  const [subType,      setSubType]      = useState(initial.subType)
  const [status,       setStatus]       = useState(initial.status)
  const [date,         setDate]         = useState(initial.date)
  const [time,         setTime]         = useState(initial.time)
  const [country,      setCountry]      = useState(initial.country)
  const [countryFlag,  setCountryFlag]  = useState(initial.countryFlag)
  const [location,     setLocation]     = useState(initial.location)
  const [description,  setDescription]  = useState(initial.description)
  const [tags,         setTags]         = useState(initial.tags)
  const [ticketUrl,    setTicketUrl]    = useState(initial.ticketUrl)
  const [streamUrl,    setStreamUrl]    = useState(initial.streamUrl)
  const [sourceLabel,  setSourceLabel]  = useState(initial.sourceLabel)
  const [sourceType,   setSourceType]   = useState(initial.sourceType || 'official_sns')
  const [sourceUrl,    setSourceUrl]    = useState(initial.sourceUrl)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const idol = idols.find((i) => i.id === idolId)
    if (!idol) {
      setError('請選擇偶像')
      setSubmitting(false)
      return
    }

    const tagArray = tags
      ? tags.split(',').map((t) => t.trim()).filter(Boolean)
      : []

    const result = await updateDraftEvent(eventId, {
      idolId,
      idolName:    idol.name,
      title,
      type,
      subType,
      status,
      date,
      time,
      country,
      countryFlag,
      location,
      description,
      tags:        tagArray,
      ticketUrl,
      streamUrl,
      sourceLabel,
      sourceType,
      sourceUrl,
    })

    // If updateDraftEvent returns (i.e. did NOT redirect), there was an error
    if (result?.error) {
      setError(result.error)
      setSubmitting(false)
    }
    // On success, redirect() is called server-side and the component unmounts
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">

      {/* 基本資訊 */}
      <Section title="基本資訊">
        <Field label="偶像" required>
          <select
            required
            value={idolId}
            onChange={(e) => setIdolId(e.target.value)}
            className={selectCls}
          >
            <option value="">請選擇偶像</option>
            {idols.map((idol) => (
              <option key={idol.id} value={idol.id}>{idol.name}</option>
            ))}
          </select>
        </Field>

        <Field label="活動標題" required>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例：BTS WORLD TOUR 台北站"
            className={inputCls}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="活動類型" required>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className={selectCls}
            >
              {EVENT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>

          <Field label="細分類型">
            <select
              value={subType}
              onChange={(e) => setSubType(e.target.value)}
              className={selectCls}
            >
              {EVENT_SUBTYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="活動狀態" required>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={selectCls}
            >
              <option value="confirmed">已確認</option>
              <option value="tentative">暫定</option>
              <option value="postponed">延期</option>
            </select>
          </Field>
        </div>
      </Section>

      {/* 時間 / 地點 */}
      <Section title="時間 / 地點">
        <div className="grid grid-cols-2 gap-3">
          <Field label="日期" required>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputCls}
            />
          </Field>

          <Field label="時間">
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="國旗">
            <input
              type="text"
              value={countryFlag}
              onChange={(e) => setCountryFlag(e.target.value)}
              placeholder="🇹🇼"
              className={inputCls}
            />
          </Field>

          <div className="col-span-2">
            <Field label="國家 / 地區" required>
              <input
                type="text"
                required
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="台灣"
                className={inputCls}
              />
            </Field>
          </div>
        </div>

        <Field label="地點">
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="例：台北小巨蛋"
            className={inputCls}
          />
        </Field>
      </Section>

      {/* 來源資訊 */}
      <Section title="來源資訊">
        <p className="text-[10px] text-muted/60 leading-snug -mt-1">
          儲存時將取代所有既有來源（delete-all + re-insert）
        </p>
        <Field label="來源名稱" required>
          <input
            type="text"
            required
            value={sourceLabel}
            onChange={(e) => setSourceLabel(e.target.value)}
            placeholder="例：@BIGHIT_MUSIC"
            className={inputCls}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="來源類型" required>
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
              className={selectCls}
            >
              {SOURCE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>

          <Field label="來源 URL">
            <input
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://…"
              className={inputCls}
            />
          </Field>
        </div>
        <AutoTrustNotice
          sourceName={sourceLabel}
          sourceType={sourceType}
          sourceUrl={sourceUrl}
        />
      </Section>

      {/* 連結 / 標籤 / 說明 */}
      <Section title="連結 / 標籤 / 說明">
        <div className="grid grid-cols-2 gap-3">
          <Field label="票務 URL">
            <input
              type="url"
              value={ticketUrl}
              onChange={(e) => setTicketUrl(e.target.value)}
              placeholder="https://…"
              className={inputCls}
            />
          </Field>

          <Field label="串流 URL">
            <input
              type="url"
              value={streamUrl}
              onChange={(e) => setStreamUrl(e.target.value)}
              placeholder="https://…"
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="標籤（逗號分隔）">
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="例：演唱會, 台灣, 2026"
            className={inputCls}
          />
        </Field>

        <Field label="說明">
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="活動說明（選填）"
            className={inputCls + ' resize-none'}
          />
        </Field>
      </Section>

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2.5">
          <p className="text-xs text-red-400 leading-relaxed break-all">{error}</p>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className="flex items-center justify-center gap-2 rounded-xl bg-violet px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 transition-opacity"
      >
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitting ? '儲存中…' : '儲存草稿變更'}
      </button>
    </form>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-card border border-card-border px-4 py-4 flex flex-col gap-3">
      <p className="text-xs font-semibold text-muted uppercase tracking-wide">{title}</p>
      {children}
    </div>
  )
}

function AutoTrustNotice({
  sourceName,
  sourceType,
  sourceUrl,
}: {
  sourceName: string
  sourceType: string
  sourceUrl: string
}) {
  const sourceInfo = getReviewSourceInfo({ sourceName, sourceType, sourceUrl })
  const label =
    sourceInfo.trustLevel === 'official'
      ? '官方確認'
      : sourceInfo.trustLevel === 'media'
        ? '媒體確認'
        : '待確認草稿'

  return (
    <div className="rounded-xl border border-card-border bg-bg px-3 py-2.5">
      <p className="text-xs text-text-base">
        系統判斷：<span className="font-semibold">{label}</span>
      </p>
      {sourceInfo.hint && (
        <p className="text-[10px] text-amber-300 leading-snug mt-1">
          {sourceInfo.hint}
        </p>
      )}
    </div>
  )
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted">
        {label}
        {required && <span className="text-primary ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

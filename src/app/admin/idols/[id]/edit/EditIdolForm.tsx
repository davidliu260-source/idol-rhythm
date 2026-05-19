'use client'

import { useRef, useState } from 'react'
import { Loader2, Upload, ImageIcon, Sparkles } from 'lucide-react'
import AiImageSearchModal from './AiImageSearchModal'
import { updateIdol, uploadIdolAvatar, type UpdateIdolPayload } from './actions'

// ── Option lists ──────────────────────────────────────────────────────────────

const TYPE_OPTIONS = [
  { value: 'group', label: '團體 Group' },
  { value: 'solo',  label: '個人 Solo' },
]

const GENDER_OPTIONS = [
  { value: '',        label: '（不選）' },
  { value: 'male',    label: '男 Male' },
  { value: 'female',  label: '女 Female' },
  { value: 'mixed',   label: '混合 Mixed' },
  { value: 'unknown', label: '不明 Unknown' },
]

const CATEGORY_OPTIONS = [
  { value: '',      label: '（不選）' },
  { value: 'kpop',  label: 'K-Pop' },
  { value: 'cpop',  label: 'C-Pop' },
  { value: 'jpop',  label: 'J-Pop' },
  { value: 'idol',  label: 'Idol' },
  { value: 'other', label: 'Other' },
]

// ── Styles ────────────────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-xl border border-card-border bg-bg px-3 py-2.5 text-sm text-text-base placeholder:text-muted/40 focus:outline-none focus:border-violet/60 transition-colors'

const selectCls = inputCls + ' cursor-pointer'
const disabledCls = inputCls + ' opacity-50 cursor-not-allowed'

// ── Props ─────────────────────────────────────────────────────────────────────

export interface EditIdolFormProps {
  idolId: string
  initial: {
    slug: string
    name: string
    koreanName: string
    type: string
    gender: string
    category: string
    agency: string
    debutDate: string
    color: string
    genres: string     // comma-separated string for the input
    memberCount: string
    description: string
    avatarUrl: string
    altNames: string   // newline-separated string for the textarea
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EditIdolForm({ idolId, initial }: EditIdolFormProps) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)

  const [name,        setName]        = useState(initial.name)
  const [koreanName,  setKoreanName]  = useState(initial.koreanName)
  const [type,        setType]        = useState(initial.type)
  const [gender,      setGender]      = useState(initial.gender)
  const [category,    setCategory]    = useState(initial.category)
  const [agency,      setAgency]      = useState(initial.agency)
  const [debutDate,   setDebutDate]   = useState(initial.debutDate)
  const [color,       setColor]       = useState(initial.color)
  const [genres,      setGenres]      = useState(initial.genres)
  const [memberCount, setMemberCount] = useState(initial.memberCount)
  const [description, setDescription] = useState(initial.description)
  const [avatarUrl,   setAvatarUrl]   = useState(initial.avatarUrl)
  const [altNames,    setAltNames]    = useState(initial.altNames)

  // ── I1b-A: avatar file upload state ────────────────────────────────────────
  const [uploading,    setUploading]    = useState(false)
  const [uploadError,  setUploadError]  = useState<string | null>(null)
  // I1b-B: AI image search modal open state
  const [aiModalOpen,  setAiModalOpen]  = useState(false)
  const [uploadNotice, setUploadNotice] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  async function handleAvatarUpload(file: File) {
    setUploadError(null)
    setUploadNotice(null)
    setUploading(true)

    const formData = new FormData()
    formData.append('file', file)
    const result = await uploadIdolAvatar(idolId, formData)

    if (!result.ok || !result.avatarUrl) {
      setUploadError(result.error ?? '上傳失敗')
    } else {
      setAvatarUrl(result.avatarUrl)
      setUploadNotice('已上傳並寫入 avatar_url。')
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
    setUploading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const genreArray = genres
      ? genres.split(',').map((g) => g.trim()).filter(Boolean)
      : []

    const altNamesArray = altNames
      ? altNames.split('\n').map((n) => n.trim()).filter(Boolean)
      : []

    const payload: UpdateIdolPayload = {
      name,
      koreanName,
      type,
      gender,
      category,
      agency,
      debutDate,
      color,
      genres: genreArray,
      memberCount,
      description,
      avatarUrl,
      altNames: altNamesArray,
    }

    const result = await updateIdol(idolId, payload)

    if (result?.error) {
      setError(result.error)
      setSubmitting(false)
    }
    // On success, redirect() is called server-side
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">

      {/* 基本識別 */}
      <Section title="基本識別">
        {/* Slug — displayed but immutable */}
        <Field label="Slug（不可修改）">
          <input
            type="text"
            value={initial.slug}
            disabled
            className={disabledCls}
          />
          <p className="text-[10px] text-muted/50 mt-0.5">
            Slug 為前台路由鍵值（/idols/[slug]），建立後不可修改。
          </p>
        </Field>

        <Field label="名稱（Display Name）" required>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例：NewJeans"
            className={inputCls}
          />
        </Field>

        <Field label="韓文 / 原文名稱">
          <input
            type="text"
            value={koreanName}
            onChange={(e) => setKoreanName(e.target.value)}
            placeholder="例：뉴진스"
            className={inputCls}
          />
        </Field>
      </Section>

      {/* 分類 */}
      <Section title="分類">
        <div className="grid grid-cols-2 gap-3">
          <Field label="組合 / 個人" required>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className={selectCls}
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>

          <Field label="性別">
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className={selectCls}
            >
              {GENDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="音樂分類">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={selectCls}
            >
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>

          <Field label="成員人數">
            <input
              type="number"
              min={1}
              max={99}
              value={memberCount}
              onChange={(e) => setMemberCount(e.target.value)}
              placeholder="留空 = 不限"
              className={inputCls}
            />
          </Field>
        </div>
      </Section>

      {/* 詳細資訊 */}
      <Section title="詳細資訊">
        <Field label="所屬公司 / 事務所">
          <input
            type="text"
            value={agency}
            onChange={(e) => setAgency(e.target.value)}
            placeholder="例：ADOR"
            className={inputCls}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="出道日期">
            <input
              type="date"
              value={debutDate}
              onChange={(e) => setDebutDate(e.target.value)}
              className={inputCls}
            />
          </Field>

          <Field label="主色調（Hex）">
            <input
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="#4c1d95"
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="音樂類型（逗號分隔）">
          <input
            type="text"
            value={genres}
            onChange={(e) => setGenres(e.target.value)}
            placeholder="例：K-Pop, Hip-Hop, R&B"
            className={inputCls}
          />
        </Field>

        <Field label="說明">
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="偶像簡介（選填）"
            className={inputCls + ' resize-none'}
          />
        </Field>

        <Field label="別名（每行一個）">
          <textarea
            rows={3}
            value={altNames}
            onChange={(e) => setAltNames(e.target.value)}
            placeholder={'例：\nSKZ\n스트레이 키즈'}
            className={inputCls + ' resize-none font-mono text-xs'}
          />
          <p className="text-[10px] text-muted/50 mt-0.5">
            供聚合來源爬蟲比對藝人用。每行一個別名，大小寫與空白會被自動 normalize；不會在前台顯示。
          </p>
        </Field>

        <Field label="頭像圖片">
          {/* Preview + upload row */}
          <div className="flex items-center gap-3">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt="目前頭像預覽"
                className="h-12 w-12 rounded-xl object-cover bg-card border border-card-border"
              />
            ) : (
              <div className="h-12 w-12 rounded-xl bg-card border border-card-border flex items-center justify-center text-muted">
                <ImageIcon className="h-5 w-5" />
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleAvatarUpload(f)
              }}
            />

            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet/40 bg-violet/10 px-3 py-2 text-xs font-semibold text-violet-200 disabled:opacity-60 transition-opacity"
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {uploading ? '上傳中…' : '選擇圖片上傳'}
            </button>

            <button
              type="button"
              disabled={uploading}
              onClick={() => setAiModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet/40 bg-violet/10 px-3 py-2 text-xs font-semibold text-violet-200 disabled:opacity-60 transition-opacity"
            >
              <Sparkles className="h-3.5 w-3.5" />
              AI 搜圖
            </button>
          </div>

          <p className="text-[10px] text-muted/50 mt-1.5">
            支援 JPEG / PNG / WebP，上限 2 MB。上傳成功會直接寫入 avatar_url；如不上傳本機檔，也可手動貼公開圖片網址。
            或點「AI 搜圖」自動從 Wikimedia 找候選圖片。
          </p>

          {uploadError && (
            <p className="text-[10px] text-red-400 mt-1">{uploadError}</p>
          )}
          {uploadNotice && (
            <p className="text-[10px] text-emerald-400 mt-1">{uploadNotice}</p>
          )}

          <input
            type="url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://...（手動貼網址）"
            className={inputCls + ' mt-2'}
          />
        </Field>
      </Section>

      {/* is_active 不在 H3 範圍 — 保留給 Phase H4 */}

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
        {submitting ? '儲存中…' : '儲存變更'}
      </button>

      {/* I1b-B: AI image search modal (renders only when open) */}
      <AiImageSearchModal
        idolId={idolId}
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        onAvatarUpdated={(url) => {
          setAvatarUrl(url)
          setUploadNotice('已從 AI 搜圖選定圖片並寫入 avatar_url。')
          setUploadError(null)
        }}
      />
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

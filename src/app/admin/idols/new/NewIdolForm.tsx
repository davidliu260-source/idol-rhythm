'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { createIdol } from './actions'

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

const SLUG_RE = /^[a-z0-9-]*$/

// ── Component ─────────────────────────────────────────────────────────────────

export default function NewIdolForm() {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [slugError, setSlugError]   = useState<string | null>(null)

  const [name,        setName]        = useState('')
  const [slug,        setSlug]        = useState('')
  const [koreanName,  setKoreanName]  = useState('')
  const [type,        setType]        = useState('group')
  const [gender,      setGender]      = useState('')
  const [category,    setCategory]    = useState('kpop')
  const [agency,      setAgency]      = useState('')
  const [debutDate,   setDebutDate]   = useState('')
  const [color,       setColor]       = useState('')
  const [genres,      setGenres]      = useState('')
  const [memberCount, setMemberCount] = useState('')
  const [description, setDescription] = useState('')
  const [isActive,    setIsActive]    = useState(true)

  // Auto-generate slug from name (English chars only)
  function handleNameChange(val: string) {
    setName(val)
    if (!slug) {
      const auto = val
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
      setSlug(auto)
    }
  }

  function handleSlugChange(val: string) {
    setSlug(val)
    if (val && !SLUG_RE.test(val)) {
      setSlugError('只能使用小寫英文、數字、hyphen（-）')
    } else {
      setSlugError(null)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const genreArray = genres
      ? genres.split(',').map((g) => g.trim()).filter(Boolean)
      : []

    const result = await createIdol({
      slug,
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
      isActive,
    })

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
        <Field label="名稱（Display Name）" required>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="例：NewJeans"
            className={inputCls}
          />
        </Field>

        <Field label="Slug" required>
          <input
            type="text"
            required
            value={slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            placeholder="例：newjeans"
            className={inputCls + (slugError ? ' border-red-500/60' : '')}
          />
          {slugError ? (
            <p className="text-[10px] text-red-400 mt-0.5">{slugError}</p>
          ) : (
            <p className="text-[10px] text-amber-400/80 mt-0.5">
              ⚠ Slug 建立後暫不支援修改，會影響前台路由（/idols/[slug]）
            </p>
          )}
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
      </Section>

      {/* 狀態 */}
      <Section title="狀態">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded accent-violet"
          />
          <span className="text-sm text-text-base">
            立即啟用（is_active = true）
          </span>
        </label>
        <p className="text-[10px] text-muted/60 -mt-1">
          停用的偶像不會出現在前台偶像頁，也不會顯示在活動新增表單的下拉選單。
        </p>
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
        disabled={submitting || !!slugError}
        className="flex items-center justify-center gap-2 rounded-xl bg-violet px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 transition-opacity"
      >
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitting ? '建立中…' : '建立偶像'}
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

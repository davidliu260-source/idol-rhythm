'use client'

import { useEffect, useState } from 'react'
import { Loader2, X, ExternalLink, Sparkles, AlertTriangle, Check } from 'lucide-react'
import { uploadIdolAvatarFromUrl } from './actions'

// ── Types ──────────────────────────────────────────────────────────────────

interface Candidate {
  imageUrl: string
  thumbnailUrl: string
  sourceUrl: string
  title: string
  width: number | null
  height: number | null
  provider: 'wikimedia'
}

interface SearchOk {
  ok: true
  idolId: string
  query: { name: string; koreanName: string | null }
  candidates: Candidate[]
  diagnostics: {
    queriedEn: number
    queriedKo: number
    rawHits: number
    afterDedupe: number
  }
}

interface SearchErr {
  ok: false
  error: string
}

type SearchResponse = SearchOk | SearchErr

interface Props {
  idolId: string
  isOpen: boolean
  onClose: () => void
  /** Called with the new public Storage URL after a successful pick + upload. */
  onAvatarUpdated: (url: string) => void
}

const COPYRIGHT_NOTICE =
  '請確認圖片來源與使用權限，建議優先使用官方或可公開使用圖片。'
const NO_RESULT_NOTICE =
  '找不到合適圖片，請改用手動上傳或手動貼圖片網址。'

export default function AiImageSearchModal({
  idolId,
  isOpen,
  onClose,
  onAvatarUpdated,
}: Props) {
  const [searching, setSearching] = useState(false)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)
  const [query, setQuery] = useState<{ name: string; koreanName: string | null } | null>(null)

  const [selectedUrl, setSelectedUrl] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  // Kick off the search whenever the modal opens.
  useEffect(() => {
    if (!isOpen) return

    let cancelled = false
    setSearching(true)
    setCandidates([])
    setSearchError(null)
    setSelectedUrl(null)
    setConfirmError(null)
    setQuery(null)

    fetch(`/api/admin/idols/${idolId}/ai-search-image`, {
      method: 'GET',
      cache: 'no-store',
    })
      .then(async (res) => {
        const body = (await res.json()) as SearchResponse
        if (cancelled) return
        if (body.ok) {
          setCandidates(body.candidates)
          setQuery(body.query)
        } else {
          setSearchError(body.error || '搜尋失敗，請稍後再試。')
        }
      })
      .catch((e) => {
        if (cancelled) return
        setSearchError(
          `搜尋失敗：${e instanceof Error ? e.message : '網路錯誤'}。`,
        )
      })
      .finally(() => {
        if (!cancelled) setSearching(false)
      })

    return () => {
      cancelled = true
    }
  }, [isOpen, idolId])

  async function handleConfirm() {
    if (!selectedUrl) return
    setConfirming(true)
    setConfirmError(null)
    try {
      const result = await uploadIdolAvatarFromUrl(idolId, selectedUrl)
      if (!result.ok || !result.avatarUrl) {
        setConfirmError(result.error || '圖片上傳失敗，請稍後再試。')
        return
      }
      onAvatarUpdated(result.avatarUrl)
      onClose()
    } catch (e) {
      setConfirmError(
        `圖片上傳失敗，請稍後再試（${e instanceof Error ? e.message : '網路錯誤'}）。`,
      )
    } finally {
      setConfirming(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6"
      onClick={(e) => {
        // Click on backdrop closes; clicks inside the panel don't propagate.
        if (e.target === e.currentTarget && !confirming) onClose()
      }}
    >
      <div className="w-full max-w-md max-h-full overflow-y-auto rounded-2xl bg-card border border-card-border p-4 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet" />
          <h2 className="text-sm font-semibold text-text-base">AI 搜圖</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={confirming}
            aria-label="關閉"
            className="ml-auto p-1 text-muted hover:text-text-base disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Query echo */}
        {query && (
          <p className="text-[11px] text-muted">
            搜尋：<span className="text-text-base font-mono">{query.name}</span>
            {query.koreanName && (
              <>
                {' / '}
                <span className="text-text-base font-mono">{query.koreanName}</span>
              </>
            )}
          </p>
        )}

        {/* Copyright notice */}
        <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/25 px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-[10px] text-amber-200/90 leading-relaxed">
            {COPYRIGHT_NOTICE}
          </p>
        </div>

        {/* Loading */}
        {searching && (
          <div className="py-8 flex flex-col items-center gap-2 text-xs text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            搜尋 Wikimedia 中…
          </div>
        )}

        {/* Search error */}
        {!searching && searchError && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/25 px-3 py-3">
            <p className="text-xs text-red-400 leading-relaxed break-all">{searchError}</p>
          </div>
        )}

        {/* No results */}
        {!searching && !searchError && candidates.length === 0 && (
          <div className="rounded-xl bg-card border border-card-border px-3 py-4 text-center">
            <p className="text-xs text-muted leading-relaxed">{NO_RESULT_NOTICE}</p>
          </div>
        )}

        {/* Candidate grid */}
        {!searching && candidates.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {candidates.map((c) => {
              const isSelected = selectedUrl === c.imageUrl
              return (
                <button
                  key={c.imageUrl}
                  type="button"
                  onClick={() => setSelectedUrl(c.imageUrl)}
                  disabled={confirming}
                  className={`relative rounded-xl overflow-hidden border-2 active:opacity-80 transition-all ${
                    isSelected
                      ? 'border-violet'
                      : 'border-card-border hover:border-violet/40'
                  } disabled:opacity-50`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={c.thumbnailUrl}
                    alt={c.title}
                    className="w-full h-32 object-cover bg-bg"
                  />
                  {isSelected && (
                    <div className="absolute top-1 right-1 bg-violet rounded-full p-1">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                  <div className="px-2 py-1.5 bg-card/95">
                    <p className="text-[10px] text-text-base truncate">{c.title}</p>
                    {c.sourceUrl && (
                      <a
                        href={c.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-0.5 text-[9px] text-muted hover:text-violet"
                      >
                        <ExternalLink className="h-2 w-2" />
                        來源
                      </a>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Confirm error */}
        {confirmError && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/25 px-3 py-2.5">
            <p className="text-[11px] text-red-400 leading-relaxed break-all">{confirmError}</p>
          </div>
        )}

        {/* Action footer */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={confirming}
            className="flex-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs text-muted hover:text-text-base disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedUrl || confirming}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-violet px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
          >
            {confirming ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3" />
            )}
            {confirming ? '上傳中…' : '使用此圖片'}
          </button>
        </div>
      </div>
    </div>
  )
}

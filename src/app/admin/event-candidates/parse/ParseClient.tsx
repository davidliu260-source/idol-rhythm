'use client'

import { useState } from 'react'
import { Loader2, Sparkles, CheckCircle2 } from 'lucide-react'
import { commitAiCandidate } from './actions'

interface ParsedCandidate {
  detected_idol_slug: string | null
  detected_idol_id: string | null
  detected_event_type:
    | 'concert' | 'ticketing' | 'livestream' | 'streaming'
    | 'media' | 'brand' | 'official' | null
  detected_date: string | null
  source_name: string | null
  source_type:
    | 'official_sns' | 'official_website' | 'media_outlet'
    | 'fan_account' | 'community' | 'unknown' | null
  confidence: number
  reason: string
  model: string
}

interface ParseResponse {
  ok: true
  parsed: ParsedCandidate
  idol_name: string | null
}

interface ParseError {
  ok: false
  error: string
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  concert: '演唱會 / 見面會',
  ticketing: '開票售票',
  livestream: '直播',
  streaming: '串流',
  media: '媒體',
  brand: '代言品牌',
  official: '官方發布',
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  official_sns: '官方 SNS',
  official_website: '官方網站',
  media_outlet: '媒體報導',
  fan_account: '粉絲帳號',
  community: '社群討論',
  unknown: '不明',
}

export default function ParseClient() {
  const [rawText, setRawText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [result, setResult] = useState<ParseResponse | null>(null)

  const [committing, setCommitting] = useState(false)
  const [commitError, setCommitError] = useState<string | null>(null)

  async function handleParse() {
    setParsing(true)
    setParseError(null)
    setResult(null)
    setCommitError(null)
    try {
      const res = await fetch('/api/admin/ai/parse-candidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText }),
      })
      const body = (await res.json()) as ParseResponse | ParseError
      if (!body.ok) {
        setParseError(body.error)
      } else {
        setResult(body)
      }
    } catch (e) {
      setParseError(e instanceof Error ? e.message : String(e))
    } finally {
      setParsing(false)
    }
  }

  async function handleCommit() {
    if (!result) return
    setCommitting(true)
    setCommitError(null)
    const ret = await commitAiCandidate({
      rawText,
      parsed: result.parsed,
    })
    // On success the server action redirects (throws). We only land here on error.
    if (ret?.error) {
      setCommitError(ret.error)
      setCommitting(false)
    }
  }

  const p = result?.parsed
  const confidenceColor =
    p && p.confidence >= 0.7
      ? 'text-emerald-400'
      : p && p.confidence >= 0.4
        ? 'text-amber-400'
        : 'text-red-400'

  return (
    <div className="flex flex-col gap-4">
      {/* Textarea */}
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-text-base">
          公告原文 <span className="text-rose-400">*</span>
        </span>
        <span className="text-[10px] text-muted">
          貼上任何官方公告 / 新聞稿 / 社群貼文。AI 會盡量解析偶像、活動類型、日期與來源。
        </span>
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          rows={10}
          placeholder="例：BLACKPINK DEADLINE WORLD TOUR — Hong Kong, AsiaWorld-Expo, March 14 2026 ..."
          className="w-full rounded-xl border border-card-border bg-bg px-3 py-2.5 text-sm text-text-base placeholder:text-muted/40 focus:outline-none focus:border-violet/60 resize-y min-h-[180px]"
        />
        <span className="text-[10px] text-muted/60 self-end tabular-nums">
          {rawText.length} 字
        </span>
      </label>

      {/* Parse button */}
      <button
        type="button"
        onClick={handleParse}
        disabled={parsing || rawText.trim().length === 0}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 active:opacity-80 transition-opacity"
      >
        {parsing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {parsing ? 'AI 解析中…' : 'AI 解析'}
      </button>

      {/* Parse error */}
      {parseError && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/25 px-3 py-2.5">
          <p className="text-xs font-semibold text-red-400 mb-0.5">解析失敗</p>
          <p className="text-xs text-red-400/80 break-all leading-relaxed">
            {parseError}
          </p>
        </div>
      )}

      {/* Preview */}
      {result && p && (
        <div className="flex flex-col gap-3">
          <div className="rounded-xl bg-card border border-card-border px-4 py-4 flex flex-col gap-3">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide">
              AI 解析結果
            </p>

            <PreviewRow label="偶像">
              {p.detected_idol_slug && result.idol_name ? (
                <span className="text-text-base">
                  {result.idol_name}{' '}
                  <span className="text-muted/60 text-[10px]">
                    ({p.detected_idol_slug})
                  </span>
                </span>
              ) : (
                <span className="text-red-400">未能對應偶像</span>
              )}
            </PreviewRow>

            <Divider />
            <PreviewRow label="活動類型">
              {p.detected_event_type
                ? (EVENT_TYPE_LABELS[p.detected_event_type] ?? p.detected_event_type)
                : <span className="text-muted">未判斷</span>}
            </PreviewRow>

            <Divider />
            <PreviewRow label="日期">
              {p.detected_date ?? <span className="text-muted">未判斷</span>}
            </PreviewRow>

            <Divider />
            <PreviewRow label="來源名稱">
              {p.source_name ?? <span className="text-muted">未判斷</span>}
            </PreviewRow>

            <Divider />
            <PreviewRow label="來源類型">
              {p.source_type
                ? (SOURCE_TYPE_LABELS[p.source_type] ?? p.source_type)
                : <span className="text-muted">未判斷</span>}
            </PreviewRow>

            <Divider />
            <PreviewRow label="信心分數">
              <span className={confidenceColor}>
                {Math.round(p.confidence * 100)}%
              </span>
            </PreviewRow>

            <Divider />
            <div className="flex flex-col gap-1">
              <p className="text-xs text-muted">判斷理由</p>
              <p className="text-xs text-text-base leading-relaxed">
                {p.reason || '（無）'}
              </p>
            </div>

            <Divider />
            <PreviewRow label="模型">
              <span className="font-mono text-[10px] text-muted/60">
                {p.model}
              </span>
            </PreviewRow>
          </div>

          {/* Commit error */}
          {commitError && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/25 px-3 py-2.5">
              <p className="text-xs font-semibold text-red-400 mb-0.5">
                寫入失敗
              </p>
              <p className="text-xs text-red-400/80 break-all leading-relaxed">
                {commitError}
              </p>
            </div>
          )}

          {/* Commit button */}
          <button
            type="button"
            onClick={handleCommit}
            disabled={committing}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-4 py-3 text-sm font-semibold text-emerald-300 disabled:opacity-60 hover:bg-emerald-500/25 transition-colors"
          >
            {committing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {committing ? '寫入中…' : '確認寫入候選池'}
          </button>

          <p className="text-[10px] text-muted leading-relaxed">
            寫入後 review_status = pending；候選仍須走 Approve / Reject 流程，
            AI 不會自動建立活動，也不會自動發布到前台。
          </p>
        </div>
      )}
    </div>
  )
}

function PreviewRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <p className="text-xs text-muted flex-shrink-0 w-20">{label}</p>
      <div className="text-xs text-text-base text-right flex-1">{children}</div>
    </div>
  )
}

function Divider() {
  return <div className="h-px bg-card-border" />
}

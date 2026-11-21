'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Calendar, Loader2 } from 'lucide-react'
import clsx from 'clsx'
import { useAppState } from '@/lib/appState'
import type { FeedAlarm } from '@/lib/ics/followsFeed'

type FeedSettings = { token: string | null; alarm: FeedAlarm }
type FeedAction = { action: 'create' | 'rotate' } | { action: 'set_alarm'; alarm: FeedAlarm }

const choices = [
  ['none', '不提醒'],
  ['day_before', '前一天'],
  ['week_before', '前一週'],
  ['both', '兩者'],
] as const

const control = 'inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.045] px-4 text-sm font-semibold text-white/80 hover:text-white disabled:opacity-60'

async function requestSettings(init?: RequestInit): Promise<FeedSettings> {
  const response = await fetch('/api/calendar-feed', init)
  if (!response.ok) throw new Error('Calendar feed request failed')
  return response.json()
}

export default function CalendarFeedCard() {
  const { user, isUserLoading, following } = useAppState()
  const userId = user?.id
  const [settings, setSettings] = useState<FeedSettings | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const fallbackInput = useRef<HTMLInputElement>(null)
  const savingRef = useRef(false)

  useEffect(() => {
    if (isUserLoading || !userId) return
    const controller = new AbortController()
    setLoading(true)
    setError('')
    requestSettings({ signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setSettings(result)
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('暫時無法載入訂閱設定，請再試一次。')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [userId, isUserLoading, loadAttempt])

  useEffect(() => {
    if (copyState === 'failed') fallbackInput.current?.select()
    if (copyState === 'copied') {
      const timer = window.setTimeout(() => setCopyState('idle'), 2000)
      return () => window.clearTimeout(timer)
    }
  }, [copyState])

  const path = settings?.token ? `/api/ics/me/${settings.token}.ics` : ''
  const httpsUrl = path && typeof window !== 'undefined' ? `https://${window.location.host}${path}` : ''

  async function copyLink() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable')
      await navigator.clipboard.writeText(httpsUrl)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
      fallbackInput.current?.select()
    }
  }

  async function save(action: FeedAction) {
    if (action.action === 'set_alarm' && action.alarm === settings?.alarm) return
    // Ignore new requests while one is in flight (keyboard arrow keys on radios
    // fire onChange repeatedly; we don't disable the inputs so focus stays put).
    if (savingRef.current) return
    savingRef.current = true

    setSaving(true)
    setError('')
    try {
      const result = await requestSettings({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
      })
      if (action.action === 'rotate') setCopyState('idle')
      setSettings(result)
    } catch {
      setError('暫時無法更新訂閱設定，請再試一次。')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <section className="rounded-[26px] border border-white/8 bg-white/[0.035] p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold text-white">
        <Calendar aria-hidden="true" className="h-5 w-5 text-[#ff8bc8]" />
        訂閱我追蹤的全部行程
      </h2>
      {isUserLoading || (user && loading) ? (
        <p role="status" className="mt-3 flex items-center gap-2 text-sm text-white/70">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          載入中…
        </p>
      ) : !user ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-white/70">登入後才能訂閱『我追蹤的全部』；單一偶像可以在偶像頁直接訂閱</p>
          <Link href="/login?next=/me" className={control}>登入</Link>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {error && <p role="alert" className="text-sm text-[#ff9ed3]">{error}</p>}
          {!settings ? (
            <button type="button" className={control} onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
              再試一次
            </button>
          ) : (
            <>
              {following.ids.length === 0 && (
                <Link href="/idols" className="inline-flex min-h-11 items-center text-sm text-white/75 underline hover:text-white">
                  先追蹤偶像才會有內容
                </Link>
              )}
              {!path ? (
                <div>
                  <button type="button" className={control} disabled={saving} onClick={() => save({ action: 'create' })}>
                    產生我的訂閱連結
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={control} disabled={saving} onClick={() => window.location.assign(`webcal://${window.location.host}${path}`)}>
                      訂閱到行事曆
                    </button>
                    <button type="button" className={control} disabled={saving} onClick={copyLink}>
                      複製連結
                    </button>
                  </div>
                  <span role="status" aria-live="polite" className="text-sm text-white/70">
                    {copyState === 'copied' ? '已複製' : copyState === 'failed' ? '請長按或手動複製這個網址' : ''}
                  </span>
                  {copyState === 'failed' && (
                    <div>
                      <input ref={fallbackInput} type="url" value={httpsUrl} readOnly aria-label="行事曆訂閱網址"
                        className="min-h-11 w-full rounded-xl border border-white/10 bg-white/[0.045] px-3 text-sm text-white/80" />
                    </div>
                  )}
                  <fieldset aria-busy={saving}>
                    <legend id="calendar-feed-alarm-label" className="mb-2 text-sm font-semibold text-white">行事曆提醒</legend>
                    <div role="radiogroup" aria-labelledby="calendar-feed-alarm-label"
                      className="grid grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-black/20 p-1 sm:grid-cols-4">
                      {choices.map(([alarm, label]) => (
                        <label key={alarm} className="relative">
                          <input type="radio" name="calendar-feed-alarm" value={alarm}
                            checked={settings.alarm === alarm}
                            onChange={() => save({ action: 'set_alarm', alarm })}
                            className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default" />
                          <span className={clsx('flex min-h-11 items-center justify-center rounded-xl px-2 text-sm font-semibold peer-disabled:opacity-60 peer-focus-visible:ring-2 peer-focus-visible:ring-[#ffb3de]',
                            settings.alarm === alarm ? 'bg-[#ff4ca1]/20 text-[#ffb3de]' : 'text-white/75 peer-hover:bg-white/10')}>
                            {label}
                          </span>
                        </label>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-white/65">改了之後，行事曆下次更新時套用</p>
                  </fieldset>
                  <p className="text-xs leading-5 text-white/70">iPhone：加入訂閱時請關閉『移除提醒』，才會跳出提醒。</p>
                  <button type="button" className={control} disabled={saving} onClick={() => {
                    if (window.confirm('重設後舊連結會失效，已訂閱的行事曆要重新訂閱。確定嗎？')) {
                      void save({ action: 'rotate' })
                    }
                  }}>
                    重設連結
                  </button>
                </>
              )}
              <p className="text-xs leading-5 text-white/70">只收錄官方或媒體確認的行程，已結束的行程保留 30 天。</p>
            </>
          )}
        </div>
      )}
    </section>
  )
}

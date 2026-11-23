'use client'

import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useAppState } from '@/lib/appState'
import { ERROR_REPORT_REASONS, NOTE_MAX, validateNoteClient, type ErrorReportReason, type ReportResult } from '@/lib/eventErrorReports'
import { ensureDeviceId } from '@/lib/eventWants'
import { checkEventErrorReportsAvailable, submitEventErrorReport } from '@/lib/supabase/eventErrorReports'

const notices: Record<ReportResult['kind'], string> = {
  ok: '謝謝回報！我們會對照主辦或官方公告核對後更新。',
  duplicate: '你已經回報過這一項，我們會盡快核對。',
  rate_limited: '回報太頻繁，請稍後再試。',
  invalid: '回報內容無法送出，請確認類型，備註不要貼網址。',
  gone: '目前無法送出回報，請稍後再試。',
}

const controlClass = 'min-h-[44px] rounded-xl border border-white/15 bg-[#191624] px-3 text-sm text-white disabled:opacity-50'

function getStorage() {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export default function EventErrorReport({ eventId }: { eventId: string }) {
  const { user, isUserLoading } = useAppState()
  const scope = user?.id ?? 'anon'
  const id = useId()
  const [available, setAvailable] = useState(false)
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<ErrorReportReason | ''>('')
  const [note, setNote] = useState('')
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState(false)
  const submitting = useRef(false)

  useEffect(() => {
    let active = true
    void checkEventErrorReportsAvailable().then(enabled => {
      if (active) setAvailable(enabled)
    })
    return () => { active = false }
  }, [])

  if (isUserLoading || (!available && !notice)) return null

  function closeForm() {
    setOpen(false)
    setReason('')
    setNote('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    const validated = validateNoteClient(note)
    if (!reason || !validated.ok) {
      setNotice(notices.invalid)
      return
    }

    const deviceId = scope === 'anon' ? ensureDeviceId(getStorage(), window.crypto) : null
    if (scope === 'anon' && !deviceId) {
      setNotice(notices.gone)
      return
    }

    submitting.current = true
    setPending(true)
    setNotice('')
    try {
      const { kind } = await submitEventErrorReport(eventId, reason, validated.note, scope, deviceId)
      if (kind === 'ok' || kind === 'duplicate') closeForm()
      if (kind === 'gone' && !(await checkEventErrorReportsAvailable())) {
        closeForm()
        setAvailable(false)
      }
      setNotice(notices[kind])
    } finally {
      submitting.current = false
      setPending(false)
    }
  }

  return (
    <div className="mt-3">
      {available && !open && (
        <button type="button" className={controlClass} onClick={() => {
          setOpen(true)
          setNotice('')
        }}>
          回報錯誤
        </button>
      )}
      {open && (
        <form className="grid gap-2" onSubmit={handleSubmit}>
          <label htmlFor={`${id}-reason`} className="text-sm text-white/85">錯誤類型</label>
          <select
            id={`${id}-reason`}
            className={controlClass}
            required
            disabled={pending}
            value={reason}
            onChange={event => setReason(event.target.value as ErrorReportReason | '')}
          >
            <option value="">請選擇錯誤類型</option>
            {Object.entries(ERROR_REPORT_REASONS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <label htmlFor={`${id}-note`} className="text-sm text-white/85">備註（選填）</label>
          <textarea
            id={`${id}-note`}
            aria-describedby={`${id}-count`}
            className={`${controlClass} py-2`}
            rows={3}
            readOnly={pending}
            value={note}
            onChange={event => setNote(Array.from(event.target.value).slice(0, NOTE_MAX).join(''))}
          />
          <p id={`${id}-count`} className="text-xs text-white/65">{Array.from(note).length}/{NOTE_MAX}</p>
          <p className="text-xs text-white/65">回報只會給管理員看，不會公開，也不會收集你的 email。</p>
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className={`${controlClass} font-semibold`}>送出</button>
            <button type="button" disabled={pending} className={controlClass} onClick={() => {
              closeForm()
              setNotice('')
            }}>取消</button>
          </div>
        </form>
      )}
      <p role="status" className={notice ? 'mt-2 text-sm text-[#ffb2db]' : undefined}>{notice}</p>
    </div>
  )
}

'use client'

import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { useAppState } from '@/lib/appState'
import {
  ensureDeviceId, normalizeWishName, wishNotice, WISH_COPY, WISH_KINDS, WISH_NAME_MAX_CHARS, type WishKind,
} from '@/lib/fanWishes'
import { checkFanWishesAvailable, submitFanWish } from '@/lib/supabase/fanWishes'

const kindLabels = { add_group: WISH_COPY.kindGroup, add_city: WISH_COPY.kindCity }
const placeholders = { add_group: WISH_COPY.placeholderGroup, add_city: WISH_COPY.placeholderCity }

function getStorage() {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export default function FanWishForm({ defaultKind, className }: { defaultKind: WishKind; className?: string }) {
  const { user, isUserLoading } = useAppState()
  const scope = user?.id ?? 'anon'
  const inputId = useId()
  const [available, setAvailable] = useState(false)
  const [kind, setKind] = useState(defaultKind)
  const [input, setInput] = useState('')
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState(false)
  const submitting = useRef(false)

  useEffect(() => {
    let active = true
    void checkFanWishesAvailable().then(enabled => {
      if (active) setAvailable(enabled)
    })
    return () => { active = false }
  }, [])

  if (isUserLoading || !available) return null

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return

    const name = normalizeWishName(input)
    if (name === null) {
      setNotice(WISH_COPY.invalid)
      return
    }
    const deviceId = scope === 'anon' ? ensureDeviceId(getStorage(), window.crypto) : null
    if (scope === 'anon' && deviceId === null) {
      setNotice(WISH_COPY.storageBlocked)
      return
    }

    submitting.current = true
    setPending(true)
    setNotice('')
    try {
      const result = await submitFanWish(kind, name, scope, deviceId)
      if (result.kind === 'gone') setAvailable(false)
      if (result.kind === 'ok') setInput('')
      setNotice(wishNotice(result.kind))
    } finally {
      submitting.current = false
      setPending(false)
    }
  }

  return (
    <section className={clsx('rounded-[26px] border border-white/8 bg-white/[0.035] p-4', className)}>
      <h2 className="text-lg font-bold text-white">{WISH_COPY.title}</h2>
      <p className="mt-1 text-sm text-white/70">{WISH_COPY.intro}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {WISH_KINDS.map(option => (
          <button
            key={option}
            type="button"
            aria-pressed={kind === option}
            disabled={pending}
            onClick={() => {
              setKind(option)
              setNotice('')
            }}
            className={clsx(
              'min-h-[44px] rounded-full border px-4 text-sm font-semibold',
              kind === option
                ? 'border-[#ff6cb7]/28 bg-[#ff4ca1]/16 text-[#ff9cd0]'
                : 'border-white/8 bg-white/[0.04] text-white/70',
            )}
          >
            {kindLabels[option]}
          </button>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <label htmlFor={inputId} className="sr-only">{kindLabels[kind]}</label>
        <input
          id={inputId}
          type="text"
          maxLength={WISH_NAME_MAX_CHARS}
          autoComplete="off"
          enterKeyHint="send"
          placeholder={placeholders[kind]}
          value={input}
          readOnly={pending}
          onChange={event => {
            setInput(event.target.value)
            setNotice('')
          }}
          className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white placeholder:text-white/50 focus:border-[#ff6cb7]/40 focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className="min-h-[44px] shrink-0 rounded-xl bg-primary px-4 text-sm font-bold text-white disabled:opacity-50"
        >
          {WISH_COPY.submit}
        </button>
      </form>
      <p className="mt-2 text-xs text-white/60">{WISH_COPY.privacy}</p>
      <div aria-live="polite" className={notice ? 'mt-2 text-sm text-[#ff9cd0]' : undefined}>{notice}</div>
    </section>
  )
}

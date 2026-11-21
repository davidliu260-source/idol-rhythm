'use client'

import { useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronLeft, Bell, Heart, Share2 } from 'lucide-react'
import { useAppState } from '@/lib/appState'
import {
  choiceToTypes,
  REMINDER_CHOICE_LABELS,
  typesToChoice,
  type ReminderChoice,
} from '@/lib/reminderTypes'
import clsx from 'clsx'

const heroButtonClass = 'grid h-11 w-11 place-items-center rounded-full bg-black/[0.24] text-white transition-colors hover:bg-black/[0.32] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'

type ActionVariant = 'default' | 'hero'

export function EventDetailBackBtn({ variant = 'default' }: { variant?: ActionVariant } = {}) {
  const router = useRouter()

  function handleBack() {
    if (window.history.length > 1) {
      router.back()
      return
    }
    router.push('/')
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      className={variant === 'hero' ? heroButtonClass : "inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-3 py-2 text-sm font-medium text-white/72 transition-colors hover:text-white"}
      aria-label="返回上一頁"
    >
      <>{variant === 'hero' ? <ChevronLeft className="h-[19px] w-[19px]" strokeWidth={1.9} /> : <><ArrowLeft className="h-4 w-4" />返回</>}</>
    </button>
  )
}

export function EventDetailFavoriteBtn({ eventId, variant = 'default' }: { eventId: string; variant?: ActionVariant }) {
  const { favorites } = useAppState()
  const isFavorited = favorites.has(eventId)
  return (
    <button
      type="button"
      onClick={() => favorites.toggle(eventId)}
      className={variant === 'hero' ? heroButtonClass : "rounded-full bg-white/10 backdrop-blur-sm p-2"}
      aria-label={isFavorited ? '取消收藏' : '收藏'}
    >
      <Heart
        strokeWidth={variant === 'hero' ? 1.9 : undefined}
        className={clsx(variant === 'hero' ? 'h-[19px] w-[19px] transition-colors' : 'h-4 w-4 transition-colors', isFavorited ? 'fill-primary text-primary' : 'text-white')}
      />
    </button>
  )
}

export function EventDetailReminderBtn({ eventId, variant = 'default' }: { eventId: string; variant?: ActionVariant }) {
  const { reminders } = useAppState()
  const hasReminder = reminders.has(eventId)
  return (
    <button
      type="button"
      onClick={() => reminders.toggle(eventId)}
      className={variant === 'hero' ? heroButtonClass : "rounded-full bg-white/10 backdrop-blur-sm p-2"}
      aria-label={hasReminder ? '取消提醒' : '設定提醒'}
    >
      <Bell
        strokeWidth={variant === 'hero' ? 1.9 : undefined}
        className={clsx(variant === 'hero' ? 'h-[19px] w-[19px] transition-colors' : 'h-4 w-4 transition-colors', hasReminder ? 'text-primary' : 'text-white')}
      />
    </button>
  )
}

const reminderChoices: ReminderChoice[] = ['day_before', 'week_before', 'both']

export function EventDetailReminderPicker({ eventId }: { eventId: string }) {
  const { reminders } = useAppState()
  const headingId = useId()
  const choice = typesToChoice(reminders.getTypes(eventId))
  const hasReminder = reminders.has(eventId)
  const status = hasReminder
    ? (choice ? `已設定：${REMINDER_CHOICE_LABELS[choice]}` : '已設定提醒')
    : '尚未設定提醒'

  return (
    <section className="rounded-[22px] border border-white/8 bg-white/[0.035] p-4">
      <h2 id={headingId} className="text-sm font-semibold text-white">提醒</h2>
      <p aria-live="polite" className="mt-1 text-xs text-white/70">{status}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <div role="group" aria-labelledby={headingId} className="flex flex-wrap gap-2">
          {reminderChoices.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={choice === option}
              disabled={reminders.isLoading}
              onClick={() => reminders.setTypes(eventId, choiceToTypes(option))}
              className={clsx(
                'min-h-[44px] rounded-full border px-3 text-sm font-medium transition-colors disabled:opacity-50',
                choice === option
                  ? 'border-violet-300/40 bg-violet-400/20 text-violet-100'
                  : 'border-white/10 bg-white/[0.04] text-white/75 hover:text-white',
              )}
            >
              {option === 'both' ? '兩者' : REMINDER_CHOICE_LABELS[option]}
            </button>
          ))}
        </div>
        {hasReminder && (
          <button
            type="button"
            disabled={reminders.isLoading}
            onClick={() => reminders.setTypes(eventId, [])}
            className="min-h-[44px] rounded-full px-3 text-sm text-white/70 transition-colors hover:text-white disabled:opacity-50"
          >
            關閉提醒
          </button>
        )}
      </div>
      {reminders.mode === 'local' && (
        <p className="mt-2 text-xs leading-relaxed text-white/60">目前只存在這台裝置；登入後才會收到站內通知</p>
      )}
    </section>
  )
}

export function EventDetailShareBtn({
  title = 'Idol Rhythm 活動',
  text,
  variant = 'icon',
}: {
  title?: string
  text?: string
  variant?: 'icon' | 'inline'
}) {
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    const url = window.location.href
    const shareData = { title, text, url }

    try {
      if (navigator.share) {
        await navigator.share(shareData)
        return
      }
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={handleShare}
        className="flex w-full items-center gap-3 text-left"
        aria-label="分享活動"
      >
        <span className="text-[#b6a9ff]">
          <Share2 className="h-4 w-4" />
        </span>
        <span>
          <span className="block text-sm font-semibold text-white">分享活動</span>
          <span className="block text-xs text-white/38">{copied ? '已複製連結' : '分享給朋友'}</span>
        </span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="rounded-full bg-white/10 backdrop-blur-sm p-2"
      aria-label={copied ? '已複製連結' : '分享'}
    >
      <Share2 className="h-4 w-4 text-white" />
    </button>
  )
}

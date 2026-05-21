'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Bell, Heart, Share2 } from 'lucide-react'
import { useAppState } from '@/lib/appState'
import clsx from 'clsx'

export function EventDetailBackBtn() {
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
      className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-3 py-2 text-sm font-medium text-white/72 transition-colors hover:text-white"
      aria-label="返回上一頁"
    >
      <ArrowLeft className="h-4 w-4" />
      返回
    </button>
  )
}

export function EventDetailFavoriteBtn({ eventId }: { eventId: string }) {
  const { favorites } = useAppState()
  const isFavorited = favorites.has(eventId)
  return (
    <button
      onClick={() => favorites.toggle(eventId)}
      className="rounded-full bg-white/10 backdrop-blur-sm p-2"
      aria-label={isFavorited ? '取消收藏' : '收藏'}
    >
      <Heart
        className={clsx('h-4 w-4 transition-colors', isFavorited ? 'fill-primary text-primary' : 'text-white')}
      />
    </button>
  )
}

export function EventDetailReminderBtn({ eventId }: { eventId: string }) {
  const { reminders } = useAppState()
  const hasReminder = reminders.has(eventId)
  return (
    <button
      onClick={() => reminders.toggle(eventId)}
      className="rounded-full bg-white/10 backdrop-blur-sm p-2"
      aria-label={hasReminder ? '取消提醒' : '設定提醒'}
    >
      <Bell
        className={clsx('h-4 w-4 transition-colors', hasReminder ? 'text-primary' : 'text-white')}
      />
    </button>
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

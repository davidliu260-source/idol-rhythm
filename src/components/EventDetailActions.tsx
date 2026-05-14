'use client'

import { Heart, Bell, Share2 } from 'lucide-react'
import { useAppState } from '@/lib/appState'
import clsx from 'clsx'

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

export function EventDetailShareBtn() {
  return (
    <button className="rounded-full bg-white/10 backdrop-blur-sm p-2" aria-label="分享">
      <Share2 className="h-4 w-4 text-white" />
    </button>
  )
}

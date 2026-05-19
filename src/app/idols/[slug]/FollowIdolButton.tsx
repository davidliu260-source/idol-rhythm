'use client'

import { Check, Plus } from 'lucide-react'
import { useAppState } from '@/lib/appState'

/**
 * F5: client-only follow toggle for the idol detail page.
 *
 * Reuses the global appState following controller so the followed state
 * stays in sync with the /idols grid card and the homepage "我追蹤的近期
 * 行程" section without needing any extra wiring.
 */
export default function FollowIdolButton({
  idolSlug,
  idolName,
}: {
  idolSlug: string
  idolName: string
}) {
  const { following } = useAppState()
  const isFollowing = following.has(idolSlug)

  return (
    <button
      type="button"
      onClick={() => following.toggle(idolSlug)}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
        isFollowing
          ? 'bg-primary text-white'
          : 'bg-card border border-card-border text-text-base hover:border-primary/50'
      }`}
      aria-pressed={isFollowing}
      aria-label={isFollowing ? `取消追蹤 ${idolName}` : `追蹤 ${idolName}`}
    >
      {isFollowing ? (
        <>
          <Check className="h-4 w-4" />
          已追蹤
        </>
      ) : (
        <>
          <Plus className="h-4 w-4" />
          追蹤
        </>
      )}
    </button>
  )
}

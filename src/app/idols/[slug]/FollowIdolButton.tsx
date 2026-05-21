'use client'

import { Check, Plus } from 'lucide-react'
import { useAppState } from '@/lib/appState'
import clsx from 'clsx'

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
      className={clsx(
        'inline-flex w-full items-center justify-center gap-1.5 rounded-full px-4 py-3 text-sm font-semibold transition-colors',
        isFollowing
          ? 'border border-[#ff6cb7]/28 bg-[#ff4ca1]/16 text-[#ff9cd0]'
          : 'border border-white/10 bg-white/[0.045] text-white/78 hover:text-white',
      )}
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

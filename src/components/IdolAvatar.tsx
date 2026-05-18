'use client'

import { useState } from 'react'
import clsx from 'clsx'

type Size = 'xs' | 'sm' | 'md' | 'lg'

interface IdolAvatarProps {
  name: string
  avatarUrl?: string | null
  /** Idol primary color (hex) used to build the fallback gradient block. */
  color?: string | null
  size?: Size
  className?: string
}

/**
 * Renders an idol thumbnail.
 *
 *   avatarUrl present     → <img>, object-cover
 *   avatarUrl missing OR
 *   image fails to load   → initial+gradient block (existing visual)
 *
 * The fallback intentionally matches the inline avatar style used in
 * EventCard / IdolsClient before I1a — same dimensions, same gradient
 * formula (`linear-gradient(135deg, color88, color)`).
 */
export default function IdolAvatar({
  name,
  avatarUrl,
  color,
  size = 'md',
  className,
}: IdolAvatarProps) {
  const [failed, setFailed] = useState(false)
  const useImg = Boolean(avatarUrl) && !failed
  const initial = name.charAt(0) || '?'
  const baseColor = color || '#6366f1'

  const sizeCls = SIZE_CLASSES[size]

  if (useImg) {
    return (
      <img
        src={avatarUrl as string}
        alt={name}
        loading="lazy"
        onError={() => setFailed(true)}
        className={clsx(sizeCls.wrap, 'object-cover bg-card', className)}
      />
    )
  }

  return (
    <div
      className={clsx(
        sizeCls.wrap,
        sizeCls.text,
        'flex items-center justify-center font-bold text-white',
        className,
      )}
      style={{ background: `linear-gradient(135deg, ${baseColor}88, ${baseColor})` }}
    >
      {initial}
    </div>
  )
}

const SIZE_CLASSES: Record<Size, { wrap: string; text: string }> = {
  xs: { wrap: 'h-8 w-8 flex-shrink-0 rounded-lg', text: 'text-sm' },
  sm: { wrap: 'h-10 w-10 flex-shrink-0 rounded-xl', text: 'text-base' },
  md: { wrap: 'h-12 w-12 flex-shrink-0 rounded-xl', text: 'text-lg' },
  lg: { wrap: 'h-16 w-16 flex-shrink-0 rounded-2xl', text: 'text-2xl' },
}

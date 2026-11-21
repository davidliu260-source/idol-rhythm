'use client'

import { useState } from 'react'
import clsx from 'clsx'
import { pickFallbackColor } from '@/lib/idolRingColor'

export { pickFallbackColor }

type Size = 'xs' | 'sm' | 'md' | 'lg'

interface IdolAvatarProps {
  name: string
  markSrc?: string | null
  decorative?: boolean
  avatarUrl?: string | null
  /** Idol primary color (hex) used to build the fallback gradient block. */
  color?: string | null
  size?: Size
  className?: string
}

/** Prefer the decorative B2v2 mark when the idol name is displayed alongside it. */
export default function IdolAvatar({
  name,
  markSrc,
  decorative = Boolean(markSrc),
  avatarUrl,
  color,
  size = 'md',
  className,
}: IdolAvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const src = markSrc ?? avatarUrl
  const initial = (name || '?').trim().charAt(0) || '?'
  const baseColor = color || pickFallbackColor(name)

  const sizeCls = SIZE_CLASSES[size]

  if (src && src !== failedSrc) {
    return (
      <img
        src={src}
        alt={decorative ? '' : name}
        loading="lazy"
        onError={() => setFailedSrc(src)}
        className={clsx(sizeCls.wrap, 'object-cover bg-card', className)}
      />
    )
  }

  return (
    <div
      className={clsx(
        sizeCls.wrap,
        sizeCls.text,
        'flex items-center justify-center font-bold text-white select-none',
        className,
      )}
      style={{ background: `linear-gradient(135deg, ${baseColor}88, ${baseColor})` }}
      aria-hidden={decorative}
      aria-label={decorative ? undefined : name}
    >
      {initial.toUpperCase()}
    </div>
  )
}

const SIZE_CLASSES: Record<Size, { wrap: string; text: string }> = {
  xs: { wrap: 'h-8 w-8 flex-shrink-0 rounded-lg', text: 'text-sm' },
  sm: { wrap: 'h-10 w-10 flex-shrink-0 rounded-xl', text: 'text-base' },
  md: { wrap: 'h-12 w-12 flex-shrink-0 rounded-xl', text: 'text-lg' },
  lg: { wrap: 'h-16 w-16 flex-shrink-0 rounded-2xl', text: 'text-2xl' },
}

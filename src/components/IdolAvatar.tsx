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
 *   image fails to load   → initial+gradient block
 *
 * I1b-C placeholder upgrade
 * ─────────────────────────
 *   - Uses `color` prop when admin has set one on idols.color
 *   - When color is null (the common case for freshly-seeded idols), derive
 *     a stable per-name color from FALLBACK_PALETTE so different idols don't
 *     all look like identical indigo squares
 *   - Initial is the first character of the name (works for Latin + CJK)
 *
 * The component is intentionally network-free — no external image hosts,
 * no Gravatar, no third-party CDN — it's just a colored block + letter.
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
  const initial = (name || '?').trim().charAt(0) || '?'
  const baseColor = color || pickFallbackColor(name)

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
        'flex items-center justify-center font-bold text-white select-none',
        className,
      )}
      style={{ background: `linear-gradient(135deg, ${baseColor}88, ${baseColor})` }}
      aria-label={name}
    >
      {initial.toUpperCase()}
    </div>
  )
}

// ── Stable name → color palette ─────────────────────────────────────────────
// Chosen to be visually distinct on the dark background and to feel "K-pop"
// enough (not corporate primary palette). Twelve entries gives ~8% collision
// rate over 50 idols, which is fine — collisions just mean two cards share
// a color, not that they're indistinguishable (initial letters differ).

const FALLBACK_PALETTE = [
  '#e91e8c', // primary pink (project base)
  '#8b5cf6', // violet
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#ef4444', // red
  '#ec4899', // pink
  '#14b8a6', // teal
  '#a855f7', // purple
  '#f97316', // orange
  '#06b6d4', // cyan
  '#84cc16', // lime
]

function pickFallbackColor(name: string): string {
  // Tiny FNV-1a-ish hash. We don't need cryptographic distribution; we just
  // need "same name → same color" so the placeholder is stable across renders.
  let h = 2166136261
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i)
    h = (h * 16777619) >>> 0
  }
  return FALLBACK_PALETTE[h % FALLBACK_PALETTE.length]
}

const SIZE_CLASSES: Record<Size, { wrap: string; text: string }> = {
  xs: { wrap: 'h-8 w-8 flex-shrink-0 rounded-lg', text: 'text-sm' },
  sm: { wrap: 'h-10 w-10 flex-shrink-0 rounded-xl', text: 'text-base' },
  md: { wrap: 'h-12 w-12 flex-shrink-0 rounded-xl', text: 'text-lg' },
  lg: { wrap: 'h-16 w-16 flex-shrink-0 rounded-2xl', text: 'text-2xl' },
}

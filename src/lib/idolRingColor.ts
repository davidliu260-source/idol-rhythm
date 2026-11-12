import { mixHex, contrastRatio } from './eventCategory'

export const RING_BG = '#0b0a11'
export const AVATAR_SURFACE = '#1c1b27'
export const DEFAULT_IDOL_COLOR_SENTINEL = '#6366f1'
export const RING_MIN_CONTRAST = 3

// ── Stable name → color palette ─────────────────────────────────────────────
// Chosen to be visually distinct on the dark background and to feel "K-pop"
// enough (not corporate primary palette). Twelve entries gives ~8% collision
// rate over 50 idols, which is fine — collisions just mean two cards share
// a color, not that they're indistinguishable (initial letters differ).

export const FALLBACK_PALETTE = [
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
] as const

export function pickFallbackColor(name: string): string {
  // Tiny FNV-1a-ish hash. We don't need cryptographic distribution; we just
  // need "same name → same color" so the placeholder is stable across renders.
  let h = 2166136261
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i)
    h = (h * 16777619) >>> 0
  }
  return FALLBACK_PALETTE[h % FALLBACK_PALETTE.length]
}

export function resolveGroupColor(color: string | null | undefined, name: string): string {
  if (typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color.trim()) &&
      color.trim().toLowerCase() !== DEFAULT_IDOL_COLOR_SENTINEL) {
    return color.trim().toLowerCase()
  }
  return pickFallbackColor(name)
}

export function ensureRingContrast(hex: string, bg: string = RING_BG): string {
  const base = hex.toLowerCase()
  if (contrastRatio(base, bg) >= RING_MIN_CONTRAST) return base
  for (let step = 1; step <= 20; step++) {
    const t = Math.round(step * 0.05 * 100) / 100
    const mixed = mixHex('#ffffff', base, t)
    if (contrastRatio(mixed, bg) >= RING_MIN_CONTRAST) return mixed
  }
  return '#ffffff'
}

export function getRingColor(color: string | null | undefined, name: string): string {
  return ensureRingContrast(resolveGroupColor(color, name))
}

export function avatarFallbackBackground(ring: string): string {
  return `linear-gradient(145deg, ${mixHex(ring, AVATAR_SURFACE, 0.34)}, ${AVATAR_SURFACE})`
}

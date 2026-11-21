import { B2V2_IDOL_COLORS } from './idolMarksData'
import { normalizeIdolColor, pickFallbackColor } from './idolRingColor'

export function resolveIdolColor({
  slug,
  color,
  name,
}: {
  slug: string
  color?: string | null
  name: string
}): string {
  const markColor = Object.prototype.hasOwnProperty.call(B2V2_IDOL_COLORS, slug) ? B2V2_IDOL_COLORS[slug] : undefined
  return normalizeIdolColor(color) ?? markColor ?? pickFallbackColor(name)
}

export function getIdolMarkSrc(slug: string): string | null {
  return Object.prototype.hasOwnProperty.call(B2V2_IDOL_COLORS, slug) ? `/idol-marks/${slug}.svg` : null
}

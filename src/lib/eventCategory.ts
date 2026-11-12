// T30a 前台改版 v4 類型地基。純 TS、零 import，供 node 檢查腳本直接執行。
export type EventCategoryId = 'concert' | 'popup' | 'fanmeet' | 'cafe' | 'exhibition' | 'ticket' | 'other'
export type CategoryGlyphId = EventCategoryId | 'all'
export interface EventCategoryMeta {
  id: EventCategoryId
  label: string
  accent: string
  heroStops: ReadonlyArray<{ color: string; at: number }>
}
export interface EventCategoryTokens {
  accent: string
  heroBackground: string
  cardBackground: string
  cardBorder: string
  cardGlow: string
  tileBackground: string
  tileBorder: string
  tileWeekday: string
  glyphColor: string
  chipIconBackground: string
  chipActiveBackground: string
  infoIconBackground: string
  infoIconBorder: string
}
export const EVENT_CATEGORY_ORDER: readonly EventCategoryId[] = ['concert', 'popup', 'fanmeet', 'cafe', 'exhibition', 'ticket', 'other']
export const EVENT_CATEGORIES: Record<EventCategoryId, EventCategoryMeta> = {
  concert: { id: 'concert', label: '演唱會', accent: '#9a7cff', heroStops: [{ color: '#5a2df0', at: 0 }, { color: '#a022b8', at: 55 }, { color: '#f0307f', at: 100 }] },
  popup: { id: 'popup', label: '快閃店', accent: '#ff9a3d', heroStops: [{ color: '#f59e0b', at: 0 }, { color: '#e8481c', at: 100 }] },
  fanmeet: { id: 'fanmeet', label: '見面會', accent: '#f45da8', heroStops: [{ color: '#ff5fae', at: 0 }, { color: '#cf1259', at: 100 }] },
  cafe: { id: 'cafe', label: '生咖', accent: '#2fcf9b', heroStops: [{ color: '#12bd88', at: 0 }, { color: '#0a6f66', at: 100 }] },
  exhibition: { id: 'exhibition', label: '展覽', accent: '#4da3ff', heroStops: [{ color: '#4f93ff', at: 0 }, { color: '#4034c4', at: 100 }] },
  ticket: { id: 'ticket', label: '售票', accent: '#ff5468', heroStops: [{ color: '#ff5a6c', at: 0 }, { color: '#9c1530', at: 100 }] },
  other: { id: 'other', label: '其他', accent: '#9aa0b8', heroStops: [{ color: '#2a2938', at: 0 }, { color: '#15141d', at: 100 }] },
}
export const ALL_CATEGORY = {
  id: 'all', label: '全部', accent: '#e9e6f5',
  chipIconBackground: 'linear-gradient(135deg, #ff2d95, #8b5cf6 60%, #22d3ee)',
  legendBackground: '#1c1b27',
} as const
export const CATEGORY_NEUTRALS = {
  surface: '#15141d', surface2: '#1c1b27', line: 'rgba(255, 255, 255, 0.07)',
  text: '#f6f4fb', muted: '#a09db4', faint: '#8a87a0', tileBase: '#14131c',
  cardEnd: '#16151f', weekdayBase: '#c9c6dc', brandPink: '#ff2d95',
} as const
export const HERO_SCRIM_ALPHA = 0.35

function channels(hex: string): number[] {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error('Expected #rrggbb')
  return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16))
}
const clamp = (value: number) => Math.max(0, Math.min(1, value))

export function withAlpha(hex: string, alpha: number): string {
  return `rgba(${channels(hex).join(', ')}, ${clamp(alpha)})`
}
export function mixHex(a: string, b: string, weightA: number): string {
  const first = channels(a)
  const second = channels(b)
  const weight = clamp(weightA)
  return '#' + first.map((value, index) =>
    Math.round(value * weight + second[index] * (1 - weight)).toString(16).padStart(2, '0'),
  ).join('')
}
export function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex).map((value) => {
    const channel = value / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export function contrastRatio(a: string, b: string): number {
  const first = relativeLuminance(a)
  const second = relativeLuminance(b)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}
export function heroGradient(id: EventCategoryId): string {
  return `linear-gradient(150deg, ${EVENT_CATEGORIES[id].heroStops.map(({ color, at }) => `${color} ${at}%`).join(', ')})`
}
export function getCategoryTokens(id: EventCategoryId): EventCategoryTokens {
  const c = EVENT_CATEGORIES[id].accent
  const n = CATEGORY_NEUTRALS
  return {
    accent: c,
    heroBackground: heroGradient(id),
    cardBackground: `linear-gradient(100deg, ${n.surface} 24%, ${mixHex(c, n.cardEnd, 0.4)} 100%)`,
    cardBorder: withAlpha(c, 0.22),
    cardGlow: `radial-gradient(circle, ${withAlpha(c, 0.38)}, transparent 70%)`,
    tileBackground: mixHex(c, n.tileBase, 0.18),
    tileBorder: withAlpha(c, 0.4),
    tileWeekday: mixHex(c, n.weekdayBase, 0.4),
    glyphColor: mixHex(c, '#ffffff', 0.48),
    chipIconBackground: `linear-gradient(145deg, ${c}, ${mixHex(c, '#000000', 0.6)})`,
    chipActiveBackground: mixHex(c, n.surface, 0.22),
    infoIconBackground: mixHex(c, n.surface, 0.15),
    infoIconBorder: withAlpha(c, 0.32),
  }
}
const FANMEET_SUB_TYPES = new Set(['fanmeet', 'fansign'])
export function getEventCategory(
  event: { type?: string | null; subType?: string | null } | null | undefined,
): EventCategoryId {
  const subType = event?.subType
  if (subType && FANMEET_SUB_TYPES.has(subType)) return 'fanmeet'
  if (subType === 'popup_store') return 'popup'
  if (subType === 'exhibition') return 'exhibition'
  if (subType === 'birthday_cafe') return 'cafe'
  if (event?.type === 'ticketing') return 'ticket'
  if (event?.type === 'concert' || subType === 'award') return 'concert'
  return 'other'
}

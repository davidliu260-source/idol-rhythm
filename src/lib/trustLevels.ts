export const PUBLIC_TRUST_LEVELS = ['official', 'media', 'aggregator'] as const
export const CALENDAR_NOTIFY_TRUST_LEVELS = ['official', 'media'] as const
export const AGGREGATOR_LABEL = '非官方整理'
export function getPublicTrustLabel(level: string | null | undefined): '官方確認' | '媒體確認' | '非官方整理' | null {
  return level === 'official' ? '官方確認' : level === 'media' ? '媒體確認' : level === 'aggregator' ? AGGREGATOR_LABEL : null
}

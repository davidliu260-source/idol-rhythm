/**
 * T35 A-3：售票階段（event_ticket_sales）的顯示與狀態計算。
 * 純函式、不碰 Supabase；所有時間一律以台北時間（Asia/Taipei）顯示與判斷。
 */
import { TAIPEI_TIME_ZONE } from './taipeiDate'
import { platformByCode, platformForUrl, unknownTicketPlatformWarning, type TicketPlatform } from './ticketPlatforms'

export const TICKET_SALE_STAGES = ['presale', 'general', 'added', 'apply', 'other'] as const
export type TicketSaleStage = (typeof TICKET_SALE_STAGES)[number]

export const TICKET_SALE_ELIGIBILITIES = [
  'public', 'fanclub_member', 'promoter_member', 'telco_member',
  'card_or_sponsor', 'partner_platform', 'registration_required', 'lottery',
] as const
export type TicketSaleEligibility = (typeof TICKET_SALE_ELIGIBILITIES)[number]

export const TICKET_SALE_VERIFICATIONS = ['phone_sms', 'real_name', 'member_login', 'other'] as const
export type TicketSaleVerification = (typeof TICKET_SALE_VERIFICATIONS)[number]

export const STAGE_LABELS: Record<TicketSaleStage, string> = {
  presale: '預購',
  general: '一般開賣',
  added: '加場加售',
  apply: '報名／抽選',
  other: '其他',
}

export const ELIGIBILITY_LABELS: Record<TicketSaleEligibility, string> = {
  public: '公開',
  fanclub_member: '官方會員',
  promoter_member: '主辦會員',
  telco_member: '電信會員',
  card_or_sponsor: '信用卡',
  registration_required: '須先登記',
  lottery: '抽選',
  partner_platform: '合作平台',
}

export const VERIFICATION_LABELS: Record<TicketSaleVerification, string> = {
  phone_sms: '須手機驗證',
  real_name: '實名制',
  member_login: '須會員登入',
  other: '須先完成指定步驟',
}

/** 前台讀到的一列售票階段（camelCase）。 */
export interface TicketSale {
  id: string
  stage: TicketSaleStage
  label: string
  startsAt: string | null
  endsAt: string | null
  platform: string | null
  url: string | null
  eligibility: TicketSaleEligibility
  eligibilityNote: string | null
  requiresVerification: TicketSaleVerification | null
  sourceUrl: string | null
  verifiedAt: string | null
}

export interface TicketSaleRow {
  id: string
  stage: string
  label: string
  starts_at: string | null
  ends_at: string | null
  platform: string | null
  url: string | null
  eligibility: string
  eligibility_note: string | null
  requires_verification: string | null
  source_url: string | null
  verified_at: string | null
}

const oneOf = <T extends string>(list: readonly T[], value: string | null | undefined, fallback: T): T =>
  (list as readonly string[]).includes(value ?? '') ? value as T : fallback

export function rowToTicketSale(row: TicketSaleRow): TicketSale {
  return {
    id: row.id,
    stage: oneOf(TICKET_SALE_STAGES, row.stage, 'other'),
    label: row.label,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    platform: row.platform,
    url: row.url,
    eligibility: oneOf(TICKET_SALE_ELIGIBILITIES, row.eligibility, 'public'),
    eligibilityNote: row.eligibility_note,
    requiresVerification: row.requires_verification
      ? oneOf(TICKET_SALE_VERIFICATIONS, row.requires_verification, 'other') : null,
    sourceUrl: row.source_url,
    verifiedAt: row.verified_at,
  }
}

const ms = (iso: string | null | undefined): number | null => {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : null
}

/** 顯示排序：有開賣時間的依時間先後，沒有時間的放最後；同時間依階段、標題。 */
export function sortTicketSales<T extends Pick<TicketSale, 'startsAt' | 'stage' | 'label'>>(sales: readonly T[]): T[] {
  return [...sales].sort((a, b) => {
    const ta = ms(a.startsAt), tb = ms(b.startsAt)
    if (ta !== tb) return ta === null ? 1 : tb === null ? -1 : ta - tb
    return TICKET_SALE_STAGES.indexOf(a.stage) - TICKET_SALE_STAGES.indexOf(b.stage) || a.label.localeCompare(b.label)
  })
}

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TAIPEI_TIME_ZONE, year: 'numeric', month: 'numeric', day: 'numeric',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
})
const WEEKDAY_ZH: Record<string, string> = { Sun: '日', Mon: '一', Tue: '二', Wed: '三', Thu: '四', Fri: '五', Sat: '六' }

function taipeiParts(iso: string | null | undefined) {
  const t = ms(iso)
  if (t === null) return null
  const parts = partsFormatter.formatToParts(t)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value ?? ''
  return { year: Number(part('year')), month: Number(part('month')), day: Number(part('day')), hour: part('hour'), minute: part('minute'), weekday: WEEKDAY_ZH[part('weekday')] ?? '' }
}

/** 「11/28（六）12:00」（台北時間）。無效時間回 null。 */
export function formatTaipeiSaleTime(iso: string | null | undefined): string | null {
  const p = taipeiParts(iso)
  return p ? `${p.month}/${p.day}（${p.weekday}）${p.hour}:${p.minute}` : null
}

/** 「11/28 12:00」（台北時間，卡片徽章用）。 */
export function formatTaipeiShortTime(iso: string | null | undefined): string | null {
  const p = taipeiParts(iso)
  return p ? `${p.month}/${p.day} ${p.hour}:${p.minute}` : null
}

export type TicketSaleStatus = 'upcoming' | 'open' | 'ended' | 'unknown'
export interface TicketSaleStatusInfo { status: TicketSaleStatus; label: string }

function distanceLabel(diffMs: number): string {
  const minutes = Math.max(1, Math.ceil(diffMs / 60000))
  if (minutes < 60) return `${minutes} 分鐘`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小時`
  const days = Math.floor(hours / 24)
  return `${days} 天`
}

/**
 * 狀態：未開賣（顯示距離）／進行中／已結束。
 * - 沒有開賣時間 → unknown（「開賣時間未公布」）。
 * - 已開賣且沒有結束時間 → 進行中（一般開賣通常沒有結束時間）。
 */
export function ticketSaleStatus(sale: Pick<TicketSale, 'startsAt' | 'endsAt'>, now: Date = new Date()): TicketSaleStatusInfo {
  const start = ms(sale.startsAt), end = ms(sale.endsAt), t = now.getTime()
  if (end !== null && t >= end) return { status: 'ended', label: '已結束' }
  if (start === null) return { status: 'unknown', label: '開賣時間未公布' }
  if (t < start) return { status: 'upcoming', label: `未開賣・還有 ${distanceLabel(start - t)}` }
  return { status: 'open', label: '進行中' }
}

/** 卡片徽章：取「開賣時間在未來」中最近的一列；沒有就回 null（不顯示空徽章）。 */
export function nextTicketSaleBadge(startsAt: ReadonlyArray<string | null | undefined> | null | undefined, now: Date = new Date()): string | null {
  const t = now.getTime()
  const next = (startsAt ?? []).map(ms).filter((v): v is number => v !== null && v > t).sort((a, b) => a - b)[0]
  if (next === undefined) return null
  return `${formatTaipeiShortTime(new Date(next).toISOString())} 開賣`
}

/** 平台：先看 platform 代碼，再看網址網域。 */
export function resolveSalePlatform(sale: Pick<TicketSale, 'platform' | 'url'>): TicketPlatform | null {
  return platformByCode(sale.platform) ?? platformForUrl(sale.url)
}

export interface TicketSaleView {
  id: string
  stageLabel: string
  label: string
  timeLabel: string | null
  endLabel: string | null
  platformName: string | null
  eligibilityLabel: string
  eligibilityNote: string | null
  verificationLabel: string | null
  href: string | null
  unknownPlatformWarning: string | null
  status: TicketSaleStatusInfo
}

export function toTicketSaleView(sale: TicketSale, now: Date = new Date()): TicketSaleView {
  const platform = resolveSalePlatform(sale)
  const href = sale.url?.trim() || null
  return {
    id: sale.id,
    stageLabel: STAGE_LABELS[sale.stage],
    label: sale.label,
    timeLabel: formatTaipeiSaleTime(sale.startsAt),
    endLabel: formatTaipeiSaleTime(sale.endsAt),
    platformName: platform?.name ?? (sale.platform?.trim() && sale.platform !== 'other' ? sale.platform : null),
    eligibilityLabel: ELIGIBILITY_LABELS[sale.eligibility],
    eligibilityNote: sale.eligibilityNote?.trim() || null,
    verificationLabel: sale.requiresVerification ? VERIFICATION_LABELS[sale.requiresVerification] : null,
    href,
    unknownPlatformWarning: href ? unknownTicketPlatformWarning(href) : null,
    status: ticketSaleStatus(sale, now),
  }
}

/** 前置提醒：只列出本活動用到、且平台表 prerequisite 有值的平台（不推測）。 */
export function platformPrerequisites(sales: ReadonlyArray<Pick<TicketSale, 'platform' | 'url'>>, ticketUrl?: string | null): Array<{ code: string; name: string; prerequisite: string }> {
  const platforms = [...sales.map(resolveSalePlatform), platformForUrl(ticketUrl)]
  const seen = new Map<string, { code: string; name: string; prerequisite: string }>()
  for (const p of platforms) if (p?.prerequisite && !seen.has(p.code)) seen.set(p.code, { code: p.code, name: p.name, prerequisite: p.prerequisite })
  return Array.from(seen.values())
}

/** 有任何票務資訊（售票階段或單一購票連結）就要顯示防詐提醒。 */
export function hasTicketInfo(sales: ReadonlyArray<unknown> | null | undefined, ticketUrl?: string | null): boolean {
  return (sales?.length ?? 0) > 0 || Boolean(ticketUrl?.trim())
}

// ── 後台：台北時間輸入 ↔ timestamptz ──────────────────────────────────────────

/** `<input type="datetime-local">` 的值（台北時間）→ ISO（+08:00）。空字串回 null；格式錯回 undefined。 */
export function taipeiLocalToIso(value: string | null | undefined): string | null | undefined {
  const v = value?.trim()
  if (!v) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(v)
  if (!m) return undefined
  const [, y, mo, d, h, mi, s = '00'] = m
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}+08:00`
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return undefined
  // 擋掉 2026-02-30 這類會被 Date 進位的值
  const back = taipeiParts(iso)
  if (!back || back.year !== Number(y) || back.month !== Number(mo) || back.day !== Number(d)) return undefined
  return iso
}

/** ISO → `datetime-local` 值（台北時間，到分鐘）。 */
export function isoToTaipeiLocal(iso: string | null | undefined): string {
  const p = taipeiParts(iso)
  if (!p) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${p.hour}:${p.minute}`
}

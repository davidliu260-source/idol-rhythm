/**
 * T35 B-3：把 venueCalendar.ts 已抽到 raw_data 的欄位帶進 events／event_ticket_sales。
 * 只處理 parser_type = 'venue_calendar'；沒抽到的欄位一律留空，不用預設值。
 * price_text 本單不處理。
 */
import { isOfficialTicketUrl, platformForUrl } from '../ticketPlatforms'
import type { CandidateInput } from './evaluateCandidate'

export interface TicketSaleInsert {
  event_id: string
  stage: 'general'
  label: string
  starts_at: string
  ends_at: string | null
  platform: string | null
  url: string | null
  eligibility: 'public'
  source_url: string | null
}

export interface VenueCalendarFields {
  time: string | null
  timeStatus: 'announced' | null
  /** 只在官方售票網域時有值 */
  ticketUrl: string | null
  /** 一般售票那一列（event_id 由建立活動後補上） */
  sale: Omit<TicketSaleInsert, 'event_id'> | null
}

const EMPTY: VenueCalendarFields = { time: null, timeStatus: null, ticketUrl: null, sale: null }
const PRESALE = /預購|預售|優先|會員|卡友|限定|先行|presale/i
const GENERAL = /一般|全面|正式|啟售|開賣|開售|售票|general/i

const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}
const str = (v: unknown): string | null => typeof v === 'string' && v.trim() ? v.trim() : null

export function venueCalendarFields(c: Pick<CandidateInput, 'raw_data' | 'source_url'>, parserType: string | null): VenueCalendarFields {
  if (parserType !== 'venue_calendar') return EMPTY
  const raw = record(c.raw_data)
  const showTime = str(raw.show_time)
  const time = showTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(showTime) ? showTime : null
  const rawTicket = str(raw.ticket_url)
  const ticketUrl = rawTicket && isOfficialTicketUrl(rawTicket) ? rawTicket : null

  // 只寫「一般售票」一列：標題像一般開賣、且不像預購；預購階段資格無法從場館頁判斷，不寫（避免猜）。
  const lines = Array.isArray(raw.on_sale) ? raw.on_sale.map(record) : []
  const candidates = lines
    .map(l => ({ label: str(l.label), starts: str(l.starts_at), ends: str(l.ends_at) }))
    .filter(l => l.starts && Number.isFinite(Date.parse(l.starts)) && !(l.label && PRESALE.test(l.label)))
  const general = candidates.filter(l => l.label && GENERAL.test(l.label))
  const pick = (general.length ? general : candidates.length === 1 ? candidates : [])
    .sort((a, b) => Date.parse(a.starts!) - Date.parse(b.starts!))[0]
  const sale = pick ? {
    stage: 'general' as const,
    label: pick.label ?? '一般售票',
    starts_at: pick.starts!,
    ends_at: pick.ends && Number.isFinite(Date.parse(pick.ends)) ? pick.ends : null,
    platform: ticketUrl ? platformForUrl(ticketUrl)?.code ?? null : null,
    url: ticketUrl,
    eligibility: 'public' as const,
    source_url: str(c.source_url),
  } : null

  return { time, timeStatus: time ? 'announced' : null, ticketUrl, sale }
}

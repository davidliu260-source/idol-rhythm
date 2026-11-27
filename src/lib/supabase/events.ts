import { PUBLIC_TRUST_LEVELS } from '../trustLevels'
import { findOfficialNoticeUrl } from '../officialNotice'
import type { Event, EventType, EventSubType, EventStatus, EventSource, TrustLevel, SourceType, Idol, GenderType, IdolCategory, GroupOrSolo } from '../types'
import { getSupabaseClient } from './client'
import { rowToTicketSale, sortTicketSales, type TicketSale, type TicketSaleRow } from '../ticketSales'
import { addDaysToKey, taipeiToday } from '../taipeiDate'

// ── Supabase row shapes (snake_case, mirrors the DB schema) ───────────────────

interface SupabaseEventRow {
  id: string
  idol_id: string
  idol_name: string
  title: string
  type: string
  sub_type: string | null
  status: string
  trust_level: string
  date: string
  start_date: string | null
  end_date: string | null
  date_label: string | null
  time: string | null
  location: string | null
  location_name_zh: string | null
  city: string | null
  venue_name: string | null
  address: string | null
  map_url: string | null
  display_title_zh: string | null
  display_summary_zh: string | null
  translation_status: string | null
  country: string
  country_flag: string
  /** T35（migration 073）。getPublishedEvents 的欄位清單明列這兩欄，需要 073 已套用（正式庫已套用）。 */
  country_code?: string | null
  time_status?: string | null
  description: string | null
  tags: string[] | null
  ticket_url: string | null
  stream_url: string | null
  is_published: boolean
  published_at: string | null
  updated_at?: string | null
  idols?: { slug: string; avatar_url: string | null; color: string | null } | null
  event_sources?: SupabaseEventSourceRow[] | null
}

interface SupabaseIdolRow {
  id: string
  slug: string
  name: string
  korean_name: string | null
  type: string
  gender: string | null
  category: string | null
  agency: string | null
  debut_date: string | null
  color: string | null
  gradient: string | null
  genres: string[] | null
  member_count: number | null
  description: string | null
  is_active: boolean
  avatar_url: string | null
}

interface SupabaseEventSourceRow {
  id: string
  event_id: string
  level: string
  label: string
  type: string | null
  url: string | null
}

// ── Conversion helpers ────────────────────────────────────────────────────────

function rowToEvent(row: SupabaseEventRow): Event {
  // Single source of truth: events.trust_level. event_sources rows are still
  // used for label / url / source-type metadata, but their `level` column is
  // deliberately ignored here to prevent drift between the two stores.
  // (Historical bug: bulk-publish updated events.trust_level but left
  // event_sources.level untouched, so the badge kept saying "待確認".)
  const primarySource = row.event_sources?.[0]
  const source: EventSource = {
    level: row.trust_level as TrustLevel,
    label: primarySource?.label ?? row.idol_name,
    type: (primarySource?.type ?? undefined) as SourceType | undefined,
    url: primarySource?.url ?? undefined,
  }
  const displayTitleZh = row.display_title_zh?.trim()
  const originalTitle =
    displayTitleZh && displayTitleZh !== row.title ? row.title : undefined
  const displayLocation = row.location_name_zh?.trim() || row.location || undefined
  const startDate = row.start_date ?? row.date
  const officialNoticeUrl = findOfficialNoticeUrl(row.event_sources)

  return {
    id: row.id,
    // Use slug as idolId to match the current frontend's mock-data convention.
    // Falls back to the UUID if the idols join is unavailable.
    idolId: row.idols?.slug ?? row.idol_id,
    idolName: row.idol_name,
    idolAvatarUrl: row.idols?.avatar_url ?? null,
    idolColor: row.idols?.color ?? null,
    title: displayTitleZh || row.title,
    originalTitle,
    type: row.type as EventType,
    subType: (row.sub_type ?? undefined) as EventSubType | undefined,
    status: row.status as EventStatus,
    updatedAt: row.updated_at ?? undefined,
    date: startDate,
    startDate,
    endDate: row.end_date ?? undefined,
    dateLabel: row.date_label ?? undefined,
    time: row.time ?? undefined,
    location: displayLocation,
    originalLocation:
      displayLocation && row.location && displayLocation !== row.location
        ? row.location
        : undefined,
    city: row.city ?? undefined,
    venueName: row.venue_name ?? undefined,
    address: row.address ?? undefined,
    mapUrl: row.map_url ?? undefined,
    country: row.country,
    countryFlag: row.country_flag,
    ...(row.country_code ? { countryCode: row.country_code } : {}),
    ...(row.time_status === 'unknown' || row.time_status === 'announced' || row.time_status === 'tba' ? { timeStatus: row.time_status } : {}),
    source,
    description: row.description ?? '',
    displaySummaryZh: row.display_summary_zh ?? undefined,
    ...(officialNoticeUrl ? { officialNoticeUrl } : {}),
    translationStatus: (row.translation_status ?? undefined) as Event['translationStatus'],
    isFavorited: false, // UI state — managed by localStorage / auth layer
    ticketUrl: row.ticket_url ?? undefined,
    streamUrl: row.stream_url ?? undefined,
    publishedAt: row.published_at ?? undefined,
    tags: row.tags ?? [],
  }
}

function rowToIdol(row: SupabaseIdolRow): Idol {
  return {
    // Use slug as id to match the current frontend's mock-data convention.
    id: row.slug,
    name: row.name,
    koreanName: row.korean_name ?? '',
    type: row.type as GroupOrSolo,
    gender: (row.gender ?? undefined) as GenderType | undefined,
    category: (row.category ?? undefined) as IdolCategory | undefined,
    agency: row.agency ?? '',
    debut: row.debut_date ?? '',
    color: row.color ?? '#6366f1',
    gradient: row.gradient ?? 'from-indigo-900 to-purple-700',
    genres: row.genres ?? [],
    memberCount: row.member_count ?? undefined,
    following: false, // UI state — managed by localStorage / auth layer
    description: row.description ?? '',
    avatarUrl: row.avatar_url ?? null,
  }
}

function rowToEventSource(row: SupabaseEventSourceRow): EventSource {
  return {
    level: row.level as TrustLevel,
    label: row.label,
    type: (row.type ?? undefined) as SourceType | undefined,
    url: row.url ?? undefined,
  }
}

// ── Public read functions ─────────────────────────────────────────────────────

/**
 * Must #12：getPublishedEvents 只選 rowToEvent 真的會用到的欄位（原本 select('*')）。
 * 這份清單要和 SupabaseEventRow／rowToEvent 保持一致；新增前台要顯示的欄位時，
 * 要同時加在這裡，scripts/check-must12-hot-pages-isr.mjs 會核對。
 * 其中 country_code、time_status 來自 migration 073（正式庫已套用）。
 */
export const PUBLISHED_EVENT_COLUMNS = [
  'id', 'idol_id', 'idol_name', 'title', 'type', 'sub_type', 'status', 'trust_level',
  'date', 'start_date', 'end_date', 'date_label', 'time',
  'location', 'location_name_zh', 'city', 'venue_name', 'address', 'map_url',
  'display_title_zh', 'display_summary_zh', 'translation_status',
  'country', 'country_flag', 'country_code', 'time_status',
  'description', 'tags', 'ticket_url', 'stream_url', 'published_at', 'updated_at',
] as const

/**
 * 預設日期下限：只讀「台北今天往前 1 天」之後還沒結束的活動，已結束很久的不再整批搬回來。
 * 多留 1 天是給時區與 ISR 快取（最多 5 分鐘）的緩衝；前台頁面仍會用 listCurrentEvents 精確過濾。
 */
export const PUBLISHED_EVENTS_DEFAULT_LOOKBACK_DAYS = 1

/**
 * 日期下限條件（PostgREST or 語法）。結束日的判定和前台一致：end_date ?? start_date ?? date，
 * 所以跨多天、早就開始但還沒結束的活動會留下來。三個欄位都是 date 型別，直接用 YYYY-MM-DD 比較。
 */
export function buildPublishedEventsDateFloorFilter(floorKey: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(floorKey)) throw new Error('Invalid date floor')
  return [
    `end_date.gte.${floorKey}`,
    `and(end_date.is.null,start_date.gte.${floorKey})`,
    `and(end_date.is.null,start_date.is.null,date.gte.${floorKey})`,
  ].join(',')
}

export interface PublishedEventsOptions {
  /** 查詢失敗或沒有 client 都丟錯（ICS、sitemap 用，要區分「沒活動」和「讀不到」）。 */
  throwOnError?: boolean
  /**
   * 只有「查詢本身失敗」才丟錯；沒設定 Supabase（例如沒有環境變數的本機建置）仍回空陣列。
   * ISR 頁面用：重新產生頁面時讀庫失敗就丟錯，Next 會繼續提供上一份舊頁面，
   * 而不是把空清單快取 5 分鐘。
   */
  throwOnQueryError?: boolean
  /**
   * 往前看幾天（台北今天往前算）。預設 1 天。傳 null 代表不設下限、讀全部（如 /atlas 的已結束活動）。
   * 需要較長歷史的呼叫端（ICS 要 30 天）要明確傳入。
   */
  lookbackDays?: number | null
  /** 測試用。 */
  now?: Date
}

/**
 * Returns published, non-cancelled events at the public trust levels.
 * An unavailable client or failed query returns an empty array by default.
 * Use throwOnError when a query failure must be distinguished from an empty result.
 * By default only events that have not ended before (Taipei today - 1 day) are read;
 * pass lookbackDays (or null for no floor) when past events are needed.
 */
export async function getPublishedEvents({
  throwOnError = false,
  throwOnQueryError = false,
  lookbackDays = PUBLISHED_EVENTS_DEFAULT_LOOKBACK_DAYS,
  now = new Date(),
}: PublishedEventsOptions = {}): Promise<Event[]> {
  if (lookbackDays !== null && (!Number.isInteger(lookbackDays) || lookbackDays < 0)) {
    throw new RangeError('lookbackDays must be a non-negative integer or null')
  }
  const supabase = getSupabaseClient()
  if (!supabase) {
    if (throwOnError) throw new Error('Published events client is unavailable')
    return []
  }

  let query = supabase
    .from('events')
    .select(`${PUBLISHED_EVENT_COLUMNS.join(', ')}, idols!events_idol_id_fkey!inner(slug, avatar_url, color), event_sources(id, event_id, level, label, type, url)`)
    .eq('is_published', true)
    .in('trust_level', [...PUBLIC_TRUST_LEVELS])
    .neq('status', 'cancelled')
  if (lookbackDays !== null) {
    query = query.or(buildPublishedEventsDateFloorFilter(addDaysToKey(taipeiToday(now), -lookbackDays)))
  }

  const [{ data, error }, saleStarts] = await Promise.all([
    query.order('date', { ascending: true }),
    getUpcomingTicketSaleStarts(now),
  ])

  if (error || !data) {
    if (error) {
      console.error('[getPublishedEvents] events query failed', {
        code: error.code ?? null,
        message: error.message ?? null,
        details: error.details ?? null,
        hint: error.hint ?? null,
      })
    }
    if (throwOnError || throwOnQueryError) throw new Error('Published events query failed')
    return []
  }

  return (data as unknown as SupabaseEventRow[]).map((row) => {
    const event = rowToEvent(row)
    const starts = saleStarts.get(row.id)
    return starts?.length ? { ...event, ticketSaleStartsAt: starts } : event
  })
}

/**
 * T35：一次批次讀所有「未來開賣」的售票階段開始時間（卡片徽章用，避免 N+1）。
 * RLS 只放行已發布活動的列。表不存在（073 未套用）或任何錯誤 → 當作沒有，不影響清單。
 */
async function getUpcomingTicketSaleStarts(now: Date = new Date()): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>()
  const supabase = getSupabaseClient()
  if (!supabase) return result
  try {
    const { data, error } = await supabase
      .from('event_ticket_sales')
      .select('event_id, starts_at')
      .gt('starts_at', now.toISOString())
      .order('starts_at', { ascending: true })
    if (error || !data) return result
    for (const row of data as Array<{ event_id: string; starts_at: string | null }>) {
      if (!row.starts_at) continue
      result.set(row.event_id, [...(result.get(row.event_id) ?? []), row.starts_at])
    }
  } catch {
    // 讀不到售票階段不影響清單
  }
  return result
}

/**
 * T35：單一活動的售票階段（詳情頁）。公開 client，RLS 擋未發布活動。
 * 讀取失敗（含 073 未套用）一律回空陣列，前台退回單一購票連結。
 */
export async function getEventTicketSales(eventId: string): Promise<TicketSale[]> {
  const supabase = getSupabaseClient()
  if (!supabase) return []
  try {
    const { data, error } = await supabase
      .from('event_ticket_sales')
      .select('id, stage, label, starts_at, ends_at, platform, url, eligibility, eligibility_note, requires_verification, source_url, verified_at')
      .eq('event_id', eventId)
    if (error || !data) return []
    return sortTicketSales((data as TicketSaleRow[]).map(rowToTicketSale))
  } catch {
    return []
  }
}

/**
 * Returns all active idols.
 * Returns an empty array if Supabase is not configured or the query fails.
 */
export async function getActiveIdols({ throwOnError = false, throwOnQueryError = false } = {}): Promise<Idol[]> {
  const supabase = getSupabaseClient()
  if (!supabase) {
    if (throwOnError) throw new Error('Active idols client is unavailable')
    return []
  }

  const { data, error } = await supabase
    .from('idols')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error || !data) {
    if (throwOnError || throwOnQueryError) throw new Error('Active idols query failed')
    return []
  }

  return (data as SupabaseIdolRow[]).map(rowToIdol)
}

/**
 * Returns a single idol by slug for the F5 idol detail page.
 * Returns null when not found, inactive, or Supabase unavailable.
 *
 * Inactive idols deliberately 404 so we don't leak dormant rows publicly —
 * admin can re-activate them via /admin/idols if needed.
 */
export async function getIdolBySlug(slug: string): Promise<Idol | null> {
  const supabase = getSupabaseClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('idols')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()

  if (error || !data) return null
  return rowToIdol(data as SupabaseIdolRow)
}

/**
 * Returns a single published event by UUID.
 * Returns null if not found, not published, or Supabase is not configured.
 */
export async function getEventById(id: string): Promise<Event | null> {
  const supabase = getSupabaseClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('events')
    .select('*, idols!events_idol_id_fkey!inner(slug, avatar_url, color), event_sources(id, event_id, level, label, type, url)')
    .eq('id', id)
    .eq('is_published', true)
    .in('trust_level', [...PUBLIC_TRUST_LEVELS])
    .neq('status', 'cancelled')
    .single()

  if (error || !data) {
    if (error) {
      console.error('[getEventById] events query failed', {
        code: error.code ?? null,
        message: error.message ?? null,
        details: error.details ?? null,
        hint: error.hint ?? null,
      })
    }
    return null
  }

  return rowToEvent(data as SupabaseEventRow)
}

/**
 * Returns all sources for a given event ID.
 * Returns an empty array if Supabase is not configured or the query fails.
 */
export async function getEventSources(eventId: string): Promise<EventSource[]> {
  const supabase = getSupabaseClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('event_sources')
    .select('*')
    .eq('event_id', eventId)
    .order('level', { ascending: true })

  if (error || !data) return []

  return (data as SupabaseEventSourceRow[]).map(rowToEventSource)
}

import type { Event, EventType, EventSubType, EventStatus, EventSource, TrustLevel, SourceType, Idol, GenderType, IdolCategory, GroupOrSolo } from '../types'
import { getSupabaseClient } from './client'

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
  time: string | null
  location: string | null
  country: string
  country_flag: string
  description: string | null
  tags: string[] | null
  ticket_url: string | null
  stream_url: string | null
  is_published: boolean
  published_at: string | null
  idols?: { slug: string; avatar_url: string | null } | null
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

  return {
    id: row.id,
    // Use slug as idolId to match the current frontend's mock-data convention.
    // Falls back to the UUID if the idols join is unavailable.
    idolId: row.idols?.slug ?? row.idol_id,
    idolName: row.idol_name,
    idolAvatarUrl: row.idols?.avatar_url ?? null,
    title: row.title,
    type: row.type as EventType,
    subType: (row.sub_type ?? undefined) as EventSubType | undefined,
    status: row.status as EventStatus,
    date: row.date,
    time: row.time ?? undefined,
    location: row.location ?? undefined,
    country: row.country,
    countryFlag: row.country_flag,
    source,
    description: row.description ?? '',
    isFavorited: false, // UI state — managed by localStorage / auth layer
    ticketUrl: row.ticket_url ?? undefined,
    streamUrl: row.stream_url ?? undefined,
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
 * Returns all published, non-cancelled events with official or media trust level.
 * Returns an empty array if Supabase is not configured or the query fails.
 */
export async function getPublishedEvents(): Promise<Event[]> {
  const supabase = getSupabaseClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('events')
    .select('*, idols!inner(slug, avatar_url), event_sources(id, event_id, level, label, type, url)')
    .eq('is_published', true)
    .in('trust_level', ['official', 'media'])
    .neq('status', 'cancelled')
    .order('date', { ascending: true })

  if (error || !data) return []

  return (data as SupabaseEventRow[]).map(rowToEvent)
}

/**
 * Returns all active idols.
 * Returns an empty array if Supabase is not configured or the query fails.
 */
export async function getActiveIdols(): Promise<Idol[]> {
  const supabase = getSupabaseClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('idols')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error || !data) return []

  return (data as SupabaseIdolRow[]).map(rowToIdol)
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
    .select('*, idols!inner(slug, avatar_url), event_sources(id, event_id, level, label, type, url)')
    .eq('id', id)
    .eq('is_published', true)
    .in('trust_level', ['official', 'media'])
    .neq('status', 'cancelled')
    .single()

  if (error || !data) return null

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

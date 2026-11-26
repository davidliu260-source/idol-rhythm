/**
 * Client-side query helpers for the notifications table (N4).
 *
 * All functions require a Supabase browser client and operate on the
 * authenticated user's own rows (enforced by RLS: user_id = auth.uid()).
 *
 * service_role INSERT (派送通知) is handled separately by server-side
 * runtime / cron (N6+). These helpers only cover read + mark-read paths.
 *
 * Visibility (2026-11-26):
 *   A notification is shown only if it has no linked event (event_id is
 *   null) or the linked event is still published (is_published = true).
 *   Unpublished or missing events are hidden on the read path only —
 *   rows are never deleted — so republishing the event makes the
 *   notification reappear automatically.
 *
 *   Regular (non-admin) clients cannot SELECT unpublished, cancelled, or
 *   untrusted events (policy "events: public read published"). A left /
 *   inner join therefore returns no event row in those cases, which this
 *   module treats as hidden. Admins can see unpublished events, so the
 *   query also requires events.is_published = true rather than "join is
 *   not null".
 *
 *   Notifications for a cancelled-but-still-published event are hidden
 *   for regular users (the join is null under RLS) and remain visible
 *   for admins. That follows from the join-null rule, not an extra
 *   product filter.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Notification {
  id: string
  type: 'event_reminder' | 'followed_idol_new_event'
  event_id: string | null
  idol_id: string | null
  title: string
  body: string | null
  payload: Record<string, unknown>
  dedupe_key: string
  read_at: string | null
  delivered_at: string
  created_at: string
}

export type LinkedEvent = {
  id: string
  is_published: boolean
}

type NotificationRow = Notification & {
  events?: LinkedEvent | LinkedEvent[] | null
}

/** Inner join used so unpublished / missing events never enter the result set. */
export const PUBLISHED_EVENT_NOTIFICATION_SELECT =
  '*, events!inner(id, is_published)' as const

// ── Visibility helpers (pure; also used by the check script) ──────────────────

/**
 * A notification is visible when it is not tied to an event, or when the
 * linked event row is present and published.
 *
 * `linkedEvent` is the joined `events` embed. A null embed (row missing,
 * or hidden by RLS) must be treated as hidden whenever `eventId` is set.
 */
export function isNotificationVisible(
  eventId: string | null | undefined,
  linkedEvent: LinkedEvent | LinkedEvent[] | null | undefined
): boolean {
  if (eventId == null || eventId === '') return true
  const event = normalizeLinkedEvent(linkedEvent)
  return event != null && event.is_published === true
}

export function normalizeLinkedEvent(
  linkedEvent: LinkedEvent | LinkedEvent[] | null | undefined
): LinkedEvent | null {
  if (linkedEvent == null) return null
  const row = Array.isArray(linkedEvent) ? linkedEvent[0] : linkedEvent
  if (!row || typeof row !== 'object') return null
  if (typeof row.id !== 'string' || row.id === '') return null
  return { id: row.id, is_published: row.is_published === true }
}

export function stripNotificationEmbed(row: NotificationRow): Notification {
  const { events: _ignored, ...rest } = row
  return rest
}

/**
 * Merge the two visibility buckets (no event + published event), newest
 * first, and apply the list limit after the merge so hidden rows cannot
 * starve the page.
 */
export function mergeNotificationPages(
  withoutEvent: readonly Notification[],
  withPublishedEvent: readonly Notification[],
  limit?: number
): Notification[] {
  const byId = new Map<string, Notification>()
  for (const row of withoutEvent) byId.set(row.id, stripNotificationEmbed(row))
  for (const row of withPublishedEvent) {
    if (!byId.has(row.id)) byId.set(row.id, stripNotificationEmbed(row))
  }
  const merged = [...byId.values()].sort((a, b) => {
    if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1
    return a.id < b.id ? 1 : -1
  })
  return limit == null ? merged : merged.slice(0, limit)
}

type ListOptions = {
  unreadOnly?: boolean
  limit?: number
}

async function fetchVisibleNotifications(
  supabase: SupabaseClient,
  options: ListOptions = {}
): Promise<Notification[] | null> {
  const noEventQuery = applyListModifiers(
    supabase.from('notifications').select('*').is('event_id', null),
    options
  )
  const publishedQuery = applyListModifiers(
    supabase
      .from('notifications')
      .select(PUBLISHED_EVENT_NOTIFICATION_SELECT)
      .eq('events.is_published', true),
    options
  )

  const [noEventResult, publishedResult] = await Promise.all([
    noEventQuery,
    publishedQuery,
  ])

  if (noEventResult.error || publishedResult.error) return null
  if (!noEventResult.data || !publishedResult.data) return null

  const withoutEvent = (noEventResult.data as NotificationRow[]).filter((row) =>
    isNotificationVisible(row.event_id, null)
  )
  const withPublishedEvent = (publishedResult.data as NotificationRow[]).filter(
    (row) => isNotificationVisible(row.event_id, row.events)
  )

  return mergeNotificationPages(withoutEvent, withPublishedEvent, options.limit)
}


function applyListModifiers<
  T extends {
    is: (column: string, value: unknown) => T
    order: (column: string, options: { ascending: boolean }) => T
    limit: (value: number) => T
  },
>(query: T, options: ListOptions): T {
  let next = query
  if (options.unreadOnly) next = next.is('read_at', null)
  next = next.order('created_at', { ascending: false })
  if (options.limit != null) next = next.limit(options.limit)
  return next
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns the number of unread notifications for the current user
 * that would also appear in the notification list (unpublished /
 * missing events excluded). Returns 0 if not authenticated or on any error.
 */
export const MARK_ALL_READ_CHUNK_SIZE = 100

export async function getUnreadNotificationCount(
  supabase: SupabaseClient
): Promise<number> {
  const noEventQuery = supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .is('event_id', null)
    .is('read_at', null)
  const publishedQuery = supabase
    .from('notifications')
    .select(PUBLISHED_EVENT_NOTIFICATION_SELECT, { count: 'exact', head: true })
    .eq('events.is_published', true)
    .is('read_at', null)

  const [noEventResult, publishedResult] = await Promise.all([
    noEventQuery,
    publishedQuery,
  ])

  if (noEventResult.error || publishedResult.error) return 0
  if (noEventResult.count == null || publishedResult.count == null) return 0
  return noEventResult.count + publishedResult.count
}

/**
 * Returns the most recent visible notifications for the current user.
 * Ordered by created_at DESC (newest first).
 * Returns an empty array on any error.
 */
export async function listNotifications(
  supabase: SupabaseClient,
  limit = 20
): Promise<Notification[]> {
  const rows = await fetchVisibleNotifications(supabase, { limit })
  return rows ?? []
}

/**
 * Marks a single notification as read.
 * No-ops silently if already read or on error.
 */
export async function markNotificationAsRead(
  supabase: SupabaseClient,
  notificationId: string
): Promise<void> {
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .is('read_at', null)
}

/**
 * Marks all *visible* unread notifications as read for the current user.
 * Hidden rows (unpublished or missing events) stay unread, so they can
 * reappear as unread if the event is published again.
 * Returns the number of rows updated, or 0 on error.
 */
export async function markAllNotificationsAsRead(
  supabase: SupabaseClient
): Promise<number> {
  const visible = await fetchVisibleNotifications(supabase, { unreadOnly: true })
  if (visible == null) return 0
  const ids = visible.map((row) => row.id)
  if (ids.length === 0) return 0

  const readAt = new Date().toISOString()
  let updated = 0
  for (let i = 0; i < ids.length; i += MARK_ALL_READ_CHUNK_SIZE) {
    const chunk = ids.slice(i, i + MARK_ALL_READ_CHUNK_SIZE)
    const { data, error } = await supabase
      .from('notifications')
      .update({ read_at: readAt })
      .in('id', chunk)
      .is('read_at', null)
      .select('id')
    if (error || !data) return updated
    updated += data.length
  }
  return updated
}

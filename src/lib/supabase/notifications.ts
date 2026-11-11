/**
 * Client-side query helpers for the notifications table (N4).
 *
 * All functions require a Supabase browser client and operate on the
 * authenticated user's own rows (enforced by RLS: user_id = auth.uid()).
 *
 * service_role INSERT (派送通知) is handled separately by server-side
 * runtime / cron (N6+). These helpers only cover read + mark-read paths.
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

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns the number of unread notifications for the current user.
 * Returns 0 if not authenticated or on any error.
 */
export async function getUnreadNotificationCount(
  supabase: SupabaseClient
): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .is('read_at', null)

  if (error || count === null) return 0
  return count
}

/**
 * Returns the most recent notifications for the current user.
 * Ordered by created_at DESC (newest first).
 * Returns an empty array on any error.
 */
export async function listNotifications(
  supabase: SupabaseClient,
  limit = 20
): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []
  return data as Notification[]
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
 * Marks all unread notifications as read for the current user.
 * Returns the number of rows updated, or 0 on error.
 */
export async function markAllNotificationsAsRead(
  supabase: SupabaseClient
): Promise<number> {
  const { data, error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null)
    .select('id')

  if (error || !data) return 0
  return data.length
}

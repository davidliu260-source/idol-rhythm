// IMPORTANT: server-only — this module uses getSupabaseServiceClient which
// bypasses RLS. It must never be imported from a client component.
import 'server-only'

import { getSupabaseServiceClient } from './serviceClient'
import { getSupabaseServerClient } from './serverClient'

// ── Types ──────────────────────────────────────────────────────────────────

export interface AnalyticsStats {
  // ── service_role-gated metrics ──────────────────────────────────────────
  // null when SUPABASE_SERVICE_ROLE_KEY is missing or a query fails.
  serviceRoleAvailable: boolean

  // auth.users (always service_role)
  totalUsers: number | null
  newUsers7d: number | null
  newUsers30d: number | null

  // User-scoped tables — user-scoped RLS blocks full-table COUNT for
  // authenticated role, so service_role is required for site-wide aggregates.
  totalFollows: number | null
  totalSaves: number | null
  totalReminders: number | null
  totalNotifications: number | null
  unreadNotifications: number | null

  // admin_users — self-read RLS only; full COUNT needs service_role
  adminUsers: number | null

  // ── server-client metrics (public tables, admin RLS allows full reads) ──
  publishedEvents: number | null
  draftEvents: number | null

  // Candidates by review_status
  pendingCandidates: number | null
  approvedCandidates: number | null
  rejectedCandidates: number | null

  // Candidates by source_type (map of source_type → count)
  candidatesBySourceType: Record<string, number> | null

  // Crawler sources
  activeSources: number | null
  totalSources: number | null
  // Map of parser_type → count
  sourcesByParserType: Record<string, number> | null
}

// ── Helpers ────────────────────────────────────────────────────────────────

type CountResult = PromiseSettledResult<{ count: number | null; error: unknown }>

function extractCount(res: CountResult): number | null {
  if (res.status === 'rejected') return null
  if (res.value.error) return null
  return res.value.count ?? null
}

// ── Main export ────────────────────────────────────────────────────────────

export async function getAnalyticsStats(): Promise<AnalyticsStats> {
  // ── 1. Service-role block ──────────────────────────────────────────────
  // getSupabaseServiceClient() throws if key is missing. Wrap in try/catch
  // so the dashboard degrades gracefully rather than crashing.

  let serviceRoleAvailable = false
  let totalUsers: number | null = null
  let newUsers7d: number | null = null
  let newUsers30d: number | null = null
  let totalFollows: number | null = null
  let totalSaves: number | null = null
  let totalReminders: number | null = null
  let totalNotifications: number | null = null
  let unreadNotifications: number | null = null
  let adminUsers: number | null = null

  try {
    const svc = getSupabaseServiceClient()
    serviceRoleAvailable = true

    const now = new Date()
    const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

    // All service_role queries run in parallel for minimal latency.
    const [
      totalUsersRes,
      new7dRes,
      new30dRes,
      followsRes,
      savesRes,
      remindersRes,
      notifTotalRes,
      notifUnreadRes,
      adminUsersRes,
    ] = await Promise.allSettled([
      // auth.users — query via .schema('auth').from('users')
      svc.schema('auth').from('users').select('*', { count: 'exact', head: true }),
      svc.schema('auth').from('users').select('*', { count: 'exact', head: true }).gte('created_at', d7),
      svc.schema('auth').from('users').select('*', { count: 'exact', head: true }).gte('created_at', d30),

      // User-scoped public tables — service_role bypasses user-scoped RLS
      // so COUNT(*) returns the site-wide total, not just the admin's rows.
      // Note: COUNT DISTINCT user_id requires a DB function (future v2 metric).
      svc.from('user_follows').select('*', { count: 'exact', head: true }),
      svc.from('saved_events').select('*', { count: 'exact', head: true }),
      svc.from('reminders').select('*', { count: 'exact', head: true }),
      svc.from('notifications').select('*', { count: 'exact', head: true }),
      svc.from('notifications').select('*', { count: 'exact', head: true }).is('read_at', null),

      // admin_users — self-read RLS blocks full COUNT for authenticated role
      svc.from('admin_users').select('*', { count: 'exact', head: true }),
    ])

    totalUsers = extractCount(totalUsersRes as CountResult)
    newUsers7d = extractCount(new7dRes as CountResult)
    newUsers30d = extractCount(new30dRes as CountResult)
    totalFollows = extractCount(followsRes as CountResult)
    totalSaves = extractCount(savesRes as CountResult)
    totalReminders = extractCount(remindersRes as CountResult)
    totalNotifications = extractCount(notifTotalRes as CountResult)
    unreadNotifications = extractCount(notifUnreadRes as CountResult)
    adminUsers = extractCount(adminUsersRes as CountResult)
  } catch {
    // Key missing or misconfigured — all service_role metrics remain null.
    // serviceRoleAvailable stays false.
  }

  // ── 2. Server-client block (public tables with admin RLS) ──────────────
  // These tables have admin-accessible RLS policies so a cookie-based server
  // client (authenticated as admin) can read full-table counts.

  const serverClient = getSupabaseServerClient()

  let publishedEvents: number | null = null
  let draftEvents: number | null = null
  let pendingCandidates: number | null = null
  let approvedCandidates: number | null = null
  let rejectedCandidates: number | null = null
  let candidatesBySourceType: Record<string, number> | null = null
  let activeSources: number | null = null
  let totalSources: number | null = null
  let sourcesByParserType: Record<string, number> | null = null

  if (serverClient) {
    const [
      publishedRes,
      draftRes,
      pendingRes,
      approvedRes,
      rejectedRes,
      candidatesSourceRes,
      activeSourcesRes,
      totalSourcesRes,
      allSourcesRes,
    ] = await Promise.allSettled([
      serverClient.from('events').select('*', { count: 'exact', head: true }).eq('is_published', true),
      serverClient.from('events').select('*', { count: 'exact', head: true }).eq('is_published', false),

      serverClient.from('event_candidates').select('*', { count: 'exact', head: true }).eq('review_status', 'pending'),
      serverClient.from('event_candidates').select('*', { count: 'exact', head: true }).eq('review_status', 'approved'),
      serverClient.from('event_candidates').select('*', { count: 'exact', head: true }).eq('review_status', 'rejected'),

      // Fetch source_type column for grouping in JS (small table)
      serverClient.from('event_candidates').select('source_type'),

      serverClient.from('crawler_sources').select('*', { count: 'exact', head: true }).eq('is_active', true),
      serverClient.from('crawler_sources').select('*', { count: 'exact', head: true }),

      // Fetch parser_type column for grouping in JS (small table, typically <20 rows)
      serverClient.from('crawler_sources').select('parser_type'),
    ])

    publishedEvents = extractCount(publishedRes as CountResult)
    draftEvents = extractCount(draftRes as CountResult)
    pendingCandidates = extractCount(pendingRes as CountResult)
    approvedCandidates = extractCount(approvedRes as CountResult)
    rejectedCandidates = extractCount(rejectedRes as CountResult)
    activeSources = extractCount(activeSourcesRes as CountResult)
    totalSources = extractCount(totalSourcesRes as CountResult)

    // Group candidates by source_type in JS
    if (candidatesSourceRes.status === 'fulfilled' && !candidatesSourceRes.value.error && candidatesSourceRes.value.data) {
      const grouped: Record<string, number> = {}
      for (const row of candidatesSourceRes.value.data as { source_type: string }[]) {
        const t = row.source_type ?? 'unknown'
        grouped[t] = (grouped[t] ?? 0) + 1
      }
      candidatesBySourceType = grouped
    }

    // Group crawler sources by parser_type in JS
    if (allSourcesRes.status === 'fulfilled' && !allSourcesRes.value.error && allSourcesRes.value.data) {
      const grouped: Record<string, number> = {}
      for (const row of allSourcesRes.value.data as { parser_type: string }[]) {
        const t = row.parser_type ?? 'unknown'
        grouped[t] = (grouped[t] ?? 0) + 1
      }
      sourcesByParserType = grouped
    }
  }

  return {
    serviceRoleAvailable,
    totalUsers,
    newUsers7d,
    newUsers30d,
    totalFollows,
    totalSaves,
    totalReminders,
    totalNotifications,
    unreadNotifications,
    adminUsers,
    publishedEvents,
    draftEvents,
    pendingCandidates,
    approvedCandidates,
    rejectedCandidates,
    candidatesBySourceType,
    activeSources,
    totalSources,
    sourcesByParserType,
  }
}

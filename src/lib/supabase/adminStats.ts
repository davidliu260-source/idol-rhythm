import { getSupabaseClient } from './client'

export interface AdminStats {
  activeIdols: number | null
  publishedEvents: number | null
  pendingCandidates: number | null // null = RLS blocked (no admin auth yet)
  upcomingEvents: number | null
}

/**
 * Fetches read-only summary counts for the admin dashboard.
 * Uses the public anon client — no service role key, no writes.
 * Any query that fails (RLS, missing env, network) returns null for that field.
 */
export async function getAdminStats(): Promise<AdminStats> {
  const supabase = getSupabaseClient()

  if (!supabase) {
    return { activeIdols: null, publishedEvents: null, pendingCandidates: null, upcomingEvents: null }
  }

  const today = new Date().toISOString().split('T')[0]

  const [idolsRes, publishedRes, candidatesRes, upcomingRes] = await Promise.allSettled([
    supabase
      .from('idols')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),

    supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('is_published', true)
      .in('trust_level', ['official', 'media']),

    // event_candidates is admin-only via RLS.
    // With the anon key this will return 0 rows (not an error), so count will be 0.
    // We store it as null to signal "requires admin auth" in the UI.
    supabase
      .from('event_candidates')
      .select('id', { count: 'exact', head: true })
      .eq('review_status', 'pending'),

    supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('is_published', true)
      .in('trust_level', ['official', 'media'])
      .gte('date', today),
  ])

  function extractCount(res: PromiseSettledResult<{ count: number | null; error: unknown }>): number | null {
    if (res.status === 'rejected') return null
    if (res.value.error) return null
    return res.value.count ?? null
  }

  const pendingCount = extractCount(candidatesRes as PromiseSettledResult<{ count: number | null; error: unknown }>)

  return {
    activeIdols: extractCount(idolsRes as PromiseSettledResult<{ count: number | null; error: unknown }>),
    publishedEvents: extractCount(publishedRes as PromiseSettledResult<{ count: number | null; error: unknown }>),
    // If count is 0 due to RLS blocking (anon sees empty set), treat as null
    // so the UI shows "—" instead of a misleading "0".
    pendingCandidates: pendingCount === 0 ? null : pendingCount,
    upcomingEvents: extractCount(upcomingRes as PromiseSettledResult<{ count: number | null; error: unknown }>),
  }
}

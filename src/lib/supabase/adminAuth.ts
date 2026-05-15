import { getSupabaseServerClient } from './serverClient'

export interface AdminAuthResult {
  /** The currently authenticated Supabase Auth user, or null if not logged in. */
  user: { id: string; email?: string } | null
  /**
   * True only when:
   *   1. A valid Supabase session exists, AND
   *   2. The user's id appears in admin_users with is_active = true.
   * False in all other cases (no session, not in table, table not yet created, env missing).
   */
  isAdmin: boolean
}

/**
 * Server-side admin identity check.
 *
 * Uses the anon key + the current request's cookie session.
 * Never uses the service_role key.
 *
 * Steps:
 *   1. Get the current Auth user via auth.getUser().
 *   2. Query admin_users for a row where user_id = user.id AND is_active = true.
 *   3. Return isAdmin = true only if both succeed.
 *
 * Safe to call before the admin_users migration is run:
 *   the query will fail and isAdmin will be false.
 */
export async function getCurrentAdmin(): Promise<AdminAuthResult> {
  const supabase = getSupabaseServerClient()
  if (!supabase) return { user: null, isAdmin: false }

  // getUser() validates the session token against Supabase Auth.
  // This is safer than getSession() which only reads the local cookie.
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) return { user: null, isAdmin: false }

  // Check admin_users table.
  // If the table does not exist yet (migration not yet run), this returns an error
  // and isAdmin stays false — safe default.
  const { data: adminRow } = await supabase
    .from('admin_users')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  return {
    user: { id: user.id, email: user.email },
    isAdmin: !!adminRow,
  }
}

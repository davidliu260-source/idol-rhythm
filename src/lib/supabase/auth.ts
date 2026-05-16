import { getSupabaseServerClient } from './serverClient'

export interface CurrentUser {
  id: string
  email: string | null
}

/**
 * Server-side helper to read the current frontend user (not admin).
 *
 * Separate from getCurrentAdmin() in adminAuth.ts:
 *   - getCurrentUser():  any authenticated Supabase user (frontend members)
 *   - getCurrentAdmin(): only users in admin_users with is_active = true
 *
 * Returns null when:
 *   - Supabase env vars are missing
 *   - No active session cookie
 *   - auth.getUser() returns an error
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = getSupabaseServerClient()
  if (!supabase) return null

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return null

  return {
    id: user.id,
    email: user.email ?? null,
  }
}

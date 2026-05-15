import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

/**
 * Returns a Supabase browser client that stores the auth session in cookies
 * (not localStorage), so the server-side createServerClient can read the
 * same session via request cookies.
 *
 * Use this instead of getSupabaseClient() for any auth operations
 * (signIn, signOut) that need to be visible to Server Components.
 *
 * Returns null if env vars are not configured.
 */
export function getBrowserSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null

  if (!_client) {
    _client = createBrowserClient(url, key)
  }

  return _client
}

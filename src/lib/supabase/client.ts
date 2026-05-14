import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

/**
 * Returns a Supabase browser client, or null if env vars are not configured.
 * Safe to call during SSR and build — returns null instead of throwing.
 */
export function getSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) return null

  if (!_client) {
    _client = createClient(url, key)
  }

  return _client
}

// IMPORTANT: server-only import — throws at build time if this module is
// ever pulled into a client bundle. The service role key bypasses RLS and
// MUST NEVER reach the browser. Do not remove this import.
import 'server-only'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Returns a Supabase client authenticated with the service_role key,
 * bypassing RLS. ONLY for use in server-only route handlers that have
 * already verified a server-to-server secret (e.g. CRON_SECRET).
 *
 * Allowed callers (as of J5b):
 *   - GET /api/cron/sync-candidates  (CRON_SECRET-gated)
 *
 * NOT allowed:
 *   - Any client component
 *   - Any Server Component that renders user-facing pages
 *   - Any admin route (admin routes use getSupabaseServerClient() +
 *     getCurrentAdmin() session, which is the RLS-respecting path)
 *
 * Env requirements:
 *   - NEXT_PUBLIC_SUPABASE_URL (existing, public is fine)
 *   - SUPABASE_SERVICE_ROLE_KEY (NEW — must be set in Vercel + .env.local;
 *     MUST NOT use NEXT_PUBLIC_ prefix or it will leak to client bundles)
 *
 * Throws if SUPABASE_SERVICE_ROLE_KEY is missing so misconfiguration fails
 * loudly instead of silently falling back to anon access.
 */
export function getSupabaseServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    throw new Error(
      'getSupabaseServiceClient: NEXT_PUBLIC_SUPABASE_URL 未設定',
    )
  }
  if (!serviceKey) {
    throw new Error(
      'getSupabaseServiceClient: SUPABASE_SERVICE_ROLE_KEY 未設定（請在 Vercel Project Settings 加入，且不可加 NEXT_PUBLIC_ 前綴）',
    )
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

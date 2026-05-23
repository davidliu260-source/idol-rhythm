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
 * Allowed callers:
 *   - GET /api/cron/sync-candidates            (CRON_SECRET-gated)
 *   - GET /api/cron/dispatch-reminders         (CRON_SECRET-gated)
 *   - GET /api/cron/dispatch-new-event-*       (CRON_SECRET-gated)
 *   - POST /api/account/delete                 (session-gated, user self-delete)
 *   - src/lib/supabase/analyticsStats.ts       (admin-gated Server Component;
 *       aggregate COUNT only — never returns row-level data or emails)
 *
 * NOT allowed:
 *   - Any client component
 *   - Any Server Component that renders user-facing (non-admin) pages
 *   - Any code path that returns user_id lists, email lists, or row-level
 *     data to the browser (even in admin context)
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

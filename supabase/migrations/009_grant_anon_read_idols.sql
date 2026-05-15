-- =============================================================================
-- Idol Rhythm — Grant anon SELECT on idols
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   The "idols: public read active" RLS policy (created in 001_initial_schema.sql)
--   allows all roles to SELECT is_active = true rows. However, PostgREST enforces
--   object-level privileges BEFORE evaluating RLS policies. Without a table-level
--   GRANT SELECT for the `anon` role, every anonymous query against idols is
--   rejected with error 42501 (permission denied) — and the Supabase JS client
--   returns [] on any error, causing the frontend to fall back to MOCK_IDOLS.
--
--   Migration 004 added GRANT SELECT TO authenticated; this migration adds the
--   equivalent grant for the anon role so that the public /idols page can read
--   real data from Supabase.
--
-- DEPENDENCY
--   Must be run AFTER:
--     001_initial_schema.sql  — defines idols table + RLS + "idols: public read active"
--
-- EXECUTION
--   Run in Supabase SQL Editor:
--     BEGIN; <paste this file>; COMMIT;
--   GRANT is idempotent — safe to re-run.
--
-- EXPECTED RESULT
--   After executing, /idols (frontend) shows is_active = true idols from Supabase
--   in alphabetical order instead of the hardcoded MOCK_IDOLS fallback.
--
-- ⚠️  HUMAN REVIEW REQUIRED before executing.
--     See review checklist at the bottom of this file.
-- =============================================================================


BEGIN;


-- =============================================================================
-- SECTION 1: Grant object-level SELECT to anon role
-- =============================================================================
-- The existing "idols: public read active" RLS policy already restricts rows to
-- is_active = true. This GRANT only unlocks the object-level permission check;
-- row filtering is still enforced by RLS.
-- GRANT is additive and idempotent — does not affect authenticated or other roles.
-- =============================================================================

GRANT SELECT ON public.idols TO anon;


COMMIT;


-- =============================================================================
-- REVIEW CHECKLIST (complete before executing in Supabase)
-- =============================================================================
--
--  □ 001_initial_schema.sql has already been executed in this project.
--    Verify "idols: public read active" policy exists:
--      SELECT policyname FROM pg_policies
--      WHERE tablename = 'idols' AND policyname = 'idols: public read active';
--
--  □ Run the full file wrapped in BEGIN … COMMIT in the SQL Editor.
--    Verify "COMMIT" appears in the output with no errors.
--
--  □ After executing, open the frontend /idols page (not admin) and confirm:
--    - Active idols appear in alphabetical order (not MOCK_IDOLS order)
--    - The test idol created via /admin/idols/new (is_active = true) is visible
--    - Inactive idols do NOT appear on the public page
--
--  □ The "idols: public read active" RLS policy (USING is_active = true) is NOT
--    changed by this migration. Row-level filtering is still enforced.
--
--  □ This GRANT does not affect admin routes — admin pages use the authenticated
--    cookie session (getSupabaseServerClient), not the anon client.
--
-- =============================================================================

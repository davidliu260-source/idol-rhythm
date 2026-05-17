-- =============================================================================
-- Idol Rhythm — Crawler Sources Run Status Policy (Phase J6b)
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   Phase J6b connects the BLACKPINK fetcher to crawler_sources so that
--   each run reads its config from the row and writes back execution
--   status (last_run_at / last_status / last_error). Migration 019
--   only granted SELECT; this migration opens the minimum write surface
--   needed for that status write-back.
--
--   Scope is intentionally narrow:
--     - GRANT UPDATE on ONLY the status columns to authenticated
--       (admin manual route runs under the admin user's JWT).
--     - RLS UPDATE policy gated on active admin_users.
--     - GRANT SELECT + UPDATE on the whole row to service_role
--       (cron route uses service_role and bypasses RLS, but the GRANT
--       still has to exist).
--
--   NOT in this migration:
--     - No INSERT / DELETE policies. Sources are still added via
--       migration only.
--     - No GRANT UPDATE on content fields (name / source_url /
--       source_key / parser_type / idol_id / is_active). Editing
--       source content via the admin UI is out of scope for J6b.
--     - No anon access.
--     - No second crawler source.
--
-- DEPENDENCY
--   Must be run AFTER:
--     002_admin_users.sql
--     019_crawler_sources.sql
--
-- EXECUTION
--   Run in Supabase SQL Editor:
--     BEGIN; <paste this file>; COMMIT;
--   All statements are idempotent (DROP POLICY IF EXISTS + GRANT is
--   re-runnable).
--
-- ⚠️  HUMAN REVIEW REQUIRED before executing.
--     See review checklist at the bottom of this file.
-- =============================================================================


BEGIN;


-- =============================================================================
-- SECTION 1: Column-level GRANT UPDATE for authenticated
-- =============================================================================
-- PostgreSQL column-level GRANT restricts authenticated users to updating
-- ONLY the status columns. Attempts to UPDATE any other column (name,
-- source_url, source_key, parser_type, idol_id, is_active, ...) fail with
-- 42501 even before RLS is evaluated.
--
-- updated_at is included so the application can keep it in sync with
-- last_run_at; we do not rely on a trigger here.
-- =============================================================================

GRANT UPDATE (last_run_at, last_status, last_error, updated_at)
  ON public.crawler_sources
  TO authenticated;


-- =============================================================================
-- SECTION 2: DROP existing UPDATE policy if present (idempotent re-run)
-- =============================================================================

DROP POLICY IF EXISTS "crawler_sources: admin_users update run status"
  ON crawler_sources;


-- =============================================================================
-- SECTION 3: RLS UPDATE POLICY — admin_users only
-- =============================================================================
-- The column-level GRANT above is the column-scope guard. This policy is
-- the row-scope guard: only active admin_users can UPDATE any row.
-- =============================================================================

CREATE POLICY "crawler_sources: admin_users update run status"
  ON crawler_sources
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM admin_users
      WHERE admin_users.user_id = auth.uid()
        AND admin_users.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM admin_users
      WHERE admin_users.user_id = auth.uid()
        AND admin_users.is_active = true
    )
  );


-- =============================================================================
-- SECTION 4: service_role GRANT
-- =============================================================================
-- The cron route (GET /api/cron/sync-candidates) uses the service_role
-- client. service_role bypasses RLS but still needs table-level GRANTs.
-- We grant SELECT + UPDATE only (no INSERT / DELETE) so the cron path
-- can read the source config and write back run status, matching exactly
-- what the J6b fetcher needs.
-- =============================================================================

GRANT SELECT, UPDATE ON public.crawler_sources TO service_role;


COMMIT;


-- =============================================================================
-- REVIEW CHECKLIST (complete before executing in Supabase)
-- =============================================================================
--
--  □ Migrations 001–019 have already been executed.
--
--  □ Run the full file wrapped in BEGIN … COMMIT in the SQL Editor.
--    Verify "COMMIT" appears in the output with no errors.
--
--  □ After executing, verify column-level GRANT:
--    SELECT grantee, privilege_type, column_name
--      FROM information_schema.column_privileges
--     WHERE table_name = 'crawler_sources'
--       AND grantee = 'authenticated'
--       AND privilege_type = 'UPDATE';
--    Expected: 4 rows for last_run_at / last_status / last_error / updated_at.
--
--  □ Verify policy exists:
--    SELECT polname FROM pg_policy
--     WHERE polrelid = 'public.crawler_sources'::regclass
--       AND polname = 'crawler_sources: admin_users update run status';
--
--  □ Verify service_role can SELECT + UPDATE:
--    SELECT has_table_privilege('service_role', 'public.crawler_sources', 'SELECT');
--    SELECT has_table_privilege('service_role', 'public.crawler_sources', 'UPDATE');
--    Both should return true.
--
--  □ Verify non-admin authenticated cannot UPDATE:
--    Logging in as a non-admin user and attempting
--      UPDATE crawler_sources SET last_status = 'x' WHERE id = '...'
--    should affect 0 rows (RLS blocks).
--
--  □ Verify content columns are NOT updatable by authenticated:
--    Logged in as admin, attempting
--      UPDATE crawler_sources SET source_url = '...' WHERE id = '...'
--    should fail with 42501 (column-level GRANT blocks).
--
--  □ Verify "抓取 BLACKPINK 官方巡演" admin button still works end-to-end:
--    after the button completes, /admin/sources should show an updated
--    last_run_at and last_status on the BLACKPINK row.
--
-- =============================================================================

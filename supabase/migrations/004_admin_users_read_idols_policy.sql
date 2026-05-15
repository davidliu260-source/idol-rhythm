-- =============================================================================
-- Idol Rhythm — Admin Users Read Idols Policy
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   Grants SELECT on idols to authenticated users who exist in admin_users
--   with is_active = true. Required by /admin/events/new to populate the
--   idol selector dropdown.
--
--   The existing "idols: public read active" policy (001_initial_schema.sql)
--   uses no role qualifier, which in practice applies to the `anon` role via
--   PostgREST. However, if the table-level GRANT is absent for `authenticated`,
--   the query returns error 42501 (permission denied for table idols) even when
--   a valid Supabase session is present.
--
-- DEPENDENCY
--   Must be run AFTER:
--     001_initial_schema.sql  — defines idols table + RLS
--     002_admin_users.sql     — defines admin_users table
--
-- EXECUTION
--   Run in Supabase SQL Editor:
--     BEGIN; <paste this file>; COMMIT;
--   On any error the transaction rolls back completely.
--
-- ⚠️  HUMAN REVIEW REQUIRED before executing.
--     See review checklist at the bottom of this file.
-- =============================================================================


BEGIN;


-- =============================================================================
-- SECTION 1: GRANT table-level SELECT privilege to authenticated role
-- =============================================================================
-- Without this GRANT, authenticated users receive error 42501 before RLS
-- policies are evaluated, even if an appropriate policy exists.
-- This GRANT is additive and does not affect the existing anon GRANT.
-- =============================================================================

GRANT SELECT ON TABLE idols TO authenticated;


-- =============================================================================
-- SECTION 2: DROP existing policy if present (idempotent re-run safety)
-- =============================================================================

DROP POLICY IF EXISTS "idols: admin_users select" ON idols;


-- =============================================================================
-- SECTION 3: RLS SELECT POLICY — idols (admin_users check)
-- =============================================================================
-- Allows authenticated users with an active admin_users row to SELECT all
-- idols (including is_active = false rows, which the public policy hides).
-- This is intentional: admins should be able to see all idols when composing
-- events, even if an idol is currently inactive on the public frontend.
--
-- The TO authenticated clause ensures anon requests are never evaluated
-- against this policy.
-- =============================================================================

CREATE POLICY "idols: admin_users select"
  ON idols
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM admin_users
      WHERE admin_users.user_id = auth.uid()
        AND admin_users.is_active = true
    )
  );


COMMIT;


-- =============================================================================
-- REVIEW CHECKLIST (complete before executing in Supabase)
-- =============================================================================
--
--  □ 001_initial_schema.sql and 002_admin_users.sql have already been
--    executed in this project.
--
--  □ An admin row exists in admin_users with is_active = true for the
--    user who will be using /admin/events/new.
--
--  □ Run the full file wrapped in BEGIN … COMMIT in the SQL Editor.
--    Verify "COMMIT" appears in the output with no errors.
--
--  □ After executing, refresh /admin/events/new and confirm:
--      - The red "查詢偶像失敗：[42501]" error block is gone.
--      - The idol selector dropdown shows the expected idol rows.
--
--  □ Verify the public "idols: public read active" policy is still intact
--    and that unauthenticated users can only see is_active = true idols.
--
--  □ The GRANT SELECT above is additive. It does not remove any existing
--    grants or modify the anon role's access.
--
-- =============================================================================

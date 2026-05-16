-- =============================================================================
-- Idol Rhythm — Admin Users Toggle Idol is_active Policy
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   Adds the column-level GRANT UPDATE for is_active on public.idols.
--   This enables Phase H4: admin can activate / deactivate idols from the
--   detail page without modifying the existing content-field UPDATE policy
--   (added in migration 010).
--
--   The existing RLS UPDATE policy "idols: admin_users update basic info"
--   (created in 010) already allows authenticated admin_users to target any
--   idol row. No new RLS policy is needed — only the missing column GRANT.
--
-- DEPENDENCY
--   Must be run AFTER:
--     001_initial_schema.sql  — defines idols table + RLS
--     002_admin_users.sql     — defines admin_users table
--     010_admin_users_update_idols_basic_policy.sql — UPDATE policy already live
--
-- EXECUTION
--   Run in Supabase SQL Editor:
--     BEGIN; <paste this file>; COMMIT;
--   GRANT is idempotent (safe to re-run).
--
-- ⚠️  HUMAN REVIEW REQUIRED before executing.
--     See review checklist at the bottom of this file.
-- =============================================================================


BEGIN;


-- =============================================================================
-- SECTION 1: Column-level GRANT UPDATE — is_active only
-- =============================================================================
-- The existing GRANT from migration 010 covers all content fields but
-- explicitly excludes is_active and slug.  This migration closes that gap
-- for is_active only.  slug remains permanently excluded (immutable URL key).
-- =============================================================================

GRANT UPDATE (is_active) ON public.idols TO authenticated;


COMMIT;


-- =============================================================================
-- REVIEW CHECKLIST (complete before executing in Supabase)
-- =============================================================================
--
--  □ Migrations 001–010 have already been executed.
--
--  □ Run the full file wrapped in BEGIN … COMMIT in the SQL Editor.
--    Verify "COMMIT" appears in the output with no errors.
--
--  □ After executing, test via /admin/idols/[id]:
--    - Admin can toggle is_active (Activate / Deactivate button appears)
--    - After toggling, the status banner updates immediately
--    - slug is still immutable (no slug change path exists in UI)
--
--  □ Verify anon (frontend) cannot UPDATE is_active:
--    Anon user only has SELECT on idols (migration 009).
--    No UPDATE grant was given to anon role, so this is safe.
--
-- =============================================================================

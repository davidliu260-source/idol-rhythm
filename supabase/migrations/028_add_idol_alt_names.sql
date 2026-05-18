-- =============================================================================
-- Idol Rhythm — Add idols.alt_names (Phase M1a-A)
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   M1a-A — first step of the multi-artist aggregator crawler framework.
--   When an aggregator source (e.g. kpopofficial.com) returns events
--   referencing artists by free-text name, we need to map those names back
--   to our idols table without resorting to fuzzy matching. The matcher
--   (delivered in M1a-B) will normalize and compare against `idols.name`
--   plus the aliases stored in this new column.
--
--   Examples of aliases an admin might fill in:
--     Stray Kids → {'SKZ','스트레이 키즈'}
--     TWICE      → {'트와이스'}
--     BLACKPINK  → {'블랙핑크','BP'}
--
--   Scope is intentionally tight:
--     - One NOT NULL text[] column with default '{}' so existing rows
--       become {} and the matcher safely iterates an empty list.
--     - No data backfill — admins fill aliases manually per idol via
--       /admin/idols/<id>/edit (also delivered in this PR).
--     - Column-level GRANT extension so admin_users can write alt_names.
--       The existing row-level UPDATE policy "idols: admin_users update
--       basic info" (migration 010) already covers the auth check; we
--       only widen the column GRANT to include the new field.
--     - No new RLS policy. SELECT for anon is already granted on idols
--       (migration 009) and works against the new column unchanged.
--     - No index. Idol count is small (< 100); the matcher will SELECT
--       all active idols once per crawler run and match in app code.
--
--   Aggregator parser, matcher, and crawler_sources seed are explicitly
--   NOT in this migration. They land in M1a-B and M1a-C.
--
-- IDEMPOTENCE
--   - ADD COLUMN IF NOT EXISTS  — safe on re-run.
--   - GRANT UPDATE              — idempotent at the column level.
--
-- DEPENDENCY
--   Must be run AFTER:
--     001_initial_schema.sql                         — idols table
--     009_grant_select_idols_to_anon.sql             — anon SELECT GRANT
--     010_admin_users_update_idols_basic_policy.sql  — admin UPDATE policy
--
-- EXECUTION
--   Run in Supabase SQL Editor:
--     BEGIN; <paste this file>; COMMIT;
--
-- ⚠️  HUMAN REVIEW REQUIRED before executing.
--     See review checklist at the bottom of this file.
-- =============================================================================


BEGIN;


-- =============================================================================
-- SECTION 1: ADD COLUMN — idols.alt_names
-- =============================================================================
-- NOT NULL text[] with default '{}'. Storing aliases as a Postgres array
-- avoids a join table for what is essentially a small list per row, and
-- matches the existing pattern used for `genres` (also text[]).
-- =============================================================================

ALTER TABLE public.idols
  ADD COLUMN IF NOT EXISTS alt_names text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.idols.alt_names IS
  'Aliases for the aggregator-crawler idol matcher (M1a). Normalize (lowercase + collapse whitespace) and compare with exact equality. No fuzzy matching.';


-- =============================================================================
-- SECTION 2: Extend column-level GRANT UPDATE on idols to include alt_names
-- =============================================================================
-- Migrations 010 / 011 / 025 progressively widened the UPDATE GRANT to
-- cover content fields, is_active, and avatar_url. alt_names is a content
-- field that admins must be able to edit through /admin/idols/<id>/edit,
-- so we add it to the GRANT here.
--
-- The row-level UPDATE policy "idols: admin_users update basic info"
-- (migration 010) checks admin_users membership and is reused as-is — no
-- new policy is created, no existing policy is modified or relaxed.
-- =============================================================================

GRANT UPDATE (alt_names) ON public.idols TO authenticated;


COMMIT;


-- =============================================================================
-- REVIEW CHECKLIST (complete before executing in Supabase)
-- =============================================================================
--
--  □ Migrations 001, 009, 010 have already been executed.
--
--  □ Run the file wrapped in BEGIN … COMMIT. Verify "COMMIT" with no errors.
--
--  □ Verify the column was added:
--      SELECT column_name, data_type, is_nullable, column_default
--        FROM information_schema.columns
--       WHERE table_schema = 'public'
--         AND table_name   = 'idols'
--         AND column_name  = 'alt_names';
--      Expected: one row, data_type='ARRAY', is_nullable='NO',
--                column_default='''{}''::text[]'.
--
--  □ Verify column-level UPDATE GRANT is in place:
--      SELECT grantee, privilege_type, column_name
--        FROM information_schema.column_privileges
--       WHERE table_schema = 'public'
--         AND table_name   = 'idols'
--         AND column_name  = 'alt_names'
--         AND grantee      = 'authenticated';
--      Expected: one row, privilege_type='UPDATE'.
--
--  □ Verify every existing idol row has alt_names = '{}' (empty array):
--      SELECT count(*) FROM idols WHERE alt_names <> '{}';
--      Expected: 0.
--
--  □ As an admin user via /admin/idols/<id>/edit, enter one alias per line
--    (e.g. SKZ / 스트레이 키즈 for Stray Kids) and save. Reload the edit
--    page and confirm the aliases persisted.
--
--  □ As anon (logged out), browsing /idols should be unaffected (alt_names
--    is not rendered on any frontend page in M1a-A).
--
-- =============================================================================

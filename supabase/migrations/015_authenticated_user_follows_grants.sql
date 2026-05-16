-- =============================================================================
-- Idol Rhythm — Authenticated GRANTs for user_follows
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   Milestone 4 (Idol follow persistence): fills in the missing table-level
--   GRANTs for the user_follows table.
--
--   Migration 001_initial_schema.sql already created the RLS policies that
--   restrict authenticated users to their own user_id rows:
--     - "user_follows: user read own"   (SELECT)
--     - "user_follows: user insert own" (INSERT)
--     - "user_follows: user delete own" (DELETE)
--
--   But no GRANT statements were issued for the `authenticated` role on the
--   user_follows table. Same pattern as migrations 003 (events), 013
--   (saved_events) and 014 (reminders). Without these GRANTs, authenticated
--   users receive 42501 ("permission denied for table user_follows") before
--   RLS is evaluated.
--
--   This milestone needs only SELECT / INSERT / DELETE. There is no UPDATE
--   policy in migration 001 for user_follows (following is a binary toggle —
--   you either follow or you don't, nothing to update), so no UPDATE GRANT
--   either.
--
-- DEPENDENCY
--   Must be run AFTER:
--     001_initial_schema.sql  — defines user_follows table + RLS + policies
--
-- EXECUTION
--   Run in Supabase SQL Editor:
--     BEGIN; <paste this file>; COMMIT;
--   GRANTs are idempotent (safe to re-run).
--
-- ⚠️  HUMAN REVIEW REQUIRED before executing.
--     See review checklist at the bottom of this file.
-- =============================================================================


BEGIN;


-- =============================================================================
-- SECTION 1: Table-level GRANTs for authenticated role
-- =============================================================================
-- The RLS policies from migration 001 will still restrict every operation to
-- rows where auth.uid() = user_id. These GRANTs only allow the operation to
-- reach the RLS layer.
--
-- No GRANT is given to anon — anonymous users cannot read, insert, or delete
-- user_follows. Follow state is inherently per-user data.
-- =============================================================================

GRANT SELECT ON public.user_follows TO authenticated;
GRANT INSERT ON public.user_follows TO authenticated;
GRANT DELETE ON public.user_follows TO authenticated;


COMMIT;


-- =============================================================================
-- REVIEW CHECKLIST (complete before executing in Supabase)
-- =============================================================================
--
--  □ Migration 001 has been executed (user_follows table + RLS + policies).
--
--  □ Run the full file wrapped in BEGIN … COMMIT in the SQL Editor.
--    Verify "COMMIT" appears in the output with no errors.
--
--  □ After executing, verify:
--    - Logged-in user can INSERT a user_follows row (idol_id from public idols).
--    - Logged-in user can SELECT only their own user_follows rows.
--    - Logged-in user can DELETE only their own user_follows rows.
--    - anon role still receives permission denied (no GRANT was given).
--
--  □ Verify policies from migration 001 are still in place (untouched):
--    "user_follows: user read own", "user insert own", "user delete own".
--
-- =============================================================================

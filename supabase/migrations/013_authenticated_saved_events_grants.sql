-- =============================================================================
-- Idol Rhythm — Authenticated GRANTs for saved_events
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   Milestone 1 (Frontend auth + saved events): fills in the missing
--   table-level GRANTs for saved_events.
--
--   Migration 001_initial_schema.sql already created the RLS policies that
--   restrict authenticated users to their own user_id rows:
--     - "saved_events: user read own"   (SELECT)
--     - "saved_events: user insert own" (INSERT)
--     - "saved_events: user delete own" (DELETE)
--
--   But no GRANT statements were issued for the `authenticated` role on the
--   saved_events table. Without these GRANTs, authenticated users receive
--   42501 ("permission denied for table saved_events") before RLS is
--   evaluated — the same pattern that was fixed for `events` in migration 003.
--
--   This migration adds the missing GRANTs only. The existing policies remain
--   unchanged and continue to enforce user-scoped row access.
--
-- DEPENDENCY
--   Must be run AFTER:
--     001_initial_schema.sql  — defines saved_events table + RLS + policies
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
-- saved_events. This matches the product requirement (favorites are per-user).
-- =============================================================================

GRANT SELECT ON public.saved_events TO authenticated;
GRANT INSERT ON public.saved_events TO authenticated;
GRANT DELETE ON public.saved_events TO authenticated;


COMMIT;


-- =============================================================================
-- REVIEW CHECKLIST (complete before executing in Supabase)
-- =============================================================================
--
--  □ Migration 001 has been executed (saved_events table + RLS + policies).
--
--  □ Run the full file wrapped in BEGIN … COMMIT in the SQL Editor.
--    Verify "COMMIT" appears in the output with no errors.
--
--  □ After executing, verify:
--    - Logged-in user can INSERT a saved_events row (event_id from public events).
--    - Logged-in user can SELECT only their own saved_events rows.
--    - Logged-in user can DELETE only their own saved_events rows.
--    - anon role still receives permission denied (no GRANT was given).
--
--  □ Verify policies from migration 001 are still in place (untouched):
--    "saved_events: user read own", "user insert own", "user delete own".
--
-- =============================================================================

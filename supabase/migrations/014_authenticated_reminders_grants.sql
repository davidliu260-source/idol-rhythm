-- =============================================================================
-- Idol Rhythm — Authenticated GRANTs for reminders
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   Milestone 2 (Reminders persistence): fills in the missing table-level
--   GRANTs for the reminders table.
--
--   Migration 001_initial_schema.sql already created the RLS policies that
--   restrict authenticated users to their own user_id rows:
--     - "reminders: user read own"   (SELECT)
--     - "reminders: user insert own" (INSERT)
--     - "reminders: user delete own" (DELETE)
--     - "reminders: user update own" (UPDATE — for reminder_type changes)
--
--   But no GRANT statements were issued for the `authenticated` role on the
--   reminders table. Same pattern as migrations 003 (events) and 013
--   (saved_events). Without these GRANTs, authenticated users receive
--   42501 ("permission denied for table reminders") before RLS is evaluated.
--
--   This milestone only needs SELECT / INSERT / DELETE. The UPDATE GRANT is
--   intentionally omitted because the current UI toggles a single reminder
--   on/off (insert/delete the default 'day_before' row) — it never edits
--   reminder_type. When a future milestone adds reminder-type selection UI,
--   a separate migration will add the UPDATE GRANT then.
--
--   The "reminders: user update own" RLS policy from migration 001 is left
--   in place but has no effect until the column GRANT is added.
--
-- DEPENDENCY
--   Must be run AFTER:
--     001_initial_schema.sql  — defines reminders table + RLS + policies
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
-- reminders. Reminders are inherently per-user data.
-- =============================================================================

GRANT SELECT ON public.reminders TO authenticated;
GRANT INSERT ON public.reminders TO authenticated;
GRANT DELETE ON public.reminders TO authenticated;


COMMIT;


-- =============================================================================
-- REVIEW CHECKLIST (complete before executing in Supabase)
-- =============================================================================
--
--  □ Migration 001 has been executed (reminders table + RLS + policies).
--
--  □ Run the full file wrapped in BEGIN … COMMIT in the SQL Editor.
--    Verify "COMMIT" appears in the output with no errors.
--
--  □ After executing, verify:
--    - Logged-in user can INSERT a reminders row (event_id from public events).
--    - Logged-in user can SELECT only their own reminders rows.
--    - Logged-in user can DELETE only their own reminders rows.
--    - anon role still receives permission denied (no GRANT was given).
--
--  □ Verify policies from migration 001 are still in place (untouched):
--    "reminders: user read own", "user insert own", "user delete own",
--    "user update own" (the UPDATE policy stays but is dormant until a
--    future UPDATE GRANT is added).
--
-- =============================================================================

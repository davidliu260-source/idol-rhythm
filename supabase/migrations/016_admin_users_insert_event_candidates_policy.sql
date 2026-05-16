-- =============================================================================
-- Idol Rhythm — Admin Users INSERT Event Candidates Policy
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   Phase J1: allows active admin_users to INSERT new rows into
--   event_candidates via the admin UI (/admin/event-candidates/new).
--
--   Until now only SELECT and UPDATE (review columns) were granted to admins
--   by migration 012. Candidates were assumed to arrive from an external
--   pipeline only. J1 adds a manual admin import path: admin types in raw
--   data from an external announcement and the row enters the candidate pool
--   with review_status = 'pending'. The existing Approve / Reject flow then
--   handles promotion to a draft event.
--
--   anon role retains zero access (no GRANT given to anon).
--   No DELETE policy is added — candidates are never destroyed from the UI.
--
-- DEPENDENCY
--   Must be run AFTER:
--     001_initial_schema.sql — defines event_candidates table + RLS
--     002_admin_users.sql    — defines admin_users table
--     012_admin_users_review_event_candidates_policy.sql — SELECT + UPDATE
--
-- EXECUTION
--   Run in Supabase SQL Editor:
--     BEGIN; <paste this file>; COMMIT;
--   GRANT is idempotent. DROP POLICY IF EXISTS is safe to re-run.
--
-- ⚠️  HUMAN REVIEW REQUIRED before executing.
--     See review checklist at the bottom of this file.
-- =============================================================================


BEGIN;


-- =============================================================================
-- SECTION 1: Table-level GRANT INSERT
-- =============================================================================
-- Without this GRANT, authenticated users receive 42501 before RLS is
-- evaluated, even when a matching policy exists.
-- We grant on the whole table (no column list); RLS controls which rows
-- the admin may insert, and the application layer is responsible for not
-- supplying disallowed columns (id / created_at / updated_at / approved_event_id
-- are either auto-defaulted or left null on insert).
-- =============================================================================

GRANT INSERT ON public.event_candidates TO authenticated;


-- =============================================================================
-- SECTION 2: DROP existing policy if present (idempotent re-run safety)
-- =============================================================================

DROP POLICY IF EXISTS "event_candidates: admin_users insert" ON event_candidates;


-- =============================================================================
-- SECTION 3: RLS INSERT POLICY — event_candidates (admin_users check)
-- =============================================================================
-- WITH CHECK ensures only active admins may insert. No additional row filter
-- beyond admin identity is required: candidates are not user-scoped.
-- =============================================================================

CREATE POLICY "event_candidates: admin_users insert"
  ON event_candidates
  FOR INSERT
  TO authenticated
  WITH CHECK (
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
--  □ Migrations 001–015 have already been executed (especially 012).
--
--  □ Run the full file wrapped in BEGIN … COMMIT in the SQL Editor.
--    Verify "COMMIT" appears in the output with no errors.
--
--  □ After executing, verify admin can INSERT event_candidates:
--    Open /admin/event-candidates/new, fill required fields, submit.
--    Should redirect to /admin/event-candidates/[newId].
--
--  □ Verify the inserted row has review_status = 'pending'
--    and approved_event_id IS NULL.
--
--  □ Verify anon cannot INSERT event_candidates:
--    No GRANT was given to anon; INSERT remains blocked.
--
--  □ Verify non-admin authenticated user cannot INSERT:
--    Log in as a non-admin account and confirm the action fails.
--
--  □ Verify idempotence:
--    Re-running this file should produce no errors (DROP IF EXISTS + GRANT
--    idempotence guarantee this).
--
-- =============================================================================

-- =============================================================================
-- Idol Rhythm — Admin Users Review Event Candidates Policy
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   Phase I: allows active admin_users to:
--     1. SELECT any event_candidates row (to list and view candidates)
--     2. UPDATE the review-related columns only:
--          review_status, reviewer_note, approved_event_id
--
--   The existing "event_candidates: admin all" policy in 001_initial_schema.sql
--   uses (auth.jwt() ->> 'user_role') = 'admin', which this project does NOT
--   configure. This migration adds separate policies using the admin_users table
--   lookup pattern used by all other admin policies (003–011).
--
--   anon role retains zero access (no GRANT given to anon).
--   No INSERT or DELETE policies are added — candidates are created by an
--   external pipeline, not by the admin UI.
--
-- DEPENDENCY
--   Must be run AFTER:
--     001_initial_schema.sql  — defines event_candidates table + RLS
--     002_admin_users.sql     — defines admin_users table
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
-- SECTION 1: Table-level GRANT SELECT
-- =============================================================================
-- Without this GRANT, authenticated users receive 42501 before RLS is
-- evaluated, even when a matching policy exists.
-- =============================================================================

GRANT SELECT ON public.event_candidates TO authenticated;


-- =============================================================================
-- SECTION 2: Column-level GRANT UPDATE — review columns only
-- =============================================================================
-- Only the three columns that the admin review flow writes.
-- raw_title, raw_content, detected_*, source_*, ai_confidence, created_at
-- remain immutable from the admin UI side.
-- =============================================================================

GRANT UPDATE (
  review_status,
  reviewer_note,
  approved_event_id
) ON public.event_candidates TO authenticated;


-- =============================================================================
-- SECTION 3: DROP existing policies if present (idempotent re-run safety)
-- =============================================================================

DROP POLICY IF EXISTS "event_candidates: admin_users select"        ON event_candidates;
DROP POLICY IF EXISTS "event_candidates: admin_users update review"  ON event_candidates;


-- =============================================================================
-- SECTION 4: RLS SELECT POLICY — event_candidates (admin_users check)
-- =============================================================================

CREATE POLICY "event_candidates: admin_users select"
  ON event_candidates
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


-- =============================================================================
-- SECTION 5: RLS UPDATE POLICY — event_candidates (admin_users check)
-- =============================================================================
-- Allows updating only review_status / reviewer_note / approved_event_id
-- (enforced by column-level GRANT above).
-- No additional row filter: admin may update any candidate row.
-- =============================================================================

CREATE POLICY "event_candidates: admin_users update review"
  ON event_candidates
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


COMMIT;


-- =============================================================================
-- REVIEW CHECKLIST (complete before executing in Supabase)
-- =============================================================================
--
--  □ Migrations 001–011 have already been executed.
--
--  □ Run the full file wrapped in BEGIN … COMMIT in the SQL Editor.
--    Verify "COMMIT" appears in the output with no errors.
--
--  □ After executing, verify admin can SELECT event_candidates:
--    Log in as admin and open /admin/event-candidates — should show 3 seeds.
--
--  □ Verify anon cannot access event_candidates:
--    No GRANT was given to anon; the table remains invisible to the public.
--
--  □ Verify column-level UPDATE restriction:
--    Admin can update review_status, reviewer_note, approved_event_id.
--    Attempts to update raw_title, detected_idol_id, etc. should be rejected.
--
--  □ Verify Approve flow:
--    - Click Approve on a pending candidate with a detected_idol_id.
--    - A new draft event should be created (is_published = false).
--    - The candidate's review_status should become 'approved'.
--    - approved_event_id should point to the new event.
--    - Redirect lands on /admin/events/[newEventId].
--
--  □ Verify Reject flow:
--    - Click Reject on a pending candidate.
--    - review_status becomes 'rejected'. No event is created.
--
--  □ Verify idempotence:
--    Re-running this file should produce no errors (DROP IF EXISTS + GRANT
--    idempotence guarantee this).
--
-- =============================================================================

-- =============================================================================
-- Idol Rhythm — Admin Users Write Policy
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   Grants INSERT on events and event_sources to any user who exists in the
--   admin_users table with is_active = true.
--
--   The existing "admin all" policies (001_initial_schema.sql) rely on the
--   JWT custom claim (auth.jwt() ->> 'user_role') = 'admin', which this
--   project does not configure. This migration adds separate INSERT-only
--   policies that use the admin_users table look-up instead.
--
-- DEPENDENCY
--   Must be run AFTER:
--     001_initial_schema.sql  — defines events, event_sources tables + RLS
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
-- SECTION 1: GRANT table-level INSERT privilege
-- =============================================================================
-- Without an explicit GRANT, authenticated users receive "permission denied"
-- (error 42501) before RLS policies are evaluated.
-- These GRANTs are additive and do not modify existing SELECT grants.
-- =============================================================================

GRANT INSERT ON TABLE events        TO authenticated;
GRANT INSERT ON TABLE event_sources TO authenticated;


-- =============================================================================
-- SECTION 2: RLS INSERT POLICY — events
-- =============================================================================
-- Allows INSERT on events only when the current authenticated user has an
-- active row in admin_users. WITH CHECK is the correct clause for INSERT
-- policies — it validates the new row being inserted, not existing rows.
-- =============================================================================

CREATE POLICY "events: admin_users insert"
  ON events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM admin_users
      WHERE admin_users.user_id = auth.uid()
        AND admin_users.is_active = true
    )
  );


-- =============================================================================
-- SECTION 3: RLS INSERT POLICY — event_sources
-- =============================================================================
-- Same admin_users check for event_sources. Allows inserting source
-- attribution rows for newly created events.
-- =============================================================================

CREATE POLICY "event_sources: admin_users insert"
  ON event_sources FOR INSERT
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
--  □ 001_initial_schema.sql and 002_admin_users.sql have already been
--    executed in this project.
--
--  □ An admin row exists in admin_users with is_active = true for the
--    user who will be inserting events.
--
--  □ Run the full file wrapped in BEGIN … COMMIT in the SQL Editor.
--    Verify "COMMIT" appears in the output with no errors.
--
--  □ Test by logging in as the admin user and inserting a draft event
--    via /admin/events/new. The INSERT should succeed without a 403/42501.
--
--  □ Verify that a non-admin authenticated user cannot insert:
--    Their auth.uid() will not match any admin_users row, so both new
--    policies will evaluate to false and the INSERT will be denied.
--
--  □ These policies do NOT touch SELECT, UPDATE, or DELETE.
--    The existing "events: public read published" and "events: admin all"
--    policies remain unchanged.
--
-- =============================================================================

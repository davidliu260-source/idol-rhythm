-- =============================================================================
-- Idol Rhythm — Admin Users Read Draft Policies
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   Grants SELECT on events and event_sources to authenticated users who exist
--   in admin_users with is_active = true. Required for three scenarios:
--
--     1. /admin/events/new — after INSERT, the form calls .select('id').single()
--        to retrieve the new event's UUID. Without a SELECT policy, RLS blocks
--        the implicit RETURNING clause and returns error 42501.
--     2. /admin/events/[id] — the detail page reads the draft event (including
--        is_published = false rows that the public policy filters out).
--     3. /admin/events — the event list page needs to show all events regardless
--        of is_published or trust_level.
--
--   The existing "events: public read published" policy remains unchanged and
--   continues to restrict unauthenticated / non-admin users to only seeing
--   published, official/media, non-cancelled events.
--
-- DEPENDENCY
--   Must be run AFTER:
--     001_initial_schema.sql  — defines events, event_sources tables + RLS
--     002_admin_users.sql     — defines admin_users table
--     003_admin_users_write_policy.sql — INSERT grants + policies
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
-- Without these GRANTs, authenticated users receive 42501 before RLS policies
-- are evaluated, even when a matching policy exists.
-- These GRANTs are additive and do not affect existing anon-role grants.
-- =============================================================================

GRANT SELECT ON TABLE events        TO authenticated;
GRANT SELECT ON TABLE event_sources TO authenticated;


-- =============================================================================
-- SECTION 2: DROP existing policies if present (idempotent re-run safety)
-- =============================================================================

DROP POLICY IF EXISTS "events: admin_users select"        ON events;
DROP POLICY IF EXISTS "event_sources: admin_users select" ON event_sources;


-- =============================================================================
-- SECTION 3: RLS SELECT POLICY — events (admin_users check)
-- =============================================================================
-- Active admins may SELECT any event row, including drafts (is_published = false)
-- and any trust_level. The public "events: public read published" policy is
-- unaffected and continues to restrict non-admin access.
-- =============================================================================

CREATE POLICY "events: admin_users select"
  ON events
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
-- SECTION 4: RLS SELECT POLICY — event_sources (admin_users check)
-- =============================================================================
-- Active admins may SELECT any event_source row, including sources attached to
-- unpublished events. The existing public policy (which restricts to published
-- events) is unaffected.
-- =============================================================================

CREATE POLICY "event_sources: admin_users select"
  ON event_sources
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
--  □ Migrations 001–004 have already been executed in this project.
--
--  □ An admin row exists in admin_users with is_active = true for the
--    user who will be using /admin/events/new.
--
--  □ Run the full file wrapped in BEGIN … COMMIT in the SQL Editor.
--    Verify "COMMIT" appears in the output with no errors.
--
--  □ After executing, test /admin/events/new end-to-end:
--      - Fill in all required fields and submit the form.
--      - Confirm no [42501] error appears.
--      - Confirm the page redirects to /admin/events/<new-uuid>.
--      - Confirm the draft detail page renders the event data.
--
--  □ Verify the public "events: public read published" policy is intact:
--      - Unauthenticated users must NOT see is_published = false events.
--      - Unauthenticated users must NOT see trust_level = 'pending' events.
--
--  □ The GRANT SELECT statements above are additive and do not remove any
--    existing grants or modify anon-role access.
--
-- =============================================================================

-- =============================================================================
-- Migration 006 — Phase F: Admin Publish / Unpublish Events
-- Project  : Idol Rhythm
-- Date     : 2026-05-15
--
-- Grants active admin_users the ability to UPDATE the three publish-control
-- columns on events (is_published, published_at, updated_at).
--
-- Architecture notes:
--   - Identity check uses admin_users table (NOT JWT custom claim).
--   - Column-level GRANT restricts UPDATE to publish-control columns only.
--     No table-level GRANT UPDATE is added, so all other columns remain
--     write-protected for the authenticated role.
--   - No REVOKE needed: migrations 003–005 never issued GRANT UPDATE.
--   - updated_at is included in GRANT because the trigger (set_updated_at)
--     fires after the UPDATE; having the column in GRANT is the safest stance.
--   - No DELETE policy. No event_sources UPDATE. No service_role.
-- =============================================================================


-- ── 1. Column-level GRANT ──────────────────────────────────────────────────────
-- Allows authenticated users to UPDATE only these three columns.
-- All other events columns remain unwritable via the authenticated role.

GRANT UPDATE (is_published, published_at, updated_at)
  ON public.events
  TO authenticated;


-- ── 2. UPDATE RLS policy ──────────────────────────────────────────────────────
-- USING      → which existing rows the authenticated user may attempt to update
-- WITH CHECK → which resulting rows are acceptable after the update
-- Both must pass for the UPDATE to succeed (defence-in-depth).

DROP POLICY IF EXISTS "events: admin_users update" ON public.events;

CREATE POLICY "events: admin_users update"
  ON public.events
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   public.admin_users
      WHERE  admin_users.user_id  = auth.uid()
        AND  admin_users.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   public.admin_users
      WHERE  admin_users.user_id  = auth.uid()
        AND  admin_users.is_active = true
    )
  );


-- =============================================================================
-- HUMAN REVIEW CHECKLIST (required before executing in Supabase SQL editor)
-- =============================================================================
--
--  [ ] 1. Execute in a transaction:
--         BEGIN; <paste SQL>; COMMIT; — allows full rollback on any error.
--
--  [ ] 2. Verify no existing GRANT UPDATE on events before running
--         (run: \dp events in psql, or check Supabase Dashboard → Table editor
--         → events → Policies). Migrations 003–005 only issued INSERT / SELECT.
--
--  [ ] 3. After executing, test in Supabase SQL editor as authenticated admin:
--           UPDATE public.events
--           SET is_published = true
--           WHERE id = '<known-draft-id>';
--         Expect: 1 row updated (not permission denied).
--
--  [ ] 4. Confirm anon role CANNOT update events (no GRANT UPDATE to anon).
--
--  [ ] 5. Confirm non-admin authenticated users CANNOT update events
--         (RLS policy checks admin_users.is_active = true).
--
-- =============================================================================

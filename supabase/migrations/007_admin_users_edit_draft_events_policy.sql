-- =============================================================================
-- Migration 007 — Phase G: Admin Edit Draft Events
-- Project  : Idol Rhythm
-- Date     : 2026-05-15
--
-- Grants active admin_users the ability to:
--   1. UPDATE content fields on draft events (is_published = false only).
--   2. DELETE event_sources rows that belong to draft events.
--
-- Architecture notes:
--   - Identity check uses admin_users table (NOT JWT custom claim).
--   - Column-level GRANT restricts UPDATE to listed content fields.
--     is_published / published_at remain controlled by migration 006 (Phase F).
--   - UPDATE policy enforces is_published = false in both USING and WITH CHECK,
--     so published events cannot be mutated through this policy.
--   - DELETE policy on event_sources also checks that the parent event is a draft,
--     providing an extra layer against accidentally wiping sources of live events.
--   - No service_role. No JWT custom claim.
--   - No DELETE policy on events. No BULK operations.
-- =============================================================================


-- ── 1. Column-level GRANT UPDATE on events (content fields) ──────────────────
-- idol_name is included because it is a denormalized copy of the idol's display
-- name and must be updated together with idol_id.
-- is_published / published_at / created_at are intentionally OMITTED here.
-- updated_at is included so the trigger (set_updated_at) can fire correctly
-- regardless of how PostgreSQL evaluates trigger vs. column-level permissions.

GRANT UPDATE (
  idol_id,
  idol_name,
  title,
  type,
  sub_type,
  status,
  trust_level,
  date,
  time,
  location,
  country,
  country_flag,
  description,
  tags,
  ticket_url,
  stream_url,
  updated_at
)
ON public.events
TO authenticated;


-- ── 2. UPDATE RLS policy — drafts only ────────────────────────────────────────
-- USING      → only draft rows are visible/selectable for mutation
-- WITH CHECK → the resulting row must still be a draft after update
-- This double-check prevents toggling is_published through this policy
-- (which is already handled by migration 006 / Phase F).

DROP POLICY IF EXISTS "events: admin_users update drafts" ON public.events;

CREATE POLICY "events: admin_users update drafts"
  ON public.events
  FOR UPDATE
  TO authenticated
  USING (
    is_published = false
    AND EXISTS (
      SELECT 1
      FROM   public.admin_users
      WHERE  admin_users.user_id  = auth.uid()
        AND  admin_users.is_active = true
    )
  )
  WITH CHECK (
    is_published = false
    AND EXISTS (
      SELECT 1
      FROM   public.admin_users
      WHERE  admin_users.user_id  = auth.uid()
        AND  admin_users.is_active = true
    )
  );


-- ── 3. GRANT DELETE on event_sources ─────────────────────────────────────────
-- Needed for the delete-all + re-insert source management strategy in Phase G.
-- Table-level DELETE grant is acceptable here because the RLS policy below
-- limits which rows can actually be deleted.

GRANT DELETE ON public.event_sources TO authenticated;


-- ── 4. DELETE RLS policy on event_sources — draft parent only ────────────────
-- DELETE policies use only USING (no WITH CHECK for DELETE).
-- Two sub-checks are required:
--   a. The caller is an active admin.
--   b. The parent event is unpublished (draft).
-- This prevents accidentally deleting sources of published live events.

DROP POLICY IF EXISTS "event_sources: admin_users delete drafts" ON public.event_sources;

CREATE POLICY "event_sources: admin_users delete drafts"
  ON public.event_sources
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   public.admin_users
      WHERE  admin_users.user_id  = auth.uid()
        AND  admin_users.is_active = true
    )
    AND EXISTS (
      SELECT 1
      FROM   public.events
      WHERE  events.id           = event_sources.event_id
        AND  events.is_published = false
    )
  );


-- =============================================================================
-- HUMAN REVIEW CHECKLIST (required before executing in Supabase SQL editor)
-- =============================================================================
--
--  [ ] 1. Execute in a transaction:
--         BEGIN; <paste SQL>; COMMIT;
--
--  [ ] 2. Confirm migrations 003–006 were already applied before running this.
--
--  [ ] 3. Verify column-level GRANT does NOT include is_published, published_at,
--         or created_at — those must remain controlled by Phase F (migration 006).
--
--  [ ] 4. After executing, test as authenticated admin:
--           UPDATE public.events
--           SET title = 'Test edit'
--           WHERE id = '<known-draft-id>';
--         Expect: 1 row updated.
--
--  [ ] 5. Test that a published event cannot be updated:
--           UPDATE public.events
--           SET title = 'Should fail'
--           WHERE id = '<published-event-id>';
--         Expect: 0 rows updated (not an error; RLS silently filters it out).
--
--  [ ] 6. Test DELETE on event_sources for a draft event:
--           DELETE FROM public.event_sources WHERE event_id = '<draft-event-id>';
--         Expect: rows deleted.
--
--  [ ] 7. Test DELETE on event_sources for a published event:
--           DELETE FROM public.event_sources WHERE event_id = '<published-event-id>';
--         Expect: 0 rows deleted (RLS blocks it).
--
-- =============================================================================

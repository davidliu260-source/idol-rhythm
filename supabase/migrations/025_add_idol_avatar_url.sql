-- =============================================================================
-- Idol Rhythm — Add idols.avatar_url (Phase I1a)
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   I1a — baseline support for displaying real artist photos in the frontend.
--   Currently every idol renders as `name.charAt(0)` on a gradient block
--   (see EventCard.tsx and IdolsClient.tsx). This migration adds a single
--   nullable column so the admin can paste a public image URL and have the
--   frontend show it via the new IdolAvatar component (fallback to the
--   initial+gradient block when avatar_url is NULL).
--
--   Scope is intentionally tight:
--     - One nullable column. No data backfill — every existing row stays NULL
--       and the frontend's fallback path keeps rendering correctly.
--     - Column-level GRANT extension so admin_users can write avatar_url.
--       The existing UPDATE policy "idols: admin_users update basic info"
--       (migration 010) already covers the row-level check; we only need to
--       widen the column GRANT to include the new field.
--     - No new RLS policy. SELECT for anon is already granted on idols
--       (migration 009) and works against the new column without changes.
--
--   AI search + Supabase Storage upload are explicitly NOT in this migration.
--   They are reserved for I1b, which requires its own work order because
--   Storage bucket / policies / image-source decisions are higher risk.
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
-- SECTION 1: ADD COLUMN — idols.avatar_url
-- =============================================================================
-- nullable text. Stores either:
--   - A public https URL pointing at an externally-hosted image, OR
--   - (future I1b) a https URL pointing at the idol-avatars Supabase Storage
--     bucket.
-- No CHECK constraint on URL format; the frontend treats any truthy string
-- as a URL and the <img onError> handler falls back to the initial+gradient
-- block if the resource fails to load.
-- =============================================================================

ALTER TABLE public.idols
  ADD COLUMN IF NOT EXISTS avatar_url text;


-- =============================================================================
-- SECTION 2: Extend column-level GRANT UPDATE on idols to include avatar_url
-- =============================================================================
-- Migration 010 granted UPDATE on (name, korean_name, type, gender, category,
-- agency, debut_date, color, genres, member_count, description, updated_at)
-- to authenticated. avatar_url is a content field that admins must be able
-- to edit through /admin/idols/<id>/edit, so we widen the GRANT here.
--
-- The row-level UPDATE policy "idols: admin_users update basic info"
-- (migration 010) checks admin_users membership and is reused as-is — no
-- new policy is created, no existing policy is modified or relaxed.
--
-- Granting on a single column is additive; columns granted in 010 remain.
-- =============================================================================

GRANT UPDATE (avatar_url) ON public.idols TO authenticated;


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
--      SELECT column_name, data_type, is_nullable
--        FROM information_schema.columns
--       WHERE table_schema = 'public'
--         AND table_name   = 'idols'
--         AND column_name  = 'avatar_url';
--      Expected: one row, data_type='text', is_nullable='YES'.
--
--  □ Verify column-level UPDATE GRANT is in place:
--      SELECT grantee, privilege_type, column_name
--        FROM information_schema.column_privileges
--       WHERE table_schema = 'public'
--         AND table_name   = 'idols'
--         AND column_name  = 'avatar_url'
--         AND grantee      = 'authenticated';
--      Expected: one row, privilege_type='UPDATE'.
--
--  □ Verify all existing idol rows have avatar_url IS NULL (no backfill):
--      SELECT count(*) FROM idols WHERE avatar_url IS NOT NULL;
--      Expected: 0.
--
--  □ As an admin user via /admin/idols/<id>/edit, set a public image URL
--    in the new field and save. Reload /idols on the frontend and confirm
--    the avatar shows for that idol while the rest fall back to the
--    existing initial+gradient block.
--
--  □ As anon (logged out), browse /idols — the avatar should be readable
--    via the column SELECT GRANT from migration 009 (no change needed).
--
-- =============================================================================

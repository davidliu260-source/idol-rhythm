-- =============================================================================
-- Idol Rhythm — event_candidates content_hash + needs_recheck (Phase J7d-A)
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   J7d-A adds two columns to event_candidates so the crawler can detect
--   when a previously-captured source's content has changed and flag the
--   row for human re-review WITHOUT mutating review_status or
--   approved_event_id.
--
--     content_hash   text                                — SHA-256 over a fixed
--                                                          set of "decisive"
--                                                          fields (raw_title,
--                                                          raw_content,
--                                                          detected_date,
--                                                          detected_event_type,
--                                                          detected_idol_id,
--                                                          source_url,
--                                                          source_name,
--                                                          source_type).
--     needs_recheck  boolean NOT NULL DEFAULT false      — set true when the
--                                                          crawler detects a
--                                                          content change on a
--                                                          row whose source_hash
--                                                          already exists.
--
--   J7d-A scope (per GPT review of work order #32):
--     - DETECT and FLAG only. The crawler does NOT touch review_status,
--       approved_event_id, or any raw_* fields when content changes. It
--       only sets needs_recheck=true, updates content_hash to the new
--       value, and appends a timestamped line to reviewer_note.
--     - Admin UI shows a ⚠️ badge on flagged rows; no resolve button in
--       J7d-A (admin can manually edit reviewer_note or wait for J7d-B).
--
--   This migration is purely additive. Existing rows get content_hash=NULL
--   and needs_recheck=false; the crawler's first run after deploy silently
--   backfills content_hash without flagging (NULL is treated as "first
--   capture, no prior hash to compare against").
--
-- IDEMPOTENCE
--   - ADD COLUMN IF NOT EXISTS  — safe on re-run.
--   - CREATE INDEX IF NOT EXISTS — safe on re-run.
--   - GRANT UPDATE              — idempotent at the column level.
--
-- DEPENDENCY
--   Must be run AFTER:
--     001_initial_schema.sql                     — event_candidates table
--     012_admin_users_review_event_candidates_policy.sql — admin UPDATE GRANT
--     018_authenticated_admin_event_candidates_grants.sql — service_role GRANT
--     (service_role already has table-level INSERT/UPDATE/SELECT on
--      event_candidates and therefore automatically covers the new columns.)
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
-- SECTION 1: ADD COLUMNS — content_hash + needs_recheck
-- =============================================================================
-- content_hash:
--   NULL until the crawler computes it on the first post-deploy run for
--   each row. Once set, every subsequent crawl compares the freshly
--   computed hash against this value to detect content drift.
--
-- needs_recheck:
--   NOT NULL DEFAULT false so admin UI does not need null-checks. Flipped
--   to true by the crawler when it detects a content change on an
--   existing row. Stays true until admin explicitly clears it (J7d-B).
-- =============================================================================

ALTER TABLE public.event_candidates
  ADD COLUMN IF NOT EXISTS content_hash  text,
  ADD COLUMN IF NOT EXISTS needs_recheck boolean NOT NULL DEFAULT false;


-- =============================================================================
-- SECTION 2: Partial index for the admin "needs recheck" filter
-- =============================================================================
-- Vast majority of rows will be needs_recheck=false. A partial index keeps
-- the index tiny and makes the admin list filter cheap regardless of how
-- the candidates table grows.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_event_candidates_needs_recheck
  ON public.event_candidates (needs_recheck)
  WHERE needs_recheck = true;


-- =============================================================================
-- SECTION 3: Extend authenticated column-level GRANT UPDATE
-- =============================================================================
-- Migration 012 granted UPDATE on (review_status, reviewer_note,
-- approved_event_id) to authenticated. J7d-A does not introduce an admin
-- UI write path for needs_recheck (resolve UI is reserved for J7d-B), but
-- we widen the GRANT here so a future PR can add the resolve button
-- without another migration.
--
-- content_hash is intentionally NOT added to the GRANT — only the crawler
-- (running as service_role) should ever write it.
-- =============================================================================

GRANT UPDATE (needs_recheck) ON public.event_candidates TO authenticated;


COMMIT;


-- =============================================================================
-- REVIEW CHECKLIST (complete before executing in Supabase)
-- =============================================================================
--
--  □ Migrations 001, 012, 018 have already been executed.
--
--  □ Run the file wrapped in BEGIN … COMMIT. Verify "COMMIT" with no errors.
--
--  □ Verify the columns were added:
--      SELECT column_name, data_type, is_nullable, column_default
--        FROM information_schema.columns
--       WHERE table_schema = 'public'
--         AND table_name   = 'event_candidates'
--         AND column_name IN ('content_hash', 'needs_recheck');
--      Expected: two rows.
--        content_hash  | text    | YES | (null)
--        needs_recheck | boolean | NO  | false
--
--  □ Verify the partial index exists:
--      SELECT indexname, indexdef
--        FROM pg_indexes
--       WHERE schemaname = 'public'
--         AND tablename  = 'event_candidates'
--         AND indexname  = 'idx_event_candidates_needs_recheck';
--      Expected: one row with `WHERE (needs_recheck = true)` in indexdef.
--
--  □ Verify the column GRANT UPDATE on needs_recheck:
--      SELECT grantee, privilege_type, column_name
--        FROM information_schema.column_privileges
--       WHERE table_schema = 'public'
--         AND table_name   = 'event_candidates'
--         AND column_name  = 'needs_recheck'
--         AND grantee      = 'authenticated';
--      Expected: one row, privilege_type='UPDATE'.
--
--  □ Verify all existing rows have content_hash IS NULL and
--    needs_recheck=false (no backfill):
--      SELECT count(*) FILTER (WHERE content_hash IS NOT NULL) AS has_hash,
--             count(*) FILTER (WHERE needs_recheck = true) AS flagged
--        FROM event_candidates;
--      Expected: both zero.
--
--  □ Trigger any active crawler (e.g. /admin/sources/<id> → 手動執行).
--    First run after migration: content_hash populated, needs_recheck
--    remains false for all rows (NULL → value transition is a silent
--    backfill, not a "content changed" event).
--
--  □ Simulate a content change for testing:
--      UPDATE event_candidates SET raw_title = raw_title || ' (test)'
--       WHERE id = '<some-candidate-uuid>';
--    Re-run the crawler that owns this row. After the run:
--      - content_hash should be a different value
--      - needs_recheck should be true
--      - reviewer_note should have one appended line:
--          "[<ISO timestamp>] content changed after capture"
--      - review_status, approved_event_id should be UNCHANGED
--
-- =============================================================================

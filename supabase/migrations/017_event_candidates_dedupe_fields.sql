-- =============================================================================
-- Idol Rhythm — event_candidates dedupe fields
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   Phase J4: add a stable dedupe key (source_hash) and a structured payload
--   slot (raw_data jsonb) to event_candidates. Establishes a partial unique
--   index on source_hash so duplicate candidates can no longer be inserted
--   when callers (crawlers, manual import) supply a hash.
--
--   Both columns are nullable to keep existing seed / historical rows valid;
--   the unique index is partial and only enforces uniqueness when
--   source_hash IS NOT NULL. No backfill is performed in this migration
--   — see "Backfill" note below.
--
--   source_url is intentionally NOT made unique: historical rows may share
--   or lack URLs, and uniqueness there would block manual imports that
--   point at the same announcement.
--
-- DEPENDENCY
--   Must be run AFTER:
--     001_initial_schema.sql — defines event_candidates table
--     012, 016                — RLS policies already in place
--
-- EXECUTION
--   Run in Supabase SQL Editor:
--     BEGIN; <paste this file>; COMMIT;
--   ADD COLUMN IF NOT EXISTS and CREATE INDEX IF NOT EXISTS are idempotent.
--
-- BACKFILL
--   This migration does NOT backfill source_hash for existing rows.
--   Reasons:
--     - Historical seed rows may have inconsistent source_url / title and a
--       blind hash could mis-collide with a future crawler insert.
--     - Manual SQL backfill is safer to author per-source once we know
--       which rows we want to dedupe against, and is reversible.
--   New inserts (manual import + crawlers) WILL populate source_hash going
--   forward. If a historical row later turns out to be a duplicate of a
--   newly inserted one, the partial unique index will only catch the new
--   one because the old one is NULL — admin can then reject/clean manually.
--
-- ⚠️  HUMAN REVIEW REQUIRED before executing.
--     See review checklist at the bottom of this file.
-- =============================================================================


BEGIN;


-- =============================================================================
-- SECTION 1: ADD COLUMNS (idempotent)
-- =============================================================================
-- source_hash : stable canonical hash produced by the application layer.
--               SHA-256 hex output (64 chars), but typed as plain text to
--               keep the door open for shorter / different hash schemes.
-- raw_data    : structured payload kept alongside the row. For crawlers it
--               holds the parsed entry (city / venue / original date text /
--               source url / parser version). For manual imports it can be
--               { "source": "manual", ... } or left null.
-- =============================================================================

ALTER TABLE event_candidates
  ADD COLUMN IF NOT EXISTS source_hash text,
  ADD COLUMN IF NOT EXISTS raw_data    jsonb;


-- =============================================================================
-- SECTION 2: PARTIAL UNIQUE INDEX on source_hash
-- =============================================================================
-- Only enforces uniqueness for rows that supply a hash. NULL hashes are
-- excluded, so legacy rows without a hash do not collide with each other
-- and existing data continues to load.
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS event_candidates_source_hash_unique
  ON event_candidates (source_hash)
  WHERE source_hash IS NOT NULL;


COMMIT;


-- =============================================================================
-- REVIEW CHECKLIST (complete before executing in Supabase)
-- =============================================================================
--
--  □ Migrations 001–016 have already been executed.
--
--  □ Run the full file wrapped in BEGIN … COMMIT in the SQL Editor.
--    Verify "COMMIT" appears in the output with no errors.
--
--  □ After executing, verify the new columns exist:
--      SELECT column_name, data_type
--      FROM information_schema.columns
--      WHERE table_schema = 'public' AND table_name = 'event_candidates'
--        AND column_name IN ('source_hash', 'raw_data');
--    Should return two rows: source_hash (text), raw_data (jsonb).
--
--  □ Verify the partial unique index exists:
--      SELECT indexname, indexdef
--      FROM pg_indexes
--      WHERE schemaname = 'public'
--        AND tablename  = 'event_candidates'
--        AND indexname  = 'event_candidates_source_hash_unique';
--    indexdef should include "WHERE (source_hash IS NOT NULL)".
--
--  □ Sanity: existing rows still load on /admin/event-candidates.
--
--  □ Sanity: inserting two rows with the same source_hash should fail
--    with 23505 (unique_violation). NULL source_hash rows still allowed.
--
--  □ Verify idempotence:
--    Re-running this file should produce no errors (IF NOT EXISTS guards).
--
-- =============================================================================

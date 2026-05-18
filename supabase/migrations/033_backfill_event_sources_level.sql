-- =============================================================================
-- Idol Rhythm — Backfill event_sources.level from events.trust_level
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   Resolve the historical drift bug where bulk-publish updated
--   events.trust_level but left event_sources.level untouched. From now on
--   the frontend reads events.trust_level as the single source of truth
--   (see src/lib/supabase/events.ts → rowToEvent), so event_sources.level
--   is no longer rendered. This migration aligns the existing data so any
--   future tooling that still reads the column won't see contradictions.
--
--   The event_sources.level COLUMN IS NOT DROPPED. We keep it around for:
--     - admin audit (history of what an approver originally classified)
--     - future per-source trust modelling if we ever decide to revive it
--   A separate, later migration can drop it once we're confident nothing
--   reads it.
--
-- SCOPE
--   - Pure UPDATE. No DDL. No RLS / GRANT changes. No new tables.
--   - Idempotent: running again is a no-op once values already match.
--
-- DEPENDENCY
--   Must be run AFTER 001_initial_schema.sql (creates both tables).
--   Compatible with any prior migration state — only operates on existing rows.
--
-- EXECUTION
--   Run in Supabase SQL Editor:
--     BEGIN; <paste this file>; COMMIT;
-- =============================================================================

BEGIN;

UPDATE public.event_sources AS es
   SET level = e.trust_level
  FROM public.events AS e
 WHERE es.event_id = e.id
   AND es.level   IS DISTINCT FROM e.trust_level;

COMMIT;


-- =============================================================================
-- REVIEW CHECKLIST
-- =============================================================================
--
--  □ 跑完後驗證沒有不一致的列：
--    SELECT count(*)
--      FROM event_sources es
--      JOIN events e ON e.id = es.event_id
--     WHERE es.level IS DISTINCT FROM e.trust_level;
--    Expected: 0
--
--  □ 前台檢查：之前顯示「待確認」但 events.trust_level='official' 的活動，
--    現在應該顯示「官方確認」。
--
-- =============================================================================

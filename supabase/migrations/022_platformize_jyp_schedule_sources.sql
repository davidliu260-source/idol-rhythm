-- =============================================================================
-- Idol Rhythm — Platformize JYP Schedule sources (Phase J6d)
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   J6c registered a TWICE-specific JYP schedule fetcher (parser_type =
--   'twice_jyp_schedule'). J6d refactors that into a generic JYP platform
--   parser so future JYP-managed groups (Stray Kids, ITZY, NMIXX …) can be
--   added by inserting a single crawler_sources row — no new code.
--
--   This migration is data + schema only:
--     1. Add crawler_sources.config jsonb column (default '{}'::jsonb).
--     2. Switch the existing TWICE row to parser_type = 'jyp_schedule'
--        and populate config with the JYP API groupId and artistSlug.
--
--   Scope is intentionally narrow:
--     - No new tables.
--     - No RLS changes.
--     - No GRANT changes (J6b column-level UPDATE grant already covers
--       (last_run_at, last_status, last_error, updated_at); config is not
--       written by the runtime, only by SQL migrations / DBA actions).
--     - No new artist seeds (Stray Kids / ITZY / NMIXX are NOT added).
--     - No cron / cron schedule changes.
--
-- DEPENDENCY
--   Must be run AFTER:
--     019_crawler_sources.sql                         — creates crawler_sources
--     020_crawler_sources_run_status_policy.sql       — UPDATE grants
--     021_seed_twice_jyp_schedule_source.sql          — seeds the TWICE row
--
-- EXECUTION
--   Run in Supabase SQL Editor:
--     BEGIN; <paste this file>; COMMIT;
--   Idempotent: ADD COLUMN IF NOT EXISTS + UPDATE by source_key.
--
-- ⚠️  HUMAN REVIEW REQUIRED before executing.
--     See review checklist at the bottom of this file.
-- =============================================================================


BEGIN;


-- =============================================================================
-- SECTION 1: Add config jsonb column
-- =============================================================================
-- Each crawler_sources row may carry parser-specific parameters. Shape is
-- parser-defined; for jyp_schedule the runtime reads:
--   config.groupId    — JYP internal numeric group id (string)
--   config.artistSlug — JYP subdomain slug (e.g. 'twice'), used as fallback
--                       to resolve groupId via /api/groups/{slug}
--
-- Default '{}'::jsonb means existing rows (e.g. BLACKPINK) get an empty
-- object — they're unaffected because their parsers don't read config yet.
-- =============================================================================

ALTER TABLE public.crawler_sources
  ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb;


-- =============================================================================
-- SECTION 2: Repoint TWICE source to the generic jyp_schedule parser
-- =============================================================================
-- The fetcher's EXPECTED_PARSER_TYPE constant must match this string:
--   src/lib/crawlers/runJypScheduleFetcher.ts → 'jyp_schedule'.
--
-- groupId = '9' is the JYP-side identifier confirmed live against
--   GET https://twice.jype.com/api/groups/twice → { groupId: "9" }
-- during the J6c JSON-API switch.
--
-- Only TWICE is touched. If the row was deleted manually, the UPDATE
-- silently affects zero rows — re-run migration 021 first in that case.
-- =============================================================================

UPDATE public.crawler_sources
SET
  parser_type = 'jyp_schedule',
  config = jsonb_build_object(
    'groupId',    '9',
    'artistSlug', 'twice'
  ),
  updated_at = now()
WHERE source_key = 'twice-jyp-schedule';


COMMIT;


-- =============================================================================
-- REVIEW CHECKLIST (complete before executing in Supabase)
-- =============================================================================
--
--  □ Migrations 001–021 have already been executed.
--
--  □ Run the full file wrapped in BEGIN … COMMIT in the SQL Editor.
--    Verify "COMMIT" appears in the output with no errors.
--
--  □ After executing, verify the schema change:
--    SELECT column_name, data_type, column_default
--      FROM information_schema.columns
--     WHERE table_schema = 'public'
--       AND table_name   = 'crawler_sources'
--       AND column_name  = 'config';
--    Expected: one row — config / jsonb / '{}'::jsonb.
--
--  □ Verify the TWICE row was repointed:
--    SELECT source_key, parser_type, config
--      FROM crawler_sources
--     WHERE source_key = 'twice-jyp-schedule';
--    Expected: parser_type = 'jyp_schedule',
--              config     = { "groupId": "9", "artistSlug": "twice" }.
--
--  □ Verify other rows are unaffected:
--    SELECT source_key, parser_type, config
--      FROM crawler_sources
--     ORDER BY source_key;
--    Expected: BLACKPINK row still has parser_type = 'blackpink_official_tour'
--              and config = {} (default).
--
--  □ Verify idempotence:
--    Re-running this file should produce no errors and leave the data
--    in the same shape.
--
--  □ Then on the deployed site:
--    - /admin/sources/<TWICE id> shows parser_type = jyp_schedule
--      and the new "parser 設定 (config)" section lists groupId / artistSlug.
--    - The 「手動執行」button still runs successfully (now via the new
--      /api/admin/crawlers/jyp-schedule/run route).
--    - BLACKPINK source row is unaffected and its runner still works.
--
-- =============================================================================

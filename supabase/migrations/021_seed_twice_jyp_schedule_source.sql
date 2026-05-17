-- =============================================================================
-- Idol Rhythm — Seed TWICE JYP Schedule Source (Phase J6c)
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   Phase J6c registers the second crawler source — TWICE official JYP
--   Schedule page — so the data-driven source architecture is exercised
--   beyond the BLACKPINK prototype. This migration is data-only: it adds
--   one row to crawler_sources and changes nothing else.
--
--   Scope is intentionally narrow:
--     - Single INSERT … ON CONFLICT (source_key) DO NOTHING.
--     - No new tables.
--     - No RLS changes.
--     - No GRANT changes (J6a + J6b already cover SELECT + status UPDATE).
--     - No second cron, no crawler_runs history table.
--     - No anon access changes.
--
-- DEPENDENCY
--   Must be run AFTER:
--     019_crawler_sources.sql            — creates crawler_sources
--     020_crawler_sources_run_status_policy.sql — UPDATE grants
--
-- EXECUTION
--   Run in Supabase SQL Editor:
--     BEGIN; <paste this file>; COMMIT;
--   ON CONFLICT (source_key) DO NOTHING keeps it idempotent and preserves
--   any future manual edits to this row.
--
-- ⚠️  HUMAN REVIEW REQUIRED before executing.
--     See review checklist at the bottom of this file.
-- =============================================================================


BEGIN;


-- =============================================================================
-- SECTION 1: Seed — TWICE 官方 JYP Schedule
-- =============================================================================
-- idol_id is resolved by slug = 'twice'. If the idols row does not exist
-- yet (e.g. seed not yet run), idol_id becomes NULL — the fetcher has a
-- runtime fallback that re-queries by slug, so this stays non-fatal.
--
-- parser_type = 'twice_jyp_schedule' must match the EXPECTED_PARSER_TYPE
-- constant in src/lib/crawlers/runTwiceScheduleFetcher.ts. If they drift,
-- the fetcher short-circuits with an "parser_type 不符" error.
-- =============================================================================

INSERT INTO crawler_sources (
  name,
  source_key,
  idol_id,
  source_url,
  source_type,
  parser_type,
  is_active
)
SELECT
  'TWICE 官方 JYP Schedule',
  'twice-jyp-schedule',
  (SELECT id FROM idols WHERE slug = 'twice' LIMIT 1),
  'https://twice.jype.com/Mobile/Schedule',
  'official_website'::source_type,
  'twice_jyp_schedule',
  true
ON CONFLICT (source_key) DO NOTHING;


COMMIT;


-- =============================================================================
-- REVIEW CHECKLIST (complete before executing in Supabase)
-- =============================================================================
--
--  □ Migrations 001–020 have already been executed.
--
--  □ Run the full file wrapped in BEGIN … COMMIT in the SQL Editor.
--    Verify "COMMIT" appears in the output with no errors.
--
--  □ After executing, verify:
--    SELECT name, source_key, parser_type, is_active, idol_id IS NOT NULL AS has_idol
--      FROM crawler_sources
--     WHERE source_key = 'twice-jyp-schedule';
--    Expected: one row — TWICE 官方 JYP Schedule / twice-jyp-schedule /
--              twice_jyp_schedule / true / has_idol = true (assuming TWICE
--              exists in idols; if not, has_idol = false is acceptable).
--
--  □ Verify admin can see the new row at /admin/sources.
--
--  □ Verify the BLACKPINK row is unchanged (still active, still has
--    last_run_at / last_status from J6b).
--
--  □ Verify idempotence:
--    Re-running this file should produce no errors (ON CONFLICT DO NOTHING).
--
-- =============================================================================

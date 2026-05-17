-- =============================================================================
-- Idol Rhythm — Seed Stray Kids idol + JYP Schedule source (Phase J7a)
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   J7a is a pure-data smoke test of the JYP platform parser introduced in
--   J6d. Adding a second JYP artist must take exactly ONE migration, no
--   code changes — that's the contract J6d promised. This file proves it:
--
--     idols       :  Stray Kids row (basic facts, no UI styling)
--     crawler_sources :  Stray Kids JYP Schedule row, parser_type='jyp_schedule',
--                        config.groupId='10', config.artistSlug='stray-kids'
--
--   After execution, /admin/sources shows the new row, the manual-run
--   button works, and Vercel Cron picks it up automatically on the next
--   tick — because cron already fans out across all is_active rows (J6e).
--
--   Scope is intentionally narrow:
--     - Pure data INSERTs. No new tables.
--     - No RLS / GRANT / column changes.
--     - No new artist beyond Stray Kids.
--     - No code, no parser, no cron, no frontstage changes.
--
-- IDEMPOTENCE
--   - idols row uses ON CONFLICT (slug) DO NOTHING — preserves any future
--     manual UI edits (color, gradient, description, etc.).
--   - crawler_sources row uses ON CONFLICT (source_key) DO UPDATE on the
--     parser_type / source_url / config / updated_at columns only.
--     Status columns (last_run_at, last_status, last_error) are NEVER
--     touched, so re-running this migration after a real crawl run does
--     not stomp the operational state.
--
-- DEPENDENCY
--   Must be run AFTER:
--     001_initial_schema.sql                           — idols table
--     019_crawler_sources.sql                          — crawler_sources table
--     022_platformize_jyp_schedule_sources.sql         — config jsonb column
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
-- SECTION 1: Seed — Stray Kids idol
-- =============================================================================
-- Minimal, factual fields only. UI styling fields (color, gradient,
-- description, debut_date, member_count, etc.) are left NULL/default so
-- admin can fill them in via /admin/idols/<id>/edit without fearing this
-- migration will clobber their work on re-run.
--
-- slug intentionally uses 'stray-kids' (hyphen) — readable in URLs and
-- admin pages. The JYP-side subdomain 'straykids' (no hyphen) is captured
-- inside source_url / origin derivation, not here.
-- =============================================================================

INSERT INTO public.idols (
  slug,
  name,
  korean_name,
  type,
  gender,
  category,
  agency,
  is_active
)
VALUES (
  'stray-kids',
  'Stray Kids',
  '스트레이 키즈',
  'group'::group_or_solo,
  'male'::gender_type,
  'kpop'::idol_category,
  'JYP Entertainment',
  true
)
ON CONFLICT (slug) DO NOTHING;


-- =============================================================================
-- SECTION 2: Seed — Stray Kids JYP Schedule crawler source
-- =============================================================================
-- parser_type = 'jyp_schedule' matches runJypScheduleFetcher's
-- EXPECTED_PARSER_TYPE. config.groupId = '10' is the JYP internal id
-- confirmed live against:
--   GET https://straykids.jype.com/api/groups/straykids
--     → { "groupId":"10", "fansKey":"StrayKids" }
--
-- artistSlug is set to our internal idol slug ('stray-kids') so the
-- fetcher's idol_id fallback (idols.slug lookup) lands on the row above.
-- The JYP /api/groups fallback is not used because config.groupId is set.
-- =============================================================================

INSERT INTO public.crawler_sources (
  name,
  source_key,
  idol_id,
  source_url,
  source_type,
  parser_type,
  is_active,
  config
)
SELECT
  'Stray Kids 官方 JYP Schedule',
  'stray-kids-jyp-schedule',
  (SELECT id FROM idols WHERE slug = 'stray-kids' LIMIT 1),
  'https://straykids.jype.com/Mobile/Schedule',
  'official_website'::source_type,
  'jyp_schedule',
  true,
  jsonb_build_object(
    'groupId',    '10',
    'artistSlug', 'stray-kids'
  )
ON CONFLICT (source_key) DO UPDATE
SET
  parser_type = EXCLUDED.parser_type,
  source_url  = EXCLUDED.source_url,
  config      = EXCLUDED.config,
  updated_at  = now();
  -- Intentionally NOT updated on conflict:
  --   idol_id        — preserves any manual re-pointing.
  --   name           — preserves any human-edited display name.
  --   is_active      — preserves admin's enable / disable choice.
  --   last_run_at    — operational state, never reset by seed.
  --   last_status    — same.
  --   last_error     — same.


COMMIT;


-- =============================================================================
-- REVIEW CHECKLIST (complete before executing in Supabase)
-- =============================================================================
--
--  □ Migrations 001–022 have already been executed.
--
--  □ Run the full file wrapped in BEGIN … COMMIT in the SQL Editor.
--    Verify "COMMIT" appears in the output with no errors.
--
--  □ After executing, verify the idol row:
--    SELECT slug, name, agency, is_active
--      FROM idols
--     WHERE slug = 'stray-kids';
--    Expected: one row — stray-kids / Stray Kids / JYP Entertainment / true.
--
--  □ Verify the crawler source row:
--    SELECT name, source_key, parser_type, is_active, config,
--           idol_id IS NOT NULL AS has_idol
--      FROM crawler_sources
--     WHERE source_key = 'stray-kids-jyp-schedule';
--    Expected: one row, parser_type='jyp_schedule',
--              config={"groupId":"10","artistSlug":"stray-kids"},
--              has_idol = true.
--
--  □ Verify TWICE row is unchanged (still parser_type='jyp_schedule',
--    config.groupId='9', last_run_at preserved):
--    SELECT source_key, parser_type, config, last_run_at, last_status
--      FROM crawler_sources
--     WHERE source_key = 'twice-jyp-schedule';
--
--  □ Verify BLACKPINK row is unchanged:
--    SELECT source_key, parser_type, last_run_at, last_status
--      FROM crawler_sources
--     WHERE source_key = 'blackpink-official-tour';
--
--  □ Then on the deployed site:
--    - /admin/idols shows Stray Kids in the list.
--    - /admin/sources lists the new Stray Kids row alongside TWICE / BLACKPINK.
--    - /admin/sources/<stray-kids id> 「手動執行」 button works; expect
--      `fetched > 0` and `inserted > 0` on first real run, future-only
--      (J6f filter) so all candidates have detected_date >= today.
--    - /admin/event-candidates filtered by Stray Kids shows pending rows.
--    - BLACKPINK + TWICE runners unaffected.
--    - Next Vercel Cron run (J6e fan-out) automatically includes the new
--      source — no code change required.
--
--  □ Verify idempotence: re-running the file should produce zero changes
--    on the idols row (DO NOTHING) and refresh updated_at only on the
--    crawler_sources row.
--
-- =============================================================================

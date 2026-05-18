-- =============================================================================
-- Idol Rhythm — Seed 5 JYP artists + JYP Schedule sources (Phase M1b batch 1)
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   M1b expands roster coverage. JYP-managed groups can be added with pure
--   data migrations — the J6d platform parser already handles any groupId
--   you point it at. This file seeds 5 additional JYP artists:
--
--     ITZY            (groupId 11, female group)
--     NMIXX           (groupId 14, female group)
--     DAY6            (groupId 8,  male band)
--     Xdinary Heroes  (groupId 13, male band)
--     2PM             (groupId 3,  male group)
--
--   groupIds were verified live against:
--     GET https://<subdomain>.jype.com/api/groups/<subdomain>
--   on 2026-05-18.
--
--   Scope is intentionally narrow:
--     - Pure data INSERTs into idols + crawler_sources.
--     - No new tables, no RLS / GRANT / column changes.
--     - No code changes — runJypScheduleFetcher already handles any groupId.
--     - Vercel Cron auto-picks up new is_active rows on the next tick (J6e).
--
-- IDEMPOTENCE
--   - idols rows: ON CONFLICT (slug) DO NOTHING — preserves manual UI edits
--     (color, gradient, description, etc.).
--   - crawler_sources rows: ON CONFLICT (source_key) DO UPDATE on the
--     parser_type / source_url / config / updated_at columns only.
--     Status columns (last_run_at, last_status, last_error) and is_active
--     are NEVER touched on conflict.
--
-- DEPENDENCY
--   Must be run AFTER:
--     001_initial_schema.sql
--     019_crawler_sources.sql
--     022_platformize_jyp_schedule_sources.sql  (adds config jsonb column)
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
-- SECTION 1: Seed — 5 JYP idols
-- =============================================================================
-- Minimal factual fields only. UI styling fields (color, gradient, description,
-- debut_date, member_count, etc.) are left NULL/default so admin can fill them
-- in via /admin/idols/<id>/edit without fearing this migration will clobber
-- their work on re-run.
-- =============================================================================

INSERT INTO public.idols (slug, name, korean_name, type, gender, category, agency, is_active)
VALUES
  ('itzy',           'ITZY',           '있지',             'group'::group_or_solo, 'female'::gender_type, 'kpop'::idol_category, 'JYP Entertainment', true),
  ('nmixx',          'NMIXX',          '엔믹스',           'group'::group_or_solo, 'female'::gender_type, 'kpop'::idol_category, 'JYP Entertainment', true),
  ('day6',           'DAY6',           '데이식스',         'group'::group_or_solo, 'male'::gender_type,   'kpop'::idol_category, 'JYP Entertainment', true),
  ('xdinary-heroes', 'Xdinary Heroes', '엑스디너리 히어로즈', 'group'::group_or_solo, 'male'::gender_type,   'kpop'::idol_category, 'JYP Entertainment', true),
  ('2pm',            '2PM',            '투피엠',           'group'::group_or_solo, 'male'::gender_type,   'kpop'::idol_category, 'JYP Entertainment', true)
ON CONFLICT (slug) DO NOTHING;


-- =============================================================================
-- SECTION 2: Seed — 5 JYP Schedule crawler sources
-- =============================================================================
-- parser_type = 'jyp_schedule' matches runJypScheduleFetcher's
-- EXPECTED_PARSER_TYPE. config.groupId is the JYP internal id; config.artistSlug
-- mirrors our idols.slug so the fetcher's idol_id fallback resolves correctly.
-- =============================================================================

INSERT INTO public.crawler_sources (
  name, source_key, idol_id, source_url, source_type, parser_type, is_active, config
)
SELECT
  'ITZY 官方 JYP Schedule',
  'itzy-jyp-schedule',
  (SELECT id FROM idols WHERE slug = 'itzy' LIMIT 1),
  'https://itzy.jype.com/Mobile/Schedule',
  'official_website'::source_type,
  'jyp_schedule',
  true,
  jsonb_build_object('groupId', '11', 'artistSlug', 'itzy')
ON CONFLICT (source_key) DO UPDATE
SET parser_type = EXCLUDED.parser_type,
    source_url  = EXCLUDED.source_url,
    config      = EXCLUDED.config,
    updated_at  = now();

INSERT INTO public.crawler_sources (
  name, source_key, idol_id, source_url, source_type, parser_type, is_active, config
)
SELECT
  'NMIXX 官方 JYP Schedule',
  'nmixx-jyp-schedule',
  (SELECT id FROM idols WHERE slug = 'nmixx' LIMIT 1),
  'https://nmixx.jype.com/Mobile/Schedule',
  'official_website'::source_type,
  'jyp_schedule',
  true,
  jsonb_build_object('groupId', '14', 'artistSlug', 'nmixx')
ON CONFLICT (source_key) DO UPDATE
SET parser_type = EXCLUDED.parser_type,
    source_url  = EXCLUDED.source_url,
    config      = EXCLUDED.config,
    updated_at  = now();

INSERT INTO public.crawler_sources (
  name, source_key, idol_id, source_url, source_type, parser_type, is_active, config
)
SELECT
  'DAY6 官方 JYP Schedule',
  'day6-jyp-schedule',
  (SELECT id FROM idols WHERE slug = 'day6' LIMIT 1),
  'https://day6.jype.com/Mobile/Schedule',
  'official_website'::source_type,
  'jyp_schedule',
  true,
  jsonb_build_object('groupId', '8', 'artistSlug', 'day6')
ON CONFLICT (source_key) DO UPDATE
SET parser_type = EXCLUDED.parser_type,
    source_url  = EXCLUDED.source_url,
    config      = EXCLUDED.config,
    updated_at  = now();

INSERT INTO public.crawler_sources (
  name, source_key, idol_id, source_url, source_type, parser_type, is_active, config
)
SELECT
  'Xdinary Heroes 官方 JYP Schedule',
  'xdinary-heroes-jyp-schedule',
  (SELECT id FROM idols WHERE slug = 'xdinary-heroes' LIMIT 1),
  'https://xdinaryheroes.jype.com/Mobile/Schedule',
  'official_website'::source_type,
  'jyp_schedule',
  true,
  jsonb_build_object('groupId', '13', 'artistSlug', 'xdinary-heroes')
ON CONFLICT (source_key) DO UPDATE
SET parser_type = EXCLUDED.parser_type,
    source_url  = EXCLUDED.source_url,
    config      = EXCLUDED.config,
    updated_at  = now();

INSERT INTO public.crawler_sources (
  name, source_key, idol_id, source_url, source_type, parser_type, is_active, config
)
SELECT
  '2PM 官方 JYP Schedule',
  '2pm-jyp-schedule',
  (SELECT id FROM idols WHERE slug = '2pm' LIMIT 1),
  'https://2pm.jype.com/Mobile/Schedule',
  'official_website'::source_type,
  'jyp_schedule',
  true,
  jsonb_build_object('groupId', '3', 'artistSlug', '2pm')
ON CONFLICT (source_key) DO UPDATE
SET parser_type = EXCLUDED.parser_type,
    source_url  = EXCLUDED.source_url,
    config      = EXCLUDED.config,
    updated_at  = now();


COMMIT;


-- =============================================================================
-- REVIEW CHECKLIST (complete before executing in Supabase)
-- =============================================================================
--
--  □ Migrations 001–030 已執行。
--
--  □ Run the full file wrapped in BEGIN … COMMIT in the SQL Editor.
--    Verify "COMMIT" appears in the output with no errors.
--
--  □ Verify 5 new idol rows:
--    SELECT slug, name, agency, is_active
--      FROM idols
--     WHERE slug IN ('itzy','nmixx','day6','xdinary-heroes','2pm')
--     ORDER BY slug;
--    Expected: 5 rows, all agency = 'JYP Entertainment', is_active = true.
--
--  □ Verify 5 new crawler_sources rows:
--    SELECT source_key, parser_type, is_active, config,
--           idol_id IS NOT NULL AS has_idol
--      FROM crawler_sources
--     WHERE source_key LIKE '%-jyp-schedule'
--     ORDER BY source_key;
--    Expected: 7 rows total (TWICE, Stray Kids, + the new 5),
--              all parser_type='jyp_schedule', has_idol=true,
--              config = { groupId, artistSlug } per artist.
--
--  □ Verify existing TWICE / Stray Kids rows untouched
--    (parser_type, last_run_at, last_status preserved):
--    SELECT source_key, parser_type, last_run_at, last_status
--      FROM crawler_sources
--     WHERE source_key IN ('twice-jyp-schedule', 'stray-kids-jyp-schedule');
--
--  □ Then on the deployed site:
--    - /admin/idols 列表新增 5 個 JYP 藝人（無 avatar、無描述，等手動補）
--    - /admin/sources 出現 5 個新爬蟲列
--    - 任選一個點手動執行，預期 fetched > 0、inserted > 0（未來日期）
--    - /admin/event-candidates 出現對應 pending 候選
--    - Next Vercel Cron run 自動納入這 5 個來源 — 無須改 code
--    - Re-running this file should produce no changes (DO NOTHING / DO UPDATE
--      only refreshes updated_at on the crawler_sources rows).
--
-- =============================================================================

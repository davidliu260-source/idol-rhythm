-- =============================================================================
-- Idol Rhythm — Seed J.Y. Park idol + JYP Schedule source (Phase M1b solo)
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   First JYP solo entry. Park Jin-young (J.Y. Park, JYP founder) has his
--   own jype.com subdomain and JYP groupId, so the existing platform parser
--   (J6d / runJypScheduleFetcher) handles him with zero code changes.
--
--   groupId verified live on 2026-05-18:
--     GET https://jyp.jype.com/api/groups/jyp
--       → { groupId: "2", fansKey: "jypark" }
--
--   Scope is intentionally narrow:
--     - Pure data INSERTs into idols + crawler_sources.
--     - Single artist only (J.Y. Park). Other "solo" entries (e.g. TWICE
--       members' solo activities) intentionally NOT added — those usually
--       surface inside the group's schedule and would create duplicates.
--     - No new tables, no RLS / GRANT / column changes, no code changes.
--
-- IDEMPOTENCE
--   - idols row: ON CONFLICT (slug) DO NOTHING.
--   - crawler_sources row: ON CONFLICT (source_key) DO UPDATE on
--     parser_type / source_url / config / updated_at only.
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
-- =============================================================================


BEGIN;


-- =============================================================================
-- SECTION 1: Seed — J.Y. Park idol
-- =============================================================================
-- type='solo' (first solo entry), gender='male'. UI styling fields left
-- NULL/default so admin can fill in via /admin/idols/<id>/edit later.
-- member_count is NULL per the migration 001 comment: "NULL for solo".
-- =============================================================================

INSERT INTO public.idols (
  slug, name, korean_name, type, gender, category, agency, is_active
)
VALUES (
  'jy-park', 'J.Y. Park', '박진영',
  'solo'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
  'JYP Entertainment', true
)
ON CONFLICT (slug) DO NOTHING;


-- =============================================================================
-- SECTION 2: Seed — J.Y. Park JYP Schedule crawler source
-- =============================================================================

INSERT INTO public.crawler_sources (
  name, source_key, idol_id, source_url, source_type, parser_type, is_active, config
)
SELECT
  'J.Y. Park 官方 JYP Schedule',
  'jy-park-jyp-schedule',
  (SELECT id FROM idols WHERE slug = 'jy-park' LIMIT 1),
  'https://jyp.jype.com/Mobile/Schedule',
  'official_website'::source_type,
  'jyp_schedule',
  true,
  jsonb_build_object('groupId', '2', 'artistSlug', 'jy-park')
ON CONFLICT (source_key) DO UPDATE
SET parser_type = EXCLUDED.parser_type,
    source_url  = EXCLUDED.source_url,
    config      = EXCLUDED.config,
    updated_at  = now();


COMMIT;


-- =============================================================================
-- REVIEW CHECKLIST
-- =============================================================================
--
--  □ Migrations 001–031 已執行。
--
--  □ 跑完後驗證：
--    SELECT slug, name, type, agency, is_active
--      FROM idols WHERE slug = 'jy-park';
--    Expected: 1 row, type='solo', agency='JYP Entertainment', is_active=true.
--
--    SELECT source_key, parser_type, is_active, config,
--           idol_id IS NOT NULL AS has_idol
--      FROM crawler_sources WHERE source_key = 'jy-park-jyp-schedule';
--    Expected: parser_type='jyp_schedule',
--              config={"groupId":"2","artistSlug":"jy-park"}, has_idol=true.
--
--  □ /admin/sources/<jy-park id> 手動執行 — 預期 fetched > 0 或 0（J.Y. Park
--    schedule 可能極少未來活動，0 也是正常結果，重點是 last_status='success'）。
--
--  □ 不影響現有 7 個 JYP 來源（TWICE / Stray Kids / ITZY / NMIXX / DAY6 /
--    Xdinary Heroes / 2PM）的 last_run_at / last_status。
--
-- =============================================================================

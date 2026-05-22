-- =============================================================================
-- Idol Rhythm -- Seed SMTOWN notice crawler sources (SMTOWN crawler)
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   Register the SMTOWN official notice board as a crawler source family
--   for the first-pass target artists (per CRAWLER_WORK_ORDER_SMTOWN.md):
--     - aespa
--     - RIIZE
--     - Red Velvet
--     - EXO
--     - NCT (root)
--
--   All five source rows point to the same shared label notice feed at
--   https://www.smtown.com/notice and use parser_type = 'smtown_notice'.
--   The fetcher matches notices to the specific idol via name/alt_names,
--   and enforces an NCT-root unit guard (NCT 127 / NCT DREAM / NCT WISH /
--   WayV titles are dropped when the source idol is root `nct`).
--
-- PHASE A PROBE FINDINGS (2026-05-22)
--   - Server-rendered HTML. Cheerio parsing is stable.
--   - Structure: div.noticeTop > span.number + subject + span.day,
--     body in adjacent sibling div.noticeBox (no separate detail URL).
--   - Date format: "YYYY/MM/DD"
--   - Pagination: ?page=N (0-indexed). max page param = 36 at probe time.
--   - Notices have no per-notice permalink. The parser synthesises a
--     stable noticeId from span.number (or `pinned-{slug}` for pinned
--     items). source_url uses a `#smtown-{noticeId}-{idolSlug}` fragment
--     to differentiate (notice, idol) pairs.
--   - Current notices mix administrative items (privacy policy, app
--     maintenance, DIGITAL STAMP follow-ups, SEASON'S GREETINGS merch)
--     with occasional real event references. Conservative event filter
--     skips most by design.
--
-- CHANGES
--   - INSERT 5 crawler_sources rows
--   - No schema changes
--   - No GRANT / RLS changes
--   - No event_candidates changes
--
-- IDEMPOTENCE
--   ON CONFLICT (source_key) DO UPDATE keeps the row current if source
--   details change. Safe to re-run.
--
-- DEPENDENCY
--   Requires the following idol slugs to already exist in public.idols
--   (all seeded in earlier M1b migrations 034/036, before M1b-3 / M1b-4):
--     - aespa
--     - riize
--     - red-velvet
--     - exo
--     - nct
--   If any slug is missing, the matching INSERT silently inserts zero
--   rows (no error). Always verify with the review checklist below.
--
--   Also requires:
--     019_crawler_sources.sql              (crawler_sources table)
--     044_seed_wakeone_notice_crawler_sources.sql (pattern reference)
--
-- EXECUTION
--   Run in Supabase SQL Editor:
--     BEGIN; <paste this file>; COMMIT;
--
-- REVIEW CHECKLIST
--   [ ] Confirm aespa / riize / red-velvet / exo / nct slugs exist in
--       idols table (and is_active = true).
--   [ ] Confirm 5 rows inserted in crawler_sources (one per slug).
--   [ ] Confirm parser_type = 'smtown_notice' for all 5 rows.
--   [ ] Confirm idol_id IS NOT NULL for all 5 rows.
--   [ ] Test manual run via POST /api/admin/crawlers/smtown-notice/run
--       with body { "sourceKey": "aespa-smtown-notice" }.
--   [ ] Verify result: fetched > 0, most notices skip the event filter
--       (by design — board is mostly administrative).
-- =============================================================================


BEGIN;


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
  'aespa SMTOWN Notice',
  'aespa-smtown-notice',
  idols.id,
  'https://www.smtown.com/notice',
  'official_website'::source_type,
  'smtown_notice',
  true,
  '{}'::jsonb
FROM public.idols
WHERE idols.slug = 'aespa'
ON CONFLICT (source_key) DO UPDATE
SET name        = EXCLUDED.name,
    idol_id     = EXCLUDED.idol_id,
    source_url  = EXCLUDED.source_url,
    source_type = EXCLUDED.source_type,
    parser_type = EXCLUDED.parser_type,
    is_active   = EXCLUDED.is_active,
    config      = EXCLUDED.config,
    updated_at  = NOW();


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
  'RIIZE SMTOWN Notice',
  'riize-smtown-notice',
  idols.id,
  'https://www.smtown.com/notice',
  'official_website'::source_type,
  'smtown_notice',
  true,
  '{}'::jsonb
FROM public.idols
WHERE idols.slug = 'riize'
ON CONFLICT (source_key) DO UPDATE
SET name        = EXCLUDED.name,
    idol_id     = EXCLUDED.idol_id,
    source_url  = EXCLUDED.source_url,
    source_type = EXCLUDED.source_type,
    parser_type = EXCLUDED.parser_type,
    is_active   = EXCLUDED.is_active,
    config      = EXCLUDED.config,
    updated_at  = NOW();


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
  'Red Velvet SMTOWN Notice',
  'red-velvet-smtown-notice',
  idols.id,
  'https://www.smtown.com/notice',
  'official_website'::source_type,
  'smtown_notice',
  true,
  '{}'::jsonb
FROM public.idols
WHERE idols.slug = 'red-velvet'
ON CONFLICT (source_key) DO UPDATE
SET name        = EXCLUDED.name,
    idol_id     = EXCLUDED.idol_id,
    source_url  = EXCLUDED.source_url,
    source_type = EXCLUDED.source_type,
    parser_type = EXCLUDED.parser_type,
    is_active   = EXCLUDED.is_active,
    config      = EXCLUDED.config,
    updated_at  = NOW();


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
  'EXO SMTOWN Notice',
  'exo-smtown-notice',
  idols.id,
  'https://www.smtown.com/notice',
  'official_website'::source_type,
  'smtown_notice',
  true,
  '{}'::jsonb
FROM public.idols
WHERE idols.slug = 'exo'
ON CONFLICT (source_key) DO UPDATE
SET name        = EXCLUDED.name,
    idol_id     = EXCLUDED.idol_id,
    source_url  = EXCLUDED.source_url,
    source_type = EXCLUDED.source_type,
    parser_type = EXCLUDED.parser_type,
    is_active   = EXCLUDED.is_active,
    config      = EXCLUDED.config,
    updated_at  = NOW();


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
  'NCT SMTOWN Notice',
  'nct-smtown-notice',
  idols.id,
  'https://www.smtown.com/notice',
  'official_website'::source_type,
  'smtown_notice',
  true,
  '{}'::jsonb
FROM public.idols
WHERE idols.slug = 'nct'
ON CONFLICT (source_key) DO UPDATE
SET name        = EXCLUDED.name,
    idol_id     = EXCLUDED.idol_id,
    source_url  = EXCLUDED.source_url,
    source_type = EXCLUDED.source_type,
    parser_type = EXCLUDED.parser_type,
    is_active   = EXCLUDED.is_active,
    config      = EXCLUDED.config,
    updated_at  = NOW();


COMMIT;


-- Verification query (run after COMMIT):
-- SELECT source_key, name, parser_type, is_active,
--        idol_id IS NOT NULL AS has_idol, source_url
--   FROM public.crawler_sources
--  WHERE source_key IN (
--    'aespa-smtown-notice',
--    'riize-smtown-notice',
--    'red-velvet-smtown-notice',
--    'exo-smtown-notice',
--    'nct-smtown-notice'
--  )
--  ORDER BY source_key;

-- =============================================================================
-- Idol Rhythm -- Seed WAKEONE notice crawler sources (WAKEONE crawler)
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   Register the WAKEONE official notice board as a crawler source family
--   for the first-pass target artists:
--     - ZEROBASEONE
--     - Kep1er
--     - izna
--
--   All three source rows point to the same shared label notice feed at
--   https://wake-one.com/notice/ and use parser_type = 'wakeone_notice'.
--   The fetcher matches notices to the specific idol via name/alt_names.
--
-- PHASE A PROBE FINDINGS (2026-05-22)
--   - Server-rendered WordPress HTML, Cheerio parsing is stable.
--   - Structure: div.notice-item > a.post-link, h5.title, span.date
--   - Date format: "YYYY. MM. DD"
--   - URL pagination: /notice/page/N/ (max_page=2 at probe time, grows over time)
--   - Current notices are administrative (legal, contracts, activity updates).
--     Conservative event filter will skip most by design. Future concert/fan
--     meeting announcements would be captured if they appear on this board.
--
-- CHANGES
--   - INSERT 3 crawler_sources rows
--   - No schema changes
--   - No GRANT / RLS changes
--   - No event_candidates changes
--
-- IDEMPOTENCE
--   ON CONFLICT (source_key) DO UPDATE keeps the row current if source details
--   change. Safe to re-run.
--
-- DEPENDENCY
--   Must be run AFTER:
--     043_seed_mainstream_artists_m1b4.sql  (ensures izna, jo-yuri slugs exist)
--     019_crawler_sources.sql              (crawler_sources table)
--     040_seed_yg_artist_schedule_sources.sql (pattern reference)
--
-- EXECUTION
--   Run in Supabase SQL Editor:
--     BEGIN; <paste this file>; COMMIT;
--
-- REVIEW CHECKLIST
--   [ ] Confirm ZEROBASEONE, Kep1er, izna slugs exist in idols table.
--   [ ] Confirm 3 rows inserted in crawler_sources.
--   [ ] Confirm parser_type = 'wakeone_notice' for all 3 rows.
--   [ ] Confirm idol_id IS NOT NULL for all 3 rows.
--   [ ] Test manual run via POST /api/admin/crawlers/wakeone-notice/run
--       with body { "sourceKey": "zerobaseone-wakeone-notice" }.
--   [ ] Verify result: fetched >= 0, most/all notices skip the event filter
--       (by design — current board is administrative only).
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
  'ZEROBASEONE WAKEONE Notice',
  'zerobaseone-wakeone-notice',
  idols.id,
  'https://wake-one.com/notice/',
  'official_website'::source_type,
  'wakeone_notice',
  true,
  '{}'::jsonb
FROM public.idols
WHERE idols.slug = 'zerobaseone'
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
  'Kep1er WAKEONE Notice',
  'kep1er-wakeone-notice',
  idols.id,
  'https://wake-one.com/notice/',
  'official_website'::source_type,
  'wakeone_notice',
  true,
  '{}'::jsonb
FROM public.idols
WHERE idols.slug = 'kep1er'
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
  'izna WAKEONE Notice',
  'izna-wakeone-notice',
  idols.id,
  'https://wake-one.com/notice/',
  'official_website'::source_type,
  'wakeone_notice',
  true,
  '{}'::jsonb
FROM public.idols
WHERE idols.slug = 'izna'
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
--    'zerobaseone-wakeone-notice',
--    'kep1er-wakeone-notice',
--    'izna-wakeone-notice'
--  )
--  ORDER BY source_key;

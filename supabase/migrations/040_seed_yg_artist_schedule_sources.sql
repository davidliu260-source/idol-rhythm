-- =============================================================================
-- Idol Rhythm — Seed YG artist schedule crawler sources
--
-- PURPOSE
--   Register official YG schedule pages for the first YG source family.
--   Parser implementation: parser_type = 'yg_artist_schedule'
--
-- SCOPE
--   - Adds/updates crawler_sources rows only.
--   - Does not insert event_candidates.
--   - Does not approve or publish events.
--
-- SOURCES
--   - BLACKPINK group schedule: YG official artist schedule
--   - BABYMONSTER schedule: YG official artist schedule
--   - TREASURE schedule: YG official artist schedule
--
-- NOT IN SCOPE
--   - BLACKPINK solo sources (Blissoo / ODD ATELIER / THEBLACKLABEL / LLOUD)
--   - THEBLACKLABEL sources
--   - BIGBANG or BIGBANG solo sources
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
  'BLACKPINK 官方 YG Schedule',
  'blackpink-yg-schedule',
  idols.id,
  'https://www.ygfamily.com/ko/artists/blackpink/schedule',
  'official_website'::source_type,
  'yg_artist_schedule',
  true,
  jsonb_build_object('artistId', 6, 'artistSlug', 'blackpink')
FROM public.idols
WHERE idols.slug = 'blackpink'
ON CONFLICT (source_key) DO UPDATE
SET name = EXCLUDED.name,
    idol_id = EXCLUDED.idol_id,
    source_url = EXCLUDED.source_url,
    source_type = EXCLUDED.source_type,
    parser_type = EXCLUDED.parser_type,
    is_active = EXCLUDED.is_active,
    config = EXCLUDED.config,
    updated_at = NOW();

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
  'BABYMONSTER 官方 YG Schedule',
  'babymonster-yg-schedule',
  idols.id,
  'https://ygfamily.com/ko/artists/babymonster/schedule',
  'official_website'::source_type,
  'yg_artist_schedule',
  true,
  jsonb_build_object('artistId', 319, 'artistSlug', 'babymonster')
FROM public.idols
WHERE idols.slug = 'babymonster'
ON CONFLICT (source_key) DO UPDATE
SET name = EXCLUDED.name,
    idol_id = EXCLUDED.idol_id,
    source_url = EXCLUDED.source_url,
    source_type = EXCLUDED.source_type,
    parser_type = EXCLUDED.parser_type,
    is_active = EXCLUDED.is_active,
    config = EXCLUDED.config,
    updated_at = NOW();

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
  'TREASURE 官方 YG Schedule',
  'treasure-yg-schedule',
  idols.id,
  'https://ygfamily.com/ko/artists/treasure/schedule',
  'official_website'::source_type,
  'yg_artist_schedule',
  true,
  jsonb_build_object('artistId', 30, 'artistSlug', 'treasure')
FROM public.idols
WHERE idols.slug = 'treasure'
ON CONFLICT (source_key) DO UPDATE
SET name = EXCLUDED.name,
    idol_id = EXCLUDED.idol_id,
    source_url = EXCLUDED.source_url,
    source_type = EXCLUDED.source_type,
    parser_type = EXCLUDED.parser_type,
    is_active = EXCLUDED.is_active,
    config = EXCLUDED.config,
    updated_at = NOW();

COMMIT;

-- Verification:
-- SELECT source_key, parser_type, is_active, config, idol_id IS NOT NULL AS has_idol
--   FROM public.crawler_sources
--  WHERE source_key IN (
--    'blackpink-yg-schedule',
--    'babymonster-yg-schedule',
--    'treasure-yg-schedule'
--  )
--  ORDER BY source_key;

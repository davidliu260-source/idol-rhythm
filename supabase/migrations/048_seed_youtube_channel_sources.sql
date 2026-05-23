-- =============================================================================
-- Idol Rhythm -- Seed YouTube Official Channel crawler sources (P2-A1)
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   Register the first-wave (P0) 19 official YouTube channels as crawler
--   sources for the youtube_official_channel parser_type. Each row covers
--   one idol and pulls latest videos from that idol's official channel.
--
--   The fetcher classifies videos into A / B / C / unknown tiers and only
--   inserts A (high priority) and B (low priority) into event_candidates.
--   C (Shorts, vlog, reaction, fancam, etc.) and unknown are silently
--   skipped. See: src/lib/crawlers/youtubeOfficialChannel.ts
--
-- IMPORTANT: PLACEHOLDER VALUES — admin must fill in before activating
--   Each row is seeded with `is_active = false` and config containing
--   placeholder channelId / uploadsPlaylistId strings:
--     config.channelId          = 'UC__PLEASE_FILL__<slug>__________'
--     config.uploadsPlaylistId  = 'UU__PLEASE_FILL__<slug>__________'
--   Admin checklist before flipping is_active = true:
--     [1] Open the artist's official YouTube channel in a browser
--     [2] Copy the Channel ID (URL pattern: /channel/UCxxxx... — 22 chars)
--     [3] Derive uploads playlist id (typically replace "UC" prefix with "UU";
--         verify with: GET https://www.googleapis.com/youtube/v3/channels?
--         part=contentDetails&id=<channelId>&key=<your-key>)
--     [4] UPDATE crawler_sources SET config = jsonb_set(jsonb_set(config,
--         '{channelId}', '"UC<real>"'), '{uploadsPlaylistId}', '"UU<real>"'),
--         is_active = true WHERE source_key = '<key>';
--     [5] Test: POST /api/admin/crawlers/youtube-official/run
--               body { "sourceKey": "<key>" }
--     [6] Inspect event_candidates for inserted rows; reject anything
--         misclassified and refine classifier if needed.
--
-- P0 ROSTER (19 idols, per P2-A work order v3 — NewJeans deferred to P1):
--   BTS, BLACKPINK, TWICE, aespa, RIIZE, SEVENTEEN, Stray Kids, IVE,
--   LE SSERAFIM, ENHYPEN, (G)I-DLE, ITZY, NMIXX, BABYMONSTER,
--   NCT 127, NCT DREAM, Red Velvet, ATEEZ, TXT
--
-- CHANGES
--   - INSERT 19 crawler_sources rows (is_active = false)
--   - No schema changes
--   - No GRANT / RLS changes
--   - No event_candidates changes
--   - No new enum values (uses existing source_type = 'official_website')
--
-- IDEMPOTENCE
--   ON CONFLICT (source_key) DO UPDATE keeps the row current but PRESERVES
--   an admin-managed config / is_active. Specifically, we only overwrite
--   name / source_url / source_type / parser_type / idol_id (metadata),
--   and we DO NOT overwrite config or is_active so admin work is not
--   clobbered on a re-run.
--
-- DEPENDENCY
--   Must be run AFTER:
--     019_crawler_sources.sql                       (table exists)
--     022_add_crawler_sources_config.sql            (config jsonb column)
--     034 / 036 / 038 / 043 idol seeds              (all 19 slugs present)
--
-- EXECUTION
--   Run in Supabase SQL Editor:
--     BEGIN; <paste this file>; COMMIT;
--
-- REVIEW CHECKLIST
--   [ ] Confirm 19 rows inserted in crawler_sources.
--   [ ] Confirm all parser_type = 'youtube_official_channel'.
--   [ ] Confirm all idol_id IS NOT NULL (FROM-clause guarantees this).
--   [ ] Confirm all is_active = false (must be flipped by admin per row).
--   [ ] After admin fills config and flips is_active for at least one row,
--       test POST /api/admin/crawlers/youtube-official/run.
-- =============================================================================


BEGIN;


-- ── Helper note ─────────────────────────────────────────────────────────────
-- Each block follows the same shape:
--   INSERT … SELECT … FROM public.idols WHERE slug = '<slug>'
--   ON CONFLICT (source_key) DO UPDATE SET <metadata-only fields>
-- We deliberately exclude `config` and `is_active` from the DO UPDATE list
-- so admin-managed values survive re-runs of this migration.


-- ── 1. BTS ──────────────────────────────────────────────────────────────────
INSERT INTO public.crawler_sources (
  name, source_key, idol_id, source_url, source_type, parser_type, is_active, config
)
SELECT
  'BTS YouTube Official Channel',
  'bts-youtube-official',
  idols.id,
  'https://www.youtube.com/channel/UC__PLEASE_FILL__bts____________',
  'official_website'::source_type,
  'youtube_official_channel',
  false,
  jsonb_build_object(
    'channelId', 'UC__PLEASE_FILL__bts____________',
    'uploadsPlaylistId', 'UU__PLEASE_FILL__bts____________',
    'maxVideosPerRun', 10,
    'publishedAfterHours', 25
  )
FROM public.idols
WHERE idols.slug = 'bts'
ON CONFLICT (source_key) DO UPDATE
SET name        = EXCLUDED.name,
    idol_id     = EXCLUDED.idol_id,
    source_url  = EXCLUDED.source_url,
    source_type = EXCLUDED.source_type,
    parser_type = EXCLUDED.parser_type,
    updated_at  = NOW();


-- ── 2. BLACKPINK ────────────────────────────────────────────────────────────
INSERT INTO public.crawler_sources (
  name, source_key, idol_id, source_url, source_type, parser_type, is_active, config
)
SELECT
  'BLACKPINK YouTube Official Channel',
  'blackpink-youtube-official',
  idols.id,
  'https://www.youtube.com/channel/UC__PLEASE_FILL__blackpink______',
  'official_website'::source_type,
  'youtube_official_channel',
  false,
  jsonb_build_object(
    'channelId', 'UC__PLEASE_FILL__blackpink______',
    'uploadsPlaylistId', 'UU__PLEASE_FILL__blackpink______',
    'maxVideosPerRun', 10,
    'publishedAfterHours', 25
  )
FROM public.idols
WHERE idols.slug = 'blackpink'
ON CONFLICT (source_key) DO UPDATE
SET name        = EXCLUDED.name,
    idol_id     = EXCLUDED.idol_id,
    source_url  = EXCLUDED.source_url,
    source_type = EXCLUDED.source_type,
    parser_type = EXCLUDED.parser_type,
    updated_at  = NOW();


-- ── 3. TWICE ────────────────────────────────────────────────────────────────
INSERT INTO public.crawler_sources (
  name, source_key, idol_id, source_url, source_type, parser_type, is_active, config
)
SELECT
  'TWICE YouTube Official Channel',
  'twice-youtube-official',
  idols.id,
  'https://www.youtube.com/channel/UC__PLEASE_FILL__twice__________',
  'official_website'::source_type,
  'youtube_official_channel',
  false,
  jsonb_build_object(
    'channelId', 'UC__PLEASE_FILL__twice__________',
    'uploadsPlaylistId', 'UU__PLEASE_FILL__twice__________',
    'maxVideosPerRun', 10,
    'publishedAfterHours', 25
  )
FROM public.idols
WHERE idols.slug = 'twice'
ON CONFLICT (source_key) DO UPDATE
SET name        = EXCLUDED.name,
    idol_id     = EXCLUDED.idol_id,
    source_url  = EXCLUDED.source_url,
    source_type = EXCLUDED.source_type,
    parser_type = EXCLUDED.parser_type,
    updated_at  = NOW();


-- ── 4. aespa ────────────────────────────────────────────────────────────────
INSERT INTO public.crawler_sources (
  name, source_key, idol_id, source_url, source_type, parser_type, is_active, config
)
SELECT
  'aespa YouTube Official Channel',
  'aespa-youtube-official',
  idols.id,
  'https://www.youtube.com/channel/UC__PLEASE_FILL__aespa__________',
  'official_website'::source_type,
  'youtube_official_channel',
  false,
  jsonb_build_object(
    'channelId', 'UC__PLEASE_FILL__aespa__________',
    'uploadsPlaylistId', 'UU__PLEASE_FILL__aespa__________',
    'maxVideosPerRun', 10,
    'publishedAfterHours', 25
  )
FROM public.idols
WHERE idols.slug = 'aespa'
ON CONFLICT (source_key) DO UPDATE
SET name        = EXCLUDED.name,
    idol_id     = EXCLUDED.idol_id,
    source_url  = EXCLUDED.source_url,
    source_type = EXCLUDED.source_type,
    parser_type = EXCLUDED.parser_type,
    updated_at  = NOW();


-- ── 5. RIIZE ────────────────────────────────────────────────────────────────
INSERT INTO public.crawler_sources (
  name, source_key, idol_id, source_url, source_type, parser_type, is_active, config
)
SELECT
  'RIIZE YouTube Official Channel',
  'riize-youtube-official',
  idols.id,
  'https://www.youtube.com/channel/UC__PLEASE_FILL__riize__________',
  'official_website'::source_type,
  'youtube_official_channel',
  false,
  jsonb_build_object(
    'channelId', 'UC__PLEASE_FILL__riize__________',
    'uploadsPlaylistId', 'UU__PLEASE_FILL__riize__________',
    'maxVideosPerRun', 10,
    'publishedAfterHours', 25
  )
FROM public.idols
WHERE idols.slug = 'riize'
ON CONFLICT (source_key) DO UPDATE
SET name        = EXCLUDED.name,
    idol_id     = EXCLUDED.idol_id,
    source_url  = EXCLUDED.source_url,
    source_type = EXCLUDED.source_type,
    parser_type = EXCLUDED.parser_type,
    updated_at  = NOW();


-- ── 6. SEVENTEEN ────────────────────────────────────────────────────────────
INSERT INTO public.crawler_sources (
  name, source_key, idol_id, source_url, source_type, parser_type, is_active, config
)
SELECT
  'SEVENTEEN YouTube Official Channel',
  'seventeen-youtube-official',
  idols.id,
  'https://www.youtube.com/channel/UC__PLEASE_FILL__seventeen______',
  'official_website'::source_type,
  'youtube_official_channel',
  false,
  jsonb_build_object(
    'channelId', 'UC__PLEASE_FILL__seventeen______',
    'uploadsPlaylistId', 'UU__PLEASE_FILL__seventeen______',
    'maxVideosPerRun', 10,
    'publishedAfterHours', 25
  )
FROM public.idols
WHERE idols.slug = 'seventeen'
ON CONFLICT (source_key) DO UPDATE
SET name        = EXCLUDED.name,
    idol_id     = EXCLUDED.idol_id,
    source_url  = EXCLUDED.source_url,
    source_type = EXCLUDED.source_type,
    parser_type = EXCLUDED.parser_type,
    updated_at  = NOW();


-- ── 7. Stray Kids ───────────────────────────────────────────────────────────
INSERT INTO public.crawler_sources (
  name, source_key, idol_id, source_url, source_type, parser_type, is_active, config
)
SELECT
  'Stray Kids YouTube Official Channel',
  'stray-kids-youtube-official',
  idols.id,
  'https://www.youtube.com/channel/UC__PLEASE_FILL__stray-kids_____',
  'official_website'::source_type,
  'youtube_official_channel',
  false,
  jsonb_build_object(
    'channelId', 'UC__PLEASE_FILL__stray-kids_____',
    'uploadsPlaylistId', 'UU__PLEASE_FILL__stray-kids_____',
    'maxVideosPerRun', 10,
    'publishedAfterHours', 25
  )
FROM public.idols
WHERE idols.slug = 'stray-kids'
ON CONFLICT (source_key) DO UPDATE
SET name        = EXCLUDED.name,
    idol_id     = EXCLUDED.idol_id,
    source_url  = EXCLUDED.source_url,
    source_type = EXCLUDED.source_type,
    parser_type = EXCLUDED.parser_type,
    updated_at  = NOW();


-- ── 8. IVE ──────────────────────────────────────────────────────────────────
INSERT INTO public.crawler_sources (
  name, source_key, idol_id, source_url, source_type, parser_type, is_active, config
)
SELECT
  'IVE YouTube Official Channel',
  'ive-youtube-official',
  idols.id,
  'https://www.youtube.com/channel/UC__PLEASE_FILL__ive____________',
  'official_website'::source_type,
  'youtube_official_channel',
  false,
  jsonb_build_object(
    'channelId', 'UC__PLEASE_FILL__ive____________',
    'uploadsPlaylistId', 'UU__PLEASE_FILL__ive____________',
    'maxVideosPerRun', 10,
    'publishedAfterHours', 25
  )
FROM public.idols
WHERE idols.slug = 'ive'
ON CONFLICT (source_key) DO UPDATE
SET name        = EXCLUDED.name,
    idol_id     = EXCLUDED.idol_id,
    source_url  = EXCLUDED.source_url,
    source_type = EXCLUDED.source_type,
    parser_type = EXCLUDED.parser_type,
    updated_at  = NOW();


-- ── 9. LE SSERAFIM ──────────────────────────────────────────────────────────
INSERT INTO public.crawler_sources (
  name, source_key, idol_id, source_url, source_type, parser_type, is_active, config
)
SELECT
  'LE SSERAFIM YouTube Official Channel',
  'le-sserafim-youtube-official',
  idols.id,
  'https://www.youtube.com/channel/UC__PLEASE_FILL__le-sserafim____',
  'official_website'::source_type,
  'youtube_official_channel',
  false,
  jsonb_build_object(
    'channelId', 'UC__PLEASE_FILL__le-sserafim____',
    'uploadsPlaylistId', 'UU__PLEASE_FILL__le-sserafim____',
    'maxVideosPerRun', 10,
    'publishedAfterHours', 25
  )
FROM public.idols
WHERE idols.slug = 'le-sserafim'
ON CONFLICT (source_key) DO UPDATE
SET name        = EXCLUDED.name,
    idol_id     = EXCLUDED.idol_id,
    source_url  = EXCLUDED.source_url,
    source_type = EXCLUDED.source_type,
    parser_type = EXCLUDED.parser_type,
    updated_at  = NOW();


-- ── 10. ENHYPEN ─────────────────────────────────────────────────────────────
INSERT INTO public.crawler_sources (
  name, source_key, idol_id, source_url, source_type, parser_type, is_active, config
)
SELECT
  'ENHYPEN YouTube Official Channel',
  'enhypen-youtube-official',
  idols.id,
  'https://www.youtube.com/channel/UC__PLEASE_FILL__enhypen________',
  'official_website'::source_type,
  'youtube_official_channel',
  false,
  jsonb_build_object(
    'channelId', 'UC__PLEASE_FILL__enhypen________',
    'uploadsPlaylistId', 'UU__PLEASE_FILL__enhypen________',
    'maxVideosPerRun', 10,
    'publishedAfterHours', 25
  )
FROM public.idols
WHERE idols.slug = 'enhypen'
ON CONFLICT (source_key) DO UPDATE
SET name        = EXCLUDED.name,
    idol_id     = EXCLUDED.idol_id,
    source_url  = EXCLUDED.source_url,
    source_type = EXCLUDED.source_type,
    parser_type = EXCLUDED.parser_type,
    updated_at  = NOW();


-- ── 11. (G)I-DLE ────────────────────────────────────────────────────────────
INSERT INTO public.crawler_sources (
  name, source_key, idol_id, source_url, source_type, parser_type, is_active, config
)
SELECT
  '(G)I-DLE YouTube Official Channel',
  'g-i-dle-youtube-official',
  idols.id,
  'https://www.youtube.com/channel/UC__PLEASE_FILL__g-i-dle________',
  'official_website'::source_type,
  'youtube_official_channel',
  false,
  jsonb_build_object(
    'channelId', 'UC__PLEASE_FILL__g-i-dle________',
    'uploadsPlaylistId', 'UU__PLEASE_FILL__g-i-dle________',
    'maxVideosPerRun', 10,
    'publishedAfterHours', 25
  )
FROM public.idols
WHERE idols.slug = 'g-i-dle'
ON CONFLICT (source_key) DO UPDATE
SET name        = EXCLUDED.name,
    idol_id     = EXCLUDED.idol_id,
    source_url  = EXCLUDED.source_url,
    source_type = EXCLUDED.source_type,
    parser_type = EXCLUDED.parser_type,
    updated_at  = NOW();


-- ── 12. ITZY ────────────────────────────────────────────────────────────────
INSERT INTO public.crawler_sources (
  name, source_key, idol_id, source_url, source_type, parser_type, is_active, config
)
SELECT
  'ITZY YouTube Official Channel',
  'itzy-youtube-official',
  idols.id,
  'https://www.youtube.com/channel/UC__PLEASE_FILL__itzy___________',
  'official_website'::source_type,
  'youtube_official_channel',
  false,
  jsonb_build_object(
    'channelId', 'UC__PLEASE_FILL__itzy___________',
    'uploadsPlaylistId', 'UU__PLEASE_FILL__itzy___________',
    'maxVideosPerRun', 10,
    'publishedAfterHours', 25
  )
FROM public.idols
WHERE idols.slug = 'itzy'
ON CONFLICT (source_key) DO UPDATE
SET name        = EXCLUDED.name,
    idol_id     = EXCLUDED.idol_id,
    source_url  = EXCLUDED.source_url,
    source_type = EXCLUDED.source_type,
    parser_type = EXCLUDED.parser_type,
    updated_at  = NOW();


-- ── 13. NMIXX ───────────────────────────────────────────────────────────────
INSERT INTO public.crawler_sources (
  name, source_key, idol_id, source_url, source_type, parser_type, is_active, config
)
SELECT
  'NMIXX YouTube Official Channel',
  'nmixx-youtube-official',
  idols.id,
  'https://www.youtube.com/channel/UC__PLEASE_FILL__nmixx__________',
  'official_website'::source_type,
  'youtube_official_channel',
  false,
  jsonb_build_object(
    'channelId', 'UC__PLEASE_FILL__nmixx__________',
    'uploadsPlaylistId', 'UU__PLEASE_FILL__nmixx__________',
    'maxVideosPerRun', 10,
    'publishedAfterHours', 25
  )
FROM public.idols
WHERE idols.slug = 'nmixx'
ON CONFLICT (source_key) DO UPDATE
SET name        = EXCLUDED.name,
    idol_id     = EXCLUDED.idol_id,
    source_url  = EXCLUDED.source_url,
    source_type = EXCLUDED.source_type,
    parser_type = EXCLUDED.parser_type,
    updated_at  = NOW();


-- ── 14. BABYMONSTER ─────────────────────────────────────────────────────────
INSERT INTO public.crawler_sources (
  name, source_key, idol_id, source_url, source_type, parser_type, is_active, config
)
SELECT
  'BABYMONSTER YouTube Official Channel',
  'babymonster-youtube-official',
  idols.id,
  'https://www.youtube.com/channel/UC__PLEASE_FILL__babymonster____',
  'official_website'::source_type,
  'youtube_official_channel',
  false,
  jsonb_build_object(
    'channelId', 'UC__PLEASE_FILL__babymonster____',
    'uploadsPlaylistId', 'UU__PLEASE_FILL__babymonster____',
    'maxVideosPerRun', 10,
    'publishedAfterHours', 25
  )
FROM public.idols
WHERE idols.slug = 'babymonster'
ON CONFLICT (source_key) DO UPDATE
SET name        = EXCLUDED.name,
    idol_id     = EXCLUDED.idol_id,
    source_url  = EXCLUDED.source_url,
    source_type = EXCLUDED.source_type,
    parser_type = EXCLUDED.parser_type,
    updated_at  = NOW();


-- ── 15. NCT 127 ─────────────────────────────────────────────────────────────
INSERT INTO public.crawler_sources (
  name, source_key, idol_id, source_url, source_type, parser_type, is_active, config
)
SELECT
  'NCT 127 YouTube Official Channel',
  'nct-127-youtube-official',
  idols.id,
  'https://www.youtube.com/channel/UC__PLEASE_FILL__nct-127________',
  'official_website'::source_type,
  'youtube_official_channel',
  false,
  jsonb_build_object(
    'channelId', 'UC__PLEASE_FILL__nct-127________',
    'uploadsPlaylistId', 'UU__PLEASE_FILL__nct-127________',
    'maxVideosPerRun', 10,
    'publishedAfterHours', 25
  )
FROM public.idols
WHERE idols.slug = 'nct-127'
ON CONFLICT (source_key) DO UPDATE
SET name        = EXCLUDED.name,
    idol_id     = EXCLUDED.idol_id,
    source_url  = EXCLUDED.source_url,
    source_type = EXCLUDED.source_type,
    parser_type = EXCLUDED.parser_type,
    updated_at  = NOW();


-- ── 16. NCT DREAM ───────────────────────────────────────────────────────────
INSERT INTO public.crawler_sources (
  name, source_key, idol_id, source_url, source_type, parser_type, is_active, config
)
SELECT
  'NCT DREAM YouTube Official Channel',
  'nct-dream-youtube-official',
  idols.id,
  'https://www.youtube.com/channel/UC__PLEASE_FILL__nct-dream______',
  'official_website'::source_type,
  'youtube_official_channel',
  false,
  jsonb_build_object(
    'channelId', 'UC__PLEASE_FILL__nct-dream______',
    'uploadsPlaylistId', 'UU__PLEASE_FILL__nct-dream______',
    'maxVideosPerRun', 10,
    'publishedAfterHours', 25
  )
FROM public.idols
WHERE idols.slug = 'nct-dream'
ON CONFLICT (source_key) DO UPDATE
SET name        = EXCLUDED.name,
    idol_id     = EXCLUDED.idol_id,
    source_url  = EXCLUDED.source_url,
    source_type = EXCLUDED.source_type,
    parser_type = EXCLUDED.parser_type,
    updated_at  = NOW();


-- ── 17. Red Velvet ──────────────────────────────────────────────────────────
INSERT INTO public.crawler_sources (
  name, source_key, idol_id, source_url, source_type, parser_type, is_active, config
)
SELECT
  'Red Velvet YouTube Official Channel',
  'red-velvet-youtube-official',
  idols.id,
  'https://www.youtube.com/channel/UC__PLEASE_FILL__red-velvet_____',
  'official_website'::source_type,
  'youtube_official_channel',
  false,
  jsonb_build_object(
    'channelId', 'UC__PLEASE_FILL__red-velvet_____',
    'uploadsPlaylistId', 'UU__PLEASE_FILL__red-velvet_____',
    'maxVideosPerRun', 10,
    'publishedAfterHours', 25
  )
FROM public.idols
WHERE idols.slug = 'red-velvet'
ON CONFLICT (source_key) DO UPDATE
SET name        = EXCLUDED.name,
    idol_id     = EXCLUDED.idol_id,
    source_url  = EXCLUDED.source_url,
    source_type = EXCLUDED.source_type,
    parser_type = EXCLUDED.parser_type,
    updated_at  = NOW();


-- ── 18. ATEEZ ───────────────────────────────────────────────────────────────
INSERT INTO public.crawler_sources (
  name, source_key, idol_id, source_url, source_type, parser_type, is_active, config
)
SELECT
  'ATEEZ YouTube Official Channel',
  'ateez-youtube-official',
  idols.id,
  'https://www.youtube.com/channel/UC__PLEASE_FILL__ateez__________',
  'official_website'::source_type,
  'youtube_official_channel',
  false,
  jsonb_build_object(
    'channelId', 'UC__PLEASE_FILL__ateez__________',
    'uploadsPlaylistId', 'UU__PLEASE_FILL__ateez__________',
    'maxVideosPerRun', 10,
    'publishedAfterHours', 25
  )
FROM public.idols
WHERE idols.slug = 'ateez'
ON CONFLICT (source_key) DO UPDATE
SET name        = EXCLUDED.name,
    idol_id     = EXCLUDED.idol_id,
    source_url  = EXCLUDED.source_url,
    source_type = EXCLUDED.source_type,
    parser_type = EXCLUDED.parser_type,
    updated_at  = NOW();


-- ── 19. TXT ─────────────────────────────────────────────────────────────────
INSERT INTO public.crawler_sources (
  name, source_key, idol_id, source_url, source_type, parser_type, is_active, config
)
SELECT
  'TXT YouTube Official Channel',
  'txt-youtube-official',
  idols.id,
  'https://www.youtube.com/channel/UC__PLEASE_FILL__txt____________',
  'official_website'::source_type,
  'youtube_official_channel',
  false,
  jsonb_build_object(
    'channelId', 'UC__PLEASE_FILL__txt____________',
    'uploadsPlaylistId', 'UU__PLEASE_FILL__txt____________',
    'maxVideosPerRun', 10,
    'publishedAfterHours', 25
  )
FROM public.idols
WHERE idols.slug = 'txt'
ON CONFLICT (source_key) DO UPDATE
SET name        = EXCLUDED.name,
    idol_id     = EXCLUDED.idol_id,
    source_url  = EXCLUDED.source_url,
    source_type = EXCLUDED.source_type,
    parser_type = EXCLUDED.parser_type,
    updated_at  = NOW();


COMMIT;

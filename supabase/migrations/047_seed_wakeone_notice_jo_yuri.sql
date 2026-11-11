-- =============================================================================
-- Idol Rhythm -- Seed WAKEONE notice crawler source for Jo Yuri
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   Add Jo Yuri (조유리) to the WAKEONE notice crawler source family.
--   She joined WAKEONE in 2025 (confirmed via wake-one.com/artists/joyuri/).
--
-- PHASE A PROBE FINDINGS (2026-05-23)
--   1. Jo Yuri slug `jo-yuri` confirmed present and is_active = true in DB.
--   2. WAKEONE notice board (https://wake-one.com/notice/) confirmed 200 OK,
--      server-rendered WordPress HTML — compatible with wakeone_notice parser.
--   3. runWakeoneNoticeFetcher builds per-idol matchIndex from name + alt_names,
--      then applies matchIdolFromTitle — only notices explicitly naming Jo Yuri
--      in the title pass through. Zero cross-contamination with other WAKEONE
--      artists (izna, Kep1er, ZEROBASEONE).
--   4. source_url fragment `#wakeone-{idolSlug}` ensures unique source_hash
--      across all WAKEONE per-idol source rows.
--
-- CHANGES
--   - INSERT 1 crawler_sources row (jo-yuri-wakeone-notice)
--   - No parser changes
--   - No schema changes
--   - No GRANT / RLS changes
--
-- IDEMPOTENCE
--   ON CONFLICT (source_key) DO UPDATE is safe to re-run.
--
-- DEPENDENCY
--   Requires idol with slug `jo-yuri` and is_active = true.
--   Also requires:
--     019_crawler_sources.sql  (crawler_sources table)
--     wakeone_notice parser (wakeoneNotice.ts + runWakeoneNoticeFetcher.ts)
--
-- EXECUTION
--   Run the whole file in Supabase SQL Editor.
--   This file already includes BEGIN and COMMIT.
--   Do not wrap it in another transaction.
--
-- REVIEW CHECKLIST
--   [ ] Run verification query below after COMMIT.
--   [ ] Confirm 1 row returned with slug = 'jo-yuri'.
--   [ ] Confirm parser_type = 'wakeone_notice', is_active = true.
--   [ ] Confirm idol_id IS NOT NULL.
--   [ ] Optional: test manual run via
--       POST /api/admin/crawlers/wakeone-notice/run
--       with body { "sourceKey": "jo-yuri-wakeone-notice" }
-- =============================================================================


BEGIN;


INSERT INTO public.crawler_sources (
  name, source_key, idol_id, source_url,
  source_type, parser_type, is_active, config
)
SELECT
  'Jo Yuri WAKEONE Notice',
  'jo-yuri-wakeone-notice',
  idols.id,
  'https://wake-one.com/notice/',
  'official_website'::source_type,
  'wakeone_notice',
  true,
  '{}'::jsonb
FROM public.idols WHERE idols.slug = 'jo-yuri'
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


-- =============================================================================
-- VERIFICATION QUERY (run after COMMIT in Supabase SQL Editor)
-- =============================================================================
--
-- SELECT
--   cs.source_key,
--   cs.parser_type,
--   cs.is_active,
--   i.slug,
--   i.name
-- FROM crawler_sources cs
-- JOIN idols i ON i.id = cs.idol_id
-- WHERE cs.source_key = 'jo-yuri-wakeone-notice';
--
-- Expected: 1 row, is_active = true, parser_type = 'wakeone_notice'
-- =============================================================================

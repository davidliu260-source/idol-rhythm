-- =============================================================================
-- Idol Rhythm -- Seed additional SMTOWN notice crawler sources
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   Expand the SMTOWN notice crawler source family to cover 8 additional
--   SM Entertainment artists not included in migration 045:
--     - NCT 127
--     - NCT DREAM
--     - NCT WISH
--     - SHINee
--     - Super Junior
--     - TAEYEON
--     - TVXQ
--     - Hearts2Hearts
--
--   All 8 rows point to the same shared notice feed at
--   https://www.smtown.com/notice and use parser_type = 'smtown_notice'.
--   The parser (smtownNotice.ts) + fetcher (runSmtownNoticeFetcher.ts)
--   already handle per-idol name matching and NCT unit isolation.
--
-- NCT UNIT MATCHING SAFETY (verified before this migration was written)
--
--   The runSmtownNoticeFetcher builds a matchIndex from ONLY the target
--   idol's name + alt_names. Unit-specific notices are cleanly isolated:
--
--   - nct-127 (alt_names: "NCT 127", "NCT127", "엔시티 127", "엔시티127")
--     → matches only notices explicitly naming NCT 127; NOT generic "NCT"
--
--   - nct-dream (alt_names: "NCT DREAM", "NCT Dream", "NCTDREAM", ...)
--     → matches only NCT DREAM notices
--
--   - nct-wish (alt_names: "NCT WISH", "NCT Wish", "NCTWISH", ...)
--     → matches only NCT WISH notices
--
--   - nct root (migration 045) alt_names includes all unit names, BUT the
--     fetcher applies NCT_UNIT_NAMES_LOWER guard: any title explicitly
--     naming a unit (nct 127 / nct dream / nct wish / wayv) is dropped
--     for the root source. Root source keeps only generic "NCT" notices.
--
--   source_url fragment: "#smtown-{noticeId}-{idolSlug}" ensures each
--   (notice, idol) pair has a distinct source_hash. Even if multiple
--   sources process the same notice board, there is no source_hash
--   collision across source rows.
--
--   Conclusion: zero cross-contamination risk between NCT root and units.
--
-- CHANGES
--   - INSERT 8 crawler_sources rows (NCT 127, NCT DREAM, NCT WISH,
--     SHINee, Super Junior, TAEYEON, TVXQ, Hearts2Hearts)
--   - No parser changes
--   - No schema changes
--   - No GRANT / RLS changes
--   - No event_candidates changes
--
-- IDEMPOTENCE
--   ON CONFLICT (source_key) DO UPDATE is safe to re-run.
--
-- DEPENDENCY
--   Requires idols with these slugs to exist and is_active = true:
--     nct-127, nct-dream, nct-wish, shinee, super-junior,
--     taeyeon, tvxq, hearts2hearts
--   All 8 confirmed present via live DB query before this migration was
--   written (2026-05-23). If any slug is missing, that INSERT silently
--   inserts zero rows. Verify with the checklist below.
--
--   Also requires:
--     019_crawler_sources.sql  (crawler_sources table)
--     045_seed_smtown_notice_crawler_sources.sql  (smtown_notice pattern)
--
-- EXECUTION
--   Run the whole file in Supabase SQL Editor.
--   This file already includes BEGIN and COMMIT.
--   Do not wrap it in another transaction.
--
-- REVIEW CHECKLIST
--   [ ] Run verification query below after COMMIT.
--   [ ] Confirm 8 rows returned (one per slug).
--   [ ] Confirm parser_type = 'smtown_notice' for all 8 rows.
--   [ ] Confirm idol_id IS NOT NULL for all 8 rows.
--   [ ] Confirm is_active = true for all 8 rows.
--   [ ] Optional: test manual run via
--       POST /api/admin/crawlers/smtown-notice/run
--       with body { "sourceKey": "nct-127-smtown-notice" }
--   [ ] Confirm coverage query shows 8 new rows in smtown_notice.
-- =============================================================================


BEGIN;


INSERT INTO public.crawler_sources (
  name, source_key, idol_id, source_url,
  source_type, parser_type, is_active, config
)
SELECT
  'NCT 127 SMTOWN Notice',
  'nct-127-smtown-notice',
  idols.id,
  'https://www.smtown.com/notice',
  'official_website'::source_type,
  'smtown_notice',
  true,
  '{}'::jsonb
FROM public.idols WHERE idols.slug = 'nct-127'
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
  name, source_key, idol_id, source_url,
  source_type, parser_type, is_active, config
)
SELECT
  'NCT DREAM SMTOWN Notice',
  'nct-dream-smtown-notice',
  idols.id,
  'https://www.smtown.com/notice',
  'official_website'::source_type,
  'smtown_notice',
  true,
  '{}'::jsonb
FROM public.idols WHERE idols.slug = 'nct-dream'
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
  name, source_key, idol_id, source_url,
  source_type, parser_type, is_active, config
)
SELECT
  'NCT WISH SMTOWN Notice',
  'nct-wish-smtown-notice',
  idols.id,
  'https://www.smtown.com/notice',
  'official_website'::source_type,
  'smtown_notice',
  true,
  '{}'::jsonb
FROM public.idols WHERE idols.slug = 'nct-wish'
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
  name, source_key, idol_id, source_url,
  source_type, parser_type, is_active, config
)
SELECT
  'SHINee SMTOWN Notice',
  'shinee-smtown-notice',
  idols.id,
  'https://www.smtown.com/notice',
  'official_website'::source_type,
  'smtown_notice',
  true,
  '{}'::jsonb
FROM public.idols WHERE idols.slug = 'shinee'
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
  name, source_key, idol_id, source_url,
  source_type, parser_type, is_active, config
)
SELECT
  'Super Junior SMTOWN Notice',
  'super-junior-smtown-notice',
  idols.id,
  'https://www.smtown.com/notice',
  'official_website'::source_type,
  'smtown_notice',
  true,
  '{}'::jsonb
FROM public.idols WHERE idols.slug = 'super-junior'
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
  name, source_key, idol_id, source_url,
  source_type, parser_type, is_active, config
)
SELECT
  'TAEYEON SMTOWN Notice',
  'taeyeon-smtown-notice',
  idols.id,
  'https://www.smtown.com/notice',
  'official_website'::source_type,
  'smtown_notice',
  true,
  '{}'::jsonb
FROM public.idols WHERE idols.slug = 'taeyeon'
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
  name, source_key, idol_id, source_url,
  source_type, parser_type, is_active, config
)
SELECT
  'TVXQ SMTOWN Notice',
  'tvxq-smtown-notice',
  idols.id,
  'https://www.smtown.com/notice',
  'official_website'::source_type,
  'smtown_notice',
  true,
  '{}'::jsonb
FROM public.idols WHERE idols.slug = 'tvxq'
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
  name, source_key, idol_id, source_url,
  source_type, parser_type, is_active, config
)
SELECT
  'Hearts2Hearts SMTOWN Notice',
  'hearts2hearts-smtown-notice',
  idols.id,
  'https://www.smtown.com/notice',
  'official_website'::source_type,
  'smtown_notice',
  true,
  '{}'::jsonb
FROM public.idols WHERE idols.slug = 'hearts2hearts'
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
-- WHERE cs.parser_type = 'smtown_notice'
--   AND i.slug IN (
--     'nct-127',
--     'nct-dream',
--     'nct-wish',
--     'shinee',
--     'super-junior',
--     'taeyeon',
--     'tvxq',
--     'hearts2hearts'
--   )
-- ORDER BY i.slug;
--
-- Expected: 8 rows, all is_active = true, parser_type = 'smtown_notice'
-- =============================================================================

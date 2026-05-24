-- =============================================================================
-- Idol Rhythm -- Seed generic_webpage parser test sources (P1-B1)
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   Seed 3 test crawler_sources rows for the new generic_webpage parser_type.
--   Admin runs each one manually via POST /api/admin/crawlers/generic-webpage/run
--   to verify the P1-B1 preview-only runtime works end-to-end.
--
--   These are NOT production discovery sources. They are infrastructure
--   probes intended to exercise:
--     1. baseline: a non-K-pop page → expect pageRelevance = "none"
--     2. K-pop group page → expect events extracted
--     3. K-pop solo artist page → expect events extracted
--
--   Real production URLs (official announcement pages, ticketing, pop-up,
--   brand) will be added in follow-up migrations after P1-B1 is verified
--   and P1-B2 (commit path) is approved.
--
-- SAFETY
--   All 3 rows are seeded with is_active = false. The dispatch path in
--   runActiveCrawlerSources for generic_webpage is unconditionally skipped
--   (cron + sync-all guard), so even if a row were accidentally toggled
--   active, the fan-out paths still would not trigger Claude. The only way
--   to run these is via the dedicated admin route.
--
-- CHANGES
--   - INSERT 3 crawler_sources rows
--   - parser_type = 'generic_webpage' (new, but parser_type is plain text;
--     no schema migration required)
--   - source_type = 'other' (sticks to existing enum; no new enum value)
--   - idol_id = NULL (these are infrastructure probes, not idol-bound)
--   - config jsonb with provider hint for future debugging
--
-- IDEMPOTENCE
--   ON CONFLICT (source_key) DO UPDATE refreshes name/source_url/parser_type/
--   source_type/config/updated_at. is_active is NOT overwritten on conflict
--   so an admin who manually toggles a row to true does not lose that state
--   on re-apply.
--
-- DEPENDENCIES
--   - 019_crawler_sources.sql (crawler_sources table + parser_type text column)
--   - runtime: src/lib/crawlers/genericWebpage.ts +
--             src/lib/crawlers/runGenericWebpageFetcher.ts +
--             /api/admin/crawlers/generic-webpage/run route
--
-- EXECUTION
--   Run the whole file in Supabase SQL Editor.
--   This file already includes BEGIN and COMMIT.
--   Do not wrap it in another transaction.
--
-- REVIEW CHECKLIST
--   [ ] Run verification query below after COMMIT.
--   [ ] Confirm 3 rows returned, all parser_type = 'generic_webpage'.
--   [ ] Confirm all 3 rows have is_active = false.
--   [ ] Confirm source_type IN ('other').
--   [ ] Confirm idol_id IS NULL for all 3 rows.
-- =============================================================================


BEGIN;


-- 1. Baseline: non-K-pop page. Expect pageRelevance = "none", events = [].
INSERT INTO public.crawler_sources (
  name, source_key, idol_id, source_url,
  source_type, parser_type, is_active, config
)
VALUES (
  'generic_webpage baseline (example.com)',
  'generic-test-baseline-example-com',
  NULL,
  'https://example.com/',
  'other'::source_type,
  'generic_webpage',
  false,
  jsonb_build_object(
    'provider', 'generic_webpage',
    'test_category', 'baseline_non_kpop',
    'expected_page_relevance', 'none'
  )
)
ON CONFLICT (source_key) DO UPDATE
SET name        = EXCLUDED.name,
    source_url  = EXCLUDED.source_url,
    source_type = EXCLUDED.source_type,
    parser_type = EXCLUDED.parser_type,
    config      = EXCLUDED.config,
    updated_at  = NOW();


-- 2. K-pop group page. Expect pageRelevance high/medium, some events.
INSERT INTO public.crawler_sources (
  name, source_key, idol_id, source_url,
  source_type, parser_type, is_active, config
)
VALUES (
  'generic_webpage test (Wikipedia BLACKPINK)',
  'generic-test-wikipedia-blackpink',
  NULL,
  'https://en.wikipedia.org/wiki/BLACKPINK',
  'other'::source_type,
  'generic_webpage',
  false,
  jsonb_build_object(
    'provider', 'generic_webpage',
    'test_category', 'kpop_group',
    'expected_page_relevance', 'high_or_medium'
  )
)
ON CONFLICT (source_key) DO UPDATE
SET name        = EXCLUDED.name,
    source_url  = EXCLUDED.source_url,
    source_type = EXCLUDED.source_type,
    parser_type = EXCLUDED.parser_type,
    config      = EXCLUDED.config,
    updated_at  = NOW();


-- 3. K-pop solo artist page. Expect pageRelevance high/medium, some events.
INSERT INTO public.crawler_sources (
  name, source_key, idol_id, source_url,
  source_type, parser_type, is_active, config
)
VALUES (
  'generic_webpage test (Wikipedia IU)',
  'generic-test-wikipedia-iu',
  NULL,
  'https://en.wikipedia.org/wiki/IU_(singer)',
  'other'::source_type,
  'generic_webpage',
  false,
  jsonb_build_object(
    'provider', 'generic_webpage',
    'test_category', 'kpop_solo',
    'expected_page_relevance', 'high_or_medium'
  )
)
ON CONFLICT (source_key) DO UPDATE
SET name        = EXCLUDED.name,
    source_url  = EXCLUDED.source_url,
    source_type = EXCLUDED.source_type,
    parser_type = EXCLUDED.parser_type,
    config      = EXCLUDED.config,
    updated_at  = NOW();


COMMIT;


-- =============================================================================
-- VERIFICATION QUERY (run after COMMIT in Supabase SQL Editor)
-- =============================================================================
--
-- SELECT
--   source_key,
--   parser_type,
--   source_type,
--   is_active,
--   idol_id,
--   source_url,
--   config->>'test_category' AS test_category
-- FROM crawler_sources
-- WHERE parser_type = 'generic_webpage'
-- ORDER BY source_key;
--
-- Expected: 3 rows
--   generic-test-baseline-example-com   | other | false | (null) | example.com
--   generic-test-wikipedia-blackpink    | other | false | (null) | wikipedia.org/BLACKPINK
--   generic-test-wikipedia-iu           | other | false | (null) | wikipedia.org/IU_(singer)
-- =============================================================================

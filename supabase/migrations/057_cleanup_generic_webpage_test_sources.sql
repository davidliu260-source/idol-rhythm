-- =============================================================================
-- Idol Rhythm -- Cleanup generic_webpage test wiring probe sources
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   Migration 049 seeded 3 generic_webpage rows purely as wiring probes
--   for P1-B1 preview-only runtime acceptance:
--     - generic-test-baseline-example-com   (example.com)
--     - generic-test-wikipedia-blackpink    (Wikipedia BLACKPINK page)
--     - generic-test-wikipedia-iu           (Wikipedia IU page)
--
--   These were never intended as production K-pop event sources. They
--   served only to confirm:
--     (a) crawler_sources schema works for parser_type='generic_webpage'
--     (b) preview pipeline does not crash on non-K-pop pages
--     (c) event_candidates remains zero (proven 2026-05-24)
--
--   Now that P1-B1 / P1-B2 / P1-B7 / P1-B8 are all in production and the
--   pipeline is exercised by 8+ real sources, these probes only add
--   clutter to /admin/sources list. Remove them.
--
-- WHY DELETE (not just set is_active=false)
--   - is_active is already false (set in migration 049)
--   - These rows have zero historical value (no candidates ever written
--     against them per P1-B1 wiring probe acceptance)
--   - event_candidates does NOT have a foreign key to crawler_sources,
--     so deletion is safe even if any candidates referenced them
--   - Keeping them as deprecated rows adds noise to admin lists and
--     analytics dashboard counts
--
-- SCOPE
--   - DELETE exactly 3 rows from public.crawler_sources
--   - No schema / enum / RLS / GRANT change
--   - No other crawler_sources row touched
--   - No idols / event_candidates / events row touched
--
-- IDEMPOTENCE
--   DELETE ... WHERE source_key IN (...) is idempotent — re-running is a no-op
--   once the rows are gone.
--
-- VERIFICATION QUERY (run after executing)
--   SELECT source_key
--   FROM   public.crawler_sources
--   WHERE  source_key IN (
--     'generic-test-baseline-example-com',
--     'generic-test-wikipedia-blackpink',
--     'generic-test-wikipedia-iu'
--   );
--
--   Expected: 0 rows.
-- =============================================================================


BEGIN;


DELETE FROM public.crawler_sources
WHERE source_key IN (
  'generic-test-baseline-example-com',
  'generic-test-wikipedia-blackpink',
  'generic-test-wikipedia-iu'
);


COMMIT;

-- =============================================================================
-- Idol Rhythm -- Fix Dynamicduo source URL
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   migration 051 seeded `generic-dynamicduo-amoeba` with the correct URL:
--     https://www.amoebaculture.com/artists/67
--   The URL was later manually changed in the DB to:
--     https://www.amoebaculture.com/news  (incorrect)
--   This caused Preview to return 0 events because /news is a general
--   news page unrelated to Dynamicduo, not the artist-specific page.
--
--   This migration restores the correct artist-specific URL.
--
-- SCOPE
--   • UPDATE 1 row in crawler_sources (source_key = 'generic-dynamicduo-amoeba')
--   • No schema / enum / RLS / GRANT changes
--   • is_active is NOT changed (remains as-is in DB)
--
-- IDEMPOTENCE
--   WHERE clause only updates when source_url does not already match,
--   so re-running this migration is safe.
--
-- VERIFICATION QUERY (run in Supabase SQL Editor after executing)
--   SELECT source_key, source_url, is_active, updated_at
--   FROM public.crawler_sources
--   WHERE source_key = 'generic-dynamicduo-amoeba';
--
--   Expected: source_url = 'https://www.amoebaculture.com/artists/67'
-- =============================================================================

BEGIN;

UPDATE public.crawler_sources
SET
  source_url = 'https://www.amoebaculture.com/artists/67',
  updated_at = NOW()
WHERE source_key = 'generic-dynamicduo-amoeba'
  AND source_url != 'https://www.amoebaculture.com/artists/67';

COMMIT;

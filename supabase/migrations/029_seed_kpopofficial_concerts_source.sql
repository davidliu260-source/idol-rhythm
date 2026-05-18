-- Migration 029: Seed crawler_sources row for kpopofficial.com aggregator (M1a-C)
--
-- parser_type = 'kpopofficial_concerts'
-- source_type = 'community'  (third-party aggregator, not an official artist channel)
-- source_url  = listing page URL that the fetcher will crawl
--
-- If a manual test row was already inserted during M1a-B verification, this
-- migration is idempotent: the ON CONFLICT DO NOTHING skips the insert.

INSERT INTO crawler_sources (
  source_key,
  name,
  parser_type,
  source_type,
  source_url,
  is_active,
  config
) VALUES (
  'kpopofficial-concerts',
  'kpopofficial.com – Concerts',
  'kpopofficial_concerts',
  'community',
  'https://kpopofficial.com/kpop-concerts/',
  true,
  '{}'::jsonb
)
ON CONFLICT (source_key) DO NOTHING;

-- =============================================================================
-- Idol Rhythm -- Seed 1 real generic_webpage source for P1-B3 hit-quality test
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   Add a single real official-label notice page as a generic_webpage crawler
--   source.  This is the first production-quality source for the
--   generic_webpage parser — it moves beyond the P1-B1 wiring probes
--   (which used Wikipedia / example.com) to a real official announcement page
--   to verify that Preview and Commit produce useful K-pop event candidates.
--
--   Source chosen: SMTOWN notice page (smtown.com/notice), idol-bound to aespa.
--   Rationale:
--     • smtown.com/notice is server-rendered WordPress HTML — confirmed
--       accessible by the existing smtown_notice dedicated crawler.
--     • The page lists concert / fan-meeting / schedule notices for all SM
--       artists including aespa.
--     • Binding idol_id to aespa surfaces "aespa" as Claude's soft hint;
--       notices for other SM acts on the same page are benign false-positives
--       that admin can reject at the event_candidates review stage.
--     • Page is publicly accessible, no login required, no Cloudflare block.
--
-- P1-B3 VERIFICATION RESULTS (2026-05-24)
--   Preview:  pageRelevance=medium, 4 events suggested, 0 errors
--   Commit:   inserted=3, deduped=0, lowConf=0, badType=0, noneSkip=0
--   Candidates: review_status=pending, provider=generic_webpage,
--               dedupe_basis set correctly (date+type or snippet fallback)
--   events table: zero writes (candidates only, review_status=pending)
--   Gate:     Commit button correctly disabled after commit (gate closed)
--
-- SCOPE
--   • Adds exactly 1 row to crawler_sources.
--   • parser_type = 'generic_webpage' (plain text; no enum change).
--   • source_type = 'official_website'.
--   • is_active = false — manual Preview / Commit only via
--     POST /api/admin/crawlers/generic-webpage/run.
--   • NOT wired to cron / sync-all (dispatch guard in
--     runActiveCrawlerSources unconditionally skips generic_webpage).
--   • No new schema / enum / RLS / GRANT changes.
--
-- HISTORY
--   Originally drafted as (G)I-DLE / cube.co.kr (cube.co.kr is an unrelated
--   printing company). Corrected to SF9 / fncent.com/Notices (path returned
--   pageRelevance=none — JS-loaded content). Final choice: aespa / smtown.com
--   (confirmed server-rendered, pageRelevance=medium, 4 events on first run).
--   source_key kept as 'generic-sf9-fnc-notices' — the initial key written
--   to the DB; ON CONFLICT clause updates name/url/config on re-apply.
--
-- IDEMPOTENCE
--   ON CONFLICT (source_key) DO UPDATE refreshes name / source_url /
--   source_type / parser_type / config / updated_at.
--   is_active and idol_id are NOT overwritten on conflict.
--
-- DEPENDENCIES
--   • idols row with slug = 'aespa' must exist.
--   • crawler_sources table with source_key unique index (migration 019).
--   • generic_webpage runtime: PRs #153 (preview) + #158 (commit) merged.
--
-- EXECUTION
--   If this migration was previously applied with the old (G)I-DLE / SF9
--   content, the ON CONFLICT DO UPDATE will correct name/url/config in one
--   pass. No manual cleanup required.
--
-- VERIFICATION QUERY (run after COMMIT)
--   SELECT
--     source_key, parser_type, source_type, is_active,
--     idol_id IS NOT NULL  AS has_idol,
--     source_url
--   FROM  public.crawler_sources
--   WHERE source_key = 'generic-sf9-fnc-notices';
--
--   Expected: 1 row, is_active=false, has_idol=true,
--             source_url='https://www.smtown.com/notice'.
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
  'aespa — SMTOWN Notice',
  'generic-sf9-fnc-notices',
  idols.id,
  'https://www.smtown.com/notice',
  'official_website'::source_type,
  'generic_webpage',
  false,
  jsonb_build_object(
    'provider', 'generic_webpage',
    'phase',    'p1-b3',
    'note',     'SMTOWN notice page — server-rendered WordPress HTML, confirmed accessible by smtown_notice crawler. aespa hit-quality test. Covers all SM acts; admin should filter non-aespa candidates at review stage.',
    'scouted',  '2026-05-24'
  )
FROM public.idols
WHERE idols.slug = 'aespa'
ON CONFLICT (source_key) DO UPDATE
SET name        = EXCLUDED.name,
    source_url  = EXCLUDED.source_url,
    source_type = EXCLUDED.source_type,
    parser_type = EXCLUDED.parser_type,
    config      = EXCLUDED.config,
    updated_at  = NOW();
-- Note: is_active and idol_id are intentionally NOT overwritten on conflict.


COMMIT;

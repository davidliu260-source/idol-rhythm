-- =============================================================================
-- Idol Rhythm -- Seed 1 real generic_webpage source for P1-B3 hit-quality test
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   Add a single real official-label notices page as a generic_webpage crawler
--   source.  This is the first production-quality source for the
--   generic_webpage parser — it moves beyond the P1-B1 wiring probes
--   (which used Wikipedia / example.com) to a real official announcement page
--   so admin can verify that Preview and Commit produce useful K-pop event
--   candidates against live content.
--
--   Source chosen: FNC Entertainment public Notices page, idol-bound to SF9.
--   Rationale:
--     • fncent.com is FNC Entertainment's official domain (WordPress-based,
--       server-rendered HTML — not an SPA shell like Weverse).
--     • SF9 is one of FNC's flagship acts with concert / fan-meeting / schedule
--       announcements published on the label notices page.
--     • Binding idol_id to SF9 causes the runtime to surface the hint "SF9"
--       to Claude; notices for other FNC acts on the same page are benign
--       false-positives that admin can reject at the event_candidates review.
--     • Page is publicly accessible, no login required.
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
--   Originally seeded as (G)I-DLE / cube.co.kr/en/news (2026-05-24), but
--   cube.co.kr belongs to an unrelated printing company; corrected to
--   FNC Entertainment / SF9 in the same migration file.
--
-- IDEMPOTENCE
--   ON CONFLICT (source_key) DO UPDATE refreshes name / source_url /
--   source_type / parser_type / config / updated_at.
--   is_active and idol_id are NOT overwritten on conflict.
--
-- DEPENDENCIES
--   • idols row with slug = 'sf9' must exist (seeded in M1b second batch).
--   • crawler_sources table with source_key unique index (migration 019).
--   • generic_webpage runtime: PRs #153 (preview) + #158 (commit) merged.
--
-- EXECUTION
--   If the old row (source_key = 'generic-gidle-cube-news') already exists
--   in the DB, run this UPDATE first to rename it, then run the BEGIN/COMMIT
--   block below (the ON CONFLICT clause will handle the rest):
--
--   UPDATE public.crawler_sources
--   SET source_key = 'generic-sf9-fnc-notices', updated_at = NOW()
--   WHERE source_key = 'generic-gidle-cube-news';
--
--   Then paste the BEGIN...COMMIT block below and run it.
--   If starting from a clean DB, the BEGIN...COMMIT block alone is sufficient.
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
--             source_url='https://www.fncent.com/Notices'.
--
-- HUMAN ACCEPTANCE TEST (after migration executed)
--   1. Open /admin/sources and search "SF9" or "FNC".
--   2. Click the source row → /admin/sources/[id].
--   3. Click "Preview：SF9 — FNC Entertainment Notices".
--      • Expect: pageRelevance high/medium.
--      • Expect: 1-10 events suggested; inspect titles / dates.
--      • event_candidates must remain unchanged (preview only).
--   4. If preview results look reasonable, click "寫入候選".
--      • Confirm the window.confirm dialog.
--      • Expect: inserted ≥ 1 (or deduped=N on second run).
--   5. Open /admin/event-candidates. Confirm:
--      • New rows appear with review_status = 'pending'.
--      • raw_data.provider = 'generic_webpage'.
--      • raw_data.dedupe_basis is set.
--      • No rows in the live events table (candidates only).
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
  'SF9 — FNC Entertainment Notices',
  'generic-sf9-fnc-notices',
  idols.id,
  'https://www.fncent.com/Notices',
  'official_website'::source_type,
  'generic_webpage',
  false,
  jsonb_build_object(
    'provider', 'generic_webpage',
    'phase',    'p1-b3',
    'note',     'FNC Entertainment public notices page — SF9 hit-quality test. Covers all FNC acts; admin should filter non-SF9 candidates at review stage.',
    'scouted',  '2026-05-24'
  )
FROM public.idols
WHERE idols.slug = 'sf9'
ON CONFLICT (source_key) DO UPDATE
SET name        = EXCLUDED.name,
    source_url  = EXCLUDED.source_url,
    source_type = EXCLUDED.source_type,
    parser_type = EXCLUDED.parser_type,
    config      = EXCLUDED.config,
    updated_at  = NOW();
-- Note: is_active and idol_id are intentionally NOT overwritten on conflict.


COMMIT;

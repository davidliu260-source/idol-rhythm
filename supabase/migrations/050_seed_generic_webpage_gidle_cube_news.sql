-- =============================================================================
-- Idol Rhythm -- Seed 1 real generic_webpage source for P1-B3 hit-quality test
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   Add a single real official-label news page as a generic_webpage crawler
--   source.  This is the first production-quality source for the
--   generic_webpage parser — it moves beyond the P1-B1 wiring probes
--   (which used Wikipedia / example.com) to a real official announcement page
--   so admin can verify that Preview and Commit produce useful K-pop event
--   candidates against live content.
--
--   Source chosen: Cube Entertainment English news page, idol-bound to
--   (G)I-DLE.  Rationale:
--     • Cube's website is server-rendered HTML (not an SPA shell like Weverse).
--     • (G)I-DLE is one of Cube's flagship acts with a consistent stream of
--       concert / comeback / fan-meeting announcements.
--     • Binding idol_id to (G)I-DLE causes the runtime to surface the hint
--       "(G)I-DLE" to Claude without constraining the parser; articles about
--       other Cube acts that may appear on the page are benign false-positives
--       that admin can reject at the event_candidates review stage.
--     • Page is publicly accessible, no login, no known bot-block as of
--       2026-05-24 scouting.
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
-- HOW THE IDOL HINT WORKS AT RUNTIME
--   runGenericWebpageFetcher resolves idol_id → idols.name and passes the
--   result as a soft hint to Claude Haiku ("you are looking for events related
--   to this artist").  The hint is informational only; Claude still reports
--   all events it finds on the page.  Admin reviews candidates in
--   /admin/event-candidates before anything is published.
--
-- IDEMPOTENCE
--   ON CONFLICT (source_key) DO UPDATE refreshes name / source_url /
--   source_type / parser_type / config / updated_at.
--   is_active is deliberately NOT overwritten on conflict — if an admin has
--   manually toggled the row active, a re-apply of this migration will not
--   silently disable it again.
--   idol_id is NOT overwritten on conflict either — the FK relationship should
--   only be changed intentionally via the admin UI.
--
-- DEPENDENCIES
--   • idols row with slug = 'gidle' must exist (seeded in migration 036).
--   • crawler_sources table with source_key unique index (migration 019).
--   • generic_webpage runtime: PRs #153 (preview) + #158 (commit) merged.
--
-- EXECUTION
--   Paste the entire file into the Supabase SQL Editor and run.
--   The file wraps its own BEGIN / COMMIT — do not wrap again.
--
-- VERIFICATION QUERY (run after COMMIT)
--   SELECT
--     source_key, parser_type, source_type, is_active,
--     idol_id IS NOT NULL          AS has_idol,
--     source_url,
--     config->>'note'              AS note
--   FROM  public.crawler_sources
--   WHERE source_key = 'generic-gidle-cube-news';
--
--   Expected: 1 row, is_active=false, has_idol=true,
--             source_url='https://cube.co.kr/en/news'.
--
-- HUMAN ACCEPTANCE TEST (after migration executed)
--   1. Open /admin/sources in the browser and search for "gidle" or "Cube".
--   2. Click the source row → /admin/sources/[id].
--   3. Click "Preview：(G)I-DLE — Cube News".
--      • Expect: pageRelevance high/medium (the page has real K-pop content).
--      • Expect: 1–10 events suggested; inspect titles / dates.
--      • event_candidates must remain unchanged at this stage (preview only).
--   4. If preview results look reasonable, click "寫入候選".
--      • Confirm the window.confirm dialog.
--      • Expect: inserted ≥ 1 (or deduped=N on second run).
--   5. Open /admin/event-candidates.  Confirm:
--      • New rows appear with review_status = 'pending'.
--      • raw_data.provider = 'generic_webpage'.
--      • raw_data.dedupe_basis is set.
--      • No rows appeared in the live `events` table (candidates only).
--   6. (Optional) Run Commit a second time without re-previewing.
--      • Commit button should be disabled (gate requires re-preview first).
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
  '(G)I-DLE — Cube Entertainment News',
  'generic-gidle-cube-news',
  idols.id,
  'https://cube.co.kr/en/news',
  'official_website'::source_type,
  'generic_webpage',
  false,
  jsonb_build_object(
    'provider',    'generic_webpage',
    'phase',       'p1-b3',
    'note',        'Cube Entertainment English news page — (G)I-DLE hit-quality test. Covers all Cube acts; admin should filter non-(G)I-DLE candidates at review stage.',
    'scouted',     '2026-05-24'
  )
FROM public.idols
WHERE idols.slug = 'gidle'
ON CONFLICT (source_key) DO UPDATE
SET name        = EXCLUDED.name,
    source_url  = EXCLUDED.source_url,
    source_type = EXCLUDED.source_type,
    parser_type = EXCLUDED.parser_type,
    config      = EXCLUDED.config,
    updated_at  = NOW();
-- Note: is_active and idol_id are intentionally NOT overwritten on conflict.


COMMIT;

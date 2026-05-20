-- =============================================================================
-- Idol Rhythm — Fix cron kpopofficial permissions + disable old BLACKPINK tour
--
-- PURPOSE
--   2026-05-20 cron did run, but kpopofficial-concerts failed with:
--     permission denied for table idols
--
--   The kpopofficial aggregator needs to read active idols + alt_names for
--   matching. Grant the minimal read path to service_role.
--
--   Also move the old BLACKPINK 2025 tour microsite out of the active source
--   list. It was useful for the first crawler prototype, but the source URL is
--   a past 2025 tour page and should not appear as an active current source.
--
-- SCOPE
--   - GRANT SELECT on idols to service_role
--   - UPDATE one crawler_sources row to inactive
--   - No schema changes
-- =============================================================================

BEGIN;

GRANT SELECT ON public.idols TO service_role;

UPDATE public.crawler_sources
   SET is_active = false,
       name = 'BLACKPINK 2025 官方巡演頁（已停用）',
       last_status = 'skipped',
       last_error = '已停用：2025 官方巡演頁屬舊活動頁；後續改由 YG artist schedule / notice source 覆蓋。',
       updated_at = NOW()
 WHERE source_key = 'blackpink-official-tour'
   AND source_url LIKE '%2025TOUR%';

COMMIT;


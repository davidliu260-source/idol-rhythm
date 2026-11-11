-- =============================================================================
-- Idol Rhythm -- Seed 1 generic_webpage source: YG Family notice page
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   P1-B5：第三筆 production-quality generic_webpage source。
--   來源：https://www.ygfamily.com/en/news/notice
--
--   為什麼選 YG notice：
--     • 2026-05-24 curl 實測：
--         HTTP 200 / 23657 bytes / 29 grep hits
--         HTML 直接看到 notice list section、個別 notice 連結（/en/news/notice/5763 等）
--         日期（<span class="date">）、分類（<span class="cate">）、標題（<p>）
--         全在初始 HTML 裡 — 確認 server-rendered
--     • 與既有 yg_artist_schedule（JSON API）互補：
--         yg_artist_schedule 抓 concert/schedule 日曆資料
--         YG notice 抓 announcement / ticket-info / member 公告類內容
--     • 涵蓋 BIGBANG（目前 yg_artist_schedule 無此藝人）+ 全 YG 公告
--     • 公開頁、無 Cloudflare / login wall
--
-- idol_id 設計決策
--   此 notice 頁為 label-level 共用公告（BIGBANG / BABYMONSTER / TREASURE /
--   BLACKPINK 公告皆在同一 feed），不綁定特定藝人（idol_id = NULL）。
--   Claude 的 generic_webpage prompt 不帶藝人 soft-hint，直接從內容自由萃取。
--   若 Preview 結果雜訊過多，後續可考慮改拆多筆或加 filter。
--
-- SCOPE
--   • 新增 1 列 crawler_sources（idol_id = NULL）
--   • parser_type = 'generic_webpage'
--   • source_type = 'official_website'
--   • is_active = false（手動 Preview / Commit，不被 cron / sync-all 撿到）
--   • 不動 schema / enum / RLS / GRANT
--
-- IDEMPOTENCE
--   ON CONFLICT (source_key) DO UPDATE 更新 name / source_url /
--   source_type / parser_type / config / updated_at。
--   is_active 不被覆寫。
--
-- DEPENDENCIES
--   • crawler_sources 表 + source_key unique index（migration 019）
--   • generic_webpage runtime：PR #153（preview）+ #158（commit）merged
--
-- VERIFICATION QUERY（COMMIT 後在 Supabase SQL Editor 執行）
--   SELECT
--     source_key, parser_type, source_type, is_active,
--     idol_id IS NULL AS idol_unbound,
--     source_url
--   FROM  public.crawler_sources
--   WHERE source_key = 'generic-yg-notice';
--
--   Expected: 1 row, is_active=false, idol_unbound=true,
--             source_url='https://www.ygfamily.com/en/news/notice'.
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
VALUES (
  'YG Family — official notice page',
  'generic-yg-notice',
  NULL,
  'https://www.ygfamily.com/en/news/notice',
  'official_website'::source_type,
  'generic_webpage',
  false,
  jsonb_build_object(
    'provider',  'generic_webpage',
    'phase',     'p1-b5',
    'note',      'YG Family label-level notice page. Confirmed server-rendered 2026-05-24 via curl (200/23657 bytes, notice list + titles + dates visible in initial HTML). idol_id=NULL — label feed covering BIGBANG/BABYMONSTER/TREASURE/BLACKPINK announcements. Complements yg_artist_schedule (JSON API) which covers schedule/calendar data.',
    'scouted',   '2026-05-24'
  )
)
ON CONFLICT (source_key) DO UPDATE
SET name        = EXCLUDED.name,
    source_url  = EXCLUDED.source_url,
    source_type = EXCLUDED.source_type,
    parser_type = EXCLUDED.parser_type,
    config      = EXCLUDED.config,
    updated_at  = NOW();
-- Note: is_active is intentionally NOT overwritten on conflict.


COMMIT;

-- =============================================================================
-- Idol Rhythm -- Seed 1 generic_webpage source: N.Flying Japan official site
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   P1-B6：第四筆 production-quality generic_webpage source。
--   來源：https://nflying-official.jp/（root page）
--
--   為什麼選 N.Flying JP 官網 root：
--     • 2026-05-24 curl 實測：
--         HTTP 200 / 22248B / 9 grep hits
--         HTML 直接看到完整活動標題 + 日期 + category，例如：
--           「2026 N.Flying FAN MEETING IN JAPAN 'Let's have some little talk'」
--           「FNC BAND KINGDOM 2026」（ticket on-sale notices）
--         格式：<div class="block--date"><p class="category">LIVE</p>
--               <p class="date">2026.05.22</p></div>
--               <div class="block--tit"><p class="tit">...</p></div>
--         全在初始 HTML 裡 — 確認 server-rendered
--     • N.Flying 目前完全沒有任何 dedicated label crawler 覆蓋
--       （FNC 韓國官網 fncent.com/b/notice 被 CUPID 反爬擋住；
--        日本官網是獨立站，無 bot challenge）
--     • 以日本市場活動為主，補足 kpopofficial_concerts 可能漏掉的
--       日本 fan meeting / live house 活動
--
--   排除的 N.Flying URL：
--     • /news/（HTTP 404）
--     • /schedule/list/（AJAX 載入，onclick="return send('list', year, month)"，
--       事件資料不在初始 HTML 裡）
--
-- SCOPE
--   • 新增 1 列 crawler_sources
--   • parser_type = 'generic_webpage'
--   • source_type = 'official_website'
--   • is_active = false（手動 Preview / Commit，不被 cron / sync-all 撿到）
--   • 不動 schema / enum / RLS / GRANT
--
-- IDEMPOTENCE
--   ON CONFLICT (source_key) DO UPDATE 更新 name / source_url /
--   source_type / parser_type / config / updated_at。
--   is_active 與 idol_id 不在 conflict 時被覆寫。
--
-- DEPENDENCIES
--   • idols.slug = 'n-flying' 必須存在（由 M1b 系列 migration seed）
--   • crawler_sources 表 + source_key unique index（migration 019）
--   • generic_webpage runtime：PR #153（preview）+ #158（commit）merged
--
-- VERIFICATION QUERY（COMMIT 後在 Supabase SQL Editor 執行）
--   SELECT
--     source_key, parser_type, source_type, is_active,
--     idol_id IS NOT NULL AS has_idol,
--     source_url
--   FROM  public.crawler_sources
--   WHERE source_key = 'generic-nflying-jp';
--
--   Expected: 1 row, is_active=false, has_idol=true,
--             source_url='https://nflying-official.jp/'.
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
  'N.Flying — Japan Official Website',
  'generic-nflying-jp',
  idols.id,
  'https://nflying-official.jp/',
  'official_website'::source_type,
  'generic_webpage',
  false,
  jsonb_build_object(
    'provider',  'generic_webpage',
    'phase',     'p1-b6',
    'note',      'N.Flying Japan official website root page. Confirmed server-rendered 2026-05-24 via curl (200/22248 bytes, full event titles + dates visible in initial HTML). FNC Korean site fncent.com blocked by CUPID anti-bot. Japan site is independent, no bot challenge. Focuses on Japan fan meeting / live events.',
    'scouted',   '2026-05-24'
  )
FROM public.idols
WHERE idols.slug = 'n-flying'
ON CONFLICT (source_key) DO UPDATE
SET name        = EXCLUDED.name,
    source_url  = EXCLUDED.source_url,
    source_type = EXCLUDED.source_type,
    parser_type = EXCLUDED.parser_type,
    config      = EXCLUDED.config,
    updated_at  = NOW();
-- Note: is_active and idol_id are intentionally NOT overwritten on conflict.


COMMIT;

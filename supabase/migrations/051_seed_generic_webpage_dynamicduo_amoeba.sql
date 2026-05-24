-- =============================================================================
-- Idol Rhythm -- Seed 1 generic_webpage source: Dynamicduo / Amoeba Culture
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   P1-B4：第二筆 production-quality generic_webpage source。延續 P1-B3
--   （aespa / smtown.com/notice）的小步驟驗收節奏：
--     - 一次只加 1 個 source
--     - is_active = false，僅手動 Preview / Commit
--     - 跑完驗收後再決定下一個來源
--
--   來源選擇：Amoeba Culture 的 Dynamicduo artist page
--   URL: https://www.amoebaculture.com/artists/67
--
--   為什麼選 Dynamicduo / Amoeba：
--     • Dynamicduo 目前完全沒有任何 dedicated label crawler 覆蓋
--       （Amoeba Culture 是獨立 hip-hop label，不在 SM / JYP / YG / WAKEONE /
--        SMTOWN 已建好的 crawler 範圍內）
--     • 2026-05-24 curl 實測：
--         HTTP 200 / 32593 bytes / 37 grep hits
--         HTML 直接看到 "2025 Dynamicduo Concert In The Long Run"
--         + 日期 2025.12.20、2026.01.23
--         + artist meta（韓文 / 英文 keywords 完整）
--     • artist-specific URL → 不會撈到其他藝人，零雜訊
--     • 公開頁、無 Cloudflare / CUPID / login wall
--
-- 已被排除的兄弟候選（同輪 curl 驗證結果）
--   ❌ EDAM IU       — root 回 200 + 0 bytes（bot detection），notice path 404
--   ❌ FNC /b/notice — CUPID 反爬挑戰頁（JS AES + cookie redirect），
--                      不可繞過，違反專案安全規則
--   ⏸ YG /en/news/notice — server-rendered ✅ 但可能跟既有
--                      yg_artist_schedule 大量 dedupe；等本次驗收完再評估
--
-- SCOPE
--   • 新增 1 列 crawler_sources
--   • parser_type = 'generic_webpage'
--   • source_type = 'official_website'
--   • is_active = false（手動 Preview / Commit 觸發，
--     不會被 cron / sync-all 撿到 — runActiveCrawlerSources 對
--     generic_webpage 有 unconditional skip）
--   • 不動 schema / enum / RLS / GRANT
--
-- IDEMPOTENCE
--   ON CONFLICT (source_key) DO UPDATE 更新 name / source_url /
--   source_type / parser_type / config / updated_at。
--   is_active 與 idol_id 不在 conflict 時被覆寫。
--
-- DEPENDENCIES
--   • idols.slug = 'dynamicduo' 必須存在（由 M1b 系列 migration seed）
--   • crawler_sources 表 + source_key unique index（migration 019）
--   • generic_webpage runtime：PR #153（preview）+ #158（commit）merged
--
-- VERIFICATION QUERY（COMMIT 後在 Supabase SQL Editor 執行）
--   SELECT
--     source_key, parser_type, source_type, is_active,
--     idol_id IS NOT NULL  AS has_idol,
--     source_url
--   FROM  public.crawler_sources
--   WHERE source_key = 'generic-dynamicduo-amoeba';
--
--   Expected: 1 row, is_active=false, has_idol=true,
--             source_url='https://www.amoebaculture.com/artists/67'.
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
  'Dynamicduo — Amoeba Culture artist page',
  'generic-dynamicduo-amoeba',
  idols.id,
  'https://www.amoebaculture.com/artists/67',
  'official_website'::source_type,
  'generic_webpage',
  false,
  jsonb_build_object(
    'provider', 'generic_webpage',
    'phase',    'p1-b4',
    'note',     'Amoeba Culture artist page for Dynamicduo. Confirmed server-rendered 2026-05-24 via curl (200/32593 bytes, real concert title + dates visible in initial HTML). Artist-specific URL — zero cross-artist noise.',
    'scouted',  '2026-05-24'
  )
FROM public.idols
WHERE idols.slug = 'dynamicduo'
ON CONFLICT (source_key) DO UPDATE
SET name        = EXCLUDED.name,
    source_url  = EXCLUDED.source_url,
    source_type = EXCLUDED.source_type,
    parser_type = EXCLUDED.parser_type,
    config      = EXCLUDED.config,
    updated_at  = NOW();
-- Note: is_active and idol_id are intentionally NOT overwritten on conflict.


COMMIT;

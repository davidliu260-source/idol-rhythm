-- =============================================================================
-- Idol Rhythm -- Seed 1 generic_webpage source: kpopconcerts.com tour aggregator
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   P1-B7：第五筆 production-quality generic_webpage source。
--   來源：https://kpopconcerts.com/category/k-pop-concerts/
--
--   為什麼選 kpopconcerts.com 的 k-pop-concerts 分類頁：
--     • 跟既有 kpopofficial_concerts 同類（多藝人 tour aggregator），但角度不同：
--         - kpopofficial 偏全球巡演 calendar（BTS / IVE / IU / (G)I-DLE 等大團）
--         - kpopconcerts 偏 tour announcement 新聞（含 LISA / JENNIE / EVERGLOW
--           / TRENDZ 等個人藝人 / 中小團 tour 公告）
--     • 2026-05-24 curl 實測：
--         HTTP 200 / 136889 bytes / 3777 visible text chars
--         真實活動標題在初始 HTML，例如：
--           「LISA Announces "VIVA LA LISA" Las Vegas Residency at Caesars Palace」
--           「Stray Kids and JENNIE To Be First-Ever K-Pop Headliners at Governors Ball」
--           「MAMAMOO Announce 2026 US Tour」
--           「EVERGLOW Announces 2026 WORLD TOUR [RE:CODE]」
--     • 覆蓋目前完全沒有 dedicated crawler 的個人藝人（LISA / JENNIE）
--     • 公開頁、無 Cloudflare / login wall
--
-- idol_id 設計決策
--   此頁為多藝人 tour announcement feed，與 kpopofficial / YG notice 同模式：
--   idol_id = NULL，不綁定特定藝人。Claude 從內容自由萃取多藝人 events。
--
--   ⚠️ dedupe 預期：與 kpopofficial 會有部分重疊（同一場巡演兩邊都報導）。
--   依賴 source_hash + url+title+date+type dedupe 機制處理。
--
-- SCOPE
--   • 新增 1 列 crawler_sources（idol_id = NULL）
--   • parser_type = 'generic_webpage'
--   • source_type = 'media_outlet'（注意：不是 official_website，是第三方媒體）
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
-- 同輪 curl 測試但放棄的兄弟候選
--   ❌ bandsintown.com/genre/2-k-pop  → HTTP 403（Cloudflare/bot block）
--   ❌ soompi.com/category/news       → HTTP 404
--   ❌ songkick.com/genres/16-kpop    → HTTP 406（block）
--   ❌ concertful.com/genre/k-pop     → HTTP 403
--   ⚠️ allkpop.com/category/concerts  → 200 但內容為綜合 K-pop news，
--                                        concert content 比例低，雜訊高
--
-- VERIFICATION QUERY（COMMIT 後在 Supabase SQL Editor 執行）
--   SELECT
--     source_key, parser_type, source_type, is_active,
--     idol_id IS NULL AS idol_unbound,
--     source_url
--   FROM  public.crawler_sources
--   WHERE source_key = 'generic-kpopconcerts-aggregator';
--
--   Expected: 1 row, is_active=false, idol_unbound=true,
--             source_url='https://kpopconcerts.com/category/k-pop-concerts/'.
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
  'kpopconcerts.com — K-Pop Concerts category',
  'generic-kpopconcerts-aggregator',
  NULL,
  'https://kpopconcerts.com/category/k-pop-concerts/',
  'media_outlet'::source_type,
  'generic_webpage',
  false,
  jsonb_build_object(
    'provider',  'generic_webpage',
    'phase',     'p1-b7',
    'note',      'kpopconcerts.com K-Pop Concerts category page — multi-artist tour announcement aggregator (third-party media). Confirmed server-rendered 2026-05-24 via curl (200/136889B, real tour titles incl. LISA Las Vegas Residency, JENNIE Governors Ball, MAMAMOO US Tour, EVERGLOW World Tour visible in initial HTML). Complements kpopofficial_concerts. Expected dedupe with kpopofficial via source_hash + url+title+date+type.',
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

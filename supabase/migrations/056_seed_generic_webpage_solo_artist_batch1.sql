-- =============================================================================
-- Idol Rhythm -- Seed generic_webpage sources for Solo Artist Batch 1
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   依 SOLO_ARTIST_NOTICE_URL_PROBE_REPORT.md（PR #174）的 Verdict A 結果，
--   為 4 位 solo artist 各 seed 1 筆 crawler_sources：
--     1. jay-park   → https://jaypark.com
--     2. jisoo      → https://blissoo.com
--     3. dean       → https://www.youwillknovv.com
--     4. plave      → https://vlast.com/plave
--
--   全部 is_active = false。Cron / sync-all 對 generic_webpage 已有
--   unconditional skip guard（PR #155），所以 active=false 時不會被 cron
--   觸發；admin 手動 Preview / Commit 後再決定是否打開。
--
--   每筆 source 都會：
--     • 出現在 /admin/sources 後台列表
--     • 顯示「執行」按鈕（generic_webpage 是 page.tsx 的特例，is_active=false
--       也能手動觸發 — see PR #155）
--     • Preview 不寫 event_candidates；Commit 才寫
--
-- WHY THESE 4
--   probe 報告中 Verdict A 的條件：
--     • HTTP 200 + bot UA = Chrome UA（雙 UA 驗證一致）
--     • 顯著 server-rendered HTML（非 SPA shell 主導）
--     • 藝人名 / 活動關鍵字 grep 命中（jaypark 25 / blissoo 232 /
--       dean 2317 / plave 188 hits）
--     • 無 Cloudflare / CUPID / 反爬訊號
--
-- WHY is_active = false
--   GPT audit 對 small batch 的裁定（PR #173 / #174）：先 seed → 手動
--   Preview → 觀察 Claude 萃取結果 → 確認 confidence 與 idolMatcher
--   命中後，再透過 admin UI 或下一筆 SQL 把 is_active 改為 true。
--   本 migration **不**改 is_active = true，避免一鍵打開後沒有驗收緩衝。
--
-- SCOPE
--   • 新增 4 列 crawler_sources
--   • 不改 schema / enum / RLS / GRANT
--   • 不改 idols 表
--   • 不改其他 crawler_sources 行
--
-- IDEMPOTENCE
--   ON CONFLICT (source_key) DO UPDATE 重新覆蓋 name / source_url /
--   source_type / parser_type / config / updated_at。
--   is_active 與 idol_id 不在 conflict 時被覆寫，避免破壞 admin
--   後續調整。
--
-- DEPENDENCIES
--   • idols.slug 必須存在：jay-park, jisoo, dean, plave
--       jay-park / jisoo / plave → migration 038（M1b-3 seed）
--       dean                    → migration 043（M1b-4 seed）
--   • crawler_sources 表 + source_key unique index → migration 019
--   • generic_webpage runtime → PR #153 (preview) + PR #158 (commit)
--   • P1-B8 idolMatcher 整合 → PR #172（對 idol_id 已綁定的 source
--     不影響行為；本 batch 4 筆都有 idol_id binding，走 source_binding
--     路徑）
--
-- VERIFICATION QUERY (run in Supabase SQL Editor after executing)
--   SELECT
--     source_key,
--     parser_type,
--     source_type,
--     is_active,
--     idol_id IS NOT NULL AS has_idol,
--     source_url
--   FROM  public.crawler_sources
--   WHERE source_key IN (
--     'generic-jay-park-jaypark',
--     'generic-jisoo-blissoo',
--     'generic-dean-youwillknovv',
--     'generic-plave-vlast'
--   )
--   ORDER BY source_key;
--
--   Expected: 4 rows; parser_type='generic_webpage';
--   source_type='official_website'; is_active=false; has_idol=true.
-- =============================================================================


BEGIN;


-- 1) Jay Park — jaypark.com (MORE VISION; personal site on Vercel/Next.js)
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
  'Jay Park - jaypark.com official site',
  'generic-jay-park-jaypark',
  idols.id,
  'https://jaypark.com',
  'official_website'::source_type,
  'generic_webpage',
  false,
  jsonb_build_object(
    'provider', 'generic_webpage',
    'phase',    'p1-b-solo-artist-batch1',
    'agency',   'MORE VISION (personal site separate from agency root)',
    'note',     'Vercel/Next.js. 200/23.8KB, 25 keyword hits, no SPA root, bot UA = Chrome UA. Verdict A per PR #174.',
    'scouted',  '2026-05-25'
  )
FROM public.idols
WHERE idols.slug = 'jay-park'
ON CONFLICT (source_key) DO UPDATE
SET name        = EXCLUDED.name,
    source_url  = EXCLUDED.source_url,
    source_type = EXCLUDED.source_type,
    parser_type = EXCLUDED.parser_type,
    config      = EXCLUDED.config,
    updated_at  = NOW();


-- 2) JISOO — blissoo.com (BLISSOO; JISOO own agency; PHP/WordPress)
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
  'JISOO - blissoo.com official site',
  'generic-jisoo-blissoo',
  idols.id,
  'https://blissoo.com',
  'official_website'::source_type,
  'generic_webpage',
  false,
  jsonb_build_object(
    'provider', 'generic_webpage',
    'phase',    'p1-b-solo-artist-batch1',
    'agency',   'BLISSOO',
    'note',     'PHP/WordPress site. 200/118KB, 232 keyword hits (highest density in batch), no SPA root, bot UA = Chrome UA. Verdict A per PR #174.',
    'scouted',  '2026-05-25'
  )
FROM public.idols
WHERE idols.slug = 'jisoo'
ON CONFLICT (source_key) DO UPDATE
SET name        = EXCLUDED.name,
    source_url  = EXCLUDED.source_url,
    source_type = EXCLUDED.source_type,
    parser_type = EXCLUDED.parser_type,
    config      = EXCLUDED.config,
    updated_at  = NOW();


-- 3) Dean — youwillknovv.com (you.will.knovv label)
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
  'Dean - you.will.knovv official site',
  'generic-dean-youwillknovv',
  idols.id,
  'https://www.youwillknovv.com',
  'official_website'::source_type,
  'generic_webpage',
  false,
  jsonb_build_object(
    'provider', 'generic_webpage',
    'phase',    'p1-b-solo-artist-batch1',
    'agency',   'you.will.knovv',
    'note',     'Korean PHP-like site. 200/387KB, 2317 keyword hits (very high density), no SPA root, bot UA = Chrome UA. Verdict A per PR #174. Body size near MAX_HTML_BYTES=500KB cap.',
    'scouted',  '2026-05-25'
  )
FROM public.idols
WHERE idols.slug = 'dean'
ON CONFLICT (source_key) DO UPDATE
SET name        = EXCLUDED.name,
    source_url  = EXCLUDED.source_url,
    source_type = EXCLUDED.source_type,
    parser_type = EXCLUDED.parser_type,
    config      = EXCLUDED.config,
    updated_at  = NOW();


-- 4) PLAVE — vlast.com/plave (VLAST artist-specific path, not root)
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
  'PLAVE - VLAST artist page',
  'generic-plave-vlast',
  idols.id,
  'https://vlast.com/plave',
  'official_website'::source_type,
  'generic_webpage',
  false,
  jsonb_build_object(
    'provider', 'generic_webpage',
    'phase',    'p1-b-solo-artist-batch1',
    'agency',   'VLAST',
    'note',     'WordPress site, artist-specific path (not root) to avoid cross-artist noise. 200/181KB, 188 keyword hits, no SPA root, bot UA = Chrome UA. Verdict A per PR #174.',
    'scouted',  '2026-05-25'
  )
FROM public.idols
WHERE idols.slug = 'plave'
ON CONFLICT (source_key) DO UPDATE
SET name        = EXCLUDED.name,
    source_url  = EXCLUDED.source_url,
    source_type = EXCLUDED.source_type,
    parser_type = EXCLUDED.parser_type,
    config      = EXCLUDED.config,
    updated_at  = NOW();
-- Note: is_active and idol_id are intentionally NOT overwritten on conflict.


COMMIT;

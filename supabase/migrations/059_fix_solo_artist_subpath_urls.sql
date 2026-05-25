-- =============================================================================
-- Idol Rhythm -- Fix solo artist generic_webpage source URLs (subpath probe)
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   Migration 056 seeded 4 個 solo 藝人 generic_webpage sources。
--   2026-05-25 Preview 驗收結果：
--     • JISOO (blissoo.com)       : pageRelevance=high,   10 events ✅
--     • PLAVE (vlast.com/plave)   : pageRelevance=medium, 10 events ✅
--     • Jay Park (jaypark.com)    : pageRelevance=none,    0 events ❌
--     • Dean (youwillknovv.com)   : pageRelevance=none,    0 events ❌
--
--   Jay Park 與 Dean 落地頁太精簡（landing page 風格），Claude 判定非
--   K-pop 頁。本 migration 將兩者的 source_url 改為已實地 curl 探測
--   證實「內容豐富 + 含活動資訊」的子路徑。
--
-- PROBE EVIDENCE (2026-05-25 curl, Chrome desktop UA)
--
--   1. Jay Park → https://www.jaypark.com/notice
--      • HTTP 200, 30 KB
--      • Next.js SSG（`"__N_SSG":true`），HTML inline 已包含完整 notice
--        資料：title / excerpt / date / slug，無需額外 JS render
--      • Inline 命中具體活動：
--          - "2025 박재범 월드투어 [Serenades & Body Rolls] In Seoul
--             팬 서포트 및 기부 화환 설치 신청 안내" (2025-04-30)
--          - "박재범 (Jay Park) <Remedy MV Preview Event> 진행 안내"
--            (2025-07-10)
--          - 多筆 fan club / kit / streaming 公告
--      • Notice slug 模式：/notice/{slug}（permalink 結構穩定）
--      • 5+ 個 future-dated post 證明頁面有持續更新
--
--   2. Dean → https://www.youwillknovv.com/live
--      • HTTP 200, 226 KB
--      • imweb (Korean SaaS) 平台 server-rendered
--      • 命中 3 筆未來日期：2026.05.22 / 2026.06.20 / 2026.08.14
--      • 含 show/쇼/live 關鍵字 40+ 次
--      • 注意：imweb 模板 chrome 較重（"설명/타이틀/버튼" 等平台 UI 字串
--        占比高），Claude pageRelevance 信心可能仍偏 low/medium，需
--        Preview 後再評估。若仍 none，下一步考慮：
--          (a) /artist/dean (236KB profile 頁)
--          (b) 接受 Verdict B (部分覆蓋)
--          (c) 改用 Google Discovery 補洞
--
-- SCOPE
--   • UPDATE 2 rows in public.crawler_sources
--   • 不改 schema / enum / RLS / GRANT
--   • 不改 idols / parser / runtime
--   • 不改其他 crawler_sources rows
--
-- IDEMPOTENCE
--   WHERE 子句檢查 source_key 才 UPDATE。重複執行為 no-op（值已是
--   新 URL 時，second run 不會有 row 受影響但也不會出錯）。
--
-- DEPENDENCIES
--   • Migration 056 已執行（seed generic-jay-park-jaypark /
--     generic-dean-youwillknovv 兩筆 source）
--
-- POST-MIGRATION VERIFICATION
--   SELECT source_key, source_url
--   FROM   public.crawler_sources
--   WHERE  source_key IN (
--     'generic-jay-park-jaypark',
--     'generic-dean-youwillknovv'
--   )
--   ORDER BY source_key;
--
--   Expected:
--     generic-dean-youwillknovv  | https://www.youwillknovv.com/live
--     generic-jay-park-jaypark   | https://www.jaypark.com/notice
--
--   Then in admin UI: /admin/sources → 點進兩筆 source → 按 Preview
--   • Jay Park 期望: pageRelevance=high/medium, events≥3
--   • Dean 期望:     pageRelevance≥low,        events≥1 (warning ok)
-- =============================================================================


BEGIN;


-- 1) Jay Park: jaypark.com → www.jaypark.com/notice
UPDATE public.crawler_sources
SET source_url = 'https://www.jaypark.com/notice',
    config     = jsonb_set(
                   COALESCE(config, '{}'::jsonb),
                   '{note}',
                   to_jsonb(
                     'Next.js SSG. /notice subpath chosen 2026-05-25 after root URL probe returned pageRelevance=none. Inline __NEXT_DATA__ contains structured notice posts with title/excerpt/date/slug. Verdict A per migration 059 probe.'::text
                   )
                 ),
    updated_at = NOW()
WHERE source_key = 'generic-jay-park-jaypark';


-- 2) Dean: youwillknovv.com → www.youwillknovv.com/live
UPDATE public.crawler_sources
SET source_url = 'https://www.youwillknovv.com/live',
    config     = jsonb_set(
                   COALESCE(config, '{}'::jsonb),
                   '{note}',
                   to_jsonb(
                     'imweb (Korean SaaS) site, /live subpath chosen 2026-05-25 after root URL probe returned pageRelevance=none. Page is 226KB with 3 future dates (2026.05/06/08) and show/쇼/live keywords. imweb template chrome may still confuse Claude — re-evaluate after Preview. Verdict A (provisional) per migration 059 probe.'::text
                   )
                 ),
    updated_at = NOW()
WHERE source_key = 'generic-dean-youwillknovv';


COMMIT;

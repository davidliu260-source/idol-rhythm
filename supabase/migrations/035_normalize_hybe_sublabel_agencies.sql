-- =============================================================================
-- Idol Rhythm — Normalize HYBE sub-label agency strings
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   /admin/idols 的「HYBE」filter tab 用 lower(agency) LIKE '%hybe%' 判斷
--   是否屬於 HYBE。migration 034 把 sub-label 名稱直接寫進 agency
--   （'BIGHIT MUSIC'、'PLEDIS Entertainment' 等），沒有 HYBE 前綴 → 命中
--   不到 filter，全部掉到「其他」分類。
--
--   修法：把 sub-label 名稱統一改成「HYBE / <label>」格式，與使用者之前手動
--   建立的 BTS / TXT / NewJeans / LE SSERAFIM 等列保持一致。
--
-- AFFECTED ROWS
--   只 UPDATE agency 字串完全等於 migration 034 預設值的列。如果 admin 之後
--   在 /admin/idols/<id>/edit 把 agency 改成自訂值，不會被本 migration 覆蓋。
--
-- IDEMPOTENCE
--   重跑無作用 — 第二次執行時 agency 已經是 'HYBE / ...'，WHERE 子句找不到
--   舊值（'BIGHIT MUSIC' 等）的列。
--
-- SCOPE
--   - 純 UPDATE。無 schema 變更、無 GRANT / RLS 變更。
--   - 不動已存在但 agency 已是「HYBE / ...」格式的列。
--   - 不動非 HYBE 系列（SM / YG / Starship / KQ 等）。
--   - 不動 code。
--
-- DEPENDENCY
--   Must be run AFTER 034_seed_mainstream_kpop_idols_batch_1.sql
--
-- EXECUTION
--   Run in Supabase SQL Editor:
--     BEGIN; <paste this file>; COMMIT;
-- =============================================================================


BEGIN;


-- HYBE / BigHit Music — BTS / TXT / CORTIS
UPDATE public.idols
   SET agency = 'HYBE / BigHit Music'
 WHERE agency = 'BIGHIT MUSIC';

-- HYBE / Pledis — SEVENTEEN / TWS
UPDATE public.idols
   SET agency = 'HYBE / Pledis'
 WHERE agency = 'PLEDIS Entertainment';

-- HYBE / Source Music — LE SSERAFIM
UPDATE public.idols
   SET agency = 'HYBE / Source Music'
 WHERE agency = 'Source Music';

-- HYBE / ADOR — NewJeans
UPDATE public.idols
   SET agency = 'HYBE / ADOR'
 WHERE agency = 'ADOR';

-- HYBE / BELIFT LAB — ENHYPEN / ILLIT
UPDATE public.idols
   SET agency = 'HYBE / BELIFT LAB'
 WHERE agency = 'BELIFT LAB';

-- HYBE / KOZ — BOYNEXTDOOR
UPDATE public.idols
   SET agency = 'HYBE / KOZ'
 WHERE agency = 'KOZ Entertainment';


COMMIT;


-- =============================================================================
-- REVIEW CHECKLIST
-- =============================================================================
--
--  □ Migrations 001–034 已執行。
--
--  □ 跑完後驗證 HYBE 系列藝人 agency 都含 'HYBE'：
--    SELECT slug, name, agency FROM idols
--     WHERE slug IN ('bts','txt','cortis','seventeen','tws','le-sserafim',
--                    'newjeans','enhypen','illit','boynextdoor','katseye')
--     ORDER BY slug;
--    Expected: 全部 agency 含 'HYBE' 字串。
--
--  □ 驗證沒影響到非 HYBE 列：
--    SELECT count(*) FROM idols WHERE agency = 'JYP Entertainment';
--    Expected: 8（不變）
--
--  □ /admin/idols 的「HYBE」filter：
--    應該從 5 變 11（+ CORTIS / SEVENTEEN / TWS / ENHYPEN / ILLIT / BOYNEXTDOOR）。
--
--  □ /admin/idols 的「其他」filter：
--    應該減少 6。
--
--  □ 重跑驗證 idempotence：
--    再次執行此 migration 應為 no-op（0 rows affected for each UPDATE）。
--
-- =============================================================================

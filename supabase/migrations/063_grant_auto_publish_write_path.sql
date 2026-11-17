-- =============================================================================
-- 063_grant_auto_publish_write_path.sql
--
-- PURPOSE
--   記錄 M063 已在正式庫套用的最小 GRANT，供冪等重跑。
--   cron（service_role）需要 events INSERT、欄位級 UPDATE
--   （發布／信任／空地點／稽核欄），以及 event_sources SELECT／INSERT。
--   後台一鍵下架需要 authenticated 對 auto_publish_blocked 的 UPDATE。
--
-- EXECUTION
--   Dave 已於 2026-11-17 在 Chrome、專案 rdrthazsonkefggedbjr 的
--   SQL Editor 跑過 M063；本檔是紀錄，不是新的權限變更。
--
-- SCOPE
--   只加權限。不改資料、不改 RLS、不改開關、不改 anon。
--   不給任何角色 DELETE；不給 service_role 對 events.auto_publish_blocked、
--   events 的 title／date／type 等內容欄或 app_settings 的 UPDATE。
--   歷史政策 "events: admin all" 保留不變；本檔不 DROP／ALTER 任何政策。
--
-- IDEMPOTENT
--   GRANT 重跑無害。
--
-- ROLLBACK
--   先把 PR-3 程式 revert 並部署，再跑；否則一鍵下架會失敗。
--   BEGIN;
--   REVOKE UPDATE (auto_publish_blocked) ON public.events FROM authenticated;
--   REVOKE SELECT, INSERT ON public.event_sources FROM service_role;
--   REVOKE UPDATE (is_published, published_at, trust_level, city, venue_name, address,
--     auto_published_at, auto_publish_rule_version, location_autofilled_at, location_autofill_meta, updated_at)
--     ON public.events FROM service_role;
--   REVOKE INSERT ON public.events FROM service_role;
--   COMMIT;
-- =============================================================================

BEGIN;

-- cron（service_role）：建立自動上架草稿
GRANT INSERT ON public.events TO service_role;

-- cron（service_role）：發布、信任等級、補空地點、稽核欄（不含 title/date/type 等內容欄）
GRANT UPDATE (
  is_published, published_at, trust_level,
  city, venue_name, address,
  auto_published_at, auto_publish_rule_version,
  location_autofilled_at, location_autofill_meta,
  updated_at
) ON public.events TO service_role;

-- cron（service_role）：比對來源網址、寫入活動來源
GRANT SELECT, INSERT ON public.event_sources TO service_role;

-- 後台一鍵下架（authenticated + admin_users，沿用 006 政策）
GRANT UPDATE (auto_publish_blocked) ON public.events TO authenticated;

COMMIT;

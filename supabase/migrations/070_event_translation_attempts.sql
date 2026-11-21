-- =============================================================================
-- 070_event_translation_attempts.sql
--
-- PURPOSE
--   記錄中文翻譯的失敗次數、最近錯誤與認領時間。
--
-- EXECUTION
--   尚未套用。Dave 須在合併／部署前於 Chrome 的 SQL Editor 執行貼上單 M077。
--
-- SCOPE
--   只新增三欄和欄位級 UPDATE 權限。不改既有欄位、資料或 RLS。
--
-- IDEMPOTENT
--   欄位僅在不存在時新增。COMMENT 與 GRANT 可以重跑。
--
-- ROLLBACK
--   先 revert 讀寫這些欄位的程式並部署，再撤權並移除欄位。
--   BEGIN;
--   REVOKE UPDATE (display_title_zh, display_summary_zh, location_name_zh,
--     translation_status, translation_source, translation_updated_at,
--     translation_attempts, translation_last_error, translation_attempted_at)
--     ON public.events FROM service_role;
--   REVOKE UPDATE (translation_attempts, translation_last_error, translation_attempted_at)
--     ON public.events FROM authenticated;
--   ALTER TABLE public.events
--     DROP COLUMN IF EXISTS translation_attempts,
--     DROP COLUMN IF EXISTS translation_last_error,
--     DROP COLUMN IF EXISTS translation_attempted_at;
--   COMMIT;
-- =============================================================================

BEGIN;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS translation_attempts int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS translation_last_error text,
  ADD COLUMN IF NOT EXISTS translation_attempted_at timestamptz;

COMMENT ON COLUMN public.events.translation_attempts IS
  '中文翻譯失敗次數。滿三次停止自動重試，後台單筆重試時歸零。';
COMMENT ON COLUMN public.events.translation_last_error IS
  '最近一次中文翻譯錯誤摘要，最多 200 字元。';
COMMENT ON COLUMN public.events.translation_attempted_at IS
  '最近一次中文翻譯認領時間，用於避免重複翻譯。';

-- cron 使用 service_role（不受 RLS 限制）。063 未授予中文顯示欄的 UPDATE，
-- cron 翻譯需要寫入以下欄位。不含 title/date/type 等原文欄位。
GRANT UPDATE (
  display_title_zh, display_summary_zh, location_name_zh,
  translation_status, translation_source, translation_updated_at,
  translation_attempts, translation_last_error, translation_attempted_at
) ON public.events TO service_role;

-- 後台沿用 041 的中文欄位權限及 006 的 "events: admin_users update" RLS。
GRANT UPDATE (translation_attempts, translation_last_error, translation_attempted_at)
  ON public.events TO authenticated;

COMMIT;

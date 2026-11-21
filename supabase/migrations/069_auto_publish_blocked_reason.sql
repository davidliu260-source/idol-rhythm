-- =============================================================================
-- 069_auto_publish_blocked_reason.sql
--
-- PURPOSE
--   記錄因缺最低內容而暫停自動上架的原因。
--
-- EXECUTION
--   尚未套用。Dave 須在合併前於 Chrome 的 SQL Editor 執行貼上單 M076 第 1 段。
--
-- SCOPE
--   只新增欄位、CHECK 與欄位級 UPDATE 權限。不改資料、不改 RLS、
--   不給 service_role 對 auto_publish_blocked 的 UPDATE 權限。
--
-- IDEMPOTENT
--   欄位與 CHECK 僅在不存在時新增。COMMENT 與 GRANT 可以重跑。
--
-- ROLLBACK
--   先還原讀寫此欄位的程式並部署，再撤權並移除欄位（會刪除已記錄的原因）。
--   BEGIN;
--   REVOKE UPDATE (auto_publish_blocked_reason) ON public.events FROM service_role;
--   ALTER TABLE public.events DROP COLUMN IF EXISTS auto_publish_blocked_reason;
--   COMMIT;
-- =============================================================================

BEGIN;

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS auto_publish_blocked_reason text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'events_auto_publish_blocked_reason_check'
      AND conrelid = 'public.events'::regclass
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_auto_publish_blocked_reason_check
      CHECK (auto_publish_blocked_reason IS NULL OR auto_publish_blocked_reason IN ('empty_shell', 'manual'));
  END IF;
END;
$$;

COMMENT ON COLUMN public.events.auto_publish_blocked_reason IS
  'empty_shell：因缺最低內容暫停（搭配 auto_publish_blocked=false），cron 補到內容會自動上架並清空原因。manual 保留。只要 auto_publish_blocked=true，一律是人工永久封鎖，不論原因為何（後台下架不會清掉原因）。';

GRANT UPDATE (auto_publish_blocked_reason) ON public.events TO service_role;

COMMIT;

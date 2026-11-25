-- =============================================================================
-- 072_crawler_source_alerts.sql
-- Idol Rhythm — MUST #10 爬蟲故障提醒（資料表與來源狀態欄）
--
-- PURPOSE
--   讓每日爬蟲跑完後，能算出「連續失敗幾次」、「多久沒成功」、
--   「成功卻抓到 0 筆」，並把未解決的故障／警告記在專用提醒表，
--   給管理員在後台查看。本檔只改 schema，不寫入活動、不下架、
--   不寄信、不碰粉絲 notifications 表。
--
-- SCOPE
--   1. public.crawler_sources 新增 4 個狀態欄（預設／可為空，不做歷史回填）。
--   2. 新增 public.crawler_source_alerts。
--   3. RLS：一般使用者與 anon 讀不到提醒；只有在職管理員可讀寫狀態。
--   4. 擴充 authenticated 對來源列新狀態欄的 column-level UPDATE，
--      讓後台手動執行爬蟲時也能寫入（cron 使用的 service_role
--      已有整表 UPDATE）。
--
-- IDEMPOTENT
--   ADD COLUMN IF NOT EXISTS、CREATE TABLE / INDEX IF NOT EXISTS、
--   DROP CONSTRAINT / POLICY IF EXISTS 後重建、重新 GRANT。
--
-- ROLLBACK（會刪掉尚未解決的提醒紀錄；來源列本身留下）
--   BEGIN;
--   DROP TABLE IF EXISTS public.crawler_source_alerts;
--   ALTER TABLE public.crawler_sources
--     DROP COLUMN IF EXISTS last_success_at,
--     DROP COLUMN IF EXISTS last_fetched_count,
--     DROP COLUMN IF EXISTS consecutive_error_count,
--     DROP COLUMN IF EXISTS consecutive_zero_fetch_count;
--   COMMIT;
--   NOTIFY pgrst, 'reload schema';
--
-- EXECUTION
--   不要現在跑正式庫。等後續「故障提醒」程式要合併或部署時，
--   由 Dave 核准並依貼上單 M081 在 SQL Editor 執行。
--
-- DEPENDENCIES
--   public.crawler_sources（019／020）、public.admin_users、auth.uid()、
--   PostgreSQL 13+ 與 UTF8 資料庫。不依賴 072 以外的未合併分支。
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. crawler_sources：健康狀態欄
--    不上線前回填 last_success_at，避免把「本功能上線前的空白」
--    或「上線前就已超過 48 小時沒跑」直接當成已故障。
-- ---------------------------------------------------------------------------

ALTER TABLE public.crawler_sources
  ADD COLUMN IF NOT EXISTS last_success_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_fetched_count integer,
  ADD COLUMN IF NOT EXISTS consecutive_error_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS consecutive_zero_fetch_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.crawler_sources.last_success_at IS
  'MUST10: timestamp of the last run that connected successfully (including a successful fetch of 0 rows). NULL until the first such run after this column exists. Interpreted in the app as Asia/Taipei.';

COMMENT ON COLUMN public.crawler_sources.last_fetched_count IS
  'MUST10: number of items fetched on the last run. NULL means no run has written a count yet; 0 means the last successful run fetched nothing.';

COMMENT ON COLUMN public.crawler_sources.consecutive_error_count IS
  'MUST10: consecutive runs whose last_status was error or partial_error. Reset to 0 on success.';

COMMENT ON COLUMN public.crawler_sources.consecutive_zero_fetch_count IS
  'MUST10: consecutive successful runs that fetched 0 items. Reset to 0 when a run fetches at least 1 item.';

ALTER TABLE public.crawler_sources
  DROP CONSTRAINT IF EXISTS crawler_sources_last_fetched_count_nonneg,
  DROP CONSTRAINT IF EXISTS crawler_sources_consecutive_error_count_nonneg,
  DROP CONSTRAINT IF EXISTS crawler_sources_consecutive_zero_fetch_count_nonneg;

ALTER TABLE public.crawler_sources
  ADD CONSTRAINT crawler_sources_last_fetched_count_nonneg
    CHECK (last_fetched_count IS NULL OR last_fetched_count >= 0),
  ADD CONSTRAINT crawler_sources_consecutive_error_count_nonneg
    CHECK (consecutive_error_count >= 0),
  ADD CONSTRAINT crawler_sources_consecutive_zero_fetch_count_nonneg
    CHECK (consecutive_zero_fetch_count >= 0);

-- 020 只授權 authenticated 更新 last_run_at／last_status／last_error／updated_at。
-- 新欄若不加 GRANT，後台用登入身分寫入會得到 42501。service_role 已有整表 UPDATE。
GRANT UPDATE (
  last_success_at,
  last_fetched_count,
  consecutive_error_count,
  consecutive_zero_fetch_count
) ON public.crawler_sources TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. crawler_source_alerts：未解決的故障／警告
--    同一來源、同一 kind，同一時間只允許一筆未解決（open 或 acknowledged）。
--    本表不觸發、不更新 public.events。
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.crawler_source_alerts (
  id                 bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id          uuid        NOT NULL REFERENCES public.crawler_sources (id) ON DELETE CASCADE,
  kind               text        NOT NULL,
  severity           text        NOT NULL,
  status             text        NOT NULL DEFAULT 'open',
  opened_at          timestamptz NOT NULL DEFAULT now(),
  last_triggered_at  timestamptz NOT NULL DEFAULT now(),
  acknowledged_at    timestamptz,
  resolved_at        timestamptz,
  detail             text,
  CONSTRAINT crawler_source_alerts_kind_check
    CHECK (kind IN ('error_streak', 'stale_success', 'zero_fetch')),
  CONSTRAINT crawler_source_alerts_severity_check
    CHECK (severity IN ('fault', 'warning')),
  CONSTRAINT crawler_source_alerts_status_check
    CHECK (status IN ('open', 'acknowledged', 'resolved')),
  CONSTRAINT crawler_source_alerts_detail_len
    CHECK (detail IS NULL OR pg_catalog.char_length(detail) BETWEEN 1 AND 1000),
  CONSTRAINT crawler_source_alerts_resolved_consistency
    CHECK (
      (status = 'resolved' AND resolved_at IS NOT NULL)
      OR (status IN ('open', 'acknowledged') AND resolved_at IS NULL)
    )
);

COMMENT ON TABLE public.crawler_source_alerts IS
  'MUST10: crawler health alerts for admins. One unresolved row (open or acknowledged) per (source_id, kind). Not used for fan notifications. Creating or resolving a row must never unpublish events.';

COMMENT ON COLUMN public.crawler_source_alerts.kind IS
  'error_streak = consecutive error/partial_error runs; stale_success = no successful run within the threshold; zero_fetch = consecutive successful empty fetches.';

COMMENT ON COLUMN public.crawler_source_alerts.severity IS
  'fault = outage-level; warning = needs attention (e.g. empty official notice boards). Thresholds live in app code, not this table.';

COMMENT ON COLUMN public.crawler_source_alerts.status IS
  'open = unresolved; acknowledged = seen by an admin but still unresolved; resolved = cleared (automatically when the source recovers, or manually).';

CREATE UNIQUE INDEX IF NOT EXISTS crawler_source_alerts_open_kind_uidx
  ON public.crawler_source_alerts (source_id, kind)
  WHERE status IN ('open', 'acknowledged');

CREATE INDEX IF NOT EXISTS crawler_source_alerts_status_triggered_idx
  ON public.crawler_source_alerts (status, last_triggered_at DESC);

CREATE INDEX IF NOT EXISTS crawler_source_alerts_source_status_idx
  ON public.crawler_source_alerts (source_id, status);

ALTER TABLE public.crawler_source_alerts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.crawler_source_alerts FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE public.crawler_source_alerts_id_seq FROM PUBLIC, anon, authenticated, service_role;

-- 管理員後台：讀列表、把狀態改成已看過／已解決。不可自行新增或刪除列。
GRANT SELECT ON TABLE public.crawler_source_alerts TO authenticated;
GRANT UPDATE (status, acknowledged_at, resolved_at, detail)
  ON TABLE public.crawler_source_alerts TO authenticated;

-- cron（service_role）開單、更新最近觸發時間、自動結案。不下架活動。
GRANT SELECT, INSERT, UPDATE ON TABLE public.crawler_source_alerts TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.crawler_source_alerts_id_seq TO service_role;

DROP POLICY IF EXISTS "crawler_source_alerts: admin_users select" ON public.crawler_source_alerts;
CREATE POLICY "crawler_source_alerts: admin_users select"
  ON public.crawler_source_alerts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
        AND admin_users.is_active = true
    )
  );

DROP POLICY IF EXISTS "crawler_source_alerts: admin_users update status" ON public.crawler_source_alerts;
CREATE POLICY "crawler_source_alerts: admin_users update status"
  ON public.crawler_source_alerts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
        AND admin_users.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
        AND admin_users.is_active = true
    )
  );

COMMIT;

NOTIFY pgrst, 'reload schema';

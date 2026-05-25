-- =============================================================================
-- Idol Rhythm -- Drift Diff v1: add latest_* snapshot columns
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   依 DRIFT_DIFF_WORK_ORDER.md（PR #178）的方案 A，在 event_candidates
--   表新增 5 個欄位，讓 crawler 偵測 content_hash drift 時，能在保留
--   原始 raw_* 的前提下，把新抓到的版本另外存起來供 admin 在後台對比。
--
--   v1 範圍只接 JYP schedule fetcher（runJypScheduleFetcher.ts）為唯一
--   寫入路徑，其他 6 個受影響 fetcher（BLACKPINK / kpopofficial / SMTOWN /
--   WAKEONE / YG / YouTube）的接線屬於後續 PR。
--
-- WHY column-level（not jsonb）
--   - 結構清楚、TypeScript / SQL 查詢直觀
--   - 沿用 J7d-A migration 026 既有 GRANT pattern（不引入新概念）
--   - 未來如要做 v2 多代歷史，再新建 history 表，本欄位仍可保留作為
--     「最新一次 snapshot」cache
--
-- WHY 5 個欄位
--   - latest_raw_title       text         ← 對應 raw_title
--   - latest_raw_content     text         ← 對應 raw_content
--   - latest_detected_date   date         ← 對應 detected_date
--   - latest_source_url      text         ← 對應 source_url
--   - latest_detected_at     timestamptz  ← 紀錄這次 snapshot 的 fetch 時間
--
--   不含 latest_detected_idol_id / latest_detected_event_type / latest_raw_data
--   等 — v1 範圍只追蹤「使用者最容易看出變化的 4 個內容欄位」加 1 個時間戳。
--
-- WHY column-level GRANT 只給 service_role UPDATE
--   - crawler 在 cron / 手動 RunSource 路徑使用 service_role client
--     （migration 018 既定行為），需 UPDATE 這 5 欄位
--   - admin 在後台只 READ，不需要 UPDATE（v1 不支援人工 promote
--     latest_* → raw_*；那是 J7d-B 範疇）
--   - SELECT 已由既有 table-level GRANT 涵蓋（migration 012）— 新欄位自動繼承
--
-- WHY ADD COLUMN IF NOT EXISTS（冪等）
--   - 重跑 migration 應為 no-op
--   - GRANT 重發也不會錯（PostgreSQL 接受同一 grant 重複授予）
--
-- DEPENDENCIES
--   - event_candidates 表 + content_hash + needs_recheck 欄位 → migration 026
--   - service_role 既有 GRANT INSERT/SELECT/UPDATE → migration 018
--   - authenticated 既有 GRANT SELECT/UPDATE → migration 012
--
-- SCOPE
--   - ADD 5 columns（皆 nullable，預設 NULL）
--   - GRANT UPDATE (5 columns) TO service_role
--   - 不改 schema 其他部分（既有欄位 / RLS / 其他 GRANT 全不動）
--   - 不寫任何資料（candidate row 既有 raw_* 維持原狀，latest_* 初始為 NULL）
--
-- VERIFICATION QUERIES (run after executing in Supabase SQL Editor)
--   1. 5 個新欄位存在且都 nullable：
--        SELECT column_name, data_type, is_nullable
--        FROM   information_schema.columns
--        WHERE  table_schema = 'public'
--          AND  table_name = 'event_candidates'
--          AND  column_name LIKE 'latest_%'
--        ORDER  BY column_name;
--      預期：5 列，is_nullable=YES，data_type 對應 text/text/date/text/timestamptz
--
--   2. service_role 有 UPDATE 權限：
--        SELECT grantee, privilege_type, column_name
--        FROM   information_schema.column_privileges
--        WHERE  table_schema = 'public'
--          AND  table_name = 'event_candidates'
--          AND  grantee = 'service_role'
--          AND  column_name LIKE 'latest_%';
--      預期：5 列，privilege_type=UPDATE
--
--   3. 現有 candidate row 的 latest_* 都是 NULL（無 drift 過的尚未填寫）：
--        SELECT COUNT(*) FILTER (WHERE latest_detected_at IS NULL) AS unfilled,
--               COUNT(*) FILTER (WHERE latest_detected_at IS NOT NULL) AS filled
--        FROM   public.event_candidates;
--      預期：unfilled = 全部、filled = 0
-- =============================================================================


BEGIN;


-- ── 1. Add 5 latest snapshot columns ────────────────────────────────────────
ALTER TABLE public.event_candidates
  ADD COLUMN IF NOT EXISTS latest_raw_title     text,
  ADD COLUMN IF NOT EXISTS latest_raw_content   text,
  ADD COLUMN IF NOT EXISTS latest_detected_date date,
  ADD COLUMN IF NOT EXISTS latest_source_url    text,
  ADD COLUMN IF NOT EXISTS latest_detected_at   timestamptz;


-- ── 2. Column-level UPDATE GRANT for service_role ──────────────────────────
-- Pattern sourced from migration 026 (content_hash / needs_recheck for J7d-A).
-- Admin (authenticated) only needs SELECT; that's already covered by
-- migration 012's table-level SELECT GRANT, which auto-inherits to new columns.
GRANT UPDATE (
  latest_raw_title,
  latest_raw_content,
  latest_detected_date,
  latest_source_url,
  latest_detected_at
) ON public.event_candidates TO service_role;


COMMIT;

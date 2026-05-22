-- =============================================================================
-- Idol Rhythm — Notifications data model (N2 v1)
-- Project : idol-rhythm (ap-southeast-2 Sydney)
-- Migration: 042
--
-- PURPOSE
--   N2 第一輪：建立站內通知（notifications）資料模型。
--
--   本 migration 僅建立 schema + RLS + GRANT。
--   不寫 runtime、不接 push、不做通知 UI、不改首頁鈴鐺、不改 reminders。
--
--   依 N1 工作單（NOTIFICATION_SYSTEM_WORK_ORDER.md，PR #111 merged）與
--   N2 工作單（NOTIFICATION_DATA_MODEL_WORK_ORDER.md，PR #112 merged，已通過
--   GPT review）的「草案 SQL」段落實作。schema / RLS / index / GRANT 規則皆
--   照 N2 工作單寫死，不再加碼：
--     - type 用 text + CHECK，v1 允許 `event_reminder` / `followed_idol_new_event`
--     - dedupe_key 採 v1 單次通知模型：`${type}:${event_id}`
--     - read_at = null 代表未讀；不用 boolean
--     - delivered_at NOT NULL DEFAULT NOW()（v1 即時派送，與 created_at 同值；
--       v2 排程派送時才會與 created_at 拉開）
--     - v1 不加 archived_at
--     - event_id NULLABLE：保留未來「非活動類通知」（如系統公告）彈性，
--       v1 兩種 type 都會帶 event_id，由 runtime 強制
--     - 通知只允許 service_role INSERT（runtime / cron），使用者沒 INSERT GRANT
--       / 沒 INSERT policy；使用者只能 SELECT 自己的 row + UPDATE(read_at)
--     - 沒有 client DELETE：v1 不提供刪除，已讀通知留在 DB；未來 v2 由 cron
--       清理或加 archived_at 再決定
--
--   裁定要點（依使用者 N2 review 結論）：
--     - 通知只從 published events 派送（events.is_published = true /
--       trust_level IN ('official','media') / status <> 'cancelled'），candidate
--       階段不通知 — 由 runtime 端負責，schema 不約束
--     - followed_idol_new_event v1 不回追舊活動，只通知追蹤後新發布的活動 —
--       由 runtime 端比對 user_follows.created_at vs events.published_at
--     - delivered_at 保留
--     - 不加 archived_at
--
-- DEPENDENCY
--   Must be run AFTER:
--     001_initial_schema.sql  — defines events / idols / uuid_generate_v4()
--
-- EXECUTION
--   Run in Supabase SQL Editor:
--     BEGIN; <paste this file>; COMMIT;
--
--   CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS /
--   DROP POLICY IF EXISTS / idempotent GRANT 讓本檔可安全重跑。
--
-- ⚠️  HUMAN REVIEW REQUIRED before executing.
--     See review checklist at the bottom of this file.
-- =============================================================================


BEGIN;


-- =============================================================================
-- SECTION 1: Table
-- =============================================================================
-- 與 N2 工作單「草案 SQL」一致。使用 uuid_generate_v4() 而非
-- gen_random_uuid() 以對齊本 repo 既有 migrations 慣例（events / idols /
-- crawler_sources 等表皆使用 uuid_generate_v4()，依賴 uuid-ossp extension
-- 已在 001_initial_schema.sql 啟用）。
-- =============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id            uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  type          text        NOT NULL,
  event_id      uuid        REFERENCES events (id) ON DELETE CASCADE,
  idol_id       uuid        REFERENCES idols (id) ON DELETE SET NULL,
  title         text        NOT NULL,
  body          text,
  payload       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key    text        NOT NULL,
  read_at       timestamptz,
  delivered_at  timestamptz NOT NULL DEFAULT NOW(),
  created_at    timestamptz NOT NULL DEFAULT NOW()
);


-- =============================================================================
-- SECTION 2: CHECK constraint on type
-- =============================================================================
-- v1 僅允許兩種 type。日後新增類型時，改本 CHECK 即可（不需 ALTER TYPE）。
-- 以 DROP / ADD 維持本檔可重跑性。
-- =============================================================================

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('event_reminder', 'followed_idol_new_event'));


-- =============================================================================
-- SECTION 3: Indexes
-- =============================================================================
-- 與 N2 工作單一致的三個索引：
--   1. notifications_user_dedupe_uidx — UNIQUE，dedupe 主索引。
--      runtime 端用 INSERT ... ON CONFLICT (user_id, dedupe_key) DO NOTHING
--      去保證同 (type, event_id) 對同一 user 只進 inbox 一次。
--   2. notifications_user_created_at_idx — 通知列表頁主路徑（倒序）。
--   3. notifications_user_unread_idx — partial index，加速 unread count。
--      已讀資料量會慢慢長大，但 unread set 通常很小（< 50 筆）→ partial
--      index 永遠快。
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_dedupe_uidx
  ON notifications (user_id, dedupe_key);

CREATE INDEX IF NOT EXISTS notifications_user_created_at_idx
  ON notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON notifications (user_id)
  WHERE read_at IS NULL;


-- =============================================================================
-- SECTION 4: Enable RLS
-- =============================================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- SECTION 5: GRANTs
-- =============================================================================
-- authenticated：
--   - SELECT：讀自己的通知（由 policy 限定 user_id = auth.uid()）
--   - UPDATE (read_at)：column-level GRANT 只允許動 read_at，標已讀用；
--     即使 client 夾帶其他欄位（如 title、payload）也會被擋
--   - 沒有 INSERT GRANT：通知一律由 service_role 寫入，使用者不能偽造
--   - 沒有 DELETE GRANT：v1 不提供刪除 API（N2 工作單 read state 一節）
--
-- service_role：
--   - 完整 SELECT / INSERT / UPDATE / DELETE：runtime / cron 派送與維護用
--   - service_role 預設 bypass RLS，明列 GRANT 以避免未來 default 變更
--
-- anon：完全無權限（通知是登入後才有的功能）
-- =============================================================================

GRANT SELECT ON public.notifications TO authenticated;
GRANT UPDATE (read_at) ON public.notifications TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO service_role;


-- =============================================================================
-- SECTION 6: RLS policies — user-scoped read / update
-- =============================================================================
-- 與 saved_events / reminders / user_follows 一致的 user-scoped 模式。
-- 沒有 INSERT / DELETE policy：authenticated 沒對應 GRANT，policy 也不放行。
-- service_role 預設 bypass RLS，不需要 policy。
-- =============================================================================

DROP POLICY IF EXISTS "notifications_own_select" ON notifications;
DROP POLICY IF EXISTS "notifications_own_update" ON notifications;

CREATE POLICY "notifications_own_select"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notifications_own_update"
  ON notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


COMMIT;


-- =============================================================================
-- REVIEW CHECKLIST (complete before executing in Supabase)
-- =============================================================================
--
--  □ Migrations 001–041 已執行。
--
--  □ 用 BEGIN … COMMIT 包整個檔在 SQL Editor 跑，確認最後出現 COMMIT、無錯誤。
--
--  □ 執行後驗證 schema：
--      SELECT column_name, data_type, is_nullable, column_default
--      FROM information_schema.columns
--      WHERE table_name = 'notifications'
--      ORDER BY ordinal_position;
--    應該看到（依序）：
--      id (uuid, NO, uuid_generate_v4())
--      user_id (uuid, NO)
--      type (text, NO)
--      event_id (uuid, YES)
--      idol_id (uuid, YES)
--      title (text, NO)
--      body (text, YES)
--      payload (jsonb, NO, '{}'::jsonb)
--      dedupe_key (text, NO)
--      read_at (timestamptz, YES)
--      delivered_at (timestamptz, NO, now())
--      created_at (timestamptz, NO, now())
--
--  □ 驗證 indexes：
--      SELECT indexname FROM pg_indexes WHERE tablename = 'notifications';
--    應該包含：
--      notifications_pkey
--      notifications_user_dedupe_uidx           (UNIQUE)
--      notifications_user_created_at_idx
--      notifications_user_unread_idx            (partial: WHERE read_at IS NULL)
--
--  □ 驗證 CHECK：
--      用 service_role 嘗試 INSERT type = 'bogus' → 應被
--      notifications_type_check 擋下。
--
--  □ 驗證 RLS：
--      - 登入使用者 SELECT 只看到自己的 row。
--      - 登入使用者試圖 INSERT → 應被擋（沒有 GRANT INSERT，也沒有 policy）。
--      - 登入使用者 UPDATE 只能動 read_at（column-level GRANT），
--        嘗試 UPDATE title / body / payload 應被擋。
--      - 登入使用者試圖 DELETE → 應被擋（沒有 GRANT DELETE，也沒有 policy）。
--      - anon 完全讀不到（沒 GRANT、沒 policy）。
--      - service_role 可正常 INSERT / SELECT / UPDATE / DELETE。
--
--  □ 驗證 dedupe：
--      用 service_role 連續兩次 INSERT 同一 (user_id, dedupe_key) →
--      第二次應出 23505 unique_violation；可用
--      INSERT ... ON CONFLICT (user_id, dedupe_key) DO NOTHING 收斂。
--
--  □ 確認本 migration 沒有動 reminders / saved_events / user_follows /
--    events / idols 任何欄位 / 索引 / policy。
--
-- =============================================================================

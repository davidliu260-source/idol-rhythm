-- =============================================================================
-- Idol Rhythm — Add avatar source metadata fields (Phase I1b-C)
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   After I1b-B 第一版（Wikimedia AI 搜圖）上線，每張 avatar 都應該帶來源
--   資訊，讓 admin 之後能：
--     - 一眼看出這張圖是怎麼來的（Wikimedia / 手動上傳 / 手動貼網址）
--     - 點來源網址回到原頁面驗證版權
--     - 將來如果某張圖出問題，能根據 provider 快速反查批量
--
-- COLUMNS (all nullable — 既有 row 不會被影響)
--   avatar_source_url      text  null  -- 圖片原始頁面或來源網址（例如 Wikipedia URL）
--   avatar_source_provider text  null  -- 'wikimedia' / 'manual_upload' / 'manual_url' / 'other'
--   avatar_source_license  text  null  -- Wikimedia API 之後若可取得就存
--   avatar_source_author   text  null  -- Wikimedia API 之後若可取得就存
--   avatar_source_note     text  null  -- 人工備註 / 來自哪個 action
--
-- SCOPE
--   - 純 ADD COLUMN，全部 nullable，無 default
--   - 既有 idol row 維持 NULL（admin 之後重新上傳就會自動寫入）
--   - GRANT UPDATE 給 authenticated（admin 寫入用）
--   - 沒有新 RLS — 既有 idols UPDATE policy（migration 010）已涵蓋
--
-- DEPENDENCY
--   Must be run AFTER 025_add_idol_avatar_url.sql.
--
-- EXECUTION
--   Run in Supabase SQL Editor:
--     BEGIN; <paste this file>; COMMIT;
-- =============================================================================


BEGIN;


ALTER TABLE public.idols
  ADD COLUMN IF NOT EXISTS avatar_source_url      text,
  ADD COLUMN IF NOT EXISTS avatar_source_provider text,
  ADD COLUMN IF NOT EXISTS avatar_source_license  text,
  ADD COLUMN IF NOT EXISTS avatar_source_author   text,
  ADD COLUMN IF NOT EXISTS avatar_source_note     text;

-- Column-level GRANT mirrors how migration 010 / 025 grant other admin-editable
-- columns. Service-role bypass remains for cron jobs that may also update.
GRANT UPDATE (
  avatar_source_url,
  avatar_source_provider,
  avatar_source_license,
  avatar_source_author,
  avatar_source_note
) ON public.idols TO authenticated;


COMMIT;


-- =============================================================================
-- REVIEW CHECKLIST
-- =============================================================================
--
--  □ Migrations 001–036 已執行。
--
--  □ 跑完後驗證 schema：
--    SELECT column_name FROM information_schema.columns
--     WHERE table_schema='public' AND table_name='idols'
--       AND column_name LIKE 'avatar_source%';
--    Expected: 5 行（url, provider, license, author, note）。
--
--  □ 既有 row 未變動：
--    SELECT count(*) FROM idols WHERE avatar_source_provider IS NOT NULL;
--    Expected: 0（全部為 NULL，等使用者重新上傳才會寫入）。
--
--  □ /admin/idols/<id>/edit 之後上傳 / AI 搜圖會自動寫 provider 與其他欄位。
--
--  □ 重跑驗證 idempotence：
--    再次執行此 migration 應為 no-op（IF NOT EXISTS）。
--
-- =============================================================================

-- =============================================================================
-- 066_event_stamps.sql
-- Idol Rhythm — F3 圖鑑「去過蓋章」
--
-- PURPOSE
--   登入使用者對「公開且已開始」的活動一鍵標記「我去過」，可再按取消。
--     public.event_stamps：一列 = 一位使用者對一個活動的蓋章。
--     PK (user_id, event_id)；user_id / event_id 皆 FK ON DELETE CASCADE。
--   私密：只有本人讀得到自己的列；沒有任何公開計數 / RPC / view。
--   模式比照 saved_events（001 表與 RLS、013 GRANT）。
--
-- SCOPE
--   - 只新增 1 張表、1 個索引、3 條 policy、GRANT/REVOKE。
--   - 不改任何既有表 / RLS / policy / GRANT；不依賴 064 / 065。
--   - 無 SECURITY DEFINER；anon / service_role 無任何權限；authenticated 無 UPDATE。
--   - INSERT 只准：本人 + 活動公開（is_published、official/media/aggregator、
--     非 cancelled，與 062 公開 RLS 一致）+ 已開始（台北日期）。
--   - 刪帳號：auth.users cascade 自動清除，不需改刪帳號流程。
--
-- IDEMPOTENT
--   CREATE TABLE / INDEX IF NOT EXISTS、DROP POLICY IF EXISTS + CREATE POLICY、
--   REVOKE + GRANT。
--
-- ROLLBACK（會刪掉所有蓋章資料；前端會自動回到「尚未開放」佔位，不必先 revert 程式）
--   BEGIN;
--   DROP TABLE IF EXISTS public.event_stamps;
--   COMMIT;
--   NOTIFY pgrst, 'reload schema';
--
-- EXECUTION
--   Dave 手動在 Chrome、Supabase 專案 rdrthazsonkefggedbjr 的 SQL Editor 執行
--   （見 repo 外貼上單 M066_貼上單_F3.md）。不要用 supabase CLI。
--   PR merge != 已套用。
--
-- DEPENDENCIES
--   auth.users、auth.uid()；public.events（含 041 的 start_date、062 的 aggregator）。
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. 表
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_stamps (
  user_id    uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  event_id   uuid        NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_stamps_pkey PRIMARY KEY (user_id, event_id)
);

COMMENT ON TABLE public.event_stamps IS
  'F3: private "I was there" stamps. One row per (user, event). Owner-only RLS; INSERT requires a published, publicly trusted, non-cancelled event that has started (Asia/Taipei date). No public counts.';

CREATE INDEX IF NOT EXISTS event_stamps_event_id_idx
  ON public.event_stamps (event_id);

-- -----------------------------------------------------------------------------
-- 2. RLS 與權限（authenticated 只有 SELECT / INSERT / DELETE）
-- -----------------------------------------------------------------------------

ALTER TABLE public.event_stamps ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.event_stamps FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, DELETE ON TABLE public.event_stamps TO authenticated;

DROP POLICY IF EXISTS "event_stamps: user read own" ON public.event_stamps;
DROP POLICY IF EXISTS "event_stamps: user insert own started public" ON public.event_stamps;
DROP POLICY IF EXISTS "event_stamps: user delete own" ON public.event_stamps;

CREATE POLICY "event_stamps: user read own"
  ON public.event_stamps FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "event_stamps: user insert own started public"
  ON public.event_stamps FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_stamps.event_id
        AND e.is_published = true
        AND e.trust_level IN ('official', 'media', 'aggregator')
        AND e.status <> 'cancelled'
        AND COALESCE(e.start_date, e.date) <= (now() AT TIME ZONE 'Asia/Taipei')::date
    )
  );

CREATE POLICY "event_stamps: user delete own"
  ON public.event_stamps FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

COMMIT;

NOTIFY pgrst, 'reload schema';

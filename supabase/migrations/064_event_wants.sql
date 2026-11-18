-- =============================================================================
-- 064_event_wants.sql
-- Idol Rhythm — F1「我想去」匿名計數
--
-- PURPOSE
--   讓登入／未登入使用者對公開活動標記「我想去」，前台只看得到彙總數。
--     1. public.event_wants：一列一票。登入存 user_id（FK cascade），
--        未登入只存 device_hash = sha256('idol-rhythm:f1:device:' || device uuid)。
--     2. public.event_want_actions：限速用短期紀錄（1 天後清掉）。
--     3. public.set_event_want()：唯一寫入路徑（SECURITY DEFINER，限速）。
--     4. public.get_event_wants()：唯一讀取路徑，只回 event_id / want_count /
--        is_wanted（呼叫者本人），不回任何明細。
--
-- SCOPE
--   - 只新增 2 張表、2 個函式、索引、GRANT/REVOKE。
--   - 不改 events 或任何既有表 / RLS / policy / GRANT。
--   - 兩張新表 RLS 開、無 policy；anon / authenticated / service_role 無任何表權限。
--   - 不存 IP、User-Agent、明文裝置 id。
--
-- RATE LIMITS（同 src/lib/eventWants.ts WANT_LIMITS）
--   同一 voter：每分鐘 10 次、每小時 60 次；同一活動未登入新增票：每 10 分鐘 60 票。
--   get_event_wants 一次最多 100 個 event id。
--   讀計數前以 pg_advisory_xact_lock 序列化（先 voter、後 event），並行請求不會超限。
--
-- IDEMPOTENT
--   CREATE TABLE / INDEX IF NOT EXISTS、CREATE OR REPLACE FUNCTION、REVOKE + GRANT。
--
-- ROLLBACK（會刪掉所有「我想去」資料；前端會自動隱藏功能，不必先 revert 程式）
--   BEGIN;
--   DROP FUNCTION IF EXISTS public.set_event_want(uuid, boolean, uuid);
--   DROP FUNCTION IF EXISTS public.get_event_wants(uuid[], uuid);
--   DROP TABLE IF EXISTS public.event_want_actions;
--   DROP TABLE IF EXISTS public.event_wants;
--   COMMIT;
--   NOTIFY pgrst, 'reload schema';
--
-- EXECUTION
--   Dave 手動在 Chrome、Supabase 專案 rdrthazsonkefggedbjr 的 SQL Editor 執行
--   （見 repo 外貼上單 M064_貼上單_F1.md）。不要用 supabase CLI。
--   PR merge ≠ 已套用。
--
-- DEPENDENCIES
--   001（events、event_status、trust_level）、062（trust_level 'aggregator'）。
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. 投票明細
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_wants (
  id          bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id    uuid        NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
  user_id     uuid        REFERENCES auth.users (id) ON DELETE CASCADE,
  device_hash bytea,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_wants_one_voter CHECK ((user_id IS NULL) <> (device_hash IS NULL)),
  CONSTRAINT event_wants_device_hash_len CHECK (device_hash IS NULL OR octet_length(device_hash) = 32)
);

COMMENT ON TABLE public.event_wants IS
  'F1: one row per want-to-go vote. Logged-in voters store user_id; anonymous voters store only sha256 of a random device uuid. Never readable by anon/authenticated; use get_event_wants().';

CREATE UNIQUE INDEX IF NOT EXISTS event_wants_event_user_uidx
  ON public.event_wants (event_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS event_wants_event_device_uidx
  ON public.event_wants (event_id, device_hash)
  WHERE device_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS event_wants_event_idx
  ON public.event_wants (event_id);

CREATE INDEX IF NOT EXISTS event_wants_user_idx
  ON public.event_wants (user_id)
  WHERE user_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. 限速紀錄（短期）
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_want_actions (
  id           bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  voter_hash   bytea       NOT NULL CHECK (octet_length(voter_hash) = 32),
  event_id     uuid        NOT NULL,
  is_anonymous boolean     NOT NULL,
  is_add       boolean     NOT NULL,
  acted_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.event_want_actions IS
  'F1: short-lived rate-limit log for set_event_want(). Rows older than 1 day are purged by the function. No plaintext user or device id.';

CREATE INDEX IF NOT EXISTS event_want_actions_voter_idx
  ON public.event_want_actions (voter_hash, acted_at DESC);

CREATE INDEX IF NOT EXISTS event_want_actions_event_anon_add_idx
  ON public.event_want_actions (event_id, acted_at DESC)
  WHERE is_anonymous AND is_add;

CREATE INDEX IF NOT EXISTS event_want_actions_acted_at_idx
  ON public.event_want_actions (acted_at);

-- -----------------------------------------------------------------------------
-- 3. RLS 開、無 policy、收回所有表權限
-- -----------------------------------------------------------------------------

ALTER TABLE public.event_wants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_want_actions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.event_wants FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.event_want_actions FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE public.event_wants_id_seq FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE public.event_want_actions_id_seq FROM PUBLIC, anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4. 寫入：set_event_want
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_event_want(
  p_event_id  uuid,
  p_want      boolean,
  p_device_id uuid DEFAULT NULL
)
RETURNS TABLE (status_code text, is_wanted boolean, want_count integer)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_uid         uuid    := auth.uid();
  v_is_anon     boolean := (auth.uid() IS NULL);
  v_device_hash bytea;
  v_voter_hash  bytea;
  v_now_wanted  boolean;
BEGIN
  IF p_event_id IS NULL OR p_want IS NULL OR (v_is_anon AND p_device_id IS NULL) THEN
    RETURN QUERY SELECT 'invalid'::text, false, 0;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.id = p_event_id
      AND e.is_published = true
      AND e.trust_level IN ('official', 'media', 'aggregator')
      AND e.status <> 'cancelled'
  ) THEN
    RETURN QUERY SELECT 'not_found'::text, false, 0;
    RETURN;
  END IF;

  IF v_is_anon THEN
    v_device_hash := pg_catalog.sha256(pg_catalog.convert_to('idol-rhythm:f1:device:' || p_device_id::text, 'UTF8'));
    v_voter_hash  := v_device_hash;
  ELSE
    v_voter_hash  := pg_catalog.sha256(pg_catalog.convert_to('idol-rhythm:f1:user:' || v_uid::text, 'UTF8'));
  END IF;

  -- 限速序列化（交易結束自動釋放）。鎖順序固定：先 voter、後 event，不會死鎖。
  --   voter：單參數 bigint 鍵空間，取 voter_hash 前 8 bytes。
  --   event：雙參數 (int4, int4) 鍵空間（與單參數鍵空間不重疊），
  --          namespace 64064 ＋ event uuid 前 32 bits；只有未登入新增票才鎖。
  PERFORM pg_catalog.pg_advisory_xact_lock(
    ('x' || pg_catalog.left(pg_catalog.encode(v_voter_hash, 'hex'), 16))::bit(64)::bigint
  );
  IF v_is_anon AND p_want THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      64064,
      ('x' || pg_catalog.left(pg_catalog.replace(p_event_id::text, '-', ''), 8))::bit(32)::integer
    );
  END IF;

  DELETE FROM public.event_want_actions a
  WHERE a.id IN (
    SELECT a2.id
    FROM public.event_want_actions a2
    WHERE a2.acted_at < pg_catalog.now() - interval '1 day'
    ORDER BY a2.acted_at
    LIMIT 200
    FOR UPDATE SKIP LOCKED
  );

  IF (SELECT pg_catalog.count(*) FROM public.event_want_actions a
        WHERE a.voter_hash = v_voter_hash
          AND a.acted_at > pg_catalog.now() - interval '1 minute') >= 10
     OR (SELECT pg_catalog.count(*) FROM public.event_want_actions a
        WHERE a.voter_hash = v_voter_hash
          AND a.acted_at > pg_catalog.now() - interval '1 hour') >= 60
     OR (v_is_anon AND p_want AND (SELECT pg_catalog.count(*) FROM public.event_want_actions a
        WHERE a.event_id = p_event_id
          AND a.is_anonymous
          AND a.is_add
          AND a.acted_at > pg_catalog.now() - interval '10 minutes') >= 60)
  THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.event_wants w
      WHERE w.event_id = p_event_id
        AND ((v_is_anon AND w.device_hash = v_device_hash)
          OR (NOT v_is_anon AND w.user_id = v_uid))
    ) INTO v_now_wanted;

    RETURN QUERY
      SELECT 'rate_limited'::text,
             v_now_wanted,
             (SELECT pg_catalog.count(*)::integer FROM public.event_wants w WHERE w.event_id = p_event_id);
    RETURN;
  END IF;

  INSERT INTO public.event_want_actions (voter_hash, event_id, is_anonymous, is_add)
  VALUES (v_voter_hash, p_event_id, v_is_anon, p_want);

  IF p_want THEN
    IF v_is_anon THEN
      INSERT INTO public.event_wants (event_id, device_hash)
      VALUES (p_event_id, v_device_hash)
      ON CONFLICT (event_id, device_hash) WHERE device_hash IS NOT NULL DO NOTHING;
    ELSE
      INSERT INTO public.event_wants (event_id, user_id)
      VALUES (p_event_id, v_uid)
      ON CONFLICT (event_id, user_id) WHERE user_id IS NOT NULL DO NOTHING;
    END IF;
  ELSE
    DELETE FROM public.event_wants w
    WHERE w.event_id = p_event_id
      AND ((v_is_anon AND w.device_hash = v_device_hash)
        OR (NOT v_is_anon AND w.user_id = v_uid));
  END IF;

  RETURN QUERY
    SELECT 'ok'::text,
           p_want,
           (SELECT pg_catalog.count(*)::integer FROM public.event_wants w WHERE w.event_id = p_event_id);
END;
$fn$;

COMMENT ON FUNCTION public.set_event_want(uuid, boolean, uuid) IS
  'F1: set (not flip) the caller''s want-to-go vote. Logged-in uses auth.uid() and ignores p_device_id. status_code: ok | rate_limited | not_found | invalid.';

-- -----------------------------------------------------------------------------
-- 5. 讀取：get_event_wants（只回彙總數＋呼叫者本人是否已投）
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_event_wants(
  p_event_ids uuid[],
  p_device_id uuid DEFAULT NULL
)
RETURNS TABLE (event_id uuid, want_count integer, is_wanted boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  WITH ids AS (
    SELECT DISTINCT u.id
    FROM pg_catalog.unnest(p_event_ids) AS u(id)
    WHERE pg_catalog.cardinality(p_event_ids) <= 100
      AND u.id IS NOT NULL
  ),
  voter AS (
    SELECT auth.uid() AS uid,
           CASE
             WHEN auth.uid() IS NULL AND p_device_id IS NOT NULL
               THEN pg_catalog.sha256(pg_catalog.convert_to('idol-rhythm:f1:device:' || p_device_id::text, 'UTF8'))
           END AS device_hash
  )
  SELECT e.id,
         (SELECT pg_catalog.count(*)::integer FROM public.event_wants w WHERE w.event_id = e.id),
         EXISTS (
           SELECT 1
           FROM public.event_wants w, voter v
           WHERE w.event_id = e.id
             AND ((v.uid IS NOT NULL AND w.user_id = v.uid)
               OR (v.device_hash IS NOT NULL AND w.device_hash = v.device_hash))
         )
  FROM ids
  JOIN public.events e ON e.id = ids.id
  WHERE e.is_published = true
    AND e.trust_level IN ('official', 'media', 'aggregator')
    AND e.status <> 'cancelled';
$fn$;

COMMENT ON FUNCTION public.get_event_wants(uuid[], uuid) IS
  'F1: aggregate want-to-go counts for up to 100 public events, plus whether the caller (auth.uid() or hashed device) has voted. Never returns other voters.';

-- -----------------------------------------------------------------------------
-- 6. 函式權限：只給 anon / authenticated 執行
-- -----------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.set_event_want(uuid, boolean, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_event_wants(uuid[], uuid) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.set_event_want(uuid, boolean, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_wants(uuid[], uuid) TO anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- 065_fan_wishes.sql
-- Idol Rhythm — F2 許願表單（請加某團／某城市）
--
-- PURPOSE
--   讓登入／未登入使用者送出「請加這個團」或「請加這個城市」。
--     1. public.fan_wishes：一列一願。kind ∈ add_group / add_city；只存正規化名稱。
--        登入存 user_id（FK cascade），未登入只存
--        device_hash = sha256('idol-rhythm:f2:device:' || device uuid)。
--     2. public.fan_wish_actions：限速用短期紀錄（1 天後清掉，不存名稱）。
--     3. public.fan_wish_normalize_name()：名稱正規化與驗證（不授權給 API 角色）。
--     4. public.submit_fan_wish()：唯一寫入路徑（SECURITY DEFINER，限速、去重）。
--     5. public.fan_wishes_enabled()：無資料探測，前端用來判斷本 migration 是否已套用。
--   前台沒有任何讀取路徑；Dave 在 SQL Editor 用唯讀 SELECT 看結果。
--
-- SCOPE
--   - 只新增 2 張表、3 個函式、索引、GRANT/REVOKE。
--   - 不改任何既有表 / RLS / policy / GRANT；不依賴 064。
--   - 兩張新表 RLS 開、無 policy；anon / authenticated / service_role 無任何表權限。
--   - 不存 IP、User-Agent、email、明文裝置 id、原文名稱、留言。
--
-- RATE LIMITS（同 src/lib/fanWishes.ts WISH_LIMITS）
--   同一 requester：每分鐘 5 次、每天 20 次（含重複送出）；全站未登入：每 10 分鐘 100 次。
--   讀計數前以 pg_advisory_xact_lock 序列化（先 requester、後全站匿名鍵），並行請求不會超限。
--
-- IDEMPOTENT
--   CREATE TABLE / INDEX IF NOT EXISTS、CREATE OR REPLACE FUNCTION、REVOKE + GRANT。
--
-- ROLLBACK（會刪掉所有許願資料；前端會自動隱藏表單，不必先 revert 程式）
--   BEGIN;
--   DROP FUNCTION IF EXISTS public.submit_fan_wish(text, text, uuid);
--   DROP FUNCTION IF EXISTS public.fan_wishes_enabled();
--   DROP FUNCTION IF EXISTS public.fan_wish_normalize_name(text);
--   DROP TABLE IF EXISTS public.fan_wish_actions;
--   DROP TABLE IF EXISTS public.fan_wishes;
--   COMMIT;
--   NOTIFY pgrst, 'reload schema';
--
-- EXECUTION
--   Dave 手動在 Chrome、Supabase 專案 rdrthazsonkefggedbjr 的 SQL Editor 執行
--   （見 repo 外貼上單 M065_貼上單_F2.md）。不要用 supabase CLI。
--   PR merge ≠ 已套用。
--
-- DEPENDENCIES
--   auth.users、auth.uid()；PG 13+（normalize）、UTF8 資料庫。不依賴 064。
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. 許願明細
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.fan_wishes (
  id          bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind        text        NOT NULL CHECK (kind IN ('add_group', 'add_city')),
  name_norm   text        NOT NULL CHECK (pg_catalog.char_length(name_norm) BETWEEN 1 AND 40),
  user_id     uuid        REFERENCES auth.users (id) ON DELETE CASCADE,
  device_hash bytea,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fan_wishes_one_requester CHECK ((user_id IS NULL) <> (device_hash IS NULL)),
  CONSTRAINT fan_wishes_device_hash_len CHECK (device_hash IS NULL OR octet_length(device_hash) = 32)
);

COMMENT ON TABLE public.fan_wishes IS
  'F2: one row per (requester, kind, normalized name) wish. Logged-in requesters store user_id; anonymous requesters store only sha256 of a random device uuid. Never readable by anon/authenticated/service_role; write via submit_fan_wish().';

CREATE UNIQUE INDEX IF NOT EXISTS fan_wishes_kind_name_user_uidx
  ON public.fan_wishes (kind, name_norm, user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS fan_wishes_kind_name_device_uidx
  ON public.fan_wishes (kind, name_norm, device_hash)
  WHERE device_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS fan_wishes_kind_name_idx
  ON public.fan_wishes (kind, name_norm);

CREATE INDEX IF NOT EXISTS fan_wishes_user_idx
  ON public.fan_wishes (user_id)
  WHERE user_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. 限速紀錄（短期，不存名稱）
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.fan_wish_actions (
  id             bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  requester_hash bytea       NOT NULL CHECK (octet_length(requester_hash) = 32),
  is_anonymous   boolean     NOT NULL,
  acted_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.fan_wish_actions IS
  'F2: short-lived rate-limit log for submit_fan_wish(). Rows older than 1 day are purged by the function. No plaintext user/device id, no wish content.';

CREATE INDEX IF NOT EXISTS fan_wish_actions_requester_idx
  ON public.fan_wish_actions (requester_hash, acted_at DESC);

CREATE INDEX IF NOT EXISTS fan_wish_actions_anon_idx
  ON public.fan_wish_actions (acted_at DESC)
  WHERE is_anonymous;

CREATE INDEX IF NOT EXISTS fan_wish_actions_acted_at_idx
  ON public.fan_wish_actions (acted_at);

-- -----------------------------------------------------------------------------
-- 3. RLS 開、無 policy、收回所有表權限
-- -----------------------------------------------------------------------------

ALTER TABLE public.fan_wishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fan_wish_actions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.fan_wishes FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.fan_wish_actions FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE public.fan_wishes_id_seq FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE public.fan_wish_actions_id_seq FROM PUBLIC, anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4. 名稱正規化與驗證（不合格回 NULL）
--    原文 >200 字或含控制／零寬／雙向控制字元 → NULL；
--    NFKC → lower → 壓空白 → 去頭尾；結果須 1–40 字；像網址 / 帳號 / HTML → NULL。
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fan_wish_normalize_name(p_raw text)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $fn$
DECLARE
  v text;
BEGIN
  IF p_raw IS NULL OR pg_catalog.char_length(p_raw) > 200 THEN
    RETURN NULL;
  END IF;

  IF p_raw ~ '[\u0001-\u001F\u007F-\u009F\u00AD\u200B-\u200F\u2028-\u202E\u2060-\u2064\uFEFF]' THEN
    RETURN NULL;
  END IF;

  v := pg_catalog.normalize(p_raw, 'NFKC');
  v := pg_catalog.lower(v);
  v := pg_catalog.btrim(pg_catalog.regexp_replace(v, '[[:space:]]+', ' ', 'g'));

  IF pg_catalog.char_length(v) < 1 OR pg_catalog.char_length(v) > 40 THEN
    RETURN NULL;
  END IF;

  IF v ~ '(://|www\.|https?:|@|<|>|\.(com|net|org|io|me|tv|kr|jp|tw|cn|hk|ly|gg|co|app|xyz|link|site|shop)([/?#[:space:]]|$))' THEN
    RETURN NULL;
  END IF;

  RETURN v;
END;
$fn$;

COMMENT ON FUNCTION public.fan_wish_normalize_name(text) IS
  'F2: normalize a wish name (NFKC, lower, collapse spaces, trim) and reject control chars, URLs, handles, HTML, empty or >40 chars. Returns NULL when invalid. Not granted to API roles.';

-- -----------------------------------------------------------------------------
-- 5. 寫入：submit_fan_wish
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.submit_fan_wish(
  p_kind      text,
  p_name      text,
  p_device_id uuid DEFAULT NULL
)
RETURNS TABLE (status_code text, wish_name text)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_uid            uuid    := auth.uid();
  v_is_anon        boolean := (auth.uid() IS NULL);
  v_name           text;
  v_device_hash    bytea;
  v_requester_hash bytea;
  v_inserted       integer;
BEGIN
  IF p_kind IS NULL OR p_kind NOT IN ('add_group', 'add_city') OR (v_is_anon AND p_device_id IS NULL) THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::text;
    RETURN;
  END IF;

  v_name := public.fan_wish_normalize_name(p_name);
  IF v_name IS NULL THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::text;
    RETURN;
  END IF;

  IF v_is_anon THEN
    v_device_hash    := pg_catalog.sha256(pg_catalog.convert_to('idol-rhythm:f2:device:' || p_device_id::text, 'UTF8'));
    v_requester_hash := v_device_hash;
  ELSE
    v_requester_hash := pg_catalog.sha256(pg_catalog.convert_to('idol-rhythm:f2:user:' || v_uid::text, 'UTF8'));
  END IF;

  -- 限速序列化（交易結束自動釋放）。鎖順序固定：先 requester、後全站匿名鍵，不會死鎖。
  --   requester：單參數 bigint 鍵空間，取 requester_hash 前 8 bytes。
  --   全站匿名：雙參數 (int4, int4) 鍵空間 (65065, 0)，與單參數鍵空間不重疊；只有未登入才鎖。
  PERFORM pg_catalog.pg_advisory_xact_lock(
    ('x' || pg_catalog.left(pg_catalog.encode(v_requester_hash, 'hex'), 16))::bit(64)::bigint
  );
  IF v_is_anon THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(65065, 0);
  END IF;

  DELETE FROM public.fan_wish_actions a
  WHERE a.id IN (
    SELECT a2.id
    FROM public.fan_wish_actions a2
    WHERE a2.acted_at < pg_catalog.now() - interval '1 day'
    ORDER BY a2.acted_at
    LIMIT 200
    FOR UPDATE SKIP LOCKED
  );

  IF (SELECT pg_catalog.count(*) FROM public.fan_wish_actions a
        WHERE a.requester_hash = v_requester_hash
          AND a.acted_at > pg_catalog.now() - interval '1 minute') >= 5
     OR (SELECT pg_catalog.count(*) FROM public.fan_wish_actions a
        WHERE a.requester_hash = v_requester_hash
          AND a.acted_at > pg_catalog.now() - interval '1 day') >= 20
     OR (v_is_anon AND (SELECT pg_catalog.count(*) FROM public.fan_wish_actions a
        WHERE a.is_anonymous
          AND a.acted_at > pg_catalog.now() - interval '10 minutes') >= 100)
  THEN
    RETURN QUERY SELECT 'rate_limited'::text, v_name;
    RETURN;
  END IF;

  INSERT INTO public.fan_wish_actions (requester_hash, is_anonymous)
  VALUES (v_requester_hash, v_is_anon);

  IF v_is_anon THEN
    INSERT INTO public.fan_wishes (kind, name_norm, device_hash)
    VALUES (p_kind, v_name, v_device_hash)
    ON CONFLICT (kind, name_norm, device_hash) WHERE device_hash IS NOT NULL DO NOTHING;
  ELSE
    INSERT INTO public.fan_wishes (kind, name_norm, user_id)
    VALUES (p_kind, v_name, v_uid)
    ON CONFLICT (kind, name_norm, user_id) WHERE user_id IS NOT NULL DO NOTHING;
  END IF;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RETURN QUERY
    SELECT (CASE WHEN v_inserted = 1 THEN 'ok' ELSE 'duplicate' END)::text, v_name;
END;
$fn$;

COMMENT ON FUNCTION public.submit_fan_wish(text, text, uuid) IS
  'F2: submit a wish (add_group / add_city). Logged-in uses auth.uid() and ignores p_device_id. status_code: ok | duplicate | rate_limited | invalid. wish_name is the caller''s own normalized name; never returns other requesters or counts.';

-- -----------------------------------------------------------------------------
-- 6. 探測：fan_wishes_enabled（不碰任何表）
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fan_wishes_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $fn$
  SELECT true;
$fn$;

COMMENT ON FUNCTION public.fan_wishes_enabled() IS
  'F2: returns true when migration 065 is applied. Touches no table; used by the frontend to decide whether to show the wish form.';

-- -----------------------------------------------------------------------------
-- 7. 函式權限：submit / enabled 只給 anon / authenticated；normalize 不授權
-- -----------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.fan_wish_normalize_name(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.submit_fan_wish(text, text, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.fan_wishes_enabled() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.submit_fan_wish(text, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fan_wishes_enabled() TO anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

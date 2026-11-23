-- =============================================================================
-- 071_event_error_reports.sql
-- Idol Rhythm — MUST9 活動錯誤回報
--
-- PURPOSE
--   讓前台使用者回報公開活動的錯誤，由管理員唯讀查閱。
--
-- SCOPE
--   新增 2 張表、3 個函式及索引、RLS 與權限。回報僅經 RPC 寫入，
--   匿名裝置識別碼只存雜湊。限速表只存短期限速資料。
--
-- RATE LIMITS
--   同一 requester 每分鐘 3 次、每天 20 次（含重複送出）。
--   全站匿名每 10 分鐘 100 次。先鎖 requester，再鎖全站匿名鍵。
--   RPC 分批清理超過一天的限速紀錄。
--
-- IDEMPOTENT
--   CREATE TABLE / INDEX IF NOT EXISTS、CREATE OR REPLACE FUNCTION、
--   DROP POLICY IF EXISTS 後重新建立，並重新設定權限。
--
-- ROLLBACK（會刪除回報資料，前台探測失敗時會隱藏按鈕）
--   BEGIN;
--   DROP FUNCTION IF EXISTS public.submit_event_error_report(uuid, text, text, uuid);
--   DROP FUNCTION IF EXISTS public.event_error_reports_enabled();
--   DROP FUNCTION IF EXISTS public.event_error_report_normalize_note(text);
--   DROP TABLE IF EXISTS public.event_error_report_actions;
--   DROP TABLE IF EXISTS public.event_error_reports;
--   COMMIT;
--   NOTIFY pgrst, 'reload schema';
--
-- EXECUTION
--   Dave 合併前在 Supabase SQL Editor 手動執行貼上單 M078。
--
-- DEPENDENCIES
--   public.events、public.admin_users、auth.users、auth.uid()、
--   PostgreSQL 13+ 與 UTF8 資料庫。
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.event_error_reports (
  id          bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id    uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  reason      text        NOT NULL CHECK (reason IN ('date', 'time', 'venue', 'ticket', 'source', 'cancelled', 'other')),
  note        text        CHECK (note IS NULL OR pg_catalog.char_length(note) BETWEEN 1 AND 200),
  user_id     uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  device_hash bytea       CHECK (device_hash IS NULL OR octet_length(device_hash) = 32),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_error_reports_one_requester CHECK ((user_id IS NULL) <> (device_hash IS NULL))
);

COMMENT ON TABLE public.event_error_reports IS
  'MUST9: one report per (requester, event, reason). Logged-in requesters store user_id; anonymous requesters store only a SHA-256 device hash. Active admins can read report details; write via submit_event_error_report().';

CREATE UNIQUE INDEX IF NOT EXISTS event_error_reports_user_uidx
  ON public.event_error_reports (event_id, reason, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS event_error_reports_device_uidx
  ON public.event_error_reports (event_id, reason, device_hash) WHERE device_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS event_error_reports_created_at_idx
  ON public.event_error_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS event_error_reports_event_id_idx
  ON public.event_error_reports (event_id);

CREATE TABLE IF NOT EXISTS public.event_error_report_actions (
  id             bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  requester_hash bytea       NOT NULL CHECK (octet_length(requester_hash) = 32),
  is_anonymous   boolean     NOT NULL,
  acted_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.event_error_report_actions IS
  'MUST9: short-lived rate-limit log for submit_event_error_report(). Rows older than 1 day are purged by the function. No plaintext user/device id, no report content.';

CREATE INDEX IF NOT EXISTS event_error_report_actions_requester_idx
  ON public.event_error_report_actions (requester_hash, acted_at DESC);

CREATE INDEX IF NOT EXISTS event_error_report_actions_anon_idx
  ON public.event_error_report_actions (acted_at DESC)
  WHERE is_anonymous;

CREATE INDEX IF NOT EXISTS event_error_report_actions_acted_at_idx
  ON public.event_error_report_actions (acted_at);

ALTER TABLE public.event_error_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_error_report_actions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.event_error_reports FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.event_error_report_actions FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE public.event_error_reports_id_seq FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE public.event_error_report_actions_id_seq FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT (id, event_id, reason, note, created_at) ON public.event_error_reports TO authenticated;

DROP POLICY IF EXISTS "event_error_reports: admin_users select" ON public.event_error_reports;
CREATE POLICY "event_error_reports: admin_users select" ON public.event_error_reports
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.admin_users
      WHERE admin_users.user_id = (SELECT auth.uid())
        AND admin_users.is_active = true
    )
  );

-- ok = true 與 note = NULL 表示未填備註。
CREATE OR REPLACE FUNCTION public.event_error_report_normalize_note(p_raw text)
RETURNS TABLE (ok boolean, note text)
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $fn$
DECLARE
  v_note text;
BEGIN
  IF pg_catalog.char_length(p_raw) > 400
     OR p_raw ~ '[\u0001-\u001F\u007F-\u009F\u00AD\u061C\u180E\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF]' THEN
    RETURN QUERY SELECT false, NULL::text;
    RETURN;
  END IF;

  -- NFKC 已將其餘允許的 Unicode 空白轉成 ASCII 空格。
  v_note := pg_catalog.btrim(pg_catalog.regexp_replace(
    pg_catalog.normalize(p_raw, 'NFKC'), '[ \u1680]+', ' ', 'g'
  ));

  IF pg_catalog.char_length(v_note) > 200
     OR v_note ~* '(://|www\.|https?:|@|<|>|\.(com|net|org|io|me|tv|kr|jp|tw|cn|hk|ly|gg|co|app|xyz|link|site|shop)([/?# ]|$))' THEN
    RETURN QUERY SELECT false, NULL::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, NULLIF(v_note, '');
END;
$fn$;

COMMENT ON FUNCTION public.event_error_report_normalize_note(text) IS
  'MUST9: normalize an optional report note (NFKC, collapse spaces, trim) and reject control chars, URLs, handles, HTML, or notes longer than 200 chars after normalization. Returns ok and the normalized note.';

CREATE OR REPLACE FUNCTION public.submit_event_error_report(
  p_event_id uuid,
  p_reason text,
  p_note text DEFAULT NULL,
  p_device_id uuid DEFAULT NULL
)
RETURNS TABLE (status_code text)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_uid            uuid    := auth.uid();
  v_is_anon        boolean := (v_uid IS NULL);
  v_note_valid     boolean;
  v_note           text;
  v_device_hash    bytea;
  v_requester_hash bytea;
  v_now            timestamptz;
  v_inserted       integer;
BEGIN
  IF p_reason IS NULL OR p_reason NOT IN ('date', 'time', 'venue', 'ticket', 'source', 'cancelled', 'other')
     OR (v_is_anon AND p_device_id IS NULL) THEN
    RETURN QUERY SELECT 'invalid'::text;
    RETURN;
  END IF;

  SELECT n.ok, n.note INTO v_note_valid, v_note
  FROM public.event_error_report_normalize_note(p_note) n;
  IF NOT v_note_valid THEN
    RETURN QUERY SELECT 'invalid'::text;
    RETURN;
  END IF;

  PERFORM 1 FROM public.events e
  WHERE e.id = p_event_id
    AND e.is_published = true
    AND e.trust_level IN ('official', 'media', 'aggregator')
    AND e.status <> 'cancelled'
  FOR KEY SHARE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'invalid'::text;
    RETURN;
  END IF;

  IF v_is_anon THEN
    v_device_hash := pg_catalog.sha256(pg_catalog.convert_to('idol-rhythm:m9:device:' || p_device_id::text, 'UTF8'));
    v_requester_hash := v_device_hash;
  ELSE
    v_requester_hash := pg_catalog.sha256(pg_catalog.convert_to('idol-rhythm:m9:user:' || v_uid::text, 'UTF8'));
  END IF;

  -- 限速序列化（交易結束自動釋放）。鎖順序固定：先 requester、後全站匿名鍵，不會死鎖。
  --   requester：單參數 bigint 鍵空間，取 requester_hash 前 8 bytes。
  --   全站匿名：雙參數 (int4, int4) 鍵空間 (65078, 0)，與單參數鍵空間不重疊；只有未登入才鎖。
  PERFORM pg_catalog.pg_advisory_xact_lock(
    ('x' || pg_catalog.left(pg_catalog.encode(v_requester_hash, 'hex'), 16))::bit(64)::bigint
  );
  IF v_is_anon THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(65078, 0);
  END IF;

  v_now := pg_catalog.clock_timestamp();

  DELETE FROM public.event_error_report_actions a
  WHERE a.id IN (
    SELECT a2.id
    FROM public.event_error_report_actions a2
    WHERE a2.acted_at < v_now - interval '1 day'
    ORDER BY a2.acted_at
    LIMIT 200
    FOR UPDATE SKIP LOCKED
  );

  IF (SELECT pg_catalog.count(*) FROM public.event_error_report_actions a
        WHERE a.requester_hash = v_requester_hash
          AND a.acted_at > v_now - interval '1 minute') >= 3
     OR (SELECT pg_catalog.count(*) FROM public.event_error_report_actions a
        WHERE a.requester_hash = v_requester_hash
          AND a.acted_at > v_now - interval '1 day') >= 20
     OR (v_is_anon AND (SELECT pg_catalog.count(*) FROM public.event_error_report_actions a
        WHERE a.is_anonymous
          AND a.acted_at > v_now - interval '10 minutes') >= 100)
  THEN
    RETURN QUERY SELECT 'rate_limited'::text;
    RETURN;
  END IF;

  INSERT INTO public.event_error_report_actions (requester_hash, is_anonymous, acted_at)
  VALUES (v_requester_hash, v_is_anon, v_now);

  INSERT INTO public.event_error_reports (event_id, reason, note, user_id, device_hash)
  VALUES (p_event_id, p_reason, v_note, v_uid, v_device_hash)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RETURN QUERY SELECT (CASE WHEN v_inserted = 1 THEN 'ok' ELSE 'duplicate' END)::text;
END;
$fn$;

COMMENT ON FUNCTION public.submit_event_error_report(uuid, text, text, uuid) IS
  'MUST9: submit a report for a publicly visible event. Requesters use auth.uid() when logged in or a device UUID when anonymous. status_code: ok | duplicate | rate_limited | invalid.';

CREATE OR REPLACE FUNCTION public.event_error_reports_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $fn$
  SELECT true;
$fn$;

COMMENT ON FUNCTION public.event_error_reports_enabled() IS
  'MUST9: returns true when migration 071 is applied. Touches no table; used by the frontend to decide whether to show the report form.';

REVOKE ALL ON FUNCTION public.event_error_report_normalize_note(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.submit_event_error_report(uuid, text, text, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.event_error_reports_enabled() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.submit_event_error_report(uuid, text, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_error_reports_enabled() TO anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

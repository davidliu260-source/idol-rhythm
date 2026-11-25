-- =============================================================================
-- 073_t35_ticket_sales_country_time_status.sql
-- Idol Rhythm — T35 售票階段、國家代碼、時間狀態（＋T35b 多藝人關聯表的結構）
--
-- 做什麼
--   1. events 加兩欄：
--        country_code text（ISO 兩碼大寫或 NULL）
--        time_status  text NOT NULL DEFAULT 'unknown'（unknown / announced / tba）
--      並把既有 country 中文名回填成代碼：台灣→TW、香港→HK、新加坡→SG、
--      馬來西亞→MY、日本→JP、韓國→KR。只填 country_code IS NULL 的列，其他留 NULL。
--   2. 新表 public.event_ticket_sales：一場活動可有多個售票階段
--      （UNIQUE (event_id, stage, label)，貼上單 M084 可重跑）。
--   3. 新表 public.event_artists：一場活動連結多位藝人（T35b 才會被程式讀寫）。
--      既有活動各回填一列 headliner；events 上加 trigger，新增或改 idol_id 時
--      自動維持 (event_id, idol_id, 'headliner') 那一列。
--   4. 兩張新表的 RLS 與權限（做法同 event_sources）：
--        anon／authenticated：只能讀「所屬活動已發布且為公開信任等級」的列
--        active admin_users：可讀寫刪全部
--        service_role：event_ticket_sales SELECT／INSERT（自動上架帶入場館開賣時間）
--                      event_artists     SELECT／INSERT（T35b 通知與自動上架預留）
--      另外補 events 兩個新欄位的欄位級 UPDATE 權限給 authenticated（後台編輯用；
--      events 的 UPDATE 一直是逐欄授權，見 006／007／041）。
--
-- 不做什麼
--   - 不改、不刪 events 既有欄位（country／country_flag／ticket_url／time 都保留）。
--   - 不會從 ticket_url 自動產生售票階段列（避免造假精度）。
--   - platform 不加 CHECK（新平台不用動資料庫，由 src/lib/ticketPlatforms.ts 驗證）。
--   - 不加「同藝人同日同城」唯一索引（多藝人同台、同日雙場會誤傷）。
--   - 不寫任何售票資料（那是貼上單 M084）；不搬多藝人資料（T35b 另出貼上單）。
--   - 不動 event_sources、event_candidates、通知、ICS 相關的表與權限。
--
-- 副作用（請知悉）
--   - 回填 country_code 會觸發 trg_events_updated_at，被回填的活動 updated_at 會變成
--     執行當下；前台「資料最後更新」會顯示執行日。
--
-- 前置條件
--   - 001（events、idols、set_updated_at()）、002（admin_users）、062（公開信任等級含
--     aggregator）已執行。
--   - 在 Supabase SQL Editor 以 postgres 身分整份貼上執行（貼上單 M082）。
--   - **必須先跑本檔，再部署 T35 的程式**：自動上架新增活動時會寫 country_code／
--     time_status，後台存檔也會寫這兩欄；欄位不存在會整筆失敗。
--
-- 可重跑
--   ADD COLUMN IF NOT EXISTS、DROP CONSTRAINT IF EXISTS 後再 ADD、CREATE TABLE／INDEX
--   IF NOT EXISTS、DROP POLICY／TRIGGER IF EXISTS 後再建、回填用 IS NULL 條件與
--   ON CONFLICT DO NOTHING。
--
-- 回滾 SQL（會刪掉所有售票階段與多藝人關聯資料；程式需先退回 T35 之前的版本）
--   BEGIN;
--   DROP TRIGGER IF EXISTS trg_events_sync_headliner_artist ON public.events;
--   DROP FUNCTION IF EXISTS public.t35_sync_event_headliner_artist();
--   DROP TABLE IF EXISTS public.event_artists;
--   DROP TABLE IF EXISTS public.event_ticket_sales;
--   REVOKE UPDATE (country_code, time_status) ON public.events FROM authenticated;
--   ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_country_code_chk;
--   ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_time_status_chk;
--   ALTER TABLE public.events DROP COLUMN IF EXISTS country_code;
--   ALTER TABLE public.events DROP COLUMN IF EXISTS time_status;
--   COMMIT;
--   NOTIFY pgrst, 'reload schema';
--
-- 匿名讀測試 SQL（整段在 BEGIN…ROLLBACK 內，不留任何資料）
--   BEGIN;
--   -- 各挑一場已發布、一場未發布的活動，各塞一列測試售票階段
--   INSERT INTO public.event_ticket_sales (event_id, stage, label)
--   SELECT id, 'other', '__t35_anon_test_published__' FROM public.events
--   WHERE is_published = true AND trust_level IN ('official', 'media', 'aggregator')
--     AND status <> 'cancelled' LIMIT 1;
--   INSERT INTO public.event_ticket_sales (event_id, stage, label)
--   SELECT id, 'other', '__t35_anon_test_draft__' FROM public.events
--   WHERE is_published = false LIMIT 1;
--   SET LOCAL ROLE anon;
--   -- 預期：published = 1、draft = 0
--   SELECT
--     count(*) FILTER (WHERE label = '__t35_anon_test_published__') AS published,
--     count(*) FILTER (WHERE label = '__t35_anon_test_draft__')     AS draft
--   FROM public.event_ticket_sales
--   WHERE label LIKE '\_\_t35\_anon\_test\_%';
--   -- 預期：匿名寫入被擋（permission denied）。這行會讓交易中止，請單獨測或最後再跑。
--   -- INSERT INTO public.event_ticket_sales (event_id, stage, label)
--   --   SELECT id, 'other', '__t35_anon_write__' FROM public.events LIMIT 1;
--   RESET ROLE;
--   ROLLBACK;
--
-- 執行後核對
--   SELECT country, country_code, count(*) FROM public.events GROUP BY 1, 2 ORDER BY 3 DESC;
--   -- 預期：country = '台灣' 的列 country_code 全為 'TW'
--   SELECT count(*) FROM public.events e
--   WHERE NOT EXISTS (SELECT 1 FROM public.event_artists a
--                     WHERE a.event_id = e.id AND a.idol_id = e.idol_id AND a.role = 'headliner');
--   -- 預期：0
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. events：country_code、time_status
-- ---------------------------------------------------------------------------
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS time_status  text NOT NULL DEFAULT 'unknown';

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_country_code_chk;
ALTER TABLE public.events
  ADD CONSTRAINT events_country_code_chk
  CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$');

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_time_status_chk;
ALTER TABLE public.events
  ADD CONSTRAINT events_time_status_chk
  CHECK (time_status IN ('unknown', 'announced', 'tba'));

COMMENT ON COLUMN public.events.country_code IS
  'T35: ISO 3166-1 兩碼大寫（TW/HK/SG/MY/JP/KR…）。NULL = 尚未判斷。country／country_flag 由程式依此欄補齊（src/lib/regions.ts）。';
COMMENT ON COLUMN public.events.time_status IS
  'T35: unknown = 我們還沒查到開演時間；announced = 有明確開演時間（見 time）；tba = 官方明說尚未公布。';

-- 回填：只填還沒有代碼的列，對不到的國家名留 NULL（不猜）。
UPDATE public.events
SET country_code = CASE country
  WHEN '台灣'     THEN 'TW'
  WHEN '香港'     THEN 'HK'
  WHEN '新加坡'   THEN 'SG'
  WHEN '馬來西亞' THEN 'MY'
  WHEN '日本'     THEN 'JP'
  WHEN '韓國'     THEN 'KR'
END
WHERE country_code IS NULL
  AND country IN ('台灣', '香港', '新加坡', '馬來西亞', '日本', '韓國');

-- 後台編輯草稿要能寫這兩欄（events 的 UPDATE 是逐欄授權）。
GRANT UPDATE (country_code, time_status) ON public.events TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. event_ticket_sales：售票階段
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_ticket_sales (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  stage                 text        NOT NULL
                        CHECK (stage IN ('presale', 'general', 'added', 'apply', 'other')),
  label                 text        NOT NULL,
  starts_at             timestamptz,
  ends_at               timestamptz,
  platform              text,
  url                   text,
  eligibility           text        NOT NULL DEFAULT 'public'
                        CHECK (eligibility IN ('public', 'fanclub_member', 'promoter_member', 'telco_member', 'card_or_sponsor', 'partner_platform', 'registration_required', 'lottery')),
  eligibility_note      text,
  requires_verification text
                        CHECK (requires_verification IN ('phone_sms', 'real_name', 'member_login', 'other')),
  source_url            text,
  verified_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_ticket_sales_event_stage_label_key UNIQUE (event_id, stage, label)
);

COMMENT ON TABLE public.event_ticket_sales IS
  'T35: 一場活動的售票／報名階段（預購、一般開賣、加場、報名抽選…）。starts_at／ends_at 為絕對時間，前台一律以台北時間顯示。不會從 events.ticket_url 自動產生。';
COMMENT ON COLUMN public.event_ticket_sales.stage IS
  'presale 預購｜general 一般開賣｜added 加場加售｜apply 報名／抽選／預購申請｜other 其他';
COMMENT ON COLUMN public.event_ticket_sales.platform IS
  '小寫平台代碼（tixcraft、kktix、ibon、era、kham、ticketplus、klook、weverse…、other）。不加 CHECK，由 src/lib/ticketPlatforms.ts 驗證。';
COMMENT ON COLUMN public.event_ticket_sales.eligibility IS
  'public 公開｜fanclub_member 官方粉絲會員｜promoter_member 主辦會員｜telco_member 電信會員｜card_or_sponsor 信用卡或贊助商｜partner_platform 合作平台｜registration_required 須先登記｜lottery 抽選';
COMMENT ON COLUMN public.event_ticket_sales.requires_verification IS
  '買票前要先做的事：phone_sms 手機驗證｜real_name 實名制｜member_login 會員登入｜other。只在來源明講時才填。';
COMMENT ON COLUMN public.event_ticket_sales.verified_at IS
  '最後一次人工或程式核對時間。';

CREATE INDEX IF NOT EXISTS event_ticket_sales_event_id_idx
  ON public.event_ticket_sales (event_id);
CREATE INDEX IF NOT EXISTS event_ticket_sales_starts_at_idx
  ON public.event_ticket_sales (starts_at);

-- 沿用 001 的共用函式 public.set_updated_at()。
DROP TRIGGER IF EXISTS trg_event_ticket_sales_updated_at ON public.event_ticket_sales;
CREATE TRIGGER trg_event_ticket_sales_updated_at
  BEFORE UPDATE ON public.event_ticket_sales
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.event_ticket_sales ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.event_ticket_sales FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.event_ticket_sales TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_ticket_sales TO authenticated;
GRANT SELECT, INSERT ON public.event_ticket_sales TO service_role;

DROP POLICY IF EXISTS "event_ticket_sales: public read via published events" ON public.event_ticket_sales;
CREATE POLICY "event_ticket_sales: public read via published events"
  ON public.event_ticket_sales FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_ticket_sales.event_id
        AND e.is_published = true
        AND e.trust_level IN ('official', 'media', 'aggregator')
    )
  );

DROP POLICY IF EXISTS "event_ticket_sales: admin_users all" ON public.event_ticket_sales;
CREATE POLICY "event_ticket_sales: admin_users all"
  ON public.event_ticket_sales FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = (SELECT auth.uid())
        AND admin_users.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = (SELECT auth.uid())
        AND admin_users.is_active = true
    )
  );

-- ---------------------------------------------------------------------------
-- 3. event_artists：一場活動連結多位藝人（T35b 才接程式；本檔只建結構與回填）
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_artists (
  event_id   uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  idol_id    uuid        NOT NULL REFERENCES public.idols(id)  ON DELETE CASCADE,
  role       text        NOT NULL DEFAULT 'participant'
             CHECK (role IN ('headliner', 'participant')),
  sort_order int,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, idol_id)
);

COMMENT ON TABLE public.event_artists IS
  'T35/T35b: 活動↔藝人關聯。events.idol_id 仍是主秀，並由 trigger 維持一列 role = headliner；其他同台藝人為 participant。';

CREATE INDEX IF NOT EXISTS event_artists_idol_event_idx
  ON public.event_artists (idol_id, event_id);

ALTER TABLE public.event_artists ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.event_artists FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.event_artists TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_artists TO authenticated;
GRANT SELECT, INSERT ON public.event_artists TO service_role;

DROP POLICY IF EXISTS "event_artists: public read via published events" ON public.event_artists;
CREATE POLICY "event_artists: public read via published events"
  ON public.event_artists FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_artists.event_id
        AND e.is_published = true
        AND e.trust_level IN ('official', 'media', 'aggregator')
    )
  );

DROP POLICY IF EXISTS "event_artists: admin_users all" ON public.event_artists;
CREATE POLICY "event_artists: admin_users all"
  ON public.event_artists FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = (SELECT auth.uid())
        AND admin_users.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = (SELECT auth.uid())
        AND admin_users.is_active = true
    )
  );

-- 回填：既有每一場活動補一列主秀。
INSERT INTO public.event_artists (event_id, idol_id, role, sort_order)
SELECT id, idol_id, 'headliner', 0
FROM public.events
WHERE idol_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 寫入 events 時維持主秀列。SECURITY DEFINER：寫 events 的角色（後台管理員、
-- 自動上架的 service_role）不需要另外有 event_artists 的寫入權限。
CREATE OR REPLACE FUNCTION public.t35_sync_event_headliner_artist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  -- 主秀換人：只刪舊主秀那一列（participant 列不動）。
  IF TG_OP = 'UPDATE' AND OLD.idol_id IS NOT NULL AND OLD.idol_id IS DISTINCT FROM NEW.idol_id THEN
    DELETE FROM public.event_artists
    WHERE event_id = NEW.id AND idol_id = OLD.idol_id AND role = 'headliner';
  END IF;

  IF NEW.idol_id IS NOT NULL THEN
    INSERT INTO public.event_artists (event_id, idol_id, role, sort_order)
    VALUES (NEW.id, NEW.idol_id, 'headliner', 0)
    ON CONFLICT (event_id, idol_id) DO UPDATE SET role = 'headliner', sort_order = 0;
  END IF;

  RETURN NULL;
END;
$fn$;

COMMENT ON FUNCTION public.t35_sync_event_headliner_artist() IS
  'T35: events AFTER INSERT OR UPDATE OF idol_id — 確保 event_artists 有 (event_id, idol_id, headliner)；idol_id 改變時刪掉舊的 headliner 列。';

REVOKE ALL ON FUNCTION public.t35_sync_event_headliner_artist() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_events_sync_headliner_artist ON public.events;
CREATE TRIGGER trg_events_sync_headliner_artist
  AFTER INSERT OR UPDATE OF idol_id ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.t35_sync_event_headliner_artist();

COMMIT;

NOTIFY pgrst, 'reload schema';

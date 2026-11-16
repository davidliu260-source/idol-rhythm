-- =============================================================================
-- 062_auto_publish_foundation.sql
-- Idol Rhythm — T34 PR-1: schema foundation for crawler auto-publish
--
-- PURPOSE
--   Schema-only groundwork for T34 (crawler candidates auto-publish):
--     1. trust_level gains 'aggregator' — a distinct trust tier for non-official
--        aggregator sites (e.g. KPopOfficial). It is NOT official / media /
--        pending. Frontend will label these rows 「非官方整理」 (PR-3).
--     2. review_status gains 'parked' — candidates auto-parked by the rule
--        engine. Parked rows are kept (never deleted), are not shown publicly,
--        and do not belong in the manual review queue.
--     3. event_candidates.park_reason — why a candidate was parked.
--     4. events audit columns for auto-publish, one-click unpublish block, and
--        location autofill.
--     5. public.app_settings — DB kill switch. Seeds
--        auto_publish_enabled = false. Only Dave turns it on, after reviewing
--        the dry-run (T34 PR-3+).
--     6. Public read RLS on events / event_sources now also exposes
--        trust_level = 'aggregator'. All other conditions are unchanged.
--
-- SCOPE
--   - Enum values, nullable columns (plus one boolean NOT NULL DEFAULT false),
--     one new settings table, 4 policies (2 replaced, 2 new), grants on the
--     new table only.
--   - Writes exactly one data row: app_settings('auto_publish_enabled', false),
--     ON CONFLICT DO NOTHING.
--   - Does NOT update or delete any existing events / event_sources /
--     event_candidates rows. No row will have 'aggregator' or 'parked' after
--     this migration.
--   - Does NOT add events.hidden_at / hidden_reason (T34 PR-5 decides; first
--     version uses query-time filtering).
--   - Does NOT add a manual location-lock flag.
--   - Does NOT grant any privilege on the new events columns. PR-3 must decide
--     the write privileges for auto-publish / one-click unpublish separately.
--   - anon gets zero privileges on app_settings. service_role gets SELECT only
--     (the cron may read the switch but must never flip it).
--
-- IDEMPOTENT
--   ADD VALUE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS /
--   CREATE TABLE IF NOT EXISTS / DROP TRIGGER IF EXISTS + CREATE TRIGGER /
--   DROP POLICY IF EXISTS + CREATE POLICY / INSERT ... ON CONFLICT (key)
--   DO NOTHING / REVOKE ALL + GRANT. Re-running never flips an
--   already-enabled switch back to false, and never turns it on.
--
-- ROLLBACK (run in order; each block separately)
--   R1. Public RLS back to official/media only:
--     BEGIN;
--     DROP POLICY IF EXISTS "events: public read published" ON public.events;
--     CREATE POLICY "events: public read published"
--       ON public.events FOR SELECT
--       USING (
--         is_published = true
--         AND trust_level IN ('official', 'media')
--         AND status != 'cancelled'
--       );
--     DROP POLICY IF EXISTS "event_sources: public read via published events"
--       ON public.event_sources;
--     CREATE POLICY "event_sources: public read via published events"
--       ON public.event_sources FOR SELECT
--       USING (
--         EXISTS (
--           SELECT 1 FROM public.events e
--           WHERE e.id = event_sources.event_id
--             AND e.is_published = true
--             AND e.trust_level IN ('official', 'media')
--         )
--       );
--     COMMIT;
--   R2. Kill switch off (keep the table):
--     UPDATE public.app_settings SET value_boolean = false
--     WHERE key = 'auto_publish_enabled';
--   R3. Full schema revert (only while no later T34 PR depends on it):
--     BEGIN;
--     DROP TABLE IF EXISTS public.app_settings;
--     ALTER TABLE public.events
--       DROP COLUMN IF EXISTS location_autofill_meta,
--       DROP COLUMN IF EXISTS location_autofilled_at,
--       DROP COLUMN IF EXISTS auto_publish_blocked,
--       DROP COLUMN IF EXISTS auto_publish_rule_version,
--       DROP COLUMN IF EXISTS auto_published_at;
--     ALTER TABLE public.event_candidates DROP COLUMN IF EXISTS park_reason;
--     COMMIT;
--   Enum values 'aggregator' / 'parked' are intentionally NOT removed.
--   PostgreSQL has no ALTER TYPE ... DROP VALUE; removal means recreating the
--   type and rewriting events.trust_level, event_sources.level and
--   event_candidates.review_status (plus dependent policies / indexes), which
--   fails if any row uses the value. Unused enum values are harmless once R1
--   is applied.
--
-- EXECUTION
--   Run manually by Dave in the Supabase SQL Editor of project
--   rdrthazsonkefggedbjr (Chrome). Do NOT use the supabase CLI.
--   ⚠️ TWO SEPARATE RUNS — do NOT paste the whole file at once:
--     Run 1: PART A only (enum values; no BEGIN/COMMIT).
--     Run 2: PART B only (BEGIN ... COMMIT), after Run 1 succeeded.
--   A new enum value cannot be used in the same transaction that added it
--   (PG 12+, SQLSTATE 55P04); PART B's RLS uses 'aggregator'.
--
-- DEPENDENCIES
--   001 (trust_level, review_status, set_updated_at, public read policies),
--   002 (admin_users), 024 (anon SELECT on events / event_sources).
-- =============================================================================


-- =============================================================================
-- PART A — enum values (Run 1: run ALONE, NOT inside BEGIN/COMMIT)
-- =============================================================================

ALTER TYPE public.trust_level ADD VALUE IF NOT EXISTS 'aggregator';

ALTER TYPE public.review_status ADD VALUE IF NOT EXISTS 'parked';


-- =============================================================================
-- PART B — columns / kill switch / RLS / grants (Run 2: after PART A)
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- B1. event_candidates.park_reason
-- -----------------------------------------------------------------------------

ALTER TABLE public.event_candidates
  ADD COLUMN IF NOT EXISTS park_reason text;

COMMENT ON COLUMN public.event_candidates.park_reason IS
  'T34: reason a candidate was auto-parked (used with review_status = ''parked''). NULL for non-parked rows. Missing city / venue / address is never a park reason.';

-- -----------------------------------------------------------------------------
-- B2. events audit columns
-- -----------------------------------------------------------------------------

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS auto_published_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_publish_rule_version text,
  ADD COLUMN IF NOT EXISTS auto_publish_blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS location_autofilled_at timestamptz,
  ADD COLUMN IF NOT EXISTS location_autofill_meta jsonb;

COMMENT ON COLUMN public.events.auto_published_at IS
  'T34: when the auto-publish engine created/published this event. NULL = not auto-published. Rollback selects auto-published rows by this column.';

COMMENT ON COLUMN public.events.auto_publish_rule_version IS
  'T34: rule-engine version that auto-published this event (e.g. t34-v1). NULL when not auto-published.';

COMMENT ON COLUMN public.events.auto_publish_blocked IS
  'T34: true after one-click unpublish. The auto-publish engine must never re-publish a blocked event; only an explicit admin re-publish may.';

COMMENT ON COLUMN public.events.location_autofilled_at IS
  'T34: last time the crawler/backfill filled an empty location column (city / venue_name / address / location_name_zh / location) on this event. NULL = never autofilled.';

COMMENT ON COLUMN public.events.location_autofill_meta IS
  'T34: append-only JSON array, one entry per autofill run: [{"filled_at": timestamptz, "candidate_id": uuid, "crawler_source_id": uuid, "fields": {"city": "...", "venue_name": "..."}, "rule_version": "t34-v1"}]. "fields" lists only the columns written and the exact values written. Only empty columns may be filled. Rollback clears a column only if its current value still equals the recorded value.';

-- -----------------------------------------------------------------------------
-- B3. public.app_settings — kill switch
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.app_settings (
  key           text        PRIMARY KEY,
  value_boolean boolean,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.app_settings IS
  'T34: DB-backed runtime switches that can be flipped without a deploy or env change. auto_publish_enabled gates auto-publish, daily location autofill and backfill writes.';

COMMENT ON COLUMN public.app_settings.value_boolean IS
  'Boolean value of the setting. auto_publish_enabled: false = crawler only writes candidates (no publish, no location autofill); true = auto-publish on.';

DROP TRIGGER IF EXISTS trg_app_settings_updated_at ON public.app_settings;

CREATE TRIGGER trg_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.app_settings (key, value_boolean)
VALUES ('auto_publish_enabled', false)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.app_settings FROM PUBLIC;
REVOKE ALL ON TABLE public.app_settings FROM anon;
REVOKE ALL ON TABLE public.app_settings FROM authenticated;
REVOKE ALL ON TABLE public.app_settings FROM service_role;

GRANT SELECT ON public.app_settings TO authenticated;

GRANT UPDATE (value_boolean, updated_at) ON public.app_settings TO authenticated;

GRANT SELECT ON public.app_settings TO service_role;

DROP POLICY IF EXISTS "app_settings: admin_users select" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings: admin_users update" ON public.app_settings;

CREATE POLICY "app_settings: admin_users select"
  ON public.app_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM admin_users
      WHERE admin_users.user_id = auth.uid()
        AND admin_users.is_active = true
    )
  );

CREATE POLICY "app_settings: admin_users update"
  ON public.app_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM admin_users
      WHERE admin_users.user_id = auth.uid()
        AND admin_users.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM admin_users
      WHERE admin_users.user_id = auth.uid()
        AND admin_users.is_active = true
    )
  );

-- -----------------------------------------------------------------------------
-- B4. Public read RLS — also expose trust_level = 'aggregator'
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "events: public read published" ON public.events;

CREATE POLICY "events: public read published"
  ON public.events FOR SELECT
  USING (
    is_published = true
    AND trust_level IN ('official', 'media', 'aggregator')
    AND status != 'cancelled'
  );

DROP POLICY IF EXISTS "event_sources: public read via published events"
  ON public.event_sources;

CREATE POLICY "event_sources: public read via published events"
  ON public.event_sources FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_sources.event_id
        AND e.is_published = true
        AND e.trust_level IN ('official', 'media', 'aggregator')
    )
  );

COMMIT;

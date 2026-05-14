-- =============================================================================
-- Idol Rhythm — Initial Schema Migration
-- Project : idol-rhythm (ap-southeast-2 Sydney)
-- Ref     : SUPABASE_SCHEMA.md
--
-- ⚠️  HUMAN REVIEW REQUIRED before executing in Supabase SQL editor.
--     See bottom of file for review checklist.
-- =============================================================================


-- =============================================================================
-- SECTION 1: EXTENSIONS
-- =============================================================================

-- uuid_generate_v4() — used for default PK values
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- =============================================================================
-- SECTION 2: ENUM TYPES (10 types)
-- =============================================================================

-- Idol music category
CREATE TYPE idol_category AS ENUM (
  'kpop',
  'cpop',
  'jpop',
  'idol',
  'other'
);

-- Whether the entry is a group or solo artist
CREATE TYPE group_or_solo AS ENUM (
  'group',
  'solo'
);

-- Gender composition of the act
CREATE TYPE gender_type AS ENUM (
  'male',
  'female',
  'mixed',
  'unknown'
);

-- 7 frontend-visible event categories (must match src/lib/types.ts EventType)
CREATE TYPE event_type AS ENUM (
  'concert',    -- 演唱會、見面會、粉絲簽名會、頒獎典禮
  'ticketing',  -- 開票售票資訊
  'livestream', -- 直播
  'streaming',  -- 串流平台 (Netflix, Disney+, etc.)
  'media',      -- 雜誌、採訪、音樂節目、綜藝
  'brand',      -- 代言、品牌合作、快閃活動
  'official'    -- 官方公告、專輯發行
);

-- Fine-grained sub-classification within a main event_type
CREATE TYPE event_sub_type AS ENUM (
  'fanmeet',
  'fansign',
  'musicshow',
  'variety',
  'interview',
  'award',
  'release',
  'announcement',
  'magazine'
);

-- Confirmation status of an event
CREATE TYPE event_status AS ENUM (
  'confirmed',
  'tentative',
  'cancelled',
  'postponed'
);

-- Three-tier trust system (must match src/lib/types.ts TrustLevel)
-- Only 'official' and 'media' are rendered in the public frontend.
CREATE TYPE trust_level AS ENUM (
  'official',  -- Direct from artist / agency SNS or official website
  'media',     -- Confirmed by known media outlet or reputable fan account
  'pending'    -- Unverified — MUST NOT appear on any public-facing page
);

-- Origin type of an event source
CREATE TYPE source_type AS ENUM (
  'official_sns',
  'official_website',
  'media_outlet',
  'fan_account',
  'community',
  'unknown'
);

-- Admin review state for event candidates
CREATE TYPE review_status AS ENUM (
  'pending',
  'approved',
  'rejected'
);

-- When to fire a reminder notification
CREATE TYPE reminder_type AS ENUM (
  'day_before',   -- 24 h before the event
  'week_before',  -- 7 days before
  'hour_before'   -- 1 h before
);


-- =============================================================================
-- SECTION 3: SHARED TRIGGER — updated_at
-- =============================================================================

-- A single reusable trigger function that keeps updated_at current.
-- Attach to any table that has an updated_at column.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- =============================================================================
-- SECTION 4: TABLES
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 4.1 idols
-- Master list of K-pop / J-pop / C-pop artists managed by admin.
-- ---------------------------------------------------------------------------
CREATE TABLE idols (
  id            uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug          text        NOT NULL UNIQUE,          -- URL-safe identifier, e.g. "bts"
  name          text        NOT NULL,                  -- Display name, e.g. "BTS"
  korean_name   text,                                  -- Hangul / CJK name
  type          group_or_solo,
  gender        gender_type,
  category      idol_category,
  agency        text,                                  -- Label / management company
  debut_date    date,
  color         text,                                  -- Primary hex colour, e.g. "#4c1d95"
  gradient      text,                                  -- Tailwind gradient class string
  genres        text[]      NOT NULL DEFAULT '{}',     -- e.g. ["K-Pop", "Hip-Hop"]
  member_count  smallint,                              -- NULL for solo
  description   text,
  is_active     boolean     NOT NULL DEFAULT true,     -- false = hidden from frontend
  created_at    timestamptz NOT NULL DEFAULT NOW(),
  updated_at    timestamptz NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_idols_updated_at
  BEFORE UPDATE ON idols
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Indexes
CREATE INDEX idx_idols_slug      ON idols (slug);
CREATE INDEX idx_idols_is_active ON idols (is_active);


-- ---------------------------------------------------------------------------
-- 4.2 events
-- Published activity records visible to the frontend.
-- Only rows where is_published=true AND trust_level IN ('official','media')
-- should be served to anonymous users (enforced by RLS).
-- ---------------------------------------------------------------------------
CREATE TABLE events (
  id            uuid          PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- RESTRICT prevents accidental idol deletion from wiping all events.
  -- Use idols.is_active = false to hide an idol from the frontend instead.
  idol_id       uuid          NOT NULL REFERENCES idols (id) ON DELETE RESTRICT,
  -- Denormalised name to avoid joins on hot read paths
  idol_name     text          NOT NULL,
  title         text          NOT NULL,
  type          event_type    NOT NULL,
  sub_type      event_sub_type,
  status        event_status  NOT NULL DEFAULT 'confirmed',
  trust_level   trust_level   NOT NULL,
  date          date          NOT NULL,
  time          text,                                  -- Local time string, e.g. "19:00"
  location      text,
  country       text          NOT NULL DEFAULT '',
  country_flag  text          NOT NULL DEFAULT '',     -- Emoji flag
  description   text,                                  -- AI-generated TC summary
  tags          text[]        NOT NULL DEFAULT '{}',
  ticket_url    text,
  stream_url    text,
  is_published  boolean       NOT NULL DEFAULT false,  -- Admin must explicitly publish
  published_at  timestamptz,
  created_at    timestamptz   NOT NULL DEFAULT NOW(),
  updated_at    timestamptz   NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Indexes
CREATE INDEX idx_events_idol_id     ON events (idol_id);
CREATE INDEX idx_events_date        ON events (date);
CREATE INDEX idx_events_published   ON events (is_published, trust_level, date);
CREATE INDEX idx_events_type        ON events (type);
CREATE INDEX idx_events_status      ON events (status);


-- ---------------------------------------------------------------------------
-- 4.3 event_sources
-- One or more source attributions per event.
-- ---------------------------------------------------------------------------
CREATE TABLE event_sources (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id    uuid        NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  level       trust_level NOT NULL,
  label       text        NOT NULL,   -- Human-readable source name
  type        source_type,
  url         text,
  created_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_event_sources_event_id ON event_sources (event_id);


-- ---------------------------------------------------------------------------
-- 4.4 user_follows
-- Which idols a user is following.
-- ---------------------------------------------------------------------------
CREATE TABLE user_follows (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  idol_id     uuid        NOT NULL REFERENCES idols (id)      ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, idol_id)
);

CREATE INDEX idx_user_follows_user_id  ON user_follows (user_id);
CREATE INDEX idx_user_follows_idol_id  ON user_follows (idol_id);


-- ---------------------------------------------------------------------------
-- 4.5 saved_events
-- Events a user has bookmarked / favourited.
-- ---------------------------------------------------------------------------
CREATE TABLE saved_events (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  event_id    uuid        NOT NULL REFERENCES events (id)     ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, event_id)
);

CREATE INDEX idx_saved_events_user_id  ON saved_events (user_id);
CREATE INDEX idx_saved_events_event_id ON saved_events (event_id);


-- ---------------------------------------------------------------------------
-- 4.6 reminders
-- Per-user, per-event reminder settings.
-- ---------------------------------------------------------------------------
CREATE TABLE reminders (
  id          uuid          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid          NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  event_id    uuid          NOT NULL REFERENCES events (id)     ON DELETE CASCADE,
  type        reminder_type NOT NULL DEFAULT 'day_before',
  is_sent     boolean       NOT NULL DEFAULT false,
  created_at  timestamptz   NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, event_id, type)
);

CREATE INDEX idx_reminders_user_id   ON reminders (user_id);
CREATE INDEX idx_reminders_event_id  ON reminders (event_id);
CREATE INDEX idx_reminders_is_sent   ON reminders (is_sent) WHERE is_sent = false;


-- ---------------------------------------------------------------------------
-- 4.7 event_candidates
-- Raw data from scrapers / AI pipelines awaiting admin review.
-- Approved rows graduate to the events table.
-- ---------------------------------------------------------------------------
CREATE TABLE event_candidates (
  id                   uuid           PRIMARY KEY DEFAULT uuid_generate_v4(),
  raw_title            text           NOT NULL,
  raw_content          text,
  detected_idol_id     uuid           REFERENCES idols (id) ON DELETE SET NULL,
  detected_event_type  event_type,
  detected_date        date,
  source_url           text,
  source_name          text,
  source_type          source_type,
  ai_confidence        numeric(3, 2)  CHECK (ai_confidence BETWEEN 0.00 AND 1.00),
  review_status        review_status  NOT NULL DEFAULT 'pending',
  reviewer_note        text,
  -- Set when review_status = 'approved' and an event row has been created
  approved_event_id    uuid           REFERENCES events (id) ON DELETE SET NULL,
  created_at           timestamptz    NOT NULL DEFAULT NOW(),
  updated_at           timestamptz    NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_candidates_updated_at
  BEFORE UPDATE ON event_candidates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_candidates_review_status ON event_candidates (review_status);
CREATE INDEX idx_candidates_detected_idol ON event_candidates (detected_idol_id);


-- ---------------------------------------------------------------------------
-- 4.8 event_clicks
-- Anonymous + authenticated click tracking for popularity metrics.
-- ---------------------------------------------------------------------------
CREATE TABLE event_clicks (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id    uuid        NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  user_id     uuid        REFERENCES auth.users (id) ON DELETE SET NULL,  -- nullable
  session_id  text,                                                         -- anonymous session token
  referrer    text,                                                         -- page path that triggered the click
  clicked_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_event_clicks_event_id   ON event_clicks (event_id);
CREATE INDEX idx_event_clicks_clicked_at ON event_clicks (clicked_at);


-- ---------------------------------------------------------------------------
-- 4.9 source_clicks
-- Tracks which external source links users actually follow.
-- ---------------------------------------------------------------------------
CREATE TABLE source_clicks (
  id               uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_source_id  uuid        NOT NULL REFERENCES event_sources (id) ON DELETE CASCADE,
  event_id         uuid        NOT NULL REFERENCES events (id)        ON DELETE CASCADE,
  user_id          uuid        REFERENCES auth.users (id) ON DELETE SET NULL,
  session_id       text,
  clicked_at       timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_source_clicks_event_id        ON source_clicks (event_id);
CREATE INDEX idx_source_clicks_event_source_id ON source_clicks (event_source_id);


-- ---------------------------------------------------------------------------
-- 4.10 user_activity_logs
-- Generic append-only log for any user action (follow, save, reminder, etc.)
-- Used by the analytics dashboard.
-- ---------------------------------------------------------------------------
CREATE TABLE user_activity_logs (
  id           uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      uuid        REFERENCES auth.users (id) ON DELETE SET NULL,  -- nullable = anonymous
  session_id   text,
  action       text        NOT NULL,   -- e.g. 'follow_idol', 'save_event', 'set_reminder'
  entity_type  text,                   -- e.g. 'idol', 'event'
  entity_id    uuid,
  metadata     jsonb,                  -- free-form extra context
  created_at   timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_user_id    ON user_activity_logs (user_id);
CREATE INDEX idx_activity_logs_action     ON user_activity_logs (action);
CREATE INDEX idx_activity_logs_created_at ON user_activity_logs (created_at);


-- =============================================================================
-- SECTION 5: ROW LEVEL SECURITY — ENABLE
-- =============================================================================
-- RLS is enabled on all tables. Default deny; access granted only by policies.

ALTER TABLE idols               ENABLE ROW LEVEL SECURITY;
ALTER TABLE events              ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_sources       ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_follows        ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_candidates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_clicks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_clicks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_logs  ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- SECTION 6: ROW LEVEL SECURITY — POLICIES
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 6.1 idols — public read (active only)
-- ---------------------------------------------------------------------------
-- ⚠️  ADMIN JWT CLAIM — applies to ALL "admin all" policies below:
--     All admin policies check: (auth.jwt() ->> 'user_role') = 'admin'
--     Before enabling any admin UI, configure a Supabase custom JWT claim:
--       user_role = 'admin'
--     This is done via Dashboard → Authentication → Hooks (or a custom
--     Auth JWT Template). Without it, no admin policy will ever match.
CREATE POLICY "idols: public read active"
  ON idols FOR SELECT
  USING (is_active = true);

CREATE POLICY "idols: admin all"
  ON idols FOR ALL
  USING ((auth.jwt() ->> 'user_role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'admin');


-- ---------------------------------------------------------------------------
-- 6.2 events — public read (published + trusted only)
-- ---------------------------------------------------------------------------
CREATE POLICY "events: public read published"
  ON events FOR SELECT
  USING (
    is_published = true
    AND trust_level IN ('official', 'media')
    AND status != 'cancelled'
  );

-- Admin full access
CREATE POLICY "events: admin all"
  ON events FOR ALL
  USING ((auth.jwt() ->> 'user_role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'admin');


-- ---------------------------------------------------------------------------
-- 6.3 event_sources — public read (for published events only)
-- ---------------------------------------------------------------------------
CREATE POLICY "event_sources: public read via published events"
  ON event_sources FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_sources.event_id
        AND e.is_published = true
        AND e.trust_level IN ('official', 'media')
    )
  );

CREATE POLICY "event_sources: admin all"
  ON event_sources FOR ALL
  USING ((auth.jwt() ->> 'user_role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'admin');


-- ---------------------------------------------------------------------------
-- 6.4 user_follows — authenticated users manage own rows
-- ---------------------------------------------------------------------------
CREATE POLICY "user_follows: user read own"
  ON user_follows FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_follows: user insert own"
  ON user_follows FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_follows: user delete own"
  ON user_follows FOR DELETE
  USING (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- 6.5 saved_events — authenticated users manage own rows
-- ---------------------------------------------------------------------------
CREATE POLICY "saved_events: user read own"
  ON saved_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "saved_events: user insert own"
  ON saved_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "saved_events: user delete own"
  ON saved_events FOR DELETE
  USING (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- 6.6 reminders — authenticated users manage own rows
-- ---------------------------------------------------------------------------
CREATE POLICY "reminders: user read own"
  ON reminders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "reminders: user insert own"
  ON reminders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reminders: user delete own"
  ON reminders FOR DELETE
  USING (auth.uid() = user_id);

-- Users may update their own reminder (e.g. change reminder_type).
-- NOTE: reminders.is_sent MUST only be updated by the service role / system job,
--       not by the user. Enforce this at the application layer.
CREATE POLICY "reminders: user update own"
  ON reminders FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- 6.7 event_candidates — admin only
-- ---------------------------------------------------------------------------
CREATE POLICY "event_candidates: admin all"
  ON event_candidates FOR ALL
  USING ((auth.jwt() ->> 'user_role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'admin');


-- ---------------------------------------------------------------------------
-- 6.8 event_clicks — insert-only for all (including anonymous); read for admin
-- ⚠️  WITH CHECK (true) allows anon insert. Requires rate limiting / bot
--     protection at the application layer before going to production.
-- ---------------------------------------------------------------------------
CREATE POLICY "event_clicks: insert anon or authed"
  ON event_clicks FOR INSERT
  WITH CHECK (true);  -- open insert; see review checklist item 2

CREATE POLICY "event_clicks: admin read"
  ON event_clicks FOR SELECT
  USING ((auth.jwt() ->> 'user_role') = 'admin');


-- ---------------------------------------------------------------------------
-- 6.9 source_clicks — same pattern as event_clicks
-- ⚠️  Same rate limiting / bot protection note applies (see checklist item 2).
-- ---------------------------------------------------------------------------
CREATE POLICY "source_clicks: insert anon or authed"
  ON source_clicks FOR INSERT
  WITH CHECK (true);

CREATE POLICY "source_clicks: admin read"
  ON source_clicks FOR SELECT
  USING ((auth.jwt() ->> 'user_role') = 'admin');


-- ---------------------------------------------------------------------------
-- 6.10 user_activity_logs — authenticated users insert own logs; admin read
-- Anonymous sessions are tracked via session_id only; user_id must match.
-- ---------------------------------------------------------------------------
CREATE POLICY "user_activity_logs: user insert own"
  ON user_activity_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_activity_logs: admin read"
  ON user_activity_logs FOR SELECT
  USING ((auth.jwt() ->> 'user_role') = 'admin');


-- =============================================================================
-- HUMAN REVIEW CHECKLIST (required before executing in Supabase)
-- =============================================================================
--
--  [ ] 1. ADMIN CUSTOM CLAIM (blocker):
--         All admin policies use (auth.jwt() ->> 'user_role') = 'admin'.
--         Before enabling any admin UI, configure a custom JWT claim in
--         Supabase Dashboard → Authentication → Hooks (or JWT Template):
--           user_role = 'admin'
--         Without this, all 8 admin policies silently deny every request.
--
--  [ ] 2. ANALYTICS RATE LIMITING (security):
--         event_clicks and source_clicks allow anonymous INSERT (WITH CHECK (true)).
--         This is intentional for click tracking, but requires rate limiting and
--         bot / abuse protection at the application or edge layer before going live.
--         Consider Supabase Edge Functions or a middleware proxy.
--
--  [ ] 3. SERVICE ROLE FOR reminders.is_sent (operational):
--         The "reminders: user update own" policy lets users change reminder_type,
--         but is_sent should only be flipped by the notification system.
--         Ensure your push / email job uses the Supabase SERVICE ROLE key,
--         which bypasses RLS, to update is_sent = true.
--
--  [ ] 4. EVENT DELETE CASCADE TO saved_events / reminders (data safety):
--         events.id → saved_events and reminders are ON DELETE CASCADE.
--         Deleting an event permanently removes all user bookmarks and reminders
--         for that event. Confirm this is acceptable, or add a soft-delete column
--         (e.g. is_archived boolean) and use it instead of hard DELETE.
--
--  [ ] 5. ARCHIVED / SOFT-DELETE STATUS (product decision):
--         There is currently no 'archived' status on events or idols.
--         If you need to hide past events without deleting them, add:
--           is_archived boolean NOT NULL DEFAULT false
--         and update the public-read RLS policy to exclude archived rows.
--         Decide before seeding data (Phase 3), as retrofitting is disruptive.
--
--  [ ] 6. uuid-ossp extension:
--         Supabase enables this by default. Verify before running.
--
--  [ ] 7. No seed data is included here. Run seed script separately (Phase 3).
--
--  [ ] 8. Run this migration in a single transaction:
--         BEGIN; <paste SQL>; COMMIT; — allows full rollback on any error.
--
-- =============================================================================

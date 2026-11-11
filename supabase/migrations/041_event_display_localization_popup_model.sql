-- =============================================================================
-- Idol Rhythm — Event display localization + popup model foundation
-- Migration: 041
--
-- PURPOSE
--   Adds additive fields needed for Chinese display titles, activity subtypes,
--   popup/exhibition date ranges, and richer location display.
--
--   This is the schema foundation only:
--     - no crawler behavior changes
--     - no UI behavior changes
--     - no automatic AI translation
--     - no destructive rewrite of existing title / description fields
--
--   Existing insert paths remain valid because every new column is nullable
--   except translation_status, which has a safe DEFAULT.
--
-- EXECUTION
--   Run in Supabase SQL Editor after merge:
--     BEGIN; <paste this file>; COMMIT;
--
-- ⚠️ HUMAN REVIEW REQUIRED before executing.
-- =============================================================================


BEGIN;


-- =============================================================================
-- SECTION 1: Translation metadata enums
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'translation_status') THEN
    CREATE TYPE public.translation_status AS ENUM (
      'none',
      'machine',
      'reviewed',
      'manual'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'translation_source') THEN
    CREATE TYPE public.translation_source AS ENUM (
      'rule',
      'ai',
      'admin',
      'import'
    );
  END IF;
END $$;


-- =============================================================================
-- SECTION 2: Activity subtypes for popup / exhibition / brand events
-- =============================================================================
-- Keep main events.type = 'brand' for compatibility. These subtypes let the UI
-- distinguish 快閃店 / 展覽 / 品牌活動 once admin and frontend support lands.
-- =============================================================================

ALTER TYPE public.event_sub_type ADD VALUE IF NOT EXISTS 'popup_store';
ALTER TYPE public.event_sub_type ADD VALUE IF NOT EXISTS 'exhibition';
ALTER TYPE public.event_sub_type ADD VALUE IF NOT EXISTS 'brand_event';


-- =============================================================================
-- SECTION 3: events display/localization/range/location fields
-- =============================================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS display_title_zh      text,
  ADD COLUMN IF NOT EXISTS display_summary_zh    text,
  ADD COLUMN IF NOT EXISTS location_name_zh      text,
  ADD COLUMN IF NOT EXISTS translation_status    public.translation_status NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS translation_source    public.translation_source,
  ADD COLUMN IF NOT EXISTS translation_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS start_date            date,
  ADD COLUMN IF NOT EXISTS end_date              date,
  ADD COLUMN IF NOT EXISTS date_label            text,
  ADD COLUMN IF NOT EXISTS city                  text,
  ADD COLUMN IF NOT EXISTS venue_name            text,
  ADD COLUMN IF NOT EXISTS address               text,
  ADD COLUMN IF NOT EXISTS map_url               text;

-- Existing single-day events should be compatible with future range rendering.
UPDATE public.events
   SET start_date = date
 WHERE start_date IS NULL;

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_date_range_valid;

ALTER TABLE public.events
  ADD CONSTRAINT events_date_range_valid
  CHECK (
    start_date IS NULL
    OR end_date IS NULL
    OR end_date >= start_date
  );


-- =============================================================================
-- SECTION 4: event_candidates mirrored display/range/location fields
-- =============================================================================
-- Candidate-level fields let admins review Chinese display text and popup/date
-- range hints before approving the candidate into events.
-- =============================================================================

ALTER TABLE public.event_candidates
  ADD COLUMN IF NOT EXISTS display_title_zh       text,
  ADD COLUMN IF NOT EXISTS display_summary_zh     text,
  ADD COLUMN IF NOT EXISTS location_name_zh       text,
  ADD COLUMN IF NOT EXISTS translation_status     public.translation_status NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS translation_source     public.translation_source,
  ADD COLUMN IF NOT EXISTS translation_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS detected_event_sub_type public.event_sub_type,
  ADD COLUMN IF NOT EXISTS detected_start_date    date,
  ADD COLUMN IF NOT EXISTS detected_end_date      date,
  ADD COLUMN IF NOT EXISTS detected_date_label    text,
  ADD COLUMN IF NOT EXISTS detected_city          text,
  ADD COLUMN IF NOT EXISTS detected_venue_name    text,
  ADD COLUMN IF NOT EXISTS detected_address       text,
  ADD COLUMN IF NOT EXISTS detected_map_url       text;

-- Mirror existing detected_date into detected_start_date for future range UI.
UPDATE public.event_candidates
   SET detected_start_date = detected_date
 WHERE detected_start_date IS NULL
   AND detected_date IS NOT NULL;

ALTER TABLE public.event_candidates
  DROP CONSTRAINT IF EXISTS event_candidates_detected_date_range_valid;

ALTER TABLE public.event_candidates
  ADD CONSTRAINT event_candidates_detected_date_range_valid
  CHECK (
    detected_start_date IS NULL
    OR detected_end_date IS NULL
    OR detected_end_date >= detected_start_date
  );


-- =============================================================================
-- SECTION 5: Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_events_start_date
  ON public.events (start_date);

CREATE INDEX IF NOT EXISTS idx_events_sub_type
  ON public.events (sub_type)
  WHERE sub_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_event_candidates_detected_event_sub_type
  ON public.event_candidates (detected_event_sub_type)
  WHERE detected_event_sub_type IS NOT NULL;


-- =============================================================================
-- SECTION 6: Grants
-- =============================================================================
-- Existing RLS policies still gate access:
--   - events update is draft-only and admin_users-gated
--   - event_candidates update is admin_users-gated
-- SELECT table grants already cover these new columns for roles that can read.
-- =============================================================================

GRANT UPDATE (
  display_title_zh,
  display_summary_zh,
  location_name_zh,
  translation_status,
  translation_source,
  translation_updated_at,
  start_date,
  end_date,
  date_label,
  city,
  venue_name,
  address,
  map_url,
  updated_at
) ON public.events TO authenticated;

GRANT UPDATE (
  display_title_zh,
  display_summary_zh,
  location_name_zh,
  translation_status,
  translation_source,
  translation_updated_at,
  detected_event_sub_type,
  detected_start_date,
  detected_end_date,
  detected_date_label,
  detected_city,
  detected_venue_name,
  detected_address,
  detected_map_url,
  updated_at
) ON public.event_candidates TO authenticated;

GRANT USAGE ON TYPE public.translation_status TO anon, authenticated, service_role;
GRANT USAGE ON TYPE public.translation_source TO anon, authenticated, service_role;


COMMIT;


-- =============================================================================
-- REVIEW CHECKLIST
-- =============================================================================
--
--  □ Confirm migration 040 has already been handled according to WORKING.md
--    before running this as migration 041.
--
--  □ Run the file in Supabase SQL Editor and confirm COMMIT succeeds.
--
--  □ Verify new columns exist:
--      SELECT table_name, column_name
--        FROM information_schema.columns
--       WHERE table_schema = 'public'
--         AND table_name IN ('events', 'event_candidates')
--         AND column_name IN (
--           'display_title_zh',
--           'display_summary_zh',
--           'translation_status',
--           'start_date',
--           'detected_start_date',
--           'detected_event_sub_type'
--         )
--       ORDER BY table_name, column_name;
--
--  □ Verify existing code paths still work:
--      - /admin/events loads
--      - /admin/event-candidates loads
--      - manual sync still inserts candidates
--      - approving a candidate still creates an unpublished draft
--
--  □ Verify existing events got start_date backfilled:
--      SELECT COUNT(*) AS missing_start_date
--        FROM public.events
--       WHERE start_date IS NULL;
--      Expected: 0 for existing rows.
--
-- =============================================================================

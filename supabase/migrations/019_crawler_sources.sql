-- =============================================================================
-- Idol Rhythm — Crawler Sources Foundation (Phase J6a)
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   Phase J6a establishes a single source-of-truth table for every crawler
--   fetcher. Today there is one hard-wired fetcher (BLACKPINK official tour)
--   triggered by a hard-coded admin button; this migration registers that
--   fetcher as the first row of a managed list so future fetchers can be
--   added via data rather than code, and the admin UI can avoid sprouting
--   per-fetcher buttons.
--
--   Scope of this migration is intentionally narrow:
--     - Create the table.
--     - Enable RLS + GRANT SELECT to authenticated.
--     - SELECT policy gated on active admin_users.
--     - Seed exactly one row (BLACKPINK official tour) idempotently.
--
--   NOT in this migration:
--     - No INSERT/UPDATE/DELETE policies. Adding sources at this phase is
--       done via migration, not via the admin UI.
--     - No service_role GRANT. The existing cron route still calls the
--       hard-coded BLACKPINK fetcher directly; later phases (J6d) will wire
--       cron to read from this table.
--     - No crawler_runs / history table.
--     - No changes to event_candidates schema.
--
-- DEPENDENCY
--   Must be run AFTER:
--     001_initial_schema.sql  — defines idols table + source_type enum
--     002_admin_users.sql     — defines admin_users table
--
-- EXECUTION
--   Run in Supabase SQL Editor:
--     BEGIN; <paste this file>; COMMIT;
--   GRANTs and DROP POLICY IF EXISTS are idempotent.
--   The seed INSERT uses ON CONFLICT (source_key) DO NOTHING.
--
-- ⚠️  HUMAN REVIEW REQUIRED before executing.
--     See review checklist at the bottom of this file.
-- =============================================================================


BEGIN;


-- =============================================================================
-- SECTION 1: Table
-- =============================================================================
-- parser_type is kept as text (not an enum) on purpose: locking the parser
-- registry into the database schema would be premature at this phase. The
-- application code maps parser_type strings to fetcher implementations.
--
-- source_key is the stable external identifier used for de-dup / lookup
-- (e.g. 'blackpink-official-tour'). It is UNIQUE so that re-running the
-- seed is idempotent.
-- =============================================================================

CREATE TABLE IF NOT EXISTS crawler_sources (
  id           uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         text        NOT NULL,
  source_key   text        NOT NULL UNIQUE,
  idol_id      uuid        REFERENCES idols (id) ON DELETE SET NULL,
  source_url   text        NOT NULL,
  source_type  source_type NOT NULL DEFAULT 'official_website',
  parser_type  text        NOT NULL,
  is_active    boolean     NOT NULL DEFAULT true,
  last_run_at  timestamptz,
  last_status  text,
  last_error   text,
  created_at   timestamptz NOT NULL DEFAULT NOW(),
  updated_at   timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crawler_sources_idol_id
  ON crawler_sources (idol_id);

CREATE INDEX IF NOT EXISTS idx_crawler_sources_is_active
  ON crawler_sources (is_active);


-- =============================================================================
-- SECTION 2: Enable RLS
-- =============================================================================

ALTER TABLE crawler_sources ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- SECTION 3: Table-level GRANT SELECT for authenticated
-- =============================================================================
-- Without this GRANT, authenticated users receive 42501 before RLS is
-- evaluated, even when a matching policy exists.
--
-- No GRANT is given to anon — crawler config is admin-only.
-- No INSERT/UPDATE/DELETE GRANT — this phase is read-only from the admin UI.
-- =============================================================================

GRANT SELECT ON public.crawler_sources TO authenticated;


-- =============================================================================
-- SECTION 4: DROP existing policy if present (idempotent re-run safety)
-- =============================================================================

DROP POLICY IF EXISTS "crawler_sources: admin_users select" ON crawler_sources;


-- =============================================================================
-- SECTION 5: RLS SELECT POLICY — admin_users only
-- =============================================================================

CREATE POLICY "crawler_sources: admin_users select"
  ON crawler_sources
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


-- =============================================================================
-- SECTION 6: Seed — BLACKPINK official tour
-- =============================================================================
-- Resolves idols.id by slug to avoid hard-coding the BLACKPINK UUID.
-- ON CONFLICT (source_key) DO NOTHING keeps the migration idempotent and
-- preserves any future manual edits to this row.
-- =============================================================================

INSERT INTO crawler_sources (
  name,
  source_key,
  idol_id,
  source_url,
  source_type,
  parser_type,
  is_active
)
SELECT
  'BLACKPINK 官方巡演頁',
  'blackpink-official-tour',
  idols.id,
  'https://blackpinkofficial.com/concert/2025TOUR/index.html',
  'official_website'::source_type,
  'blackpink_official_tour',
  true
FROM idols
WHERE idols.slug = 'blackpink'
ON CONFLICT (source_key) DO NOTHING;


COMMIT;


-- =============================================================================
-- REVIEW CHECKLIST (complete before executing in Supabase)
-- =============================================================================
--
--  □ Migrations 001–018 have already been executed.
--
--  □ Run the full file wrapped in BEGIN … COMMIT in the SQL Editor.
--    Verify "COMMIT" appears in the output with no errors.
--
--  □ After executing, verify:
--    SELECT name, source_key, parser_type, is_active FROM crawler_sources;
--    Expected: one row — BLACKPINK 官方巡演頁 / blackpink-official-tour /
--              blackpink_official_tour / true
--
--  □ Verify admin can SELECT crawler_sources via the UI:
--    Log in as admin, open /admin/sources — should show the BLACKPINK row.
--
--  □ Verify non-admin authenticated user cannot SELECT:
--    Querying the table as a non-admin user should return zero rows
--    (policy filters them out; GRANT exists but RLS blocks).
--
--  □ Verify anon cannot access:
--    No GRANT was given to anon — table is invisible to public.
--
--  □ Verify the existing BLACKPINK fetcher trigger is still functional:
--    /admin/event-candidates → "抓取 BLACKPINK 官方巡演" button still works.
--    This migration does NOT modify the fetcher; it only registers the
--    source as data for later phases.
--
--  □ Verify idempotence:
--    Re-running this file should produce no errors (CREATE TABLE IF NOT
--    EXISTS + DROP POLICY IF EXISTS + ON CONFLICT DO NOTHING + idempotent
--    GRANT guarantee this).
--
-- =============================================================================

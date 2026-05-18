-- =============================================================================
-- Idol Rhythm — Anon GRANT SELECT for events + event_sources
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   Migration 001 created the RLS policy "events: public read published"
--   which intends to let the anonymous frontend read published + trusted
--   events. The policy is in place, but the table-level GRANT to the
--   `anon` role was never created — so PostgREST short-circuits the query
--   at the permission layer (before RLS even runs) and returns 0 rows.
--
--   Result: the frontend (Server Components using NEXT_PUBLIC_SUPABASE_ANON_KEY)
--   always sees an empty events list, even though /admin/events shows 32
--   published rows. This is the root cause of the "mock fallback always
--   triggers" bug fixed at the UI layer in PR #27.
--
--   This migration grants SELECT to anon on the two tables the public
--   timeline / schedule queries touch:
--     - events           (column-level SELECT on all read columns)
--     - event_sources    (badge / detail page source list)
--
--   idols already has GRANT SELECT TO anon from migration 009.
--
-- SAFETY
--   - SELECT only, on existing public tables. No schema change. No data write.
--   - The "events: public read published" RLS policy still restricts what
--     anon can read: is_published=true AND trust_level IN ('official','media').
--     Drafts and pending rows remain invisible.
--   - The "event_sources: public read" RLS policy (from 001) restricts to
--     rows whose parent event is publicly readable. Same scope.
--   - Idempotent — GRANT is a no-op if already granted.
--
-- DEPENDENCY
--   Must be run AFTER:
--     001_initial_schema.sql  — events + event_sources tables + RLS + policies
--
-- EXECUTION
--   Run in Supabase SQL Editor:
--     BEGIN; <paste this file>; COMMIT;
--
-- ⚠️  HUMAN REVIEW REQUIRED before executing.
--     See review checklist at the bottom of this file.
-- =============================================================================


BEGIN;


-- =============================================================================
-- SECTION 1: GRANT SELECT on events to anon
-- =============================================================================
-- RLS still gates which rows the anon role sees (the "public read published"
-- policy filters to is_published=true AND trust_level IN ('official','media')).
-- The GRANT is the table-level prerequisite that PostgREST checks first.
-- =============================================================================

GRANT SELECT ON TABLE public.events TO anon;


-- =============================================================================
-- SECTION 2: GRANT SELECT on event_sources to anon
-- =============================================================================
-- event_sources is joined into the events query for badge/source display.
-- Without this GRANT the join silently returns NULL for sources.
-- =============================================================================

GRANT SELECT ON TABLE public.event_sources TO anon;


COMMIT;


-- =============================================================================
-- REVIEW CHECKLIST (complete before executing in Supabase)
-- =============================================================================
--
--  □ Migration 001 has been executed (events + event_sources tables exist
--    with RLS enabled and the "events: public read published" policy).
--
--  □ Run the file wrapped in BEGIN … COMMIT. Verify "COMMIT" with no errors.
--
--  □ Verify GRANTs were applied:
--      SELECT grantee, privilege_type
--        FROM information_schema.table_privileges
--       WHERE table_schema = 'public'
--         AND table_name   IN ('events', 'event_sources')
--         AND grantee      = 'anon';
--      Expected: two rows, both privilege_type='SELECT'.
--
--  □ Verify anon can now read published events (run as anon role or via
--    the frontend):
--      -- Via PostgREST as anon, this should return >0 rows:
--      curl "https://<project>.supabase.co/rest/v1/events?is_published=eq.true&trust_level=in.(official,media)" \
--        -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"
--      Expected: 32 rows (matching /admin/events 已發布 count).
--
--  □ Verify drafts are still hidden from anon:
--      curl "https://<project>.supabase.co/rest/v1/events?is_published=eq.false" \
--        -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"
--      Expected: 0 rows — RLS still filters.
--
--  □ Verify frontend `/schedule` now shows the published events.
--    Verify /admin/events count is unchanged (34 total, 32 published).
--
-- =============================================================================

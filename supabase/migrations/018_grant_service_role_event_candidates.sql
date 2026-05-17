-- =============================================================================
-- Idol Rhythm — service_role grants for event_candidates
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   Phase J5b follow-up: grant the minimum table privileges the cron route
--   needs on event_candidates when it connects via the SUPABASE_SERVICE_ROLE
--   client.
--
--   Although the service_role JWT has BYPASSRLS, it still requires explicit
--   table-level GRANTs in PostgREST. Without these, the cron route received
--   42501 permission denied during J5b production validation (see PR #5).
--
--   The grants were applied directly in Supabase SQL Editor on 2026-05-17
--   to unblock validation; this migration is the durable record so the
--   permission survives a DB reset or environment rebuild.
--
-- SCOPE
--   - SELECT: required for the dedupe lookup (source_hash + source_url).
--   - INSERT: required to write new candidate rows from the cron fetcher.
--   - UPDATE: reserved for admin-side flows where service_role may need to
--     touch review_status / reviewed_by columns; currently unused but kept
--     to match what was applied in production.
--
-- NOT IN SCOPE
--   - DELETE is intentionally NOT granted. Candidate deletion remains a
--     manual / admin-only operation gated by the admin session.
--   - Does NOT touch RLS policies. service_role bypasses RLS at the role
--     level; no policy changes needed.
--   - Does NOT modify anon or authenticated grants.
--
-- IDEMPOTENT
--   GRANT statements in PostgreSQL are naturally idempotent — re-running
--   this migration produces no diff.
-- =============================================================================

BEGIN;

GRANT SELECT ON public.event_candidates TO service_role;
GRANT INSERT ON public.event_candidates TO service_role;
GRANT UPDATE ON public.event_candidates TO service_role;

COMMIT;

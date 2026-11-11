-- =============================================================================
-- 061_grant_service_role_notification_crons.sql
--
-- PURPOSE
--   Grant service_role the minimum privileges required by the two
--   notification crons:
--     - /api/cron/dispatch-reminders
--         SELECT reminders (+ embedded events), UPDATE reminders.is_sent
--     - /api/cron/dispatch-new-event-notifications
--         SELECT events, SELECT user_follows
--   Without these grants both crons fail daily with 42501 permission denied.
--   notifications grants already exist (042) and are not changed here.
--
-- SCOPE
--   - Adds privileges only. No data changes, no RLS changes.
--   - Does NOT modify anon or authenticated grants.
--   - Write access is limited to the single column reminders.is_sent.
--
-- IDEMPOTENT
--   GRANT statements are naturally idempotent — re-running produces no diff.
--
-- ROLLBACK
--   REVOKE UPDATE (is_sent) ON public.reminders FROM service_role;
--   REVOKE SELECT ON public.user_follows FROM service_role;
--   REVOKE SELECT ON public.reminders FROM service_role;
--   REVOKE SELECT ON public.events FROM service_role;
--
-- EXECUTION
--   Run manually by the Owner in the Supabase SQL Editor of project
--   rdrthazsonkefggedbjr. Do NOT use the supabase CLI.
-- =============================================================================

BEGIN;

GRANT SELECT ON public.events TO service_role;

GRANT SELECT ON public.reminders TO service_role;

GRANT UPDATE (is_sent) ON public.reminders TO service_role;

GRANT SELECT ON public.user_follows TO service_role;

COMMIT;

-- F4: store per-user subscription tokens and alarms for the all-follows ICS feed.
-- Executed manually by Dave in the Supabase SQL Editor on 2026-11-21 per chief-of-staff report; this file records it.
-- Rollback: DROP TABLE IF EXISTS public.calendar_feed_tokens;

BEGIN;

CREATE TABLE IF NOT EXISTS public.calendar_feed_tokens (
  user_id          uuid        PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  token            text        NOT NULL UNIQUE
                               CHECK (token ~ '^[A-Za-z0-9_-]{43}$'),
  alarm            text        NOT NULL DEFAULT 'day_before'
                               CHECK (alarm IN ('none', 'day_before', 'week_before', 'both')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  rotated_at       timestamptz,
  last_accessed_at timestamptz
);

COMMENT ON TABLE public.calendar_feed_tokens IS
  'F4: per-user secret token for the "all follows" ICS feed. Server-only (service_role). Token is a 32-byte random base64url string; never put user_id in the feed URL.';

ALTER TABLE public.calendar_feed_tokens ENABLE ROW LEVEL SECURITY;

-- 不給 anon / authenticated 任何權限與 policy；所有存取走伺服器端 service client。
REVOKE ALL ON public.calendar_feed_tokens FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_feed_tokens TO service_role;

COMMIT;

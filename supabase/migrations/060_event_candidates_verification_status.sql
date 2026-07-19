-- =============================================================================
-- Idol Rhythm — B-1b: aggregator verification evidence columns
--
-- SCOPE
--   Only public.event_candidates is changed. This migration adds nullable,
--   auditable verification state; it performs no data backfill, runtime wiring,
--   UI work, publish-flow work, RLS work, policy work, or privilege changes.
--   Existing candidate rows therefore retain verification_status = NULL.
--
-- B-2 BLOCKER (measured by PM on 2026-07-15; intentionally not fixed here)
--   service_role: events 403 / event_sources 403 / event_candidates OK /
--   crawler_sources OK
--   anon: events OK / event_sources OK / event_candidates 403 /
--   crawler_sources 403
--   A B-2 verification runtime that writes event_sources with service_role will
--   therefore receive 403. Do not work around this by adding GRANT to
--   service_role: that would let automation reach frontend-visible tables and
--   cross the CLAUDE.md data-visibility boundary. Before B-2 is opened, PM must
--   verify which role the existing admin publish path actually uses. Owner must
--   decide any privilege model; this migration makes no privilege changes.
--
-- VERIFICATION_EVIDENCE SHAPE (documentation only; no parser/runtime here)
--   [ {
--       "url": "https://...",
--       "canonicalUrl": "https://...",          -- optional
--       "title": "...",
--       "citedText": "...",
--       "sourceClass": "official_artist_company|promoter|venue|ticketing|reliable_media",
--       "fieldMatches": { "artist": true, "dates": true, "venueOrCity": true },
--       "confidence": "high|medium|low"
--     } ]
--   confidence is calculated by deterministic re-check, not a model-reported
--   score; low confidence never produces a proposal.
--   Only auditable citation fields belong here. Never store encrypted_index
--   (Anthropic continuation metadata), nor any dynamic-filtering/A response
--   compatibility fields. A response without bound citations is fail-closed.
-- =============================================================================

BEGIN;

ALTER TABLE public.event_candidates
  ADD COLUMN IF NOT EXISTS verification_status text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_evidence jsonb,
  ADD COLUMN IF NOT EXISTS verification_provider_meta jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.event_candidates'::regclass
      AND conname = 'event_candidates_verification_status_check'
  ) THEN
    ALTER TABLE public.event_candidates
      ADD CONSTRAINT event_candidates_verification_status_check
      CHECK (
        verification_status IS NULL
        OR verification_status IN (
          'confirmed',
          'unconfirmed',
          'contradicted',
          'citation_unbound',
          'field_mismatch',
          'no_match',
          'provider_error'
        )
      );
  END IF;
END
$$;

COMMENT ON COLUMN public.event_candidates.verification_status IS
  'B-direct verification state: NULL=not checked; confirmed=qualifying citation-bound evidence passed; unconfirmed=no qualifying source established; contradicted=reliable evidence conflicts; citation_unbound=model result has no bindable citation; field_mismatch=artist/date/venue-city deterministic re-check failed; no_match=search completed with no qualifying result; provider_error=provider/tool failed or returned an error. provider_error is distinct from no_match and must never be merged with it.';

COMMENT ON COLUMN public.event_candidates.verified_at IS
  'Timestamp of the latest completed verification attempt; NULL until a verification attempt is recorded.';

COMMENT ON COLUMN public.event_candidates.verification_evidence IS
  'B-direct auditable evidence array: url, optional canonicalUrl, title, citedText, sourceClass, fieldMatches {artist, dates, venueOrCity}, confidence. Must not contain encrypted_index or dynamic-filtering response compatibility fields.';

COMMENT ON COLUMN public.event_candidates.verification_provider_meta IS
  'Provider metadata only: provider, model, tool, allowed_callers, query, usage, observedAt. Do not store secrets or encrypted continuation payloads.';

COMMIT;

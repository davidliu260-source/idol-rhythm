-- =============================================================================
-- Migration 008 — Phase H2: Admin Insert Idols
-- Project  : Idol Rhythm
-- Date     : 2026-05-15
--
-- Grants active admin_users the ability to INSERT rows into the idols table.
--
-- Architecture notes:
--   - Identity check uses admin_users table (NOT JWT custom claim).
--   - Migration 004 already granted admin_users SELECT on idols.
--   - No UPDATE policy (Phase H3, separate task).
--   - No DELETE policy — use is_active = false to hide idols instead.
--   - No service_role. No anon permission expansion.
--   - slug uniqueness is enforced at the DB level (UNIQUE constraint in migration 001).
-- =============================================================================


-- ── 1. GRANT INSERT on idols ──────────────────────────────────────────────────
-- Table-level GRANT INSERT is acceptable here; column-level INSERT grants are
-- not supported in PostgreSQL (only SELECT and UPDATE support column-level).
-- The Server Action controls which columns are actually sent.

GRANT INSERT ON public.idols TO authenticated;


-- ── 2. INSERT RLS policy ──────────────────────────────────────────────────────
-- INSERT policies use only WITH CHECK (no USING for INSERT).

DROP POLICY IF EXISTS "idols: admin_users insert" ON public.idols;

CREATE POLICY "idols: admin_users insert"
  ON public.idols
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   public.admin_users
      WHERE  admin_users.user_id  = auth.uid()
        AND  admin_users.is_active = true
    )
  );


-- =============================================================================
-- HUMAN REVIEW CHECKLIST (required before executing in Supabase SQL editor)
-- =============================================================================
--
--  [ ] 1. Execute in a transaction:
--         BEGIN; <paste SQL>; COMMIT;
--
--  [ ] 2. Confirm migration 004 was already applied (idols SELECT policy for admins).
--
--  [ ] 3. After executing, test as authenticated admin:
--           INSERT INTO public.idols (slug, name, genres)
--           VALUES ('test-idol', 'Test Idol', '{}');
--         Expect: 1 row inserted.
--
--  [ ] 4. Confirm anon role CANNOT insert idols.
--
--  [ ] 5. Delete the test row after verification:
--           DELETE FROM public.idols WHERE slug = 'test-idol';
--         (Run as postgres / service_role in Supabase SQL editor.)
--
-- =============================================================================

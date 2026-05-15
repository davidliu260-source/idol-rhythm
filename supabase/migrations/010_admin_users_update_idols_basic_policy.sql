-- =============================================================================
-- Idol Rhythm — Admin Users Update Idols Basic Info Policy
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   Allows admin_users to UPDATE the content fields of any idol row.
--   slug and is_active are intentionally excluded:
--     - slug    : immutable URL key; changing it would break /idols/[slug]
--     - is_active: reserved for Phase H4 (toggle activation, separate policy)
--     - id, created_at : system fields; never user-mutable
--
--   The trigger trg_idols_updated_at (defined in 001_initial_schema.sql)
--   automatically sets updated_at = NOW() on any UPDATE, so the client
--   does not need to supply updated_at in the SET clause.
--
-- DEPENDENCY
--   Must be run AFTER:
--     001_initial_schema.sql  — defines idols table + RLS
--     002_admin_users.sql     — defines admin_users table
--     008_admin_users_insert_idols_policy.sql — GRANT INSERT (additive, not conflicting)
--
-- EXECUTION
--   Run in Supabase SQL Editor:
--     BEGIN; <paste this file>; COMMIT;
--   GRANT is idempotent. DROP POLICY IF EXISTS is safe to re-run.
--
-- ⚠️  HUMAN REVIEW REQUIRED before executing.
--     See review checklist at the bottom of this file.
-- =============================================================================


BEGIN;


-- =============================================================================
-- SECTION 1: Column-level GRANT UPDATE — idols (content fields only)
-- =============================================================================
-- Grants UPDATE privilege for the content columns an admin may edit.
-- slug, is_active, id, created_at are NOT included.
-- updated_at is included because some UPDATE paths may set it explicitly;
-- the trigger handles it automatically when omitted from the SET clause.
-- =============================================================================

GRANT UPDATE (
  name,
  korean_name,
  type,
  gender,
  category,
  agency,
  debut_date,
  color,
  genres,
  member_count,
  description,
  updated_at
) ON public.idols TO authenticated;


-- =============================================================================
-- SECTION 2: DROP existing policy if present (idempotent re-run safety)
-- =============================================================================

DROP POLICY IF EXISTS "idols: admin_users update basic info" ON idols;


-- =============================================================================
-- SECTION 3: RLS UPDATE POLICY — idols (admin_users check)
-- =============================================================================
-- Allows authenticated users with an active admin_users row to UPDATE any idol.
-- Row-scope is all idols (no additional row filter needed — slug/is_active
-- are protected by the column-level GRANT above, not by this USING clause).
--
-- USING    : which rows the admin can target in the WHERE clause
-- WITH CHECK : what the resulting row must look like after UPDATE
-- Both check the same admin_users condition.
-- =============================================================================

CREATE POLICY "idols: admin_users update basic info"
  ON idols
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


COMMIT;


-- =============================================================================
-- REVIEW CHECKLIST (complete before executing in Supabase)
-- =============================================================================
--
--  □ 001_initial_schema.sql, 002_admin_users.sql, and
--    008_admin_users_insert_idols_policy.sql have already been executed.
--
--  □ Run the full file wrapped in BEGIN … COMMIT in the SQL Editor.
--    Verify "COMMIT" appears in the output with no errors.
--
--  □ After executing, verify column-level GRANT takes effect:
--    As admin, attempt to UPDATE idols SET slug = 'x' WHERE id = '...';
--    → Should receive error: "permission denied for column slug"
--
--  □ Verify slug is immutable: the column-level GRANT does NOT include slug.
--    Any UPDATE that includes slug in the SET clause will be rejected by
--    PostgreSQL before RLS is evaluated.
--
--  □ Verify is_active is NOT included in the GRANT.
--    Toggling is_active is reserved for Phase H4.
--
--  □ Confirm the trg_idols_updated_at trigger is active:
--    SELECT tgname FROM pg_trigger WHERE tgrelid = 'idols'::regclass;
--    → Should include trg_idols_updated_at
--    The trigger sets updated_at automatically; clients do not need to supply it.
--
--  □ After executing, test via /admin/idols/[id]/edit:
--    - Admin can change name, korean_name, category, etc. and save
--    - slug field is displayed but disabled (no edit possible in UI)
--    - is_active is not shown in the edit form
--    - updated_at reflects the edit timestamp in the detail page
--
-- =============================================================================

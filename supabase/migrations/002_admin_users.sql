-- =============================================================================
-- Idol Rhythm — Admin Users Migration
-- Project : idol-rhythm (ap-southeast-2 Sydney)
-- Ref     : ADMIN_WRITE_PLAN.md
--
-- PURPOSE
--   Establishes the admin_users table used by the admin guard to determine
--   whether the currently authenticated Supabase user has admin access.
--   This is Phase B of the admin write plan (method B: admin_users table).
--
-- DEPENDENCY
--   Must be run AFTER 001_initial_schema.sql, which defines:
--     - uuid-ossp extension (uuid_generate_v4)
--     - set_updated_at() trigger function
--
-- EXECUTION
--   Run in Supabase SQL Editor:
--     BEGIN; <paste this file>; COMMIT;
--   On any error the transaction rolls back completely.
--
-- ⚠️  HUMAN REVIEW REQUIRED before executing.
--     See review checklist at the bottom of this file.
-- =============================================================================


BEGIN;


-- =============================================================================
-- SECTION 1: TABLE
-- =============================================================================

-- ---------------------------------------------------------------------------
-- admin_users
-- ---------------------------------------------------------------------------
-- Stores the set of Supabase Auth users who have admin access.
--
-- DESIGN NOTES
--   • user_id references auth.users — the Supabase-managed authentication table.
--   • This table does NOT store passwords or credentials of any kind.
--   • Adding / removing an admin is done by inserting / setting is_active = false.
--   • Do NOT hard-delete rows; set is_active = false so there is an audit trail.
--   • The frontend MUST NOT use the service_role key to access this table.
--     Admin guard queries run via authenticated client using the user's session.
--   • After running this migration you must MANUALLY:
--       1. Create an Auth user in Supabase Dashboard → Authentication → Users.
--       2. Insert that user's UUID into admin_users.user_id.
--     No seed admin user is inserted here to avoid committing real credentials.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_users (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  email       text,
  role        text        NOT NULL DEFAULT 'admin'
                          CHECK (role IN ('admin')),
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  updated_at  timestamptz NOT NULL DEFAULT NOW(),

  CONSTRAINT admin_users_user_id_unique UNIQUE (user_id)
);

COMMENT ON TABLE admin_users IS
  'Admin identity table. Users present here with is_active=true are granted admin access. '
  'Managed manually via Supabase Dashboard or server-side tooling — never via the frontend anon key.';

COMMENT ON COLUMN admin_users.user_id IS
  'References auth.users.id. Cascade-deletes this row if the Auth user is deleted.';

COMMENT ON COLUMN admin_users.role IS
  'Admin role label. Constrained to (''admin'') for now; extend the CHECK when multi-role is needed.';

COMMENT ON COLUMN admin_users.is_active IS
  'Set to false to revoke access without hard-deleting the audit record.';


-- =============================================================================
-- SECTION 2: INDEXES
-- =============================================================================

-- Primary lookup: is this user_id an active admin?
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id
  ON admin_users (user_id);

-- Secondary: look up by email for Dashboard queries
CREATE INDEX IF NOT EXISTS idx_admin_users_email
  ON admin_users (email);

-- Filter: quickly find all active / inactive admins
CREATE INDEX IF NOT EXISTS idx_admin_users_is_active
  ON admin_users (is_active);


-- =============================================================================
-- SECTION 3: UPDATED_AT TRIGGER
-- =============================================================================

-- Reuses set_updated_at() defined in 001_initial_schema.sql.
-- If you are running this file standalone (without 001), create that function first:
--
--   CREATE OR REPLACE FUNCTION set_updated_at()
--   RETURNS TRIGGER LANGUAGE plpgsql AS $$
--   BEGIN
--     NEW.updated_at = NOW();
--     RETURN NEW;
--   END;
--   $$;

CREATE TRIGGER trg_admin_users_updated_at
  BEFORE UPDATE ON admin_users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- SECTION 4: ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Policy: self read
-- ---------------------------------------------------------------------------
-- An authenticated user can SELECT their own row IF is_active = true.
-- This is the only operation the frontend ever needs to perform on this table:
-- checking whether the current user is an active admin.
--
-- No INSERT / UPDATE / DELETE policies are created here.
-- All writes to admin_users must go through:
--   (a) the Supabase Dashboard, or
--   (b) a server-side function using the service_role key in a secure environment,
--   (c) a future admin-management policy reviewed separately.
-- ---------------------------------------------------------------------------
CREATE POLICY "admin_users: self read if active"
  ON admin_users FOR SELECT
  USING (
    auth.uid() = user_id
    AND is_active = true
  );

-- No anon access of any kind.
-- No insert / update / delete from the client.
-- Revoke or grant additional access only after explicit review.


COMMIT;


-- =============================================================================
-- REVIEW CHECKLIST (complete before executing in Supabase)
-- =============================================================================
--
--  □ 001_initial_schema.sql has already been executed in this project.
--    (uuid-ossp extension and set_updated_at() must exist.)
--
--  □ Confirm there is no existing admin_users table in Supabase
--    (Table Editor → check for conflicts).
--
--  □ Run the full file wrapped in BEGIN … COMMIT in the SQL Editor.
--    Verify "COMMIT" appears in the output with no errors.
--
--  □ After running, create an Auth user:
--      Supabase Dashboard → Authentication → Users → Invite / Add user
--
--  □ After creating the Auth user, insert the admin row manually:
--      INSERT INTO admin_users (user_id, email)
--      VALUES ('<paste-auth-user-uuid-here>', '<admin-email>');
--    Do NOT put the real UUID or email in this file.
--
--  □ Verify the RLS policy works:
--      Log in as the admin user in the app, then check:
--        SELECT * FROM admin_users WHERE user_id = auth.uid();
--      Should return exactly one row. Non-admin users should get 0 rows.
--
--  □ Verify anon access is blocked:
--      Without a session, the query above must return 0 rows.
--
--  □ Do NOT implement any admin write feature until the admin guard is in place
--    and the RLS policy above has been verified manually.

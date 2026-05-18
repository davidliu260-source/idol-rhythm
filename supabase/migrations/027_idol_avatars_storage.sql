-- =============================================================================
-- Idol Rhythm — Storage bucket `idol-avatars` + RLS policies (Phase I1b-A)
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   I1b-A: enables admin to upload idol photos directly to Supabase Storage
--   from /admin/idols/<id>/edit. I1a (migration 025) only supported pasting
--   an external public URL into idols.avatar_url; this migration adds a
--   first-party bucket so admin can pick a local file, the server uploads
--   it, and the public URL is written back to idols.avatar_url.
--
--   AI search and auto-download from external sources are explicitly OUT
--   of scope — those land in I1b-B with their own work order.
--
-- SCOPE
--   1. Create public Storage bucket `idol-avatars` with size/MIME limits
--   2. RLS on storage.objects:
--      - any role may SELECT (public read for frontend <img>)
--      - authenticated + admin_users may INSERT / UPDATE / DELETE objects
--      - everyone else is denied
--
-- IDEMPOTENCE
--   - INSERT INTO storage.buckets … ON CONFLICT DO UPDATE (safe on re-run)
--   - DROP POLICY IF EXISTS before CREATE POLICY (safe on re-run)
--
-- DEPENDENCY
--   Must be run AFTER:
--     002_admin_users.sql     — defines admin_users table
--     025_add_idol_avatar_url.sql — idols.avatar_url column exists
--
--   Supabase Storage (storage schema) is installed by default on every
--   Supabase project; no separate setup needed.
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
-- SECTION 1: Create / upsert the bucket
-- =============================================================================
-- public = true   → URLs at /storage/v1/object/public/idol-avatars/* are
--                   directly viewable; frontend <img src="..."> works without
--                   signed URL. The frontend already renders avatar_url
--                   directly through the IdolAvatar component (I1a).
-- file_size_limit = 2 MiB
-- allowed_mime_types = jpeg / png / webp
--                   SVG is intentionally excluded (XSS risk on inline SVG).
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'idol-avatars',
  'idol-avatars',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;


-- =============================================================================
-- SECTION 2: RLS on storage.objects, scoped to the new bucket
-- =============================================================================
-- storage.objects already has RLS enabled by Supabase. We add four policies
-- below; all check bucket_id = 'idol-avatars' so other buckets in this
-- project are unaffected.
--
-- Write paths (INSERT / UPDATE / DELETE) require:
--   1. authenticated role (Supabase session cookie)
--   2. row in public.admin_users for the current auth.uid()
-- This mirrors the admin_users pattern used everywhere else in this repo
-- (migrations 003, 005, 006, 008, 010, 011, 012).
-- =============================================================================

DROP POLICY IF EXISTS "idol-avatars: public read"   ON storage.objects;
DROP POLICY IF EXISTS "idol-avatars: admin insert"  ON storage.objects;
DROP POLICY IF EXISTS "idol-avatars: admin update"  ON storage.objects;
DROP POLICY IF EXISTS "idol-avatars: admin delete"  ON storage.objects;


CREATE POLICY "idol-avatars: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'idol-avatars');


CREATE POLICY "idol-avatars: admin insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'idol-avatars'
    AND EXISTS (
      SELECT 1 FROM public.admin_users
       WHERE admin_users.user_id   = auth.uid()
         AND admin_users.is_active = true
    )
  );


CREATE POLICY "idol-avatars: admin update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'idol-avatars'
    AND EXISTS (
      SELECT 1 FROM public.admin_users
       WHERE admin_users.user_id   = auth.uid()
         AND admin_users.is_active = true
    )
  )
  WITH CHECK (
    bucket_id = 'idol-avatars'
    AND EXISTS (
      SELECT 1 FROM public.admin_users
       WHERE admin_users.user_id   = auth.uid()
         AND admin_users.is_active = true
    )
  );


CREATE POLICY "idol-avatars: admin delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'idol-avatars'
    AND EXISTS (
      SELECT 1 FROM public.admin_users
       WHERE admin_users.user_id   = auth.uid()
         AND admin_users.is_active = true
    )
  );


COMMIT;


-- =============================================================================
-- REVIEW CHECKLIST (complete before executing in Supabase)
-- =============================================================================
--
--  □ Migrations 002 and 025 have already been executed.
--
--  □ Run the file wrapped in BEGIN … COMMIT. Verify "COMMIT" with no errors.
--
--  □ Verify the bucket exists with the expected settings:
--      SELECT id, public, file_size_limit, allowed_mime_types
--        FROM storage.buckets
--       WHERE id = 'idol-avatars';
--      Expected: one row, public=true, file_size_limit=2097152,
--                allowed_mime_types includes jpeg/png/webp.
--
--  □ Verify the four RLS policies exist:
--      SELECT policyname, cmd
--        FROM pg_policies
--       WHERE schemaname = 'storage'
--         AND tablename  = 'objects'
--         AND policyname LIKE 'idol-avatars:%';
--      Expected: four rows — public read / admin insert / admin update /
--                admin delete.
--
--  □ As anon (logged-out browser), browse a public URL such as
--    https://<project>.supabase.co/storage/v1/object/public/idol-avatars/test.jpg
--    Expected: 404 (no objects yet) but no 401/403. SELECT works regardless
--    of authentication.
--
--  □ After deploying the matching frontend (PR-A), upload a JPEG via
--    /admin/idols/<id>/edit. Confirm:
--      - File appears in storage.objects with bucket_id='idol-avatars'
--      - idols.avatar_url is updated to the new public URL
--      - /idols and the frontend cards show the new photo
--
--  □ Verify a non-admin authenticated user cannot upload:
--    they receive 403 / "new row violates row-level security policy".
--
-- =============================================================================

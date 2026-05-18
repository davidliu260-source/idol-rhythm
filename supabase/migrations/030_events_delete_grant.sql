-- Migration 030: Allow admins to delete draft events
--
-- Only unpublished events (is_published = false) can be deleted via this policy.
-- Published events must be unpublished first, ensuring no accidental data loss.
-- event_sources rows cascade automatically (FK ON DELETE CASCADE from migration 001).

GRANT DELETE ON events TO authenticated;

CREATE POLICY "Admin can delete draft events"
  ON events FOR DELETE
  TO authenticated
  USING (
    is_published = false
    AND auth.uid() IN (SELECT user_id FROM admin_users)
  );

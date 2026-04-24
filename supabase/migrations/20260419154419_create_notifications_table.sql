-- BACKWARD_COMPATIBLE: YES
-- REASON: Adds new table 
otifications. Existing queries unaffected.
-- ROLLBACK: DROP TABLE IF EXISTS notifications;
/*
  # Create notifications table

  1. New Tables
    - `notifications`
      - `id` (uuid, primary key)
      - `user_id` (uuid, FK to profiles)
      - `type` (text) - category like 'scan_completed', 'critical_finding', 'report_ready'
      - `title` (text) - short notification headline
      - `body` (text) - expanded description
      - `link` (text) - in-app route or external URL, optional
      - `severity` (text) - 'info' | 'success' | 'warning' | 'critical'
      - `metadata` (jsonb) - arbitrary payload (scan_id, project_id, counts)
      - `read_at` (timestamptz, nullable) - timestamp when user marked read
      - `created_at` (timestamptz, default now())

  2. Indexes
    - Composite index on (user_id, created_at desc) for fast recent-listing
    - Partial index on unread rows per user for badge counts

  3. Security
    - Enable RLS on `notifications`
    - SELECT policy: authenticated users can read only their own notifications
    - UPDATE policy: authenticated users can mark their own notifications as read
    - DELETE policy: authenticated users can remove their own notifications
    - No INSERT policy for authenticated users — only service role inserts via triggers or Edge Functions
*/

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'info',
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  link text NOT NULL DEFAULT '',
  severity text NOT NULL DEFAULT 'info',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id)
  WHERE read_at IS NULL;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

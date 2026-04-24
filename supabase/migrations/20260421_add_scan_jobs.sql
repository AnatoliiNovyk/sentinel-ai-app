-- BACKWARD_COMPATIBLE: YES
-- REASON: Adds new table scan_jobs for VPS agent job queue. Existing tables unaffected.
-- ROLLBACK: DROP TABLE IF EXISTS scan_jobs;
-- Add scan_jobs table for real scan queue
CREATE TABLE IF NOT EXISTS scan_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scanner text NOT NULL DEFAULT 'nmap',
  target text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','done','error')),
  error_message text,
  agent_id text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE scan_jobs ENABLE ROW LEVEL SECURITY;

-- Users can read their own jobs
CREATE POLICY "Users read own scan jobs"
  ON scan_jobs FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Service role (agent) can update jobs — no RLS restriction via service key
CREATE INDEX IF NOT EXISTS idx_scan_jobs_status ON scan_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_scan_jobs_user   ON scan_jobs(user_id);

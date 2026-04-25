-- Batch-77: agent_logs table for live scan logging
CREATE TABLE IF NOT EXISTS agent_logs (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id     uuid,
  scan_id    uuid,
  project_id uuid,
  level      text        NOT NULL DEFAULT 'info',
  message    text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read logs for their projects"
  ON agent_logs FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert agent_logs"
  ON agent_logs FOR INSERT
  WITH CHECK (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE agent_logs;

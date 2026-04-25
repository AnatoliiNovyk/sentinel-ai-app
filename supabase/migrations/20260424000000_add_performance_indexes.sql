-- Migration: 20260424000000_add_performance_indexes.sql
-- BACKWARD_COMPATIBLE: YES
-- Reason: CREATE INDEX CONCURRENTLY is not supported in transactions;
--         using plain CREATE INDEX IF NOT EXISTS for Supabase migrations.
--         Indexes improve query performance on large datasets without affecting data.

-- vulnerabilities: most common filter (scan_id + order by severity)
CREATE INDEX IF NOT EXISTS idx_vuln_scan_id
  ON vulnerabilities (scan_id);

CREATE INDEX IF NOT EXISTS idx_vuln_scan_severity
  ON vulnerabilities (scan_id, severity);

-- scans: most common filter (project_id + order by created_at)
CREATE INDEX IF NOT EXISTS idx_scans_project_created
  ON scans (project_id, created_at DESC);

-- scans: filter by org for team visibility
CREATE INDEX IF NOT EXISTS idx_scans_org_id
  ON scans (org_id);

-- audit_logs: compliance queries filter by org + action + timestamp
-- Wrapped in DO block: table may not exist in all environments
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_audit_logs_org_action
    ON audit_logs (org_id, action);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_org_timestamp
    ON audit_logs (org_id, timestamp DESC);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- scan_jobs: agent polls pending jobs per org
CREATE INDEX IF NOT EXISTS idx_scan_jobs_status_org
  ON scan_jobs (status, org_id);

-- notifications: user inbox queries
-- Wrapped in DO block: is_read column may not exist in all schema versions
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_notifications_user_read
    ON notifications (user_id, is_read, created_at DESC);
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

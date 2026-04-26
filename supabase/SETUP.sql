-- =============================================================================
-- SENTINEL AI — COMPLETE DATABASE SETUP SCRIPT
-- Run this in Supabase: Dashboard → SQL Editor → paste → Run
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. PROFILES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL DEFAULT '',
  full_name text NOT NULL DEFAULT '',
  company text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'owner',
  plan text NOT NULL DEFAULT 'free',
  created_at timestamptz NOT NULL DEFAULT now(),
  sla_config jsonb NOT NULL DEFAULT '{"critical":3,"high":7,"medium":30,"low":90}'::jsonb
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Users read own profile') THEN
    CREATE POLICY "Users read own profile" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Users insert own profile') THEN
    CREATE POLICY "Users insert own profile" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Users update own profile') THEN
    CREATE POLICY "Users update own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Users delete own profile') THEN
    CREATE POLICY "Users delete own profile" ON profiles FOR DELETE TO authenticated USING (auth.uid() = id);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. PROJECTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  target text NOT NULL DEFAULT '',
  environment text NOT NULL DEFAULT 'external',
  created_at timestamptz NOT NULL DEFAULT now(),
  tags text[] NOT NULL DEFAULT '{}',
  risk_score integer NOT NULL DEFAULT 0
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='projects' AND policyname='Users read own projects') THEN
    CREATE POLICY "Users read own projects" ON projects FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='projects' AND policyname='Users insert own projects') THEN
    CREATE POLICY "Users insert own projects" ON projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='projects' AND policyname='Users update own projects') THEN
    CREATE POLICY "Users update own projects" ON projects FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='projects' AND policyname='Users delete own projects') THEN
    CREATE POLICY "Users delete own projects" ON projects FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
CREATE INDEX IF NOT EXISTS projects_tags_idx ON projects USING gin (tags);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. SCANS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  scanner text NOT NULL DEFAULT 'nmap',
  status text NOT NULL DEFAULT 'queued',
  severity_summary jsonb NOT NULL DEFAULT '{"critical":0,"high":0,"medium":0,"low":0,"info":0}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE scans ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='scans' AND policyname='Users read own scans') THEN
    CREATE POLICY "Users read own scans" ON scans FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='scans' AND policyname='Users insert own scans') THEN
    CREATE POLICY "Users insert own scans" ON scans FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='scans' AND policyname='Users update own scans') THEN
    CREATE POLICY "Users update own scans" ON scans FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='scans' AND policyname='Users delete own scans') THEN
    CREATE POLICY "Users delete own scans" ON scans FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_scans_user ON scans(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_project ON scans(project_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. VULNERABILITIES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vulnerabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  severity text NOT NULL DEFAULT 'info',
  cve_id text NOT NULL DEFAULT '',
  mitre_tactic text NOT NULL DEFAULT '',
  cis_control text NOT NULL DEFAULT '',
  asset text NOT NULL DEFAULT '',
  remediation text NOT NULL DEFAULT '',
  remediation_code text NOT NULL DEFAULT '',
  remediation_type text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'open',
  note text NOT NULL DEFAULT '',
  status_updated_at timestamptz NOT NULL DEFAULT now(),
  sla_breached_at timestamptz,
  sla_warned_at timestamptz,
  CONSTRAINT vulnerabilities_status_check CHECK (status IN ('open','in_progress','accepted','resolved','false_positive'))
);

ALTER TABLE vulnerabilities ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='vulnerabilities' AND policyname='Users read own vulns') THEN
    CREATE POLICY "Users read own vulns" ON vulnerabilities FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='vulnerabilities' AND policyname='Users insert own vulns') THEN
    CREATE POLICY "Users insert own vulns" ON vulnerabilities FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='vulnerabilities' AND policyname='Users update own vulns') THEN
    CREATE POLICY "Users update own vulns" ON vulnerabilities FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='vulnerabilities' AND policyname='Users delete own vulns') THEN
    CREATE POLICY "Users delete own vulns" ON vulnerabilities FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_vulns_scan ON vulnerabilities(scan_id);
CREATE INDEX IF NOT EXISTS idx_vulns_user ON vulnerabilities(user_id);
CREATE INDEX IF NOT EXISTS vulnerabilities_status_idx ON vulnerabilities(user_id, status);
CREATE INDEX IF NOT EXISTS vulnerabilities_sla_breached_at_idx ON vulnerabilities(user_id, sla_breached_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. AI CONVERSATIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New conversation',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ai_conversations' AND policyname='Users read own conversations') THEN
    CREATE POLICY "Users read own conversations" ON ai_conversations FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ai_conversations' AND policyname='Users insert own conversations') THEN
    CREATE POLICY "Users insert own conversations" ON ai_conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ai_conversations' AND policyname='Users update own conversations') THEN
    CREATE POLICY "Users update own conversations" ON ai_conversations FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ai_conversations' AND policyname='Users delete own conversations') THEN
    CREATE POLICY "Users delete own conversations" ON ai_conversations FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. AI MESSAGES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'user',
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ai_messages' AND policyname='Users read own messages') THEN
    CREATE POLICY "Users read own messages" ON ai_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ai_messages' AND policyname='Users insert own messages') THEN
    CREATE POLICY "Users insert own messages" ON ai_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ai_messages' AND policyname='Users update own messages') THEN
    CREATE POLICY "Users update own messages" ON ai_messages FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ai_messages' AND policyname='Users delete own messages') THEN
    CREATE POLICY "Users delete own messages" ON ai_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_messages_conv ON ai_messages(conversation_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. REPORTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'executive',
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  share_token uuid,
  is_public boolean NOT NULL DEFAULT false
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reports' AND policyname='Users read own reports') THEN
    CREATE POLICY "Users read own reports" ON reports FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reports' AND policyname='Users insert own reports') THEN
    CREATE POLICY "Users insert own reports" ON reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reports' AND policyname='Users update own reports') THEN
    CREATE POLICY "Users update own reports" ON reports FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reports' AND policyname='Users delete own reports') THEN
    CREATE POLICY "Users delete own reports" ON reports FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reports' AND policyname='Public reports are readable by anyone') THEN
    CREATE POLICY "Public reports are readable by anyone"
      ON reports FOR SELECT TO anon, authenticated
      USING (is_public = true AND share_token IS NOT NULL);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS reports_share_token_key ON reports(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. NOTIFICATIONS
-- ─────────────────────────────────────────────────────────────────────────────
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

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notifications' AND policyname='Users can view own notifications') THEN
    CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notifications' AND policyname='Users can insert own notifications') THEN
    CREATE POLICY "Users can insert own notifications" ON notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notifications' AND policyname='Users can update own notifications') THEN
    CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notifications' AND policyname='Users can delete own notifications') THEN
    CREATE POLICY "Users can delete own notifications" ON notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id) WHERE read_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. SCAN SCHEDULES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scan_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scanner text NOT NULL DEFAULT 'nmap',
  cadence_hours integer NOT NULL DEFAULT 24,
  enabled boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE scan_schedules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='scan_schedules' AND policyname='Users can view own schedules') THEN
    CREATE POLICY "Users can view own schedules" ON scan_schedules FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='scan_schedules' AND policyname='Users can insert own schedules') THEN
    CREATE POLICY "Users can insert own schedules" ON scan_schedules FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='scan_schedules' AND policyname='Users can update own schedules') THEN
    CREATE POLICY "Users can update own schedules" ON scan_schedules FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='scan_schedules' AND policyname='Users can delete own schedules') THEN
    CREATE POLICY "Users can delete own schedules" ON scan_schedules FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_scan_schedules_due ON scan_schedules(user_id, enabled, next_run_at);

-- =============================================================================
-- 10. SCAN JOBS  (used by scan-dispatch edge function + VPS agent)
-- =============================================================================
CREATE TABLE IF NOT EXISTS scan_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scanner text NOT NULL DEFAULT 'nmap',
  target text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  error_message text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT scan_jobs_status_check CHECK (status IN ('pending','running','done','error'))
);

ALTER TABLE scan_jobs ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read their own jobs (for status polling)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='scan_jobs' AND policyname='Users read own jobs') THEN
    CREATE POLICY "Users read own jobs" ON scan_jobs FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  -- Service role (used by edge functions and agent) bypasses RLS automatically
END $$;

CREATE INDEX IF NOT EXISTS idx_scan_jobs_pending ON scan_jobs(status, created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_scan_jobs_scan ON scan_jobs(scan_id);

-- =============================================================================
-- 11. PRESENCE (Real-time collaboration — who's viewing what)
-- =============================================================================
CREATE TABLE IF NOT EXISTS presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  context_type text NOT NULL,
  context_id text NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  cursor_x integer,
  cursor_y integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT presence_context_check CHECK (context_type IN ('project', 'scan', 'report', 'finding')),
  UNIQUE (user_id, org_id, context_type, context_id)
);

ALTER TABLE presence ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='presence' AND policyname='Users can view org presence') THEN
    CREATE POLICY "Users can view org presence" ON presence FOR SELECT TO authenticated 
      USING (org_id IN (SELECT org_id FROM team_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='presence' AND policyname='Users can update own presence') THEN
    CREATE POLICY "Users can update own presence" ON presence FOR UPDATE TO authenticated 
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='presence' AND policyname='Users can insert own presence') THEN
    CREATE POLICY "Users can insert own presence" ON presence FOR INSERT TO authenticated 
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_presence_org_context ON presence(org_id, context_type, context_id);
CREATE INDEX IF NOT EXISTS idx_presence_last_seen ON presence(last_seen_at DESC);

-- =============================================================================
-- 12. FINDING COMMENTS (Team discussion on vulnerabilities)
-- =============================================================================
CREATE TABLE IF NOT EXISTS finding_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vulnerability_id uuid NOT NULL REFERENCES vulnerabilities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  parent_id uuid REFERENCES finding_comments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE finding_comments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='finding_comments' AND policyname='Users can read org comments') THEN
    CREATE POLICY "Users can read org comments" ON finding_comments FOR SELECT TO authenticated 
      USING (user_id IN (SELECT user_id FROM team_members WHERE org_id IN (SELECT org_id FROM projects WHERE id IN (SELECT project_id FROM scans WHERE id IN (SELECT scan_id FROM vulnerabilities WHERE id = finding_comments.vulnerability_id)))));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='finding_comments' AND policyname='Users can insert comments') THEN
    CREATE POLICY "Users can insert comments" ON finding_comments FOR INSERT TO authenticated 
      WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='finding_comments' AND policyname='Users can update own comments') THEN
    CREATE POLICY "Users can update own comments" ON finding_comments FOR UPDATE TO authenticated 
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='finding_comments' AND policyname='Users can delete own comments') THEN
    CREATE POLICY "Users can delete own comments" ON finding_comments FOR DELETE TO authenticated 
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_finding_comments_vulnerability ON finding_comments(vulnerability_id);
CREATE INDEX IF NOT EXISTS idx_finding_comments_user ON finding_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_finding_comments_parent ON finding_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_finding_comments_created ON finding_comments(created_at DESC);

-- =============================================================================
-- 13. API USAGE TRACKING (Rate limiting and quota management)
-- =============================================================================
CREATE TABLE IF NOT EXISTS api_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  metric text NOT NULL DEFAULT 'scans_per_month',
  count integer NOT NULL DEFAULT 0,
  reset_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT api_usage_metric_check CHECK (metric IN ('scans_per_month', 'reports_per_day', 'chat_messages_per_hour', 'api_calls_per_second'))
);

ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='api_usage' AND policyname='Users read own usage') THEN
    CREATE POLICY "Users read own usage" ON api_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='api_usage' AND policyname='Users can insert usage records') THEN
    CREATE POLICY "Users can insert usage records" ON api_usage FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='api_usage' AND policyname='Users can update own usage') THEN
    CREATE POLICY "Users can update own usage" ON api_usage FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_api_usage_user_metric ON api_usage(user_id, metric);
CREATE INDEX IF NOT EXISTS idx_api_usage_reset ON api_usage(reset_at DESC);

-- =============================================================================
-- REMEDIATION SUGGESTIONS (Batch-149)
-- =============================================================================
CREATE TABLE IF NOT EXISTS remediation_suggestions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vulnerability_id uuid NOT NULL REFERENCES vulnerabilities(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary         text NOT NULL,
  priority        text NOT NULL CHECK (priority IN ('immediate', 'high', 'medium', 'low')),
  effort          text NOT NULL CHECK (effort IN ('quick-win', 'moderate', 'complex')),
  estimated_time  text,
  steps           jsonb NOT NULL DEFAULT '[]',
  references      jsonb NOT NULL DEFAULT '[]',
  generated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT remediation_suggestions_vuln_unique UNIQUE (vulnerability_id)
);

ALTER TABLE remediation_suggestions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='remediation_suggestions' AND policyname='Users read own suggestions') THEN
    CREATE POLICY "Users read own suggestions" ON remediation_suggestions FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='remediation_suggestions' AND policyname='Users can insert suggestions') THEN
    CREATE POLICY "Users can insert suggestions" ON remediation_suggestions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='remediation_suggestions' AND policyname='Users can update own suggestions') THEN
    CREATE POLICY "Users can update own suggestions" ON remediation_suggestions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='remediation_suggestions' AND policyname='Users can delete own suggestions') THEN
    CREATE POLICY "Users can delete own suggestions" ON remediation_suggestions FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_remediation_vuln ON remediation_suggestions(vulnerability_id);
CREATE INDEX IF NOT EXISTS idx_remediation_user ON remediation_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_remediation_priority ON remediation_suggestions(priority);

-- =============================================================================
-- DONE ✓
-- =============================================================================

-- BACKWARD_COMPATIBLE: N/A (initial schema)
-- REASON: First migration — no prior schema exists.
-- ROLLBACK: Drop all created tables. Data will be lost.
/*
  # AI Cybersecurity Platform - Initial Schema

  ## Overview
  Creates the core schema for an AI-driven cybersecurity audit SaaS platform. The platform allows
  users to manage projects, run AI-orchestrated security scans, view vulnerabilities mapped to
  industry frameworks, chat with AI agents, and generate actionable reports.

  ## 1. New Tables

  ### `profiles`
  Extended user profile linked to auth.users.
  - `id` (uuid, PK) - references auth.users
  - `email` (text) - user email
  - `full_name` (text) - display name
  - `company` (text) - company name
  - `role` (text) - user role (owner, member)
  - `plan` (text) - subscription plan (free, basic, pro, enterprise)
  - `created_at` (timestamptz)

  ### `projects`
  Client infrastructure projects to be audited.
  - `id` (uuid, PK)
  - `user_id` (uuid, FK -> profiles)
  - `name` (text) - project name
  - `description` (text)
  - `target` (text) - target host/cloud account
  - `environment` (text) - external, cloud, internal, iac
  - `created_at` (timestamptz)

  ### `scans`
  Security scans executed against projects.
  - `id` (uuid, PK)
  - `project_id` (uuid, FK -> projects)
  - `user_id` (uuid, FK -> profiles)
  - `scanner` (text) - nmap, prowler, tfsec, openvas, amass, etc.
  - `status` (text) - queued, running, completed, failed
  - `severity_summary` (jsonb) - counts by severity
  - `started_at` (timestamptz)
  - `completed_at` (timestamptz)
  - `created_at` (timestamptz)

  ### `vulnerabilities`
  Normalized vulnerabilities found during scans.
  - `id` (uuid, PK)
  - `scan_id` (uuid, FK -> scans)
  - `user_id` (uuid, FK -> profiles)
  - `title` (text)
  - `description` (text)
  - `severity` (text) - critical, high, medium, low, info
  - `cve_id` (text)
  - `mitre_tactic` (text)
  - `cis_control` (text)
  - `asset` (text)
  - `remediation` (text)
  - `created_at` (timestamptz)

  ### `ai_conversations`
  Chat threads between users and AI agents.
  - `id` (uuid, PK)
  - `user_id` (uuid, FK -> profiles)
  - `title` (text)
  - `created_at` (timestamptz)

  ### `ai_messages`
  Individual messages within a conversation.
  - `id` (uuid, PK)
  - `conversation_id` (uuid, FK -> ai_conversations)
  - `user_id` (uuid, FK -> profiles)
  - `role` (text) - user, assistant, system
  - `content` (text)
  - `created_at` (timestamptz)

  ### `reports`
  Generated audit reports.
  - `id` (uuid, PK)
  - `project_id` (uuid, FK -> projects)
  - `user_id` (uuid, FK -> profiles)
  - `title` (text)
  - `kind` (text) - executive, technical
  - `content` (text)
  - `created_at` (timestamptz)

  ## 2. Security
  - RLS enabled on every table.
  - Each policy restricts access to `auth.uid() = user_id`.
  - Separate SELECT/INSERT/UPDATE/DELETE policies per table.

  ## 3. Notes
  1. All tables default timestamps to `now()`.
  2. Severity summary stored as jsonb for flexibility.
  3. Profiles row is expected to be created on first sign-in by the client app.
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL DEFAULT '',
  full_name text NOT NULL DEFAULT '',
  company text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'owner',
  plan text NOT NULL DEFAULT 'free',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own profile" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users delete own profile" ON profiles FOR DELETE TO authenticated USING (auth.uid() = id);

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  target text NOT NULL DEFAULT '',
  environment text NOT NULL DEFAULT 'external',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own projects" ON projects FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own projects" ON projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own projects" ON projects FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own projects" ON projects FOR DELETE TO authenticated USING (auth.uid() = user_id);

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

CREATE POLICY "Users read own scans" ON scans FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own scans" ON scans FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own scans" ON scans FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own scans" ON scans FOR DELETE TO authenticated USING (auth.uid() = user_id);

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
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vulnerabilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own vulns" ON vulnerabilities FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own vulns" ON vulnerabilities FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own vulns" ON vulnerabilities FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own vulns" ON vulnerabilities FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New conversation',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own conversations" ON ai_conversations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own conversations" ON ai_conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own conversations" ON ai_conversations FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own conversations" ON ai_conversations FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'user',
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own messages" ON ai_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own messages" ON ai_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own messages" ON ai_messages FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own messages" ON ai_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'executive',
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own reports" ON reports FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own reports" ON reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own reports" ON reports FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own reports" ON reports FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_user ON scans(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_project ON scans(project_id);
CREATE INDEX IF NOT EXISTS idx_vulns_scan ON vulnerabilities(scan_id);
CREATE INDEX IF NOT EXISTS idx_vulns_user ON vulnerabilities(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id);

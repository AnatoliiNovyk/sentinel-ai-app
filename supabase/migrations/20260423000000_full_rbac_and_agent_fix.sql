-- BACKWARD_COMPATIBLE: CONDITIONAL
-- REASON: Adds org_id FK columns and rewrites RLS policies for team RBAC. Apps not sending org_id will receive empty result sets.
-- ROLLBACK: Revert org_id columns and restore previous RLS policies. High effort — coordinate with team.
-- PHASE 1: RBAC STRUCTURE
-- 1. Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- 2. Create team_members table
CREATE TABLE IF NOT EXISTS team_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
    created_at timestamptz DEFAULT now(),
    UNIQUE(org_id, user_id)
);

-- 3. Add org_id to existing tables
ALTER TABLE projects ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE vulnerabilities ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

-- 4. Update RLS Policies
-- Drop old user-based policies
DROP POLICY IF EXISTS "Users can view own projects" ON projects;
DROP POLICY IF EXISTS "Users can insert own projects" ON projects;
DROP POLICY IF EXISTS "Users can update own projects" ON projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON projects;

DROP POLICY IF EXISTS "Users can view own scans" ON scans;
DROP POLICY IF EXISTS "Users can view own vulnerabilities" ON vulnerabilities;
DROP POLICY IF EXISTS "Users can view own reports" ON reports;

-- New Team-based Policies
CREATE POLICY "Team members can view organization projects" 
ON projects FOR SELECT 
USING (EXISTS (SELECT 1 FROM team_members WHERE org_id = projects.org_id AND user_id = auth.uid()));

CREATE POLICY "Team members can view organization scans" 
ON scans FOR SELECT 
USING (EXISTS (SELECT 1 FROM team_members WHERE org_id = scans.org_id AND user_id = auth.uid()));

CREATE POLICY "Team members can view organization vulnerabilities" 
ON vulnerabilities FOR SELECT 
USING (EXISTS (SELECT 1 FROM team_members WHERE org_id = vulnerabilities.org_id AND user_id = auth.uid()));

CREATE POLICY "Team members can view organization reports" 
ON reports FOR SELECT 
USING (EXISTS (SELECT 1 FROM team_members WHERE org_id = reports.org_id AND user_id = auth.uid()));

-- Enable RLS for new tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own organizations" 
ON organizations FOR SELECT 
USING (EXISTS (SELECT 1 FROM team_members WHERE org_id = id AND user_id = auth.uid()));


-- PHASE 2: AGENT RACE CONDITION FIX
-- Create atomic job claim function
CREATE OR REPLACE FUNCTION claim_next_job()
RETURNS SETOF scan_jobs
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  UPDATE scan_jobs
  SET status = 'running',
      started_at = now()
  WHERE id = (
    SELECT id
    FROM scan_jobs
    WHERE status = 'pending'
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  RETURNING *;
END;
$$;

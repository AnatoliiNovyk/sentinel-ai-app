-- Migration: Create remediation_workflows and remediation_events tables
-- Phase 5, Batch 2 — Auto-Remediation
-- Purpose: Track remediation workflows and their execution audit trail

-- Create remediation_workflows table
CREATE TABLE IF NOT EXISTS public.remediation_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rule_id uuid NOT NULL REFERENCES public.alert_rules(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  
  name text NOT NULL,
  description text,
  
  -- Actions to execute (JSONB array of RemediationAction objects)
  actions jsonb NOT NULL DEFAULT '[]',
  
  -- Execution settings
  enabled boolean NOT NULL DEFAULT true,
  execute_sequentially boolean NOT NULL DEFAULT true,
  stop_on_first_failure boolean NOT NULL DEFAULT true,
  
  -- Tracking
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_executed_at timestamptz,
  execution_count integer DEFAULT 0,
  
  -- Audit
  created_by text,
  updated_by text
);

-- Create remediation_events table (audit trail)
CREATE TABLE IF NOT EXISTS public.remediation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.remediation_workflows(id) ON DELETE CASCADE,
  rule_id uuid NOT NULL REFERENCES public.alert_rules(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  
  -- Trigger context
  trigger_reason text NOT NULL,
  vulnerability_ids jsonb DEFAULT '[]', -- Array of vuln UUIDs
  
  -- Execution status
  overall_status text NOT NULL DEFAULT 'pending' CHECK (overall_status IN ('pending', 'in_progress', 'succeeded', 'partially_succeeded', 'failed')),
  
  -- Action results (array of action execution results)
  action_results jsonb NOT NULL DEFAULT '[]',
  
  -- Metadata
  triggered_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  
  -- Audit
  approved_by text,
  approved_at timestamptz,
  notes text,
  
  -- Statistics
  total_actions integer NOT NULL DEFAULT 0,
  success_count integer NOT NULL DEFAULT 0,
  failure_count integer NOT NULL DEFAULT 0,
  retry_count integer NOT NULL DEFAULT 0,
  execution_time_ms integer DEFAULT 0
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_remediation_workflows_user_id 
  ON public.remediation_workflows (user_id);

CREATE INDEX IF NOT EXISTS idx_remediation_workflows_rule_id 
  ON public.remediation_workflows (rule_id);

CREATE INDEX IF NOT EXISTS idx_remediation_workflows_enabled 
  ON public.remediation_workflows (enabled) 
  WHERE enabled = true;

CREATE INDEX IF NOT EXISTS idx_remediation_events_workflow_id 
  ON public.remediation_events (workflow_id);

CREATE INDEX IF NOT EXISTS idx_remediation_events_user_id 
  ON public.remediation_events (user_id);

CREATE INDEX IF NOT EXISTS idx_remediation_events_triggered_at 
  ON public.remediation_events (triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_remediation_events_status 
  ON public.remediation_events (overall_status) 
  WHERE overall_status != 'succeeded';

-- Enable RLS
ALTER TABLE public.remediation_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remediation_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for remediation_workflows
CREATE POLICY remediation_workflows_select_policy
  ON public.remediation_workflows FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY remediation_workflows_insert_policy
  ON public.remediation_workflows FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY remediation_workflows_update_policy
  ON public.remediation_workflows FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY remediation_workflows_delete_policy
  ON public.remediation_workflows FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for remediation_events
CREATE POLICY remediation_events_select_policy
  ON public.remediation_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY remediation_events_insert_policy
  ON public.remediation_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Comments
COMMENT ON TABLE public.remediation_workflows IS 'Automation workflows for handling alert triggers (Phase 5, Batch 2)';
COMMENT ON COLUMN public.remediation_workflows.actions IS 'Array of RemediationAction objects: disable_asset, isolate_network, escalate_management, etc.';
COMMENT ON COLUMN public.remediation_workflows.execute_sequentially IS 'If true, actions execute in order; if false, execute in parallel';
COMMENT ON COLUMN public.remediation_workflows.stop_on_first_failure IS 'If true, stop workflow on first failed action';

COMMENT ON TABLE public.remediation_events IS 'Audit trail of remediation workflow executions (Phase 5, Batch 2)';
COMMENT ON COLUMN public.remediation_events.trigger_reason IS 'Human-readable reason for execution (e.g., "Rule matched: Critical CVE")';
COMMENT ON COLUMN public.remediation_events.action_results IS 'Array of action execution results with status and output';
COMMENT ON COLUMN public.remediation_events.overall_status IS 'Workflow status: pending|in_progress|succeeded|partially_succeeded|failed';

-- Migration: Create alert_rules table for Phase 5 (Alert Rules Engine)
-- Purpose: Store alert rules for automated notifications + remediation workflows
-- Timestamp: 2026-05-05 15:00

-- Create alert_rules table
CREATE TABLE IF NOT EXISTS public.alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  
  -- Rule metadata
  name text NOT NULL,
  description text,
  
  -- Rule configuration
  rule_type text NOT NULL DEFAULT 'severity_based' CHECK (rule_type IN ('severity_based', 'pattern_matching', 'frequency_based', 'custom')),
  
  -- Condition: { severity?: string[], cvePattern?: string, eventCount?: number, timeWindow?: number, customLogic?: string }
  condition jsonb NOT NULL DEFAULT '{}',
  
  -- Actions: { notify?: boolean, channels?: string[], disable?: boolean, escalate?: boolean, webhook?: string }
  actions jsonb NOT NULL DEFAULT '{"notify": true, "channels": ["email"]}',
  
  -- Evaluation settings
  enabled boolean NOT NULL DEFAULT true,
  cooldown_minutes integer DEFAULT 60,
  max_triggers_per_day integer DEFAULT 10,
  
  -- Tracking
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_triggered_at timestamptz,
  trigger_count integer DEFAULT 0,
  
  -- Audit
  created_by text,
  updated_by text
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_alert_rules_user_id 
  ON public.alert_rules (user_id);

CREATE INDEX IF NOT EXISTS idx_alert_rules_project_id 
  ON public.alert_rules (project_id);

CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled 
  ON public.alert_rules (enabled) 
  WHERE enabled = true;

CREATE INDEX IF NOT EXISTS idx_alert_rules_created_at 
  ON public.alert_rules (created_at DESC);

-- Enable RLS
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own rules or org rules (if org_id allowed)
CREATE POLICY alert_rules_select_policy
  ON public.alert_rules FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

-- RLS Policy: Users can insert rules for themselves
CREATE POLICY alert_rules_insert_policy
  ON public.alert_rules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own rules
CREATE POLICY alert_rules_update_policy
  ON public.alert_rules FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can delete their own rules
CREATE POLICY alert_rules_delete_policy
  ON public.alert_rules FOR DELETE
  USING (auth.uid() = user_id);

-- Comments
COMMENT ON TABLE public.alert_rules IS 'Alert rules for automated notifications and remediation workflows (Phase 5)';
COMMENT ON COLUMN public.alert_rules.rule_type IS 'Type of rule: severity_based, pattern_matching, frequency_based, custom';
COMMENT ON COLUMN public.alert_rules.condition IS 'Rule condition as JSONB: { severity?: string[], cvePattern?: string, eventCount?: number, timeWindow?: number }';
COMMENT ON COLUMN public.alert_rules.actions IS 'Actions to trigger: { notify?: boolean, channels?: string[], disable?: boolean, escalate?: boolean, webhook?: string }';
COMMENT ON COLUMN public.alert_rules.cooldown_minutes IS 'Cooldown period to prevent alert fatigue (default 60 min)';
COMMENT ON COLUMN public.alert_rules.last_triggered_at IS 'Timestamp of last successful trigger evaluation';
COMMENT ON COLUMN public.alert_rules.trigger_count IS 'Count of times rule triggered today (for rate limiting)';

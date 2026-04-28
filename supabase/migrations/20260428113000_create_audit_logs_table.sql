-- Create audit_logs table (idempotent) for lifecycle audit trail
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  user_id uuid NOT NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  changes jsonb,
  status text NOT NULL CHECK (status IN ('success', 'failure')),
  error_code text,
  error_message text,
  ip_address text,
  user_agent text,
  metadata jsonb,
  timestamp timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can read own org audit logs"
    ON public.audit_logs FOR SELECT
    USING (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.team_members tm
        WHERE tm.org_id = audit_logs.org_id
          AND tm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own audit logs"
    ON public.audit_logs FOR INSERT
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can manage audit logs"
    ON public.audit_logs FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_action
  ON public.audit_logs (org_id, action);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_timestamp
  ON public.audit_logs (org_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created
  ON public.audit_logs (user_id, created_at DESC);

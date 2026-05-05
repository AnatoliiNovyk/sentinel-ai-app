-- GDPR/SOC2 data retention: cleanup function for agent_logs and audit_logs
-- Callable by service role only; returns count of deleted rows per table.

CREATE OR REPLACE FUNCTION public.cleanup_old_logs(retention_days int DEFAULT 90)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cutoff        timestamptz;
  v_agent_deleted bigint := 0;
  v_audit_deleted bigint := 0;
BEGIN
  -- Only service role may call this function
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'cleanup_old_logs: permission denied (service_role required)';
  END IF;

  IF retention_days < 1 THEN
    RAISE EXCEPTION 'cleanup_old_logs: retention_days must be >= 1';
  END IF;

  v_cutoff := now() - (retention_days || ' days')::interval;

  -- Delete old agent_logs
  WITH deleted AS (
    DELETE FROM public.agent_logs
    WHERE created_at < v_cutoff
    RETURNING id
  )
  SELECT count(*) INTO v_agent_deleted FROM deleted;

  -- Delete old audit_logs
  WITH deleted AS (
    DELETE FROM public.audit_logs
    WHERE created_at < v_cutoff
    RETURNING id
  )
  SELECT count(*) INTO v_audit_deleted FROM deleted;

  RETURN jsonb_build_object(
    'retention_days',   retention_days,
    'cutoff',           v_cutoff,
    'agent_logs_deleted', v_agent_deleted,
    'audit_logs_deleted', v_audit_deleted,
    'total_deleted',    v_agent_deleted + v_audit_deleted
  );
END;
$$;

-- Revoke public execute, grant only to service_role
REVOKE ALL ON FUNCTION public.cleanup_old_logs(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_old_logs(int) TO service_role;

COMMENT ON FUNCTION public.cleanup_old_logs(int) IS
  'GDPR/SOC2 data retention: deletes agent_logs and audit_logs older than retention_days (default 90). '
  'Callable by service_role only. Returns JSON with counts of deleted rows.';

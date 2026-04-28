-- P2 safety-net: database-level cleanup for stale running jobs/scans
-- This RPC is intended as a fallback mechanism in case the agent watchdog is unavailable.

CREATE OR REPLACE FUNCTION public.cleanup_stale_running_jobs(timeout_minutes integer DEFAULT 180)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_jobs_updated integer := 0;
  v_scans_updated integer := 0;
  v_cutoff timestamptz := now() - make_interval(mins => GREATEST(timeout_minutes, 1));
BEGIN
  WITH stale_jobs AS (
    SELECT sj.id, sj.scan_id
    FROM public.scan_jobs sj
    WHERE sj.status = 'running'
      AND sj.started_at IS NOT NULL
      AND sj.started_at < v_cutoff
    FOR UPDATE SKIP LOCKED
  ),
  updated_jobs AS (
    UPDATE public.scan_jobs sj
    SET
      status = 'error',
      error_message = format('stale timeout auto-fail (%s m)', GREATEST(timeout_minutes, 1)),
      completed_at = now()
    FROM stale_jobs st
    WHERE sj.id = st.id
      AND sj.status = 'running'
    RETURNING sj.id, sj.scan_id
  ),
  updated_scans AS (
    UPDATE public.scans sc
    SET
      status = 'failed',
      completed_at = now()
    WHERE sc.status = 'running'
      AND sc.id IN (
        SELECT DISTINCT uj.scan_id
        FROM updated_jobs uj
        WHERE uj.scan_id IS NOT NULL
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.scan_jobs sj2
        WHERE sj2.scan_id = sc.id
          AND sj2.status = 'running'
      )
    RETURNING sc.id
  )
  SELECT
    (SELECT COUNT(*) FROM updated_jobs),
    (SELECT COUNT(*) FROM updated_scans)
  INTO v_jobs_updated, v_scans_updated;

  RETURN jsonb_build_object(
    'timeout_minutes', GREATEST(timeout_minutes, 1),
    'cutoff', v_cutoff,
    'jobs_updated', v_jobs_updated,
    'scans_updated', v_scans_updated
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_stale_running_jobs(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_running_jobs(integer) TO service_role;

-- Migration: Add trace_id column to agent_logs for OpenTelemetry distributed tracing
-- Phase 3 — Observability

ALTER TABLE public.agent_logs
  ADD COLUMN IF NOT EXISTS trace_id text,
  ADD COLUMN IF NOT EXISTS span_id  text;

-- Index for trace-based queries (e.g., find all logs for a trace)
CREATE INDEX IF NOT EXISTS idx_agent_logs_trace_id
  ON public.agent_logs (trace_id)
  WHERE trace_id IS NOT NULL;

COMMENT ON COLUMN public.agent_logs.trace_id IS 'OpenTelemetry W3C trace ID (32-char hex)';
COMMENT ON COLUMN public.agent_logs.span_id  IS 'OpenTelemetry W3C span ID (16-char hex)';

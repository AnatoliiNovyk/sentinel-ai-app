import { supabase } from '../lib/supabase';
import { ErrorCode, failure, Result, success } from '../lib/errors';

const POLL_MAX_ATTEMPTS = 40;
const POLL_BASE_DELAY_MS = 1_500;
const POLL_MAX_DELAY_MS = 8_000;
const POLL_JITTER_RATIO = 0.2;

const NON_RETRYABLE_DB_ERROR_CODES = new Set(['42501', 'PGRST301', 'PGRST302']);

function getBackoffDelayMs(attempt: number): number {
  const exponential = Math.min(POLL_MAX_DELAY_MS, POLL_BASE_DELAY_MS * (2 ** attempt));
  const jitterMultiplier = 1 + ((Math.random() * 2 - 1) * POLL_JITTER_RATIO);
  return Math.max(250, Math.round(exponential * jitterMultiplier));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryablePollingError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return true;
  const code = (err as { code?: unknown }).code;
  if (typeof code !== 'string') return true;
  return !NON_RETRYABLE_DB_ERROR_CODES.has(code);
}

export interface AiTaskRequest {
  title: string;
  description: string;
  severity: string;
  asset: string;
  cve_id?: string;
  project_id: string;
  scan_id: string;
  user_id: string;
}

export const AiService = {
  async generateFix(req: AiTaskRequest): Promise<Result<string>> {
    const prompt = `
      As a security engineer, analyze this vulnerability and provide a remediation plan.
      
      Vulnerability: ${req.title}
      Severity: ${req.severity}
      Asset: ${req.asset}
      CVE: ${req.cve_id || 'N/A'}
      Description: ${req.description}
      
      Provide a clear remediation plan and, if applicable, a code snippet (e.g., bash, python, terraform) to fix it.
      Format the response as JSON: { "explanation": "...", "remediation": "...", "code": "..." }
    `;

    // Note: When calling a function with a single JSONB parameter,
    // PostgREST/Supabase-js sometimes expects the object directly as the payload.
    // However, to be absolutely sure and avoid 404s, we use the named parameter 'params'.
    // BUT, if we still get 404, we try the anonymous call (passing the object directly).
    const { data: jobId, error: rpcErr } = await supabase.rpc('dispatch_ai_task', {
      project_id: req.project_id,
      scan_id: req.scan_id,
      user_id: req.user_id,
      target: prompt,
      metadata: { type: 'fix_generation', scan_id: req.scan_id }
    });

    if (rpcErr || !jobId) {
      return failure(ErrorCode.AI_RPC_FAILED, 'Failed to dispatch AI fix generation.', rpcErr, {
        projectId: req.project_id,
        scanId: req.scan_id,
      });
    }
    return success(jobId);
  },

  async dispatchChatTask(
    projectId: string,
    conversationId: string,
    userId: string,
    content: string,
  ): Promise<Result<string>> {
    const { data, error } = await supabase.rpc('dispatch_ai_task', {
      project_id: projectId,
      scan_id: null,
      user_id: userId,
      target: content,
      metadata: { type: 'chat_response', conversation_id: conversationId }
    });

    if (error || !data) {
      return failure(ErrorCode.AI_RPC_FAILED, 'Failed to dispatch AI chat task.', error, {
        projectId,
        conversationId,
      });
    }
    return success(data);
  },

  async pollForResult(scanId: string | null, startTime: number): Promise<Result<unknown>> {
    let lastRetryableError: unknown;

    for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
      let query = supabase
        .from('vulnerabilities')
        .select('*')
        .eq('title', 'AI Security Response')
        .gt('created_at', new Date(startTime).toISOString());

      if (scanId) {
        query = query.eq('scan_id', scanId);
      } else {
        query = query.is('scan_id', null);
      }

      try {
        const { data, error } = await query.maybeSingle();

        if (data) return success(data);

        if (error) {
          if (!isRetryablePollingError(error)) {
            return failure(
              ErrorCode.AI_POLLING_FAILED,
              'AI polling failed due to a non-retryable query error.',
              error,
              { scanId, attempt: i + 1 },
            );
          }
          lastRetryableError = error;
        }
      } catch (err) {
        if (!isRetryablePollingError(err)) {
          return failure(
            ErrorCode.AI_POLLING_FAILED,
            'AI polling failed due to a non-retryable runtime error.',
            err,
            { scanId, attempt: i + 1 },
          );
        }
        lastRetryableError = err;
      }

      if (i < POLL_MAX_ATTEMPTS - 1) {
        await sleep(getBackoffDelayMs(i));
      }
    }

    return failure(
      ErrorCode.AI_PROCESSING_TIMEOUT,
      'AI processing timed out. Please check again in a moment.',
      lastRetryableError,
      { scanId, attempts: POLL_MAX_ATTEMPTS },
    );
  }
};

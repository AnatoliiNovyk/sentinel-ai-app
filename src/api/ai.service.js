import { supabase } from '../lib/supabase';
import { ErrorCode, failure, success } from '../lib/errors';
const DEFAULT_POLLING_POLICY = {
    maxAttempts: 40,
    baseDelayMs: 1500,
    maxDelayMs: 8000,
    jitterRatio: 0.2,
};
const POLL_ATTEMPTS_RANGE = { min: 1, max: 300 };
const POLL_DELAY_RANGE_MS = { min: 100, max: 60000 };
const POLL_JITTER_RANGE = { min: 0, max: 1 };
const NON_RETRYABLE_DB_ERROR_CODES = new Set(['42501', 'PGRST301', 'PGRST302']);
function parseNumberEnv(name) {
    const raw = import.meta.env[name];
    if (typeof raw !== 'string' || raw.trim().length === 0)
        return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
}
function clampToInt(value) {
    return Math.trunc(value);
}
export function getPollingPolicy() {
    const attempts = parseNumberEnv('VITE_AI_POLL_MAX_ATTEMPTS');
    const baseDelay = parseNumberEnv('VITE_AI_POLL_BASE_DELAY_MS');
    const maxDelay = parseNumberEnv('VITE_AI_POLL_MAX_DELAY_MS');
    const jitter = parseNumberEnv('VITE_AI_POLL_JITTER_RATIO');
    const maxAttempts = attempts !== null &&
        attempts >= POLL_ATTEMPTS_RANGE.min &&
        attempts <= POLL_ATTEMPTS_RANGE.max
        ? clampToInt(attempts)
        : DEFAULT_POLLING_POLICY.maxAttempts;
    const baseDelayMs = baseDelay !== null &&
        baseDelay >= POLL_DELAY_RANGE_MS.min &&
        baseDelay <= POLL_DELAY_RANGE_MS.max
        ? clampToInt(baseDelay)
        : DEFAULT_POLLING_POLICY.baseDelayMs;
    const maxDelayMsCandidate = maxDelay !== null &&
        maxDelay >= POLL_DELAY_RANGE_MS.min &&
        maxDelay <= POLL_DELAY_RANGE_MS.max
        ? clampToInt(maxDelay)
        : DEFAULT_POLLING_POLICY.maxDelayMs;
    const maxDelayMs = Math.max(baseDelayMs, maxDelayMsCandidate);
    const jitterRatio = jitter !== null && jitter >= POLL_JITTER_RANGE.min && jitter <= POLL_JITTER_RANGE.max
        ? jitter
        : DEFAULT_POLLING_POLICY.jitterRatio;
    return {
        maxAttempts,
        baseDelayMs,
        maxDelayMs,
        jitterRatio,
    };
}
function getBackoffDelayMs(attempt, policy) {
    const exponential = Math.min(policy.maxDelayMs, policy.baseDelayMs * (2 ** attempt));
    const jitterMultiplier = 1 + ((Math.random() * 2 - 1) * policy.jitterRatio);
    return Math.max(250, Math.round(exponential * jitterMultiplier));
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function isRetryablePollingError(err) {
    if (!err || typeof err !== 'object')
        return true;
    const code = err.code;
    if (typeof code !== 'string')
        return true;
    return !NON_RETRYABLE_DB_ERROR_CODES.has(code);
}
export const AiService = {
    async generateFix(req) {
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
    async dispatchChatTask(projectId, conversationId, userId, content) {
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
    async pollForResult(scanId, startTime, onProgress) {
        const policy = getPollingPolicy();
        let lastRetryableError;
        for (let i = 0; i < policy.maxAttempts; i++) {
            onProgress?.({ status: 'querying', attempt: i + 1, maxAttempts: policy.maxAttempts });
            let query = supabase
                .from('vulnerabilities')
                .select('*')
                .eq('title', 'AI Security Response')
                .gt('created_at', new Date(startTime).toISOString());
            if (scanId) {
                query = query.eq('scan_id', scanId);
            }
            else {
                query = query.is('scan_id', null);
            }
            try {
                const { data, error } = await query.maybeSingle();
                if (data)
                    return success(data);
                if (error) {
                    if (!isRetryablePollingError(error)) {
                        return failure(ErrorCode.AI_POLLING_FAILED, 'AI polling failed due to a non-retryable query error.', error, { scanId, attempt: i + 1 });
                    }
                    lastRetryableError = error;
                    const errorCode = typeof error.code === 'string' ? error.code : undefined;
                    const nextDelayMs = i < policy.maxAttempts - 1 ? getBackoffDelayMs(i, policy) : undefined;
                    onProgress?.({
                        status: 'retrying',
                        attempt: i + 1,
                        maxAttempts: policy.maxAttempts,
                        nextDelayMs,
                        ...(errorCode ? { errorCode } : {}),
                    });
                }
            }
            catch (err) {
                if (!isRetryablePollingError(err)) {
                    return failure(ErrorCode.AI_POLLING_FAILED, 'AI polling failed due to a non-retryable runtime error.', err, { scanId, attempt: i + 1 });
                }
                lastRetryableError = err;
                const errorCode = typeof err.code === 'string' ? err.code : undefined;
                const nextDelayMs = i < policy.maxAttempts - 1 ? getBackoffDelayMs(i, policy) : undefined;
                onProgress?.({
                    status: 'retrying',
                    attempt: i + 1,
                    maxAttempts: policy.maxAttempts,
                    nextDelayMs,
                    ...(errorCode ? { errorCode } : {}),
                });
            }
            if (i < policy.maxAttempts - 1) {
                const delayMs = getBackoffDelayMs(i, policy);
                await sleep(delayMs);
            }
        }
        return failure(ErrorCode.AI_PROCESSING_TIMEOUT, 'AI processing timed out. Please check again in a moment.', lastRetryableError, { scanId, attempts: policy.maxAttempts });
    }
};

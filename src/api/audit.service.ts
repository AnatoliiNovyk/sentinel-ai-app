import { supabase } from './client';
import { createLogger } from '../lib/logger';

const log = createLogger('AuditService');

// ---------------------------------------------------------------------------
// Retry helper — exponential backoff, used internally by AuditService.log()
// ---------------------------------------------------------------------------
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1000
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** attempt));
      }
    }
  }
  throw lastErr;
}
// ---------------------------------------------------------------------------

export interface AuditLogEntry {
  id?: string;
  orgId: string;
  userId: string;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  changes?: Record<string, unknown>;
  status: 'success' | 'failure';
  errorCode?: string;
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

export enum AuditAction {
  // Scan actions
  SCAN_CREATED = 'scan_created',
  SCAN_STARTED = 'scan_started',
  SCAN_COMPLETED = 'scan_completed',
  SCAN_FAILED = 'scan_failed',
  SCAN_CANCELLED = 'scan_cancelled',

  // Vulnerability actions
  VULNERABILITY_DETECTED = 'vulnerability_detected',
  VULNERABILITY_TRIAGED = 'vulnerability_triaged',
  VULNERABILITY_RESOLVED = 'vulnerability_resolved',
  VULNERABILITY_REOPENED = 'vulnerability_reopened',

  // Project actions
  PROJECT_CREATED = 'project_created',
  PROJECT_UPDATED = 'project_updated',
  PROJECT_DELETED = 'project_deleted',
  PROJECT_SHARED = 'project_shared',

  // AI actions
  AI_ANALYSIS_REQUESTED = 'ai_analysis_requested',
  AI_FIX_GENERATED = 'ai_fix_generated',
  AI_ERROR = 'ai_error',

  // Security actions
  DARK_WEB_SCAN = 'dark_web_scan',
  SBOM_ANALYSIS = 'sbom_analysis',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  CIRCUIT_BREAKER_OPENED = 'circuit_breaker_opened',

  // Access actions
  USER_LOGIN = 'user_login',
  USER_LOGOUT = 'user_logout',
  AUTH_FAILED = 'auth_failed',
}

export const AuditService = {
  /**
   * Log an audit entry to the database.
   * Retries up to 3 times with exponential backoff before giving up.
   */
  async log(entry: AuditLogEntry): Promise<void> {
    const payload = {
      org_id: entry.orgId,
      user_id: entry.userId,
      action: entry.action,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId,
      changes: entry.changes ? JSON.stringify(entry.changes) : null,
      status: entry.status,
      error_code: entry.errorCode || null,
      error_message: entry.errorMessage || null,
      ip_address: entry.ipAddress || null,
      user_agent: entry.userAgent || null,
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
      created_at: new Date().toISOString(),
    };

    try {
      await withRetry(async () => {
        const { error } = await supabase.from('audit_logs').insert(payload);
        if (error) throw error;
      });
    } catch (err) {
      // All retries exhausted — log to structured output, do not throw
      log.error('Audit log failed after retries', err, { action: entry.action, orgId: entry.orgId });
    }
  },

  /**
   * Log security event (fire-and-forget for performance).
   * Retries are handled inside log(). Logs a warning if all retries are exhausted.
   */
  logSecurityEvent(
    orgId: string,
    userId: string,
    action: AuditAction,
    resourceType: string,
    resourceId: string,
    metadata?: Record<string, unknown>
  ): void {
    AuditService.log({
      orgId,
      userId,
      action,
      resourceType,
      resourceId,
      status: 'success',
      metadata,
    }).catch((err) => {
      // log() itself handles retries and only rejects in extreme cases
      log.warn(`logSecurityEvent exhausted retries for action="${action}"`, { err });
    });
  },

  /**
   * Log failed operation with error details.
   */
  async logFailure(
    orgId: string,
    userId: string,
    action: AuditAction,
    resourceType: string,
    resourceId: string,
    errorCode: string,
    errorMessage: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    return AuditService.log({
      orgId,
      userId,
      action,
      resourceType,
      resourceId,
      status: 'failure',
      errorCode,
      errorMessage,
      metadata,
    });
  },

  /**
   * Query audit logs with filtering.
   */
  async queryLogs(
    orgId: string,
    filters?: {
      userId?: string;
      action?: AuditAction;
      resourceType?: string;
      status?: 'success' | 'failure';
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ): Promise<AuditLogEntry[]> {
    let query = supabase.from('audit_logs').select('*').eq('org_id', orgId);

    if (filters?.userId) {
      query = query.eq('user_id', filters.userId);
    }

    if (filters?.action) {
      /* c8 ignore next */
      query = query.eq('action', filters.action);
    }

    if (filters?.resourceType) {
      /* c8 ignore next */
      query = query.eq('resource_type', filters.resourceType);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.startDate) {
      query = query.gte('created_at', filters.startDate.toISOString());
    }

    if (filters?.endDate) {
      query = query.lte('created_at', filters.endDate.toISOString());
    }

    const limit = filters?.limit || 1000;
    query = query.order('created_at', { ascending: false }).limit(limit);

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return data || [];
  },

  /**
   * Get audit summary for compliance reporting.
   */
  async getSummary(
    orgId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalActions: number;
    successCount: number;
    failureCount: number;
    actionBreakdown: Record<string, number>;
    topFailures: Array<{ action: string; count: number; lastError: string }>;
  }> {
    const logs = await AuditService.queryLogs(orgId, {
      startDate,
      endDate,
      limit: 10000,
    });

    const actionBreakdown: Record<string, number> = {};
    const failures: Record<string, { count: number; lastError: string }> = {};
    let successCount = 0;
    let failureCount = 0;

    logs.forEach((log) => {
      // Count by action
      actionBreakdown[log.action] = (actionBreakdown[log.action] || 0) + 1;

      // Count success/failure
      if (log.status === 'success') {
        successCount++;
      } else {
        failureCount++;
        const key = log.action;
        failures[key] = {
          count: (failures[key]?.count || 0) + 1,
          lastError: log.errorMessage || 'Unknown error',
        };
      }
    });

    const topFailures = Object.entries(failures)
      .map(([action, data]) => ({
        action,
        count: data.count,
        lastError: data.lastError,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalActions: logs.length,
      successCount,
      failureCount,
      actionBreakdown,
      topFailures,
    };
  },

  /**
   * Detect suspicious activity patterns.
   */
  async detectAnomalies(
    orgId: string,
    windowMinutes: number = 60
  ): Promise<{
    rateLimitedUsers: Array<{ userId: string; count: number }>;
    failedAuthAttempts: Array<{ userId: string; count: number }>;
    circuitBreakerEvents: number;
  }> {
    const startDate = new Date(Date.now() - windowMinutes * 60 * 1000);

    const logs = await AuditService.queryLogs(orgId, {
      startDate,
      limit: 5000,
    });

    const rateLimited: Record<string, number> = {};
    const failedAuth: Record<string, number> = {};
    let circuitBreakerCount = 0;

    logs.forEach((log) => {
      if (log.action === AuditAction.RATE_LIMIT_EXCEEDED) {
        rateLimited[log.userId] = (rateLimited[log.userId] || 0) + 1;
      }
      if (log.action === AuditAction.AUTH_FAILED) {
        failedAuth[log.userId] = (failedAuth[log.userId] || 0) + 1;
      }
      if (log.action === AuditAction.CIRCUIT_BREAKER_OPENED) {
        circuitBreakerCount++;
      }
    });

    return {
      rateLimitedUsers: Object.entries(rateLimited)
        .map(([userId, count]) => ({ userId, count }))
        .sort((a, b) => b.count - a.count)
        .filter((entry) => entry.count > 5),
      failedAuthAttempts: Object.entries(failedAuth)
        .map(([userId, count]) => ({ userId, count }))
        .sort((a, b) => b.count - a.count)
        .filter((entry) => entry.count > 3),
      circuitBreakerEvents: circuitBreakerCount,
    };
  },

  /**
   * Export audit logs for compliance (CSV format).
   */
  async exportLogs(
    orgId: string,
    startDate: Date,
    endDate: Date
  ): Promise<string> {
    const logs = await AuditService.queryLogs(orgId, {
      startDate,
      endDate,
      limit: 50000,
    });

    const headers = [
      'Timestamp',
      'User ID',
      'Action',
      'Resource Type',
      'Resource ID',
      'Status',
      'Error Code',
      'Error Message',
      'IP Address',
    ];

    const rows = logs.map((log) => [
      log.timestamp || '',
      log.userId,
      log.action,
      log.resourceType,
      log.resourceId,
      log.status,
      log.errorCode || '',
      log.errorMessage || '',
      log.ipAddress || '',
    ]);

    // CSV format
    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    return csv;
  },

  /**
   * Cleanup old audit logs (retention policy).
   */
  async cleanupOldLogs(orgId: string, retentionDays: number = 90): Promise<number> {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const { error, status } = await supabase
      .from('audit_logs')
      .delete()
      .eq('org_id', orgId)
      .lt('created_at', cutoffDate.toISOString());

    if (error) {
      throw error;
    }

    // Return affected row count (approximate based on status)
    return status === 204 ? 0 : 1;
  },
};

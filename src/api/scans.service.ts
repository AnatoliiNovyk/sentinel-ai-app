import { supabase } from './client';
import { runMockScan } from '../lib/scanMock';

async function getFunctionErrorMessage(error: unknown): Promise<string> {
  const asRecord = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === 'object' ? (value as Record<string, unknown>) : null;

  const pickText = (value: unknown): string | null =>
    typeof value === 'string' && value.trim() ? value.trim() : null;

  if (error instanceof Error) {
    const maybeContext = error as Error & { context?: { json?: () => Promise<unknown>; text?: () => Promise<string> } };
    if (maybeContext.context?.json) {
      try {
        const payload = await maybeContext.context.json() as { error?: string; message?: string };
        if (payload?.error) return payload.error;
        if (payload?.message) return payload.message;
      } catch {
        // Ignore JSON parse failures and continue fallback chain.
      }
    }
    if (maybeContext.context?.text) {
      try {
        const text = await maybeContext.context.text();
        if (text?.trim()) return text.trim();
      } catch {
        // Ignore text read failures and continue fallback chain.
      }
    }
    if (error.message?.trim()) return error.message;
  }

  const rec = asRecord(error);
  if (rec) {
    const direct =
      pickText(rec.message) ??
      pickText(rec.error_description) ??
      pickText(rec.error) ??
      pickText(rec.details) ??
      pickText(rec.hint);

    if (direct) return direct;
  }

  if (typeof error === 'string' && error.trim()) return error;
  return 'Scan dispatch failed due to an unknown service error.';
}

export const ScansService = {
  /**
   * Fetches all projects the user has access to via RLS.
   */
  async getProjects() {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Fetches scans for a specific project.
   */
  async getProjectScans(projectId: string) {
    const { data, error } = await supabase
      .from('scans')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Fetches vulnerabilities for a specific scan.
   */
  async getScanVulnerabilities(scanId: string) {
    const { data, error } = await supabase
      .from('vulnerabilities')
      .select('*')
      .eq('scan_id', scanId)
      .order('severity', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Dispatches a new scan task.
   *
   * @param agentOnline - result of the health probe already performed by the caller (Scans.tsx).
   *                      Pass `true` to attempt real dispatch, `false` or `null` for mock fallback.
   *
   * Flow:
   *  1. Agent online  → create scan row, call scan-dispatch edge fn → REAL mode.
   *  2. Agent offline → run browser mock → MOCK mode (demo findings).
   */
  async dispatchScan(
    projectId: string,
    scanner: string,
    target: string,
    orgId?: string | null,
    agentOnline: boolean | null = false,
  ) {
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData.user) {
      throw new Error('Authentication required to start scan. Please sign in again.');
    }

    const userId = authData.user.id;

    // ── MOCK path (agent offline) ────────────────────────────────────────────
    if (!agentOnline) {
      const mockScanId = await runMockScan(userId, projectId, scanner);
      if (!mockScanId) {
        throw new Error('Mock scan failed to execute. Check project access.');
      }
      return { scan: { id: mockScanId }, dispatchResult: { mode: 'MOCK' } };
    }

    // ── REAL path (agent online) ─────────────────────────────────────────────
    // 1. Create scan record
    const { data: scan, error: scanErr } = await supabase
      .from('scans')
      .insert({
        project_id: projectId,
        user_id: userId,
        org_id: orgId,
        scanner,
        status: 'queued',
        is_mock: false,
        detected_mode: 'UNKNOWN',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (scanErr) {
      const message = await getFunctionErrorMessage(scanErr);
      throw new Error(message);
    }

    // 2. Dispatch job via Edge Function
    const { data, error } = await supabase.functions.invoke('scan-dispatch', {
      body: {
        scan_id: scan.id,
        project_id: projectId,
        org_id: orgId,
        scanner,
        target,
      },
    });

    if (error) {
      const message = await getFunctionErrorMessage(error);
      await supabase
        .from('scans')
        .update({
          status: 'failed',
          is_mock: false,
          detected_mode: 'UNKNOWN',
          completed_at: new Date().toISOString(),
        })
        .eq('id', scan.id);
      throw new Error(message);
    }

    await supabase
      .from('scans')
      .update({ status: 'running', is_mock: false, detected_mode: 'REAL' })
      .eq('id', scan.id);

    return { scan, dispatchResult: data };
  }
};

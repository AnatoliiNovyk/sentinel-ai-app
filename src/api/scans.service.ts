import { supabase } from './client';
import { runMockScan } from '../lib/scanMock';

const ALLOW_MOCK_FALLBACK = import.meta.env.DEV || import.meta.env.VITE_ALLOW_MOCK_SCAN_FALLBACK === 'true';
const AGENT_HEALTH_URL_ENV = (import.meta.env.VITE_AGENT_HEALTH_URL as string | undefined) ?? null;

async function checkAgentReachable(): Promise<boolean> {
  try {
    const url = AGENT_HEALTH_URL_ENV ?? (typeof window !== 'undefined' ? localStorage.getItem('agentHealthUrl') : null);
    if (!url) return false;
    const res = await fetch(url, { signal: AbortSignal.timeout(3_000) });
    return res.ok;
  } catch {
    return false;
  }
}

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
   * Flow:
   *  1. Check agent liveness (≤3 s probe).
   *  2a. Agent online  → create scan row, call scan-dispatch edge fn → REAL mode.
   *  2b. Agent offline + mock allowed → run browser mock → MOCK mode.
   *  2c. Agent offline + mock disabled → throw, no orphan scan row created.
   */
  async dispatchScan(projectId: string, scanner: string, target: string, orgId?: string | null) {
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData.user) {
      throw new Error('Authentication required to start scan. Please sign in again.');
    }

    const userId = authData.user.id;
    const agentOnline = await checkAgentReachable();

    // ── MOCK path (agent offline) ────────────────────────────────────────────
    if (!agentOnline) {
      if (!ALLOW_MOCK_FALLBACK) {
        throw new Error(
          'Scanner agent is unreachable and mock fallback is disabled. ' +
          'Start the sentinel-agent or set VITE_ALLOW_MOCK_SCAN_FALLBACK=true.',
        );
      }

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
      // Edge fn failed after row was created — fall back to mock if allowed,
      // otherwise mark failed and surface the error.
      if (ALLOW_MOCK_FALLBACK) {
        await supabase.from('scans').delete().eq('id', scan.id);
        const mockScanId = await runMockScan(userId, projectId, scanner);
        if (!mockScanId) throw new Error('Mock scan failed to execute.');
        return { scan: { id: mockScanId }, dispatchResult: { mode: 'MOCK' } };
      }
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

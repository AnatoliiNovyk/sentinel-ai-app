import { supabase } from './client';

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
   */
  async dispatchScan(projectId: string, scanner: string, target: string, orgId: string) {
    // 1. Create a scan record in UNKNOWN mode until real dispatch succeeds
    const { data: scan, error: scanErr } = await supabase
      .from('scans')
      .insert({
        project_id: projectId,
        org_id: orgId,
        scanner,
        status: 'queued',
        is_mock: false,
        detected_mode: 'UNKNOWN',
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (scanErr) throw scanErr;

    // 2. Dispatch job via Edge Function
    const { data, error } = await supabase.functions.invoke('scan-dispatch', {
      body: { 
        scan_id: scan.id,
        project_id: projectId,
        org_id: orgId,
        scanner,
        target 
      }
    });

    if (error) {
      await supabase
        .from('scans')
        .update({
          status: 'failed',
          is_mock: false,
          detected_mode: 'UNKNOWN',
          completed_at: new Date().toISOString(),
        })
        .eq('id', scan.id);
      throw error;
    }

    await supabase
      .from('scans')
      .update({ status: 'running', is_mock: false, detected_mode: 'REAL' })
      .eq('id', scan.id);

    return { scan, dispatchResult: data };
  }
};

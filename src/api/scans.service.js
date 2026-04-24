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
        if (error)
            throw error;
        return data || [];
    },
    /**
     * Fetches scans for a specific project.
     */
    async getProjectScans(projectId) {
        const { data, error } = await supabase
            .from('scans')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });
        if (error)
            throw error;
        return data || [];
    },
    /**
     * Fetches vulnerabilities for a specific scan.
     */
    async getScanVulnerabilities(scanId) {
        const { data, error } = await supabase
            .from('vulnerabilities')
            .select('*')
            .eq('scan_id', scanId)
            .order('severity', { ascending: false });
        if (error)
            throw error;
        return data || [];
    },
    /**
     * Dispatches a new scan task.
     */
    async dispatchScan(projectId, scanner, target, orgId) {
        // 1. Create a scan record with org_id for RBAC visibility
        const { data: scan, error: scanErr } = await supabase
            .from('scans')
            .insert({
            project_id: projectId,
            org_id: orgId,
            scanner,
            status: 'running',
            is_mock: false,
            detected_mode: 'REAL',
            started_at: new Date().toISOString()
        })
            .select()
            .single();
        if (scanErr)
            throw scanErr;
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
        if (error)
            throw error;
        return { scan, dispatchResult: data };
    }
};

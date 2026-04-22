import { supabase } from './client';
import type { Scan, Vulnerability, Project } from '../lib/supabase';

export const ScansService = {
  /**
   * Fetches all projects for the current user.
   */
  async getProjects() {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as Project[];
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
    return data as Scan[];
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
    return data as Vulnerability[];
  },

  /**
   * Updates the status of a vulnerability.
   */
  async updateVulnerabilityStatus(id: string, status: Vulnerability['status'], note: string = '') {
    const { error } = await supabase
      .from('vulnerabilities')
      .update({ 
        status, 
        note,
        status_updated_at: new Date().toISOString() 
      })
      .eq('id', id);
    
    if (error) throw error;
  },

  /**
   * Triggers a new scan using the Edge Function.
   */
  async startScan(projectId: string, scanner: string, target: string) {
    const { data, error } = await supabase.functions.invoke('scan-dispatch', {
      body: { project_id: projectId, scanner, target }
    });
    
    if (error) throw error;
    return data;
  }
};

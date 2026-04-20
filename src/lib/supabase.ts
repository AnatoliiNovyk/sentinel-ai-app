import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type SlaConfig = {
  critical: number;
  high: number;
  medium: number;
  low: number;
};

export const DEFAULT_SLA_CONFIG: SlaConfig = { critical: 3, high: 7, medium: 30, low: 90 };

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  company: string;
  role: string;
  plan: string;
  created_at: string;
  sla_config: SlaConfig;
};

export type Project = {
  id: string;
  user_id: string;
  name: string;
  description: string;
  target: string;
  environment: 'external' | 'cloud' | 'internal' | 'iac';
  created_at: string;
  tags: string[];
  risk_score: number;
};

export type Scan = {
  id: string;
  project_id: string;
  user_id: string;
  scanner: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  severity_summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export type Vulnerability = {
  id: string;
  scan_id: string;
  user_id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  cve_id: string;
  mitre_tactic: string;
  cis_control: string;
  asset: string;
  remediation: string;
  remediation_code: string;
  remediation_type: string;
  created_at: string;
  status: 'open' | 'in_progress' | 'accepted' | 'resolved' | 'false_positive';
  note: string;
  status_updated_at: string;
  sla_breached_at: string | null;
  sla_warned_at: string | null;
};

export const VULN_STATUSES: Vulnerability['status'][] = [
  'open',
  'in_progress',
  'accepted',
  'resolved',
  'false_positive',
];

export type AiConversation = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
};

export type AiMessage = {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
};

export type Report = {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  kind: 'executive' | 'technical';
  content: string;
  created_at: string;
  share_token: string | null;
  is_public: boolean;
};

export type ScanSchedule = {
  id: string;
  user_id: string;
  project_id: string;
  scanner: string;
  cadence_hours: number;
  enabled: boolean;
  last_run_at: string | null;
  next_run_at: string;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  link: string;
  severity: 'info' | 'success' | 'warning' | 'critical';
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

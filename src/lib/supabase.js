import { supabase } from '../api/client';
export { supabase };
export const DEFAULT_SLA_CONFIG = { critical: 3, high: 7, medium: 30, low: 90 };
export const VULN_STATUSES = ['open', 'in_progress', 'accepted', 'resolved', 'false_positive'];

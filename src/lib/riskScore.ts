import { supabase } from './supabase';

const WEIGHTS = { critical: 25, high: 12, medium: 5, low: 2, info: 0 } as const;

export function computeScoreFromCounts(counts: Record<keyof typeof WEIGHTS, number>): number {
  const raw =
    counts.critical * WEIGHTS.critical +
    counts.high * WEIGHTS.high +
    counts.medium * WEIGHTS.medium +
    counts.low * WEIGHTS.low;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export async function recomputeProjectRiskScore(projectId: string): Promise<number> {
  const { data: scans } = await supabase.from('scans').select('id').eq('project_id', projectId);
  const scanIds = (scans ?? []).map((s) => s.id);
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  if (scanIds.length > 0) {
    const { data: vulns } = await supabase
      .from('vulnerabilities')
      .select('severity,status')
      .in('scan_id', scanIds);
    for (const v of vulns ?? []) {
      if (v.status === 'resolved' || v.status === 'false_positive' || v.status === 'accepted') continue;
      if (v.severity in counts) counts[v.severity as keyof typeof counts] += 1;
    }
  }
  const score = computeScoreFromCounts(counts);
  await supabase.from('projects').update({ risk_score: score }).eq('id', projectId);
  return score;
}

export async function recomputeRiskScoreFromScanId(scanId: string): Promise<void> {
  const { data: scan } = await supabase.from('scans').select('project_id').eq('id', scanId).maybeSingle();
  if (scan?.project_id) {
    await recomputeProjectRiskScore(scan.project_id);
  }
}

export function riskBand(score: number): { label: string; color: string } {
  if (score >= 70) return { label: 'Critical', color: 'text-red-300 bg-red-500/10 border-red-500/30' };
  if (score >= 40) return { label: 'High', color: 'text-orange-300 bg-orange-500/10 border-orange-500/30' };
  if (score >= 15) return { label: 'Medium', color: 'text-amber-300 bg-amber-500/10 border-amber-500/30' };
  if (score > 0) return { label: 'Low', color: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' };
  return { label: 'Clean', color: 'text-slate-300 bg-slate-500/10 border-slate-500/30' };
}

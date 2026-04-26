import React from 'react';
import { ShieldAlert, AlertTriangle, AlertCircle, Info, Activity } from 'lucide-react';

interface ScanStatsProps {
  stats: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  totalVulnerabilities: number;
}

export const ScanStats: React.FC<ScanStatsProps> = ({ stats, totalVulnerabilities }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
      <StatCard 
        icon={<ShieldAlert className="w-5 h-5 text-red-500" />}
        label="Critical"
        count={stats.critical}
        total={totalVulnerabilities}
        color="border-red-500/20"
      />
      <StatCard 
        icon={<AlertTriangle className="w-5 h-5 text-orange-500" />}
        label="High"
        count={stats.high}
        total={totalVulnerabilities}
        color="border-orange-500/20"
      />
      <StatCard 
        icon={<AlertCircle className="w-5 h-5 text-yellow-500" />}
        label="Medium"
        count={stats.medium}
        total={totalVulnerabilities}
        color="border-yellow-500/20"
      />
      <StatCard 
        icon={<Activity className="w-5 h-5 text-blue-500" />}
        label="Low"
        count={stats.low}
        total={totalVulnerabilities}
        color="border-blue-500/20"
      />
      <StatCard 
        icon={<Info className="w-5 h-5 text-slate-400" />}
        label="Total"
        count={totalVulnerabilities}
        total={totalVulnerabilities}
        color="border-slate-700"
      />
    </div>
  );
};

const StatCard: React.FC<{ icon: React.ReactNode, label: string, count: number, total: number, color: string }> = ({ 
  icon, label, count, total, color 
}) => {
  const pct = total === 0 ? 0 : Math.round((count / total) * 100);
  const barColor = color.includes('red') ? 'bg-red-500'
    : color.includes('orange') ? 'bg-orange-500'
    : color.includes('yellow') ? 'bg-yellow-400'
    : color.includes('blue') ? 'bg-blue-500'
    : 'bg-slate-500';
  return (
  <div className={`bg-slate-800/40 backdrop-blur-xl border ${color} rounded-2xl p-4 transition-all hover:bg-slate-800/60`}>
    <div className="flex items-center gap-3 mb-2">
      {icon}
      <span className="text-sm font-medium text-slate-400">{label}</span>
    </div>
    <div className="text-2xl font-bold text-white">{count}</div>
    {label !== 'Total' && (
      <div className="mt-2">
        <div className="h-1 rounded-full bg-slate-700 overflow-hidden">
          <div className={`h-full rounded-full ${barColor}`} ref={(el) => { if (el) el.style.width = `${pct}%`; }} />
        </div>
        <div className="text-[10px] text-slate-600 mt-1">{pct}% of total</div>
      </div>
    )}
  </div>
  );
};

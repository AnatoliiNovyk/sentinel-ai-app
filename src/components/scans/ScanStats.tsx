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
        color="border-red-500/20"
      />
      <StatCard 
        icon={<AlertTriangle className="w-5 h-5 text-orange-500" />}
        label="High"
        count={stats.high}
        color="border-orange-500/20"
      />
      <StatCard 
        icon={<AlertCircle className="w-5 h-5 text-yellow-500" />}
        label="Medium"
        count={stats.medium}
        color="border-yellow-500/20"
      />
      <StatCard 
        icon={<Activity className="w-5 h-5 text-blue-500" />}
        label="Low"
        count={stats.low}
        color="border-blue-500/20"
      />
      <StatCard 
        icon={<Info className="w-5 h-5 text-slate-400" />}
        label="Total"
        count={totalVulnerabilities}
        color="border-slate-700"
      />
    </div>
  );
};

const StatCard: React.FC<{ icon: React.ReactNode, label: string, count: number, color: string }> = ({ 
  icon, label, count, color 
}) => (
  <div className={`bg-slate-800/40 backdrop-blur-xl border ${color} rounded-2xl p-4 transition-all hover:bg-slate-800/60`}>
    <div className="flex items-center gap-3 mb-2">
      {icon}
      <span className="text-sm font-medium text-slate-400">{label}</span>
    </div>
    <div className="text-2xl font-bold text-white">{count}</div>
  </div>
);

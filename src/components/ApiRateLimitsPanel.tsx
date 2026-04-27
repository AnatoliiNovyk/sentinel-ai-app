import { useEffect, useState, useMemo } from 'react';
import { AlertCircle, Zap, TrendingUp } from 'lucide-react';
import { ApiRateLimit } from '../lib/supabase';
import { getRateLimitConfig, getCurrentUsage } from '../lib/rateLimitService';

interface ApiRateLimitsPanelProps {
  userId: string;
  planId: string;
}

type MetricKey = keyof ApiRateLimit;

const METRICS: Array<{
  key: MetricKey;
  label: string;
  description: string;
  icon: string;
  color: string;
}> = [
  {
    key: 'scans_per_month',
    label: 'Scans/Month',
    description: 'Vulnerability scans executed',
    icon: '🔍',
    color: 'from-blue-500 to-blue-600',
  },
  {
    key: 'reports_per_day',
    label: 'Reports/Day',
    description: 'Security reports generated',
    icon: '📊',
    color: 'from-emerald-500 to-emerald-600',
  },
  {
    key: 'chat_messages_per_hour',
    label: 'Chat/Hour',
    description: 'AI chat messages sent',
    icon: '💬',
    color: 'from-purple-500 to-purple-600',
  },
  {
    key: 'api_calls_per_second',
    label: 'API/Sec',
    description: 'API requests allowed',
    icon: '⚡',
    color: 'from-amber-500 to-amber-600',
  },
];

export function ApiRateLimitsPanel({ userId, planId }: ApiRateLimitsPanelProps) {
  const [limits, setLimits] = useState<ApiRateLimit | null>(null);
  const [usage, setUsage] = useState<Record<MetricKey, number>>({} as Record<MetricKey, number>);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const config = await getRateLimitConfig(planId);
      setLimits(config);

      // Fetch current usage for each metric
      const usageData: Record<MetricKey, number> = {} as Record<MetricKey, number>;
      for (const metric of METRICS) {
        const current = await getCurrentUsage(userId, metric.key);
        usageData[metric.key] = current;
      }
      setUsage(usageData);
      setLoading(false);
    })();
  }, [userId, planId]);

  const metrics = useMemo(() => {
    if (!limits) return [];
    return METRICS.map((m) => {
      const current = usage[m.key] ?? 0;
      const limit = limits[m.key];
      const percentage = Math.min(100, (current / limit) * 100);
      const isWarning = percentage > 75;
      const isExceeded = current >= limit;

      return { ...m, current, limit, percentage, isWarning, isExceeded };
    });
  }, [limits, usage]);

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900/30 p-6">
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-4 h-4 text-emerald-400" />
          <h2 className="font-semibold">API Rate Limits</h2>
        </div>
        <p className="text-sm text-slate-500 mb-5">Loading rate limit information...</p>
        <div className="animate-pulse space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-slate-800/50 rounded-lg" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/30 p-6">
      <div className="flex items-center gap-2 mb-1">
        <Zap className="w-4 h-4 text-emerald-400" />
        <h2 className="font-semibold">API Rate Limits</h2>
        <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-slate-800/50 text-slate-400">
          Plan: <span className="font-semibold capitalize text-slate-300">{planId}</span>
        </span>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Your current usage across key metrics. Reset times vary by period (monthly, daily, hourly, per-second).
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {metrics.map((m) => (
          <div
            key={m.key}
            className={`rounded-lg border p-4 transition ${
              m.isExceeded
                ? 'border-red-500/30 bg-red-500/5'
                : m.isWarning
                ? 'border-amber-500/30 bg-amber-500/5'
                : 'border-slate-700 bg-slate-900/30'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{m.icon}</span>
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">{m.label}</h3>
                  <p className="text-xs text-slate-500">{m.description}</p>
                </div>
              </div>
              {m.isExceeded && (
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              )}
            </div>

            {/* Progress bar */}
            <div className="mb-3">
              <div className="relative h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    m.isExceeded
                      ? 'bg-red-500'
                      : m.isWarning
                      ? 'bg-amber-500'
                      : `bg-gradient-to-r ${m.color}`
                  }`}
                  ref={(el) => {
                    if (el) el.style.width = `${m.percentage}%`;
                  }}
                />
              </div>
            </div>

            {/* Usage stats */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-slate-500" />
                <span className="text-slate-400">
                  <span className={m.isExceeded ? 'text-red-400 font-semibold' : 'text-slate-200 font-semibold'}>
                    {m.current}
                  </span>
                  {' '}
                  <span className="text-slate-500">/ {m.limit}</span>
                </span>
              </div>
              <span className={`${m.percentage >= 100 ? 'text-red-400' : m.percentage > 75 ? 'text-amber-400' : 'text-emerald-400'} font-semibold`}>
                {Math.round(m.percentage)}%
              </span>
            </div>

            {/* Exceeded or warning message */}
            {m.isExceeded && (
              <div className="mt-2 text-xs text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Limit exceeded. Upgrade to increase limits.
              </div>
            )}
            {m.isWarning && !m.isExceeded && (
              <div className="mt-2 text-xs text-amber-400">
                Nearing limit. Consider upgrading your plan.
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Info box */}
      <div className="mt-6 rounded-lg border border-sky-500/20 bg-sky-500/5 p-4 text-sm text-slate-300">
        <p className="mb-2">
          <span className="font-semibold text-sky-300">💡 Tip:</span> Your limits reset on different schedules:
        </p>
        <ul className="list-disc list-inside space-y-1 text-xs text-slate-400 ml-2">
          <li>Scans: Monthly (1st of month)</li>
          <li>Reports: Daily (midnight UTC)</li>
          <li>Chat: Hourly (top of hour)</li>
          <li>API: Per-second (rolling window)</li>
        </ul>
      </div>

      {/* Upgrade CTA */}
      {(planId === 'free' || planId === 'basic') && (
        <div className="mt-6 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
          <p className="text-sm text-slate-200 mb-3">
            Need more capacity? <span className="font-semibold text-emerald-400">Upgrade your plan</span> to increase all limits.
          </p>
          <a
            href="#plans"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-md text-sm transition"
          >
            <Zap className="w-4 h-4" /> View Plans
          </a>
        </div>
      )}
    </section>
  );
}

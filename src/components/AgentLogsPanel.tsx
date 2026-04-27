import { useEffect, useMemo, useRef, useState } from 'react';
import { Terminal, Loader2, Copy, Check } from 'lucide-react';
import { supabase, AgentLog } from '../lib/supabase';

interface Props {
  projectId: string;
}

const LEVEL_STYLE: Record<string, string> = {
  info:    'text-slate-400',
  success: 'text-emerald-400',
  error:   'text-red-400',
  warn:    'text-amber-400',
};

const LEVEL_PREFIX: Record<string, string> = {
  info:    '[INFO]   ',
  success: '[OK]     ',
  error:   '[ERROR]  ',
  warn:    '[WARN]   ',
};

export default function AgentLogsPanel({ projectId }: Props) {
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState<'all' | 'error' | 'warn' | 'success' | 'info'>('all');
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const visibleLogs = useMemo(() => {
    if (levelFilter === 'all') return logs;
    return logs.filter(l => l.level === levelFilter);
  }, [logs, levelFilter]);

  const errorCount   = logs.filter(l => l.level === 'error').length;
  const warnCount    = logs.filter(l => l.level === 'warn').length;

  const copyLog = () => {
    const text = visibleLogs.map(l =>
      `[${new Date(l.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}] ${LEVEL_PREFIX[l.level] ?? '[LOG]    '} ${l.message}`
    ).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('agent_logs')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true })
        .limit(200);
      if (!cancelled) {
        setLogs((data ?? []) as AgentLog[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`agent_logs:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'agent_logs',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          setLogs((prev) => [...prev.slice(-199), payload.new as AgentLog]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [projectId]);

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0c0f14] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-800 bg-slate-900/60">
        <Terminal className="w-4 h-4 text-emerald-400" />
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Agent Live Logs</span>
        {loading && <Loader2 className="w-3.5 h-3.5 text-slate-500 animate-spin ml-auto" />}
        {!loading && (
          <span className="ml-auto text-[10px] text-slate-600 font-mono">
            {logs.length} line{logs.length !== 1 ? 's' : ''}
          </span>
        )}
        {!loading && logs.length > 0 && (
          <div className="flex items-center gap-1.5 ml-2">
            {errorCount > 0 && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-red-500/30 bg-red-500/10 text-red-400">{errorCount} err</span>
            )}
            {warnCount > 0 && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-400">{warnCount} warn</span>
            )}
            <button
              onClick={copyLog}
              className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-white transition"
              aria-label="Copy log" title="Copy visible log"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        )}
      </div>

      {/* Level filter */}
      {!loading && logs.length > 0 && (
        <div className="flex items-center gap-1 px-4 py-2 border-b border-slate-800 bg-slate-900/40">
          {(['all', 'error', 'warn', 'success', 'info'] as const).map(lvl => (
            <button
              key={lvl}
              onClick={() => setLevelFilter(lvl)}
              className={`text-[10px] px-2 py-0.5 rounded border transition capitalize ${
                levelFilter === lvl
                  ? lvl === 'error' ? 'border-red-500/40 bg-red-500/10 text-red-300'
                  : lvl === 'warn' ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                  : lvl === 'success' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                  : lvl === 'info' ? 'border-sky-500/40 bg-sky-500/10 text-sky-300'
                  : 'border-slate-600 bg-slate-800 text-slate-300'
                  : 'border-slate-800 text-slate-500 hover:border-slate-600 hover:text-white'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
      )}

      <div className="h-64 overflow-y-auto font-mono text-xs p-4 space-y-0.5">
        {loading ? (
          <div className="text-slate-600 italic">Loading logs...</div>
        ) : logs.length === 0 ? (
          <>
            <div className="text-slate-600 italic">No logs yet. Logs will appear here when a scan runs.</div>
            <div className="text-slate-600 italic">No {levelFilter !== 'all' ? levelFilter : ''} logs to display.</div>
          </>
        ) : (
          visibleLogs.map((log) => (
            <div key={log.id} className="flex gap-3 leading-5">
              <span className="shrink-0 text-slate-600 select-none">
                {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className={`shrink-0 select-none ${LEVEL_STYLE[log.level] ?? 'text-slate-400'}`}>
                {LEVEL_PREFIX[log.level] ?? '[LOG]    '}
              </span>
              <span className={`break-all ${LEVEL_STYLE[log.level] ?? 'text-slate-300'}`}>
                {log.message}
              </span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Terminal, Loader2 } from 'lucide-react';
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
  const bottomRef = useRef<HTMLDivElement>(null);

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
      </div>

      <div className="h-64 overflow-y-auto font-mono text-xs p-4 space-y-0.5">
        {loading ? (
          <div className="text-slate-600 italic">Loading logs...</div>
        ) : logs.length === 0 ? (
          <div className="text-slate-600 italic">No logs yet. Logs will appear here when a scan runs.</div>
        ) : (
          logs.map((log) => (
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

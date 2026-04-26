import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, Radar, FileText, AlertTriangle, X, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase, Notification } from '../lib/supabase';
import { useAuth } from '../context/useAuth';

const SEVERITY_STYLES: Record<Notification['severity'], string> = {
  critical: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  warning: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  success: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  info: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
};

function iconFor(type: string) {
  if (type === 'scan_completed') return Radar;
  if (type === 'report_ready') return FileText;
  if (type === 'critical_finding') return AlertTriangle;
  return Bell;
}

function timeAgo(iso: string) {
  const delta = Math.max(0, Date.now() - new Date(iso).getTime());
  const min = Math.floor(delta / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const unread = items.filter((n) => !n.read_at).length;

  const fetchItems = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(25);
    setItems((data ?? []) as Notification[]);
  }, [user]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as Notification;
          setItems((prev) => {
            if (prev.find((x) => x.id === n.id)) return prev;
            return [n, ...prev].slice(0, 25);
          });
          if (n.severity === 'critical') {
            setFlash(true);
            setTimeout(() => setFlash(false), 2000);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as Notification;
          setItems((prev) => prev.map((x) => (x.id === n.id ? n : x)));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setItems((prev) => prev.filter((x) => x.id !== (payload.old as Notification).id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const markAllRead = async () => {
    if (!user || unread === 0) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('user_id', user.id)
      .is('read_at', null);
  };

  const onItemClick = async (n: Notification) => {
    if (!n.read_at) {
      const now = new Date().toISOString();
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: now } : x)));
      await supabase.from('notifications').update({ read_at: now }).eq('id', n.id);
    }
    const VALID: string[] = ['dashboard', 'chat', 'scans', 'projects', 'reports', 'settings'];
    if (VALID.includes(n.link)) {
      navigate(n.link === 'dashboard' ? '/' : `/${n.link}`);
      setOpen(false);
    }
  };

  const dismiss = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setItems((prev) => prev.filter((x) => x.id !== id));
    await supabase.from('notifications').delete().eq('id', id);
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`relative p-2 rounded-md transition ${
          flash
            ? 'text-red-400 bg-red-500/10 animate-pulse'
            : 'text-slate-400 hover:text-white hover:bg-slate-900'
        }`}
        aria-label="Notifications"
      >
        {flash ? <ShieldAlert className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 rounded-xl border border-slate-800 bg-slate-950 shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <div className="text-sm font-semibold text-white">Notifications</div>
            <button
              onClick={markAllRead}
              disabled={unread === 0}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <CheckCheck className="w-3.5 h-3.5" /> Mark all read
            </button>
          </div>
          <div className="max-h-[24rem] overflow-auto">
            {items.length === 0 ? (
              <div className="p-10 text-center">
                <Bell className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <div className="text-sm text-slate-400">You're all caught up</div>
                <div className="text-xs text-slate-600 mt-1">Scan alerts will show up here.</div>
              </div>
            ) : (
              <ul className="divide-y divide-slate-900">
                {items.map((n) => {
                  const Icon = iconFor(n.type);
                  const sev = SEVERITY_STYLES[n.severity] ?? SEVERITY_STYLES.info;
                  return (
                    <li key={n.id}>
                      <button
                        onClick={() => onItemClick(n)}
                        className={`w-full text-left px-4 py-3 flex gap-3 transition hover:bg-slate-900/60 ${
                          n.read_at ? '' : 'bg-slate-900/30'
                        }`}
                      >
                        <div className={`shrink-0 w-9 h-9 rounded-md border flex items-center justify-center ${sev}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2">
                            <div className="flex-1 text-sm text-white font-medium truncate">{n.title}</div>
                            {!n.read_at && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5 line-clamp-2">{n.body}</div>
                          <div className="flex items-center justify-between mt-1.5">
                            <div className="text-[11px] text-slate-600">{timeAgo(n.created_at)}</div>
                            <span
                              onClick={(e) => dismiss(e, n.id)}
                              className="text-slate-600 hover:text-slate-300 p-1 -m-1 cursor-pointer"
                              aria-label="Dismiss"
                            >
                              <X className="w-3 h-3" />
                            </span>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {/* Footer — view all link */}
          <div className="border-t border-slate-800 px-4 py-2.5 flex justify-center">
            <button
              onClick={() => { setOpen(false); navigate('/notifications'); }}
              className="text-xs text-emerald-400 hover:text-emerald-300 transition flex items-center gap-1"
            >
              View all notifications
              <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 6h8M6 2l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

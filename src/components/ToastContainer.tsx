import { useEffect, useRef } from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useToasts, ToastType } from '../lib/toastContext';

const STYLES: Record<ToastType, { bar: string; icon: string; bg: string; border: string }> = {
  success: { bar: 'bg-emerald-500', icon: 'text-emerald-400', bg: 'bg-slate-900', border: 'border-slate-700' },
  error:   { bar: 'bg-red-500',     icon: 'text-red-400',     bg: 'bg-slate-900', border: 'border-slate-700' },
  info:    { bar: 'bg-sky-500',     icon: 'text-sky-400',     bg: 'bg-slate-900', border: 'border-slate-700' },
  warning: { bar: 'bg-amber-500',   icon: 'text-amber-400',   bg: 'bg-slate-900', border: 'border-slate-700' },
};

const ICONS: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error:   XCircle,
  info:    Info,
  warning: AlertTriangle,
};

const DURATION_MS = 4000;

function ProgressBar({ type, id, onRemove }: { type: ToastType; id: string; onRemove: (id: string) => void }) {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    // Start at 100%, animate to 0% over DURATION_MS
    el.style.width = '100%';
    el.style.transition = `width ${DURATION_MS}ms linear`;
    // Trigger reflow so transition fires
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => { el.style.width = '0%'; });
    });
    return () => cancelAnimationFrame(raf);
  }, [id]);

  const s = STYLES[type];
  return (
    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-800 overflow-hidden rounded-b-lg">
      <div ref={barRef} className={`h-full ${s.bar} opacity-60`} />
    </div>
  );
}

export default function ToastContainer() {
  const { toasts, removeToast } = useToasts();
  if (!toasts.length) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-20 right-6 z-[60] flex flex-col gap-2 w-80 max-w-[calc(100vw-1.5rem)] pointer-events-none"
    >
      {toasts.map(toast => {
        const s = STYLES[toast.type];
        const Icon = ICONS[toast.type];
        return (
          <div
            key={toast.id}
            className={`relative overflow-hidden flex items-start gap-3 px-4 py-3 rounded-lg border shadow-xl ${s.bg} ${s.border} pointer-events-auto`}
          >
            {/* colored left bar */}
            <div className={`absolute left-0 top-0 h-full w-0.5 ${s.bar}`} />
            <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${s.icon}`} />
            <p className="flex-1 text-sm text-slate-200 leading-snug">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              aria-label="Dismiss"
              className="text-slate-500 hover:text-white transition shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <ProgressBar type={toast.type} id={toast.id} onRemove={removeToast} />
          </div>
        );
      })}
    </div>
  );
}

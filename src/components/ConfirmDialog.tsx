import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-950 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            </div>
            <h3 className="font-semibold text-white text-sm">{title}</h3>
          </div>
          <button
            onClick={onCancel}
            aria-label="Cancel"
            className="text-slate-500 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-slate-400 leading-relaxed">{message}</p>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 pb-5">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg transition shadow-lg shadow-red-900/30"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

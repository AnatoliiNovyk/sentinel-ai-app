import { useState, useEffect, useCallback } from 'react';
import { Bot, ChevronDown, ChevronRight, Clock, Code2, ExternalLink, RefreshCw, Sparkles, Zap } from 'lucide-react';
import { Vulnerability } from '../lib/supabase';
import {
  RemediationSuggestion,
  RemediationStep,
  generateRemediation,
  getSavedRemediation,
  clearRemediationCache,
} from '../lib/remediationService';
import { useAuth } from '../context/useAuth';

// ─── Types ──────────────────────────────────────────────────────────────────

type CopyState = Record<number, boolean>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PRIORITY_META: Record<
  RemediationSuggestion['priority'],
  { label: string; cls: string; dot: string }
> = {
  immediate: { label: 'Immediate', cls: 'text-red-300 border-red-500/30 bg-red-500/10', dot: 'bg-red-400' },
  high:      { label: 'High', cls: 'text-orange-300 border-orange-500/30 bg-orange-500/10', dot: 'bg-orange-400' },
  medium:    { label: 'Medium', cls: 'text-yellow-300 border-yellow-500/30 bg-yellow-500/10', dot: 'bg-yellow-400' },
  low:       { label: 'Low', cls: 'text-sky-300 border-sky-500/30 bg-sky-500/10', dot: 'bg-sky-400' },
};

const EFFORT_META: Record<
  RemediationSuggestion['effort'],
  { label: string; icon: string }
> = {
  'quick-win': { label: 'Quick win', icon: '⚡' },
  moderate:    { label: 'Moderate', icon: '🔧' },
  complex:     { label: 'Complex', icon: '🏗️' },
};

const LANG_LABELS: Record<string, string> = {
  bash: 'bash',
  python: 'python',
  yaml: 'yaml',
  terraform: 'terraform',
  powershell: 'powershell',
  typescript: 'typescript',
  sql: 'sql',
};

// ─── CodeBlock ────────────────────────────────────────────────────────────────

function CodeBlock({ step, onCopy, copied }: { step: RemediationStep; onCopy: () => void; copied: boolean }) {
  if (!step.command) return null;
  return (
    <div className="relative mt-2 rounded-lg border border-slate-700 bg-slate-950 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-800 bg-slate-900/50">
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
          {step.language ? LANG_LABELS[step.language] ?? step.language : 'code'}
        </span>
        <button
          onClick={onCopy}
          title={copied ? 'Copied!' : 'Copy to clipboard'}
          className="text-[10px] text-slate-400 hover:text-emerald-300 transition flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-800"
        >
          <Code2 className="w-3 h-3" />
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3 text-xs text-emerald-300 font-mono leading-relaxed whitespace-pre">
        {step.command}
      </pre>
    </div>
  );
}

// ─── StepCard ────────────────────────────────────────────────────────────────

function StepCard({
  step,
  copyStates,
  onCopy,
}: {
  step: RemediationStep;
  copyStates: CopyState;
  onCopy: (order: number, text: string) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        title={open ? 'Collapse step' : 'Expand step'}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-800/40 transition"
      >
        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-bold flex items-center justify-center">
          {step.order}
        </span>
        <span className="flex-1 text-sm font-medium text-slate-200">{step.title}</span>
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-3 space-y-2">
          <p className="text-xs text-slate-400 leading-relaxed">{step.description}</p>
          {step.command && (
            <CodeBlock
              step={step}
              copied={!!copyStates[step.order]}
              onCopy={() => onCopy(step.order, step.command!)}
            />
          )}
          {step.note && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2">
              <span className="text-amber-400 text-xs mt-0.5">ℹ</span>
              <p className="text-xs text-amber-300/80">{step.note}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonLoader() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-4 bg-slate-800 rounded w-3/4" />
      <div className="flex gap-2">
        <div className="h-5 bg-slate-800 rounded-full w-20" />
        <div className="h-5 bg-slate-800 rounded-full w-16" />
        <div className="h-5 bg-slate-800 rounded-full w-24" />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-slate-800" />
            <div className="h-4 bg-slate-800 rounded w-1/2" />
          </div>
          <div className="h-3 bg-slate-800 rounded w-full" />
          <div className="h-3 bg-slate-800 rounded w-5/6" />
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function RemediationAssistant({ vuln }: { vuln: Vulnerability }) {
  const { profile } = useAuth();
  const userId = profile?.id ?? 'anonymous';

  const [suggestion, setSuggestion] = useState<RemediationSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [copyStates, setCopyStates] = useState<CopyState>({});

  // Load cached suggestion on mount
  useEffect(() => {
    getSavedRemediation(vuln.id).then((saved) => {
      if (saved) setSuggestion(saved);
    });
  }, [vuln.id]);

  const generate = useCallback(
    async (force = false) => {
      if (loading) return;
      setLoading(true);
      setError(null);
      if (force) clearRemediationCache(vuln.id);
      try {
        const result = await generateRemediation(vuln, userId);
        setSuggestion(result);
        setExpanded(true);
      } catch {
        setError('Failed to generate suggestion. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [vuln, userId, loading],
  );

  const handleCopy = useCallback(async (order: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStates((prev) => ({ ...prev, [order]: true }));
      setTimeout(() => setCopyStates((prev) => ({ ...prev, [order]: false })), 2000);
    } catch {
      // Clipboard not available
    }
  }, []);

  const priorityMeta = suggestion ? PRIORITY_META[suggestion.priority] : null;
  const effortMeta = suggestion ? EFFORT_META[suggestion.effort] : null;

  // ─── Not yet generated ───────────────────────────────────────────────────
  if (!suggestion && !loading) {
    return (
      <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/30 px-4 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
            <Bot className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-200">AI Remediation Assistant</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Get step-by-step fix guidance with code snippets
            </div>
          </div>
        </div>
        <button
          onClick={() => generate()}
          className="flex-shrink-0 inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs px-3 py-1.5 rounded-lg transition"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Generate Fix
        </button>
      </div>
    );
  }

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Bot className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="text-xs font-semibold text-slate-300">
            Generating AI remediation plan…
          </span>
        </div>
        <SkeletonLoader />
      </div>
    );
  }

  // ─── Error ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 flex items-center justify-between gap-3">
        <p className="text-xs text-red-300">{error}</p>
        <button
          onClick={() => generate()}
          className="text-xs text-slate-400 hover:text-white transition flex items-center gap-1"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    );
  }

  if (!suggestion) return null;

  // ─── Generated suggestion ─────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        title={expanded ? 'Collapse remediation plan' : 'Expand remediation plan'}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-emerald-500/5 transition"
      >
        <div className="w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot className="w-3.5 h-3.5 text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-emerald-300">AI Remediation Plan</span>
            {priorityMeta && (
              <span className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded border ${priorityMeta.cls}`}>
                <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${priorityMeta.dot}`} />
                {priorityMeta.label}
              </span>
            )}
            {effortMeta && (
              <span className="text-[10px] text-slate-400">
                {effortMeta.icon} {effortMeta.label}
              </span>
            )}
            {suggestion.estimated_time && (
              <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                <Clock className="w-3 h-3" /> {suggestion.estimated_time}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-300 leading-relaxed line-clamp-2">{suggestion.summary}</p>
        </div>
        <div className="flex-shrink-0 mt-0.5">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-500" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-emerald-500/10">
          {/* Summary */}
          <p className="text-xs text-slate-300 leading-relaxed pt-3">{suggestion.summary}</p>

          {/* Steps */}
          <div className="space-y-2">
            <div className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">
              Remediation Steps
            </div>
            {suggestion.steps.map((step) => (
              <StepCard
                key={step.order}
                step={step}
                copyStates={copyStates}
                onCopy={handleCopy}
              />
            ))}
          </div>

          {/* References */}
          {suggestion.references.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">
                References
              </div>
              <div className="flex flex-wrap gap-2">
                {suggestion.references.map((ref) => (
                  <a
                    key={ref.url}
                    href={ref.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 border border-sky-500/20 hover:border-sky-500/40 bg-sky-500/5 px-2 py-1 rounded-md transition"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {ref.label}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-800">
            <span className="text-[10px] text-slate-600">
              Generated {new Date(suggestion.generated_at).toLocaleString()}
            </span>
            <button
              onClick={() => generate(true)}
              title="Regenerate AI remediation plan"
              className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-emerald-300 transition"
            >
              <Zap className="w-3 h-3" />
              Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

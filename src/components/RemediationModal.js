import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { X, Terminal, Copy, Check, ExternalLink, ChevronRight, Shield, GitBranch, Cloud, Code2 } from 'lucide-react';
function getSteps(v) {
    const type = v.remediation_type || 'manual';
    const code = v.remediation_code || '';
    if (type === 'terraform' || type === 'hcl') {
        return [
            { label: 'Review the Terraform patch', note: 'Ensure the change aligns with your state.' },
            { label: 'Apply to your configuration', command: code },
            { label: 'Validate', command: 'terraform validate' },
            { label: 'Plan', command: 'terraform plan -out=remediation.tfplan' },
            { label: 'Apply', command: 'terraform apply remediation.tfplan' },
            { label: 'Re-scan to confirm fix', note: 'Trigger a new Sentinel scan on this project.' },
        ];
    }
    if (type === 'aws-cli')
        return [
            { label: 'Configure AWS CLI', command: 'aws sts get-caller-identity' },
            { label: 'Run remediation command', command: code || v.remediation },
            { label: 'Re-scan to confirm fix', note: 'Trigger a new Sentinel scan on this project.' },
        ];
    if (type === 'kubectl' || type === 'kubernetes')
        return [
            { label: 'Check kubectl context', command: 'kubectl config current-context' },
            { label: 'Apply the patch', command: code || 'kubectl apply -f remediation.yaml' },
            { label: 'Verify rollout', command: 'kubectl rollout status deployment/<name>' },
            { label: 'Re-scan to confirm fix', note: 'Trigger a new Sentinel scan on this project.' },
        ];
    if (type === 'bash')
        return [
            { label: 'Run the remediation script', command: code || v.remediation },
            { label: 'Verify the change', note: 'Check system state after running.' },
            { label: 'Re-scan to confirm fix', note: 'Trigger a new Sentinel scan on this project.' },
        ];
    return [
        { label: 'Read the remediation guidance', note: v.remediation },
        ...(code ? [{ label: 'Apply the code change', command: code }] : []),
        { label: 'Document the change', note: 'Update your change log or ticket system.' },
        { label: 'Re-scan to confirm fix', note: 'Trigger a new Sentinel scan on this project.' },
    ];
}
const TYPE_META = {
    terraform: { label: 'Terraform', icon: Code2, color: 'text-violet-400 border-violet-500/30 bg-violet-500/10' },
    hcl: { label: 'Terraform', icon: Code2, color: 'text-violet-400 border-violet-500/30 bg-violet-500/10' },
    'aws-cli': { label: 'AWS CLI', icon: Cloud, color: 'text-orange-400 border-orange-500/30 bg-orange-500/10' },
    kubectl: { label: 'kubectl', icon: GitBranch, color: 'text-sky-400 border-sky-500/30 bg-sky-500/10' },
    kubernetes: { label: 'kubectl', icon: GitBranch, color: 'text-sky-400 border-sky-500/30 bg-sky-500/10' },
    bash: { label: 'Bash', icon: Terminal, color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
    manual: { label: 'Manual', icon: Shield, color: 'text-slate-400 border-slate-600 bg-slate-800/40' },
};
const SEV_COLOR = {
    critical: 'text-red-400 border-red-500/30 bg-red-500/10',
    high: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
    medium: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
    low: 'text-sky-400 border-sky-500/30 bg-sky-500/10',
    info: 'text-slate-400 border-slate-700 bg-slate-800/40',
};
export default function RemediationModal({ vuln, onClose }) {
    const [copied, setCopied] = useState(null);
    const [completed, setCompleted] = useState(new Set());
    const steps = getSteps(vuln);
    const meta = TYPE_META[vuln.remediation_type] ?? TYPE_META.manual;
    const Icon = meta.icon;
    const progress = Math.round((completed.size / steps.length) * 100);
    const copy = (text, idx) => {
        navigator.clipboard.writeText(text);
        setCopied(idx);
        setTimeout(() => setCopied(null), 2000);
    };
    const toggle = (i) => setCompleted(prev => {
        const next = new Set(prev);
        if (next.has(i)) {
            next.delete(i);
        }
        else {
            next.add(i);
        }
        return next;
    });
    return (_jsx("div", { className: "fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4", children: _jsxs("div", { className: "w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl flex flex-col max-h-[90vh]", children: [_jsxs("div", { className: "flex items-start justify-between px-6 py-5 border-b border-slate-800", children: [_jsxs("div", { className: "flex-1 pr-4", children: [_jsxs("div", { className: "flex items-center gap-2 mb-1.5", children: [_jsx("span", { className: `text-xs px-2 py-0.5 rounded border capitalize ${SEV_COLOR[vuln.severity] ?? ''}`, children: vuln.severity }), _jsxs("span", { className: `inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded border ${meta.color}`, children: [_jsx(Icon, { className: "w-3 h-3" }), meta.label] })] }), _jsx("h2", { className: "font-semibold text-white text-base leading-snug", children: vuln.title }), _jsx("p", { className: "mt-1 text-xs text-slate-500 font-mono", children: vuln.asset })] }), _jsx("button", { onClick: onClose, "aria-label": "Close modal", title: "Close modal", className: "p-1.5 text-slate-500 hover:text-white", children: _jsx(X, { className: "w-4 h-4" }) })] }), _jsxs("div", { className: "px-6 py-3 border-b border-slate-800", children: [_jsxs("div", { className: "flex justify-between text-xs text-slate-500 mb-1.5", children: [_jsx("span", { children: "Remediation progress" }), _jsxs("span", { className: progress === 100 ? 'text-emerald-400 font-semibold' : '', children: [progress, "%"] })] }), _jsx("div", { className: "h-1.5 bg-slate-800 rounded-full overflow-hidden", children: _jsx("div", { className: `h-full rounded-full transition-all duration-500 ${progress === 100 ? 'bg-emerald-400' : 'bg-emerald-500'}`, style: { width: `${progress}%` } }) })] }), _jsx("div", { className: "flex-1 overflow-y-auto px-6 py-4 space-y-3", children: steps.map((step, i) => (_jsxs("div", { className: `rounded-xl border transition-all ${completed.has(i) ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-slate-800 bg-slate-900/30'}`, children: [_jsxs("button", { onClick: () => toggle(i), className: "w-full flex items-center gap-3 px-4 py-3 text-left", children: [_jsx("div", { className: `w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition ${completed.has(i) ? 'border-emerald-500 bg-emerald-500' : 'border-slate-700'}`, children: completed.has(i) && _jsx(Check, { className: "w-3 h-3 text-slate-950", strokeWidth: 3 }) }), _jsxs("span", { className: "text-[10px] font-bold text-slate-600 shrink-0", children: ["STEP ", i + 1] }), _jsx(ChevronRight, { className: "w-3 h-3 text-slate-600 shrink-0" }), _jsx("span", { className: `text-sm font-medium ${completed.has(i) ? 'text-slate-500 line-through' : 'text-slate-200'}`, children: step.label })] }), step.command && (_jsxs("div", { className: "mx-4 mb-3 relative group bg-slate-950 border border-slate-800 rounded-lg overflow-hidden", children: [_jsx("pre", { className: "font-mono text-xs text-emerald-300 p-3 overflow-x-auto whitespace-pre-wrap leading-relaxed", children: step.command }), _jsx("button", { onClick: (e) => { e.stopPropagation(); copy(step.command, i); }, className: "absolute top-2 right-2 text-[10px] text-slate-500 hover:text-white bg-slate-800 px-2 py-1 rounded flex items-center gap-1 transition", children: copied === i ? _jsxs(_Fragment, { children: [_jsx(Check, { className: "w-3 h-3" }), "Copied"] }) : _jsxs(_Fragment, { children: [_jsx(Copy, { className: "w-3 h-3" }), "Copy"] }) })] })), step.note && !step.command && _jsx("div", { className: "mx-4 mb-3 text-xs text-slate-400 leading-relaxed", children: step.note })] }, i))) }), _jsxs("div", { className: "px-6 py-4 border-t border-slate-800 flex items-center justify-between gap-3", children: [vuln.cve_id && (_jsxs("a", { href: `https://nvd.nist.gov/vuln/detail/${vuln.cve_id}`, target: "_blank", rel: "noopener noreferrer", className: "inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 transition", children: [_jsx(ExternalLink, { className: "w-3 h-3" }), vuln.cve_id, " on NVD"] })), _jsxs("div", { className: "flex items-center gap-2 ml-auto", children: [_jsx("button", { onClick: onClose, className: "px-4 py-2 text-sm text-slate-300 hover:text-white", children: "Close" }), progress === 100 && (_jsxs("button", { onClick: onClose, className: "inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-4 py-2 rounded-md text-sm transition", children: [_jsx(Check, { className: "w-3.5 h-3.5" }), "Mark as Resolved"] }))] })] })] }) }));
}

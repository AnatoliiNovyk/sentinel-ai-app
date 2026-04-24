import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
export default function NotFound() {
    return (_jsx("div", { className: "min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6", children: _jsxs("div", { className: "text-center max-w-sm", children: [_jsx("div", { className: "w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto mb-6", children: _jsx(ShieldAlert, { className: "w-8 h-8 text-amber-500" }) }), _jsx("h1", { className: "text-3xl font-bold mb-2 text-white", children: "404" }), _jsx("p", { className: "text-slate-400 mb-8", children: "The page you are looking for has been neutralized or does not exist." }), _jsx(Link, { to: "/", className: "inline-flex items-center justify-center px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-all shadow-lg shadow-emerald-500/20", children: "Return to Base" })] }) }));
}

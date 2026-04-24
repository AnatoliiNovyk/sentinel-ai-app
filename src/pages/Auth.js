import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Shield, ArrowLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
export default function Auth() {
    const { signIn, signUp } = useAuth();
    const navigate = useNavigate();
    const [mode, setMode] = useState('signin');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const isSignup = mode === 'signup';
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        const { error: authError } = isSignup
            ? await signUp(email, password, fullName)
            : await signIn(email, password);
        setLoading(false);
        if (authError)
            setError(authError);
        // On success, redirecting to home is handled by the AuthProvider's user state change in App.tsx
    };
    return (_jsxs("div", { className: "min-h-screen bg-slate-950 text-slate-100 flex flex-col", children: [_jsx("div", { className: "px-6 py-5", children: _jsxs("button", { onClick: () => navigate('/landing'), className: "inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition", children: [_jsx(ArrowLeft, { className: "w-4 h-4" }), " Back"] }) }), _jsx("div", { className: "flex-1 flex items-center justify-center px-6 pb-10", children: _jsxs("div", { className: "w-full max-w-md", children: [_jsxs("div", { className: "flex items-center gap-2 mb-8", children: [_jsx("div", { className: "w-9 h-9 rounded-md bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center", children: _jsx(Shield, { className: "w-5 h-5 text-slate-950", strokeWidth: 2.5 }) }), _jsx("span", { className: "text-lg font-semibold", children: "Sentinel AI" })] }), _jsx("h1", { className: "text-3xl font-bold tracking-tight", children: isSignup ? 'Create your account' : 'Welcome back' }), _jsx("p", { className: "mt-2 text-slate-400 text-sm", children: isSignup ? 'Start auditing your infrastructure with AI.' : 'Sign in to continue your audit.' }), _jsxs("form", { onSubmit: handleSubmit, className: "mt-8 space-y-4", children: [isSignup && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm text-slate-300 mb-1.5", children: "Full name" }), _jsx("input", { type: "text", value: fullName, onChange: (e) => setFullName(e.target.value), required: true, className: "w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition", placeholder: "Jane Doe" })] })), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-slate-300 mb-1.5", children: "Email" }), _jsx("input", { type: "email", value: email, onChange: (e) => setEmail(e.target.value), required: true, className: "w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition", placeholder: "you@company.com" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-slate-300 mb-1.5", children: "Password" }), _jsx("input", { type: "password", value: password, onChange: (e) => setPassword(e.target.value), required: true, minLength: 6, className: "w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition", placeholder: "Minimum 6 characters" })] }), error && (_jsx("div", { className: "rounded-md border border-red-500/30 bg-red-500/10 text-red-300 text-sm px-3 py-2", children: error })), _jsxs("button", { type: "submit", disabled: loading, className: "w-full inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed text-slate-950 font-semibold py-2.5 rounded-md transition", children: [loading && _jsx(Loader2, { className: "w-4 h-4 animate-spin" }), isSignup ? 'Create account' : 'Sign in'] })] }), _jsxs("div", { className: "mt-6 text-sm text-slate-400 text-center", children: [isSignup ? 'Already have an account?' : "Don't have an account?", ' ', _jsx("button", { onClick: () => setMode(isSignup ? 'signin' : 'signup'), className: "text-emerald-400 hover:text-emerald-300 font-medium", children: isSignup ? 'Sign in' : 'Create one' })] })] }) })] }));
}

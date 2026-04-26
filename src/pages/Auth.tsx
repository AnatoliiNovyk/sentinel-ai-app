import { useState } from 'react';
import { Shield, ArrowLeft, Loader2, Check, X, Eye, EyeOff, Lock, Zap, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

export default function Auth() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSignup = mode === 'signup';
  const [showPassword, setShowPassword] = useState(false);

  const getPasswordStrength = (pwd: string): { level: 'weak' | 'fair' | 'strong'; score: number } => {
    if (!pwd) return { level: 'weak', score: 0 };
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (pwd.length >= 12) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[!@#$%^&*]/.test(pwd)) score += 1;
    
    if (score <= 1) return { level: 'weak', score };
    if (score <= 3) return { level: 'fair', score };
    return { level: 'strong', score };
  };

  const pwdStrength = isSignup ? getPasswordStrength(password) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: authError } = isSignup
      ? await signUp(email, password, fullName)
      : await signIn(email, password);
    setLoading(false);
    if (authError) setError(authError);
    // On success, redirecting to home is handled by the AuthProvider's user state change in App.tsx
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <div className="px-6 py-5">
        <button
          onClick={() => navigate('/landing')}
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center px-6 pb-10">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-md bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center">
              <Shield className="w-5 h-5 text-slate-950" strokeWidth={2.5} />
            </div>
            <span className="text-lg font-semibold">Sentinel AI</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isSignup ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="mt-2 text-slate-400 text-sm">
            {isSignup ? 'Start auditing your infrastructure with AI.' : 'Sign in to continue your audit.'}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {isSignup && (
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">Full name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition"
                  placeholder="Jane Doe"
                />
              </div>
            )}
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2.5 pr-10 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition"
                  placeholder="Minimum 6 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {isSignup && password && pwdStrength && (
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          pwdStrength.level === 'weak' ? 'w-1/3 bg-red-500' :
                          pwdStrength.level === 'fair' ? 'w-2/3 bg-amber-500' :
                          'w-full bg-emerald-500'
                        }`}
                      />
                    </div>
                    <span className={`text-xs font-medium capitalize ${
                      pwdStrength.level === 'weak' ? 'text-red-400' :
                      pwdStrength.level === 'fair' ? 'text-amber-400' :
                      'text-emerald-400'
                    }`}>
                      {pwdStrength.level}
                    </span>
                  </div>
                  <div className="space-y-1 text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                      {password.length >= 8 ? <Check className="w-3 h-3 text-emerald-400" /> : <X className="w-3 h-3 text-slate-600" />}
                      At least 8 characters
                    </div>
                    <div className="flex items-center gap-1.5">
                      {/[A-Z]/.test(password) ? <Check className="w-3 h-3 text-emerald-400" /> : <X className="w-3 h-3 text-slate-600" />}
                      Uppercase letter
                    </div>
                    <div className="flex items-center gap-1.5">
                      {/[0-9]/.test(password) ? <Check className="w-3 h-3 text-emerald-400" /> : <X className="w-3 h-3 text-slate-600" />}
                      Number
                    </div>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 text-red-300 text-sm px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed text-slate-950 font-semibold py-2.5 rounded-md transition"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSignup ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 text-sm text-slate-400 text-center">
            {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button onClick={() => setMode(isSignup ? 'signin' : 'signup')} className="text-emerald-400 hover:text-emerald-300 font-medium">
              {isSignup ? 'Sign in' : 'Create one'}
            </button>
          </div>

          {/* Security badges */}
          <div className="mt-8 flex items-center justify-center gap-5 flex-wrap">
            {[
              { icon: Lock, label: 'AES-256 encrypted' },
              { icon: Zap, label: 'Zero-knowledge' },
              { icon: ShieldCheck, label: 'SOC 2 compliant' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-1.5 text-[11px] text-slate-600">
                <Icon className="w-3 h-3" />
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


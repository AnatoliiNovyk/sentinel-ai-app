import { useState } from 'react';
import { Shield, ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

type Props = {
  mode: 'signin' | 'signup';
  onBack: () => void;
  onSwitch: () => void;
};

export default function Auth({ mode, onBack, onSwitch }: Props) {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSignup = mode === 'signup';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = isSignup
      ? await signUp(email, password, fullName)
      : await signIn(email, password);
    setLoading(false);
    if (error) setError(error);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <div className="px-6 py-5">
        <button
          onClick={onBack}
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
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition"
                placeholder="Minimum 6 characters"
              />
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
            <button onClick={onSwitch} className="text-emerald-400 hover:text-emerald-300 font-medium">
              {isSignup ? 'Sign in' : 'Create one'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

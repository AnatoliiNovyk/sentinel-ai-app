import { ShieldAlert, Shield, ArrowLeft, Home, Navigation, BarChart3, FileText, Settings, HelpCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();

  const quickLinks = [
    { icon: Home, label: 'Dashboard', href: '/' },
    { icon: Navigation, label: 'Projects', href: '/projects' },
    { icon: BarChart3, label: 'Scans', href: '/scans' },
    { icon: FileText, label: 'Reports', href: '/reports' },
    { icon: Settings, label: 'Settings', href: '/settings' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="text-center max-w-2xl">
        {/* Header */}
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500/20 to-red-500/20 border border-amber-500/30 flex items-center justify-center mx-auto mb-6">
          <ShieldAlert className="w-10 h-10 text-amber-500 animate-pulse" />
        </div>

        {/* Main message */}
        <h1 className="text-5xl lg:text-6xl font-black mb-3 text-white">404</h1>
        <h2 className="text-2xl font-bold mb-2 text-white">Threat Not Found</h2>
        <p className="text-slate-400 mb-2 text-lg">
          Like a well-hidden vulnerability, this page has evaded detection.
        </p>
        <p className="text-slate-500 text-sm mb-8">
          The URL you are trying to reach either doesn't exist or has been patched.
        </p>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white font-medium transition"
          >
            <ArrowLeft className="w-4 h-4" /> Go Back
          </button>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-all shadow-lg shadow-emerald-500/20"
          >
            <Home className="w-4 h-4" /> Return to Dashboard
          </Link>
        </div>

        {/* Quick navigation */}
        <div>
          <p className="text-xs text-slate-600 font-semibold uppercase tracking-wide mb-3">Quick navigation</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="group px-3 py-2.5 rounded-lg border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900/50 transition flex flex-col items-center gap-1.5"
              >
                <link.icon className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition" />
                <span className="text-xs text-slate-400 group-hover:text-white transition">{link.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Footer info */}
        <p className="mt-12 text-xs text-slate-600 flex items-center justify-center gap-1.5">
          <Shield className="w-3 h-3" />
          Need help? Check our{' '}
          <Link to="/auth" className="text-emerald-400 hover:text-emerald-300">
            support
          </Link>
        </p>
      </div>
    </div>
  );
}

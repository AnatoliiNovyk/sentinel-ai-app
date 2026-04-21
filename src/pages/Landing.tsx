import { Link } from 'react-router-dom';
import { Shield, Zap, Lock, Globe, ChevronRight, Activity, Server, FileCode, CheckCircle2 } from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 overflow-x-hidden selection:bg-emerald-500/30">
      
      {/* Header */}
      <header className="fixed top-0 w-full border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-md z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xl tracking-tight">
            <Shield className="w-6 h-6" />
            Sentinel AI
          </div>
          <div className="flex items-center gap-6 text-sm font-medium">
            <a href="#features" className="text-slate-400 hover:text-white transition">Features</a>
            <a href="#pricing" className="text-slate-400 hover:text-white transition">Pricing</a>
            <Link to="/auth" className="text-slate-400 hover:text-white transition">Sign In</Link>
            <Link to="/auth?signup=true" className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-md transition">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 px-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-slate-950 to-slate-950 -z-10" />
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-8">
            <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>
            Sentinel AI 2.0 is Live
          </div>
          <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight text-white mb-8">
            Autonomous Security <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-sky-400">
              For Modern Infrastructure
            </span>
          </h1>
          <p className="text-lg lg:text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Continuous threat exposure management. Discover assets, detect vulnerabilities across multi-cloud environments, and auto-generate remediation code with AI.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/auth?signup=true" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-base font-semibold px-8 py-4 rounded-lg transition shadow-[0_0_40px_rgba(16,185,129,0.3)] hover:shadow-[0_0_60px_rgba(16,185,129,0.4)]">
              Start Free Trial <ChevronRight className="w-4 h-4" />
            </Link>
            <a href="#features" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-slate-700 hover:border-slate-500 text-white text-base font-semibold px-8 py-4 rounded-lg transition bg-slate-900/50">
              View Features
            </a>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 border-t border-slate-800/50 bg-slate-950 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">Enterprise-Grade Security Pipeline</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">Everything you need to secure your infrastructure from code to cloud, without the noise of traditional scanners.</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Globe, title: 'Passive Reconnaissance', desc: 'Discover shadow IT and exposed assets without sending a single packet using Shodan and Censys APIs.' },
              { icon: Zap, title: 'AI Remediation', desc: 'Automatically generate Terraform, Kubernetes, and bash scripts to patch vulnerabilities instantly.' },
              { icon: FileCode, title: 'CI/CD Integration', desc: 'Scan Infrastructure as Code (IaC) directly in your GitHub Actions or GitLab pipelines.' },
              { icon: Activity, title: 'Dark Web Monitoring', desc: 'Continuous monitoring of your domains and employee emails for breached credentials.' },
              { icon: Server, title: 'Multi-Cloud Scanners', desc: 'Native integration with AWS Prowler, GCP SCC, Azure Defender, and Kubernetes kube-bench.' },
              { icon: Lock, title: 'Compliance Evidence', desc: 'One-click export of SOC2, CIS Controls, and NIST CSF evidence packages for auditors.' },
            ].map((f, i) => (
              <div key={i} className="p-6 rounded-2xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 transition hover:border-emerald-500/30 group">
                <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 mb-6 group-hover:scale-110 transition-transform">
                  <f.icon className="w-6 h-6 text-emerald-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Teaser */}
      <section id="pricing" className="py-24 border-t border-slate-800/50 bg-slate-900/20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-6">Simple, transparent pricing</h2>
          <p className="text-slate-400 mb-10">Start for free, upgrade when your team grows. All plans include unlimited CI/CD scans.</p>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
            <div className="p-8 rounded-2xl border border-slate-800 bg-slate-900/80 text-left">
              <h3 className="text-xl font-semibold text-white mb-2">Developer</h3>
              <div className="text-4xl font-bold text-white mb-6">$0<span className="text-lg text-slate-500 font-normal">/mo</span></div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-sm text-slate-300"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> 3 Projects</li>
                <li className="flex items-center gap-2 text-sm text-slate-300"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Nmap & tfsec scanners</li>
                <li className="flex items-center gap-2 text-sm text-slate-300"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> PDF Reports</li>
              </ul>
              <Link to="/auth?signup=true" className="block w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white text-center font-medium rounded-lg transition">Get Started Free</Link>
            </div>
            <div className="p-8 rounded-2xl border border-emerald-500/50 bg-emerald-500/5 text-left relative">
              <div className="absolute top-0 right-6 -translate-y-1/2 bg-emerald-500 text-slate-950 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">Most Popular</div>
              <h3 className="text-xl font-semibold text-white mb-2">Pro</h3>
              <div className="text-4xl font-bold text-white mb-6">$149<span className="text-lg text-slate-500 font-normal">/mo</span></div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-sm text-slate-300"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Unlimited Projects</li>
                <li className="flex items-center gap-2 text-sm text-slate-300"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> All Multi-Cloud Scanners</li>
                <li className="flex items-center gap-2 text-sm text-slate-300"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> AI Auto-Remediation</li>
              </ul>
              <Link to="/auth?signup=true" className="block w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-center font-bold rounded-lg transition shadow-lg shadow-emerald-500/20">Upgrade to Pro</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-slate-800 bg-slate-950 text-center text-slate-500 text-sm">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-semibold text-slate-300">
            <Shield className="w-4 h-4 text-emerald-500" /> Sentinel AI
          </div>
          <p>© {new Date().getFullYear()} Sentinel AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

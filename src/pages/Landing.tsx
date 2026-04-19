import { Shield, Terminal, Zap, Lock, Cloud, FileCheck, ArrowRight, Bot, Activity, ChevronRight } from 'lucide-react';

type Props = {
  onNavigate: (page: 'signin' | 'signup') => void;
};

export default function Landing({ onNavigate }: Props) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800/60 backdrop-blur sticky top-0 z-50 bg-slate-950/80">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center">
              <Shield className="w-5 h-5 text-slate-950" strokeWidth={2.5} />
            </div>
            <span className="text-lg font-semibold tracking-tight">Sentinel AI</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-slate-300">
            <a href="#features" className="hover:text-white transition">Features</a>
            <a href="#how" className="hover:text-white transition">How it works</a>
            <a href="#pricing" className="hover:text-white transition">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('signin')}
              className="text-sm text-slate-300 hover:text-white transition"
            >
              Sign in
            </button>
            <button
              onClick={() => onNavigate('signup')}
              className="text-sm bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-medium px-4 py-2 rounded-md transition"
            >
              Get started
            </button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.15),_transparent_60%)]" />
        <div className="max-w-7xl mx-auto px-6 py-24 md:py-32 relative">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-medium mb-6">
              <Activity className="w-3.5 h-3.5" />
              The first fully AI-driven infrastructure auditor
            </div>
            <h1 className="text-5xl md:text-6xl font-bold leading-[1.1] tracking-tight">
              Security audits,{' '}
              <span className="bg-gradient-to-r from-emerald-300 to-teal-400 bg-clip-text text-transparent">
                orchestrated by AI
              </span>
            </h1>
            <p className="mt-6 text-lg text-slate-400 leading-relaxed max-w-2xl">
              Sentinel AI pilots industry-grade scanners, interprets raw findings, and delivers
              ready-to-apply remediation in Terraform and Kubernetes. Just describe the goal in
              plain English.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => onNavigate('signup')}
                className="inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-6 py-3 rounded-md transition group"
              >
                Start free audit
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
              </button>
              <button
                onClick={() => onNavigate('signin')}
                className="inline-flex items-center justify-center gap-2 border border-slate-700 hover:border-slate-500 text-slate-200 px-6 py-3 rounded-md transition"
              >
                <Terminal className="w-4 h-4" />
                View demo
              </button>
            </div>
          </div>

          <div className="mt-20 rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden shadow-2xl">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 bg-slate-900/80">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/70" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
              </div>
              <div className="text-xs text-slate-500 ml-2">sentinel.ai / chat</div>
            </div>
            <div className="p-6 space-y-4 font-mono text-sm">
              <div className="flex gap-3">
                <div className="text-slate-500 shrink-0">you</div>
                <div className="text-slate-300">Scan my AWS account for SOC2 compliance gaps</div>
              </div>
              <div className="flex gap-3">
                <div className="text-emerald-400 shrink-0">ai</div>
                <div className="text-slate-300">
                  Spinning up Prowler + CloudSploit against 3 regions. Parsing IAM policies and S3
                  configurations. <span className="text-emerald-400">12 findings</span> mapped to
                  CIS AWS Foundations. Generating remediation Terraform now...
                </div>
              </div>
              <div className="flex gap-3">
                <div className="text-emerald-400 shrink-0">ai</div>
                <div className="text-slate-300">
                  Ready. Executive summary and 8 patch modules queued for review.
                  <ChevronRight className="inline w-3 h-3 ml-1" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-24 border-t border-slate-900">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Built around an autonomous AI core
            </h2>
            <p className="mt-4 text-slate-400 text-lg">
              Claude, GPT, and Mistral agents collaborate to pick the right scanner, interpret the
              output, and turn it into actionable engineering work.
            </p>
          </div>
          <div className="mt-16 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Bot, title: 'Multi-LLM gateway', desc: 'Routes tasks to Claude for deep analysis, Mistral for fast log parsing, GPT for code generation.' },
              { icon: Cloud, title: 'Cloud & IaC coverage', desc: 'Prowler, CloudSploit, tfsec, Checkov — orchestrated across AWS, GCP, Azure.' },
              { icon: Terminal, title: 'External attack surface', desc: 'Nmap, Masscan, Amass run in isolated containers against your perimeter.' },
              { icon: FileCheck, title: 'Framework mapping', desc: 'Findings auto-mapped to MITRE ATT&CK, CIS Controls, and SOC2 requirements.' },
              { icon: Zap, title: 'Remediation as code', desc: 'Ready-to-apply Terraform modules and Kubernetes manifests for every finding.' },
              { icon: Lock, title: 'Zero Trust by default', desc: 'End-to-end encryption for reports, credentials stored in vaulted secrets.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="group p-6 rounded-xl border border-slate-800 bg-slate-900/30 hover:border-emerald-500/50 hover:bg-slate-900/60 transition"
              >
                <div className="w-10 h-10 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition">
                  <Icon className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="py-24 border-t border-slate-900 bg-slate-950">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight max-w-2xl">
            From prompt to patch in minutes
          </h2>
          <div className="mt-16 grid md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Describe the goal', desc: 'Use natural language. "Check my Kubernetes cluster for RBAC drift."' },
              { step: '02', title: 'AI picks the toolkit', desc: 'Agents select scanners, run them in sandboxes, and correlate the output.' },
              { step: '03', title: 'Review & apply fixes', desc: 'Receive executive reports plus IaC patches ready for pull requests.' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="relative">
                <div className="text-5xl font-bold text-emerald-500/20 mb-4">{step}</div>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-slate-400 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="py-24 border-t border-slate-900">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Straightforward pricing</h2>
            <p className="mt-4 text-slate-400">Start free. Upgrade when you need deeper audits and AI remediation.</p>
          </div>
          <div className="mt-16 grid md:grid-cols-3 gap-6">
            {[
              { name: 'Basic', price: '$0', tag: 'External audit only', features: ['Attack surface scans', '1 project', 'Executive reports', 'Community support'] },
              { name: 'Pro', price: '$199', tag: 'Most popular', features: ['Cloud + IaC scanning', 'AI remediation patches', '10 projects', 'Priority support'], highlight: true },
              { name: 'Enterprise', price: 'Custom', tag: 'Unlimited', features: ['Custom AI models', 'SSO + audit log', 'Unlimited projects', 'Dedicated engineer'] },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`p-8 rounded-xl border ${
                  plan.highlight
                    ? 'border-emerald-500/50 bg-emerald-500/5 relative'
                    : 'border-slate-800 bg-slate-900/30'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-8 px-3 py-1 rounded-full bg-emerald-500 text-slate-950 text-xs font-semibold">
                    Most popular
                  </div>
                )}
                <div className="text-sm text-slate-400">{plan.tag}</div>
                <div className="mt-2 text-2xl font-bold">{plan.name}</div>
                <div className="mt-4 text-4xl font-bold">
                  {plan.price}
                  {plan.price !== 'Custom' && <span className="text-base font-normal text-slate-400">/mo</span>}
                </div>
                <ul className="mt-6 space-y-3 text-sm text-slate-300">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => onNavigate('signup')}
                  className={`mt-8 w-full py-2.5 rounded-md font-medium transition ${
                    plan.highlight
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                      : 'border border-slate-700 hover:border-slate-500 text-white'
                  }`}
                >
                  Get started
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-900 py-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Shield className="w-4 h-4 text-emerald-500" />
            Sentinel AI — Autonomous infrastructure auditor
          </div>
          <div className="text-xs text-slate-600">
            End-to-end encrypted. SOC2-ready architecture.
          </div>
        </div>
      </footer>
    </div>
  );
}

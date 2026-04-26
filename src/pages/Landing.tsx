import { Link } from 'react-router-dom';
import { Shield, Zap, Lock, Globe, ChevronRight, Activity, Server, FileCode, CheckCircle2, Mail, ChevronDown, Users, Bug, TrendingUp, Clock } from 'lucide-react';
import { useState } from 'react';

export default function Landing() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setSubscribed(true);
      setEmail('');
      setTimeout(() => setSubscribed(false), 3000);
    }
  };

  const faqs = [
    {
      q: 'What is Sentinel AI?',
      a: 'Sentinel AI is an autonomous threat exposure management platform that discovers assets, detects vulnerabilities across multi-cloud environments, and generates AI-powered remediation code automatically.',
    },
    {
      q: 'Can I use Sentinel AI for free?',
      a: 'Yes! Our Developer plan is free forever with 3 projects and core scanners. You can upgrade anytime to unlock unlimited projects and AI auto-remediation features.',
    },
    {
      q: 'How often are scans performed?',
      a: 'You can run scans on-demand or schedule them hourly, daily, or weekly. Live jobs show real-time progress, and results are updated instantly to your dashboard.',
    },
    {
      q: 'Does Sentinel AI support our compliance framework?',
      a: 'Yes! We provide one-click evidence export for SOC2, CIS Controls, NIST CSF, and MITRE ATT&CK. Perfect for audit preparation and compliance reporting.',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      
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

          {/* Social proof stats */}
          <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-2xl mx-auto">
            {[
              { icon: <Users className="w-5 h-5" />, value: '2,500+', label: 'Active users' },
              { icon: <Bug className="w-5 h-5" />,   value: '180K+',  label: 'Vulns found' },
              { icon: <Shield className="w-5 h-5" />,value: '12K+',   label: 'Scans run' },
              { icon: <TrendingUp className="w-5 h-5" />, value: '99.9%', label: 'Uptime SLA' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-2 mx-auto">{s.icon}</div>
                <div className="text-2xl font-bold text-white">{s.value}</div>
                <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-24 border-t border-slate-800/50 bg-slate-900/30 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-white mb-4">Up and running in minutes</h2>
            <p className="text-slate-400">No agents to install, no firewall rules to change. Just connect and scan.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', icon: <Globe className="w-6 h-6" />, title: 'Connect your infrastructure', desc: 'Add your domains, IPs, cloud accounts, or upload a package.json. Sentinel AI automatically maps your attack surface.' },
              { step: '02', icon: <Zap className="w-6 h-6" />,   title: 'AI scans & detects threats', desc: 'Our scanners run Nmap, tfsec, Prowler, and dark web checks in parallel. Results appear in real-time with risk scoring.' },
              { step: '03', icon: <Clock className="w-6 h-6" />,  title: 'Remediate & track SLAs', desc: 'Get AI-generated fix scripts, assign ownership, and track SLA compliance. Close findings in one click.' },
            ].map(s => (
              <div key={s.step} className="relative">
                <div className="text-6xl font-black text-slate-800/60 mb-3 leading-none">{s.step}</div>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">{s.icon}</div>
                <h3 className="text-lg font-semibold text-white mb-2">{s.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
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

      {/* FAQ Section */}
      <section className="py-24 border-t border-slate-800/50 bg-slate-950 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">Frequently Asked Questions</h2>
            <p className="text-slate-400">Common questions about Sentinel AI and how to get started.</p>
          </div>
          
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div key={i} className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden">
                <button
                  onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-900/50 transition text-left"
                >
                  <span className="font-semibold text-white">{faq.q}</span>
                  <ChevronDown className={`w-5 h-5 text-emerald-400 transition-transform ${expandedFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {expandedFaq === i && (
                  <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/20">
                    <p className="text-slate-400 text-sm leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter CTA */}
      <section className="py-24 border-t border-slate-800/50 bg-slate-900/40 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Stay Updated</h2>
          <p className="text-slate-400 mb-8">Get the latest security insights, feature releases, and threat intelligence delivered to your inbox.</p>
          
          <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row items-center gap-3 bg-slate-950/50 border border-slate-800 rounded-lg p-1.5">
            <Mail className="w-4 h-4 text-emerald-400 ml-3 shrink-0" />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Enter your email…"
              className="flex-1 bg-transparent text-white placeholder-slate-600 outline-none text-sm"
            />
            <button
              type="submit"
              className="shrink-0 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-6 py-2 rounded-md text-sm transition"
            >
              Subscribe
            </button>
          </form>
          {subscribed && (
            <p className="mt-3 text-sm text-emerald-400">✓ Thanks for subscribing!</p>
          )}
          <p className="text-xs text-slate-600 mt-3">No spam, ever. Unsubscribe anytime.</p>
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

# 🛡️ Sentinel AI

> **Autonomous Security Auditing Platform** — AI-driven vulnerability scanning, remediation, and compliance monitoring for modern infrastructure.

[![CI](https://github.com/AnatoliiNovyk/sentinel-ai-app/actions/workflows/ci.yml/badge.svg)](https://github.com/AnatoliiNovyk/sentinel-ai-app/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)

---

## ✨ Features

| Feature | Description |
|---|---|
| 🤖 **AI Agent** | Natural-language commands → autonomous scans, reports, findings triage |
| 🔍 **Multi-scanner** | nmap · amass · prowler · tfsec — simulated with realistic finding generation |
| 🛡️ **Compliance** | Automated mapping to SOC 2, CIS Controls v8, NIST CSF, MITRE ATT&CK |
| 📄 **Report Engine** | Executive & Technical reports with Markdown rendering + public share links |
| ⚡ **AI Remediation** | One-click automated patch simulation with live execution console |
| 🗺️ **Asset Topology** | SVG graph of asset relationships per project |
| 📊 **Live Dashboard** | Sparkline KPIs, area trend charts, SLA watch with breach notifications |
| ⏱️ **Scan Scheduler** | Recurring scan automation with cadence control |
| 🔔 **Notifications** | Real-time SLA breach & warning alerts |
| 🌐 **Public Reports** | Share reports via unique public URLs |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project

### 1. Clone & Install

```bash
git clone https://github.com/your-username/sentinel-ai-app.git
cd sentinel-ai-app
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Set Up Database

Run the SQL migrations in your Supabase SQL editor. The schema requires these tables:

```
profiles · projects · scans · vulnerabilities
reports · ai_conversations · ai_messages
scan_schedules · notifications
```

> See `supabase/schema.sql` for full DDL (coming soon).

### 4. Start Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Quality Gate

Before creating a PR, run the full local quality gate:

```bash
npm run quality:check
```

Command matrix:

| Command | What it validates |
|---|---|
| `npm run lint -- --max-warnings=0` | ESLint rules with zero warnings policy |
| `npm run typecheck` | TypeScript static typing (`tsc --noEmit`) |
| `npm run test:run` | Unit and integration tests (Vitest) |
| `npm run build` | Production build health (Vite) |

### Test Stability Commands

For long or repeated Vitest runs (especially on Windows), use the heap-safe commands below to reduce worker OOM risk:

| Command | Purpose |
|---|---|
| `npm run test:dashboard:stable` | Runs only Dashboard suite with increased Node heap |
| `npm run test:trio:stable` | Runs the critical trio: Dashboard, Projects, Reports with increased Node heap |
| `npm run test:full:stability:heap` | Runs full stability suite with increased Node heap |
| `npm run test:safe:dashboard` | Runs Dashboard via PowerShell helper (safe wrapper) |
| `npm run test:safe:trio` | Runs trio via PowerShell helper (safe wrapper) |
| `npm run test:safe:full` | Runs full suite via PowerShell helper (safe wrapper) |

CI also runs `test:trio:stable` as a dedicated stability job.

Do not use raw `npx vitest run ...` for Dashboard/Trio suites in this repository.
Use `test:safe:*` commands to avoid worker OOM on Windows.

If `quality:check` passes locally, the branch is ready for CI review.

---

## 🏗️ Architecture

```
sentinel-ai-app/
├── src/
│   ├── pages/
│   │   ├── Dashboard.tsx       # KPI sparklines, trend charts, SLA watch
│   │   ├── Projects.tsx        # Project management
│   │   ├── ProjectDetail.tsx   # Scans, findings, reports, asset graph
│   │   ├── Scans.tsx           # All scans across projects
│   │   ├── Reports.tsx         # Report library
│   │   ├── Compliance.tsx      # SOC2 / CIS / NIST / MITRE dashboard
│   │   ├── Scheduler.tsx       # Automated scan scheduling
│   │   ├── Chat.tsx            # AI assistant interface
│   │   └── Settings.tsx        # Profile, SLA config, plan
│   │
│   ├── components/
│   │   ├── ReportViewer.tsx    # Markdown viewer with share/download
│   │   ├── ExecutionConsole.tsx # AI remediation terminal simulation
│   │   ├── AssetGraph.tsx      # SVG asset topology visualization
│   │   ├── Sparkline.tsx       # Pure SVG sparkline component
│   │   ├── FindingsTab.tsx     # Vulnerability triage interface
│   │   └── NotificationBell.tsx # Real-time notification center
│   │
│   ├── lib/
│   │   ├── agentTools.ts       # AI agent intent → tool dispatch
│   │   ├── compliance.ts       # SOC2/CIS/NIST/MITRE mapping engine
│   │   ├── reportBuilder.ts    # Markdown report generation
│   │   ├── scanMock.ts         # Realistic vulnerability simulation
│   │   ├── scheduler.ts        # Recurring scan dispatch
│   │   ├── exporters.ts        # SARIF, JSON, file download
│   │   └── supabase.ts         # Client + TypeScript types
│   │
│   └── context/
│       └── AuthContext.tsx     # Auth state + profile
```

---

## 🤖 AI Agent Commands

The AI Chat understands natural language. Try these:

```
"Run a scan on my first project"
"List my open findings"
"Check compliance status"
"SLA status — what is overdue?"
"Generate an executive summary"
"Resolve the S3 public access finding"
"Summarize my security posture"
```

Supports English and Ukrainian 🇺🇦.

---

## 🛡️ Compliance Frameworks

Sentinel AI automatically maps your vulnerability findings to:

- **SOC 2 Trust Services Criteria** (CC1–CC7) — readiness gauge + per-criterion scores
- **CIS Controls v8** (18 controls) — coverage table with open/critical counts
- **NIST Cybersecurity Framework** — Identify · Protect · Detect · Respond · Recover
- **MITRE ATT&CK** (12 tactics) — heatmap of active threat tactics

---

## 📄 Report Types

| Type | Audience | Contents |
|---|---|---|
| **Executive Summary** | CISO, Board | Risk posture, top findings, business impact, strategic remediation |
| **Technical Deep Dive** | Engineers | Full vulnerability list, CVEs, remediation code, MITRE mapping |

Reports can be:
- Viewed with full Markdown rendering
- Downloaded as `.md` files
- Shared via public URL (`/?share=<token>`)

---

## 🔧 Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite 5 |
| Styling | Tailwind CSS 3 + `@tailwindcss/typography` |
| Backend | Supabase (PostgreSQL, Auth, Realtime) |
| Markdown | `marked` |
| Icons | Lucide React |
| Routing | React Router v6 |

---

## 📝 License

MIT © 2025 Sentinel AI

---

<div align="center">
  <sub>Built with ⚡ and 🛡️ — securing infrastructure, one scan at a time.</sub>
</div>

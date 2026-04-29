import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { PresenceProvider } from './context/PresenceContext';
import { useAuth } from './context/useAuth';
import AppLayout from './components/AppLayout';
import { Shield } from 'lucide-react';
import { ToastProvider } from './lib/toastContext';
import ToastContainer from './components/ToastContainer';

const Landing = lazy(() => import('./pages/Landing'));
const Auth = lazy(() => import('./pages/Auth'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Chat = lazy(() => import('./pages/Chat'));
const Projects = lazy(() => import('./pages/Projects'));
const Scans = lazy(() => import('./pages/Scans'));
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/Settings'));
const PublicReport = lazy(() => import('./pages/PublicReport'));
const Compliance = lazy(() => import('./pages/Compliance'));
const Scheduler = lazy(() => import('./pages/Scheduler'));
const NotFound = lazy(() => import('./pages/NotFound'));
const AttackSurfaceMap = lazy(() => import('./pages/AttackSurfaceMap'));
const DarkWebMonitor = lazy(() => import('./pages/DarkWebMonitor'));
const PassiveRecon = lazy(() => import('./pages/PassiveRecon'));
const SupplyChain = lazy(() => import('./pages/SupplyChain'));
const KillChain = lazy(() => import('./pages/KillChain'));
const Integrations = lazy(() => import('./pages/Integrations'));
const ApiDocs = lazy(() => import('./pages/ApiDocs'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Vulnerabilities = lazy(() => import('./pages/Vulnerabilities'));
const Activity = lazy(() => import('./pages/Activity'));

function RouteFallback() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
      <div className="flex items-center gap-3 text-slate-400">
        <Shield className="w-5 h-5 text-emerald-400 animate-pulse" />
        Loading route...
      </div>
    </div>
  );
}

function useShareToken(): string | null {
  return new URLSearchParams(window.location.search).get('share');
}

function Shell() {
  const { user, loading } = useAuth();
  const shareToken = useShareToken();


  if (shareToken) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <PublicReport token={shareToken} />
      </Suspense>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <Shield className="w-5 h-5 text-emerald-400 animate-pulse" />
          Loading...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/landing" element={<Landing />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="*" element={<Navigate to="/landing" replace />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="chat" element={<Chat />} />
          <Route path="projects" element={<Projects />} />
          <Route path="scans" element={<Scans />} />
          <Route path="reports" element={<Reports />} />
          <Route path="compliance" element={<Compliance />} />
          <Route path="scheduler" element={<Scheduler />} />
          <Route path="attack-map" element={<AttackSurfaceMap />} />
          <Route path="dark-web" element={<DarkWebMonitor />} />
          <Route path="recon" element={<PassiveRecon />} />
          <Route path="supply-chain" element={<SupplyChain />} />
          <Route path="kill-chain" element={<KillChain />} />
          <Route path="integrations" element={<Integrations />} />
          <Route path="api" element={<ApiDocs />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="vulnerabilities" element={<Vulnerabilities />} />
          <Route path="activity" element={<Activity />} />
          <Route path="settings" element={<Settings />} />
          <Route path="auth" element={<Navigate to="/landing" replace />} />
          <Route path="landing" element={<Landing />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <PresenceProvider>
        <BrowserRouter>
          <ToastProvider>
            <Shell />
            <ToastContainer />
          </ToastProvider>
        </BrowserRouter>
      </PresenceProvider>
    </AuthProvider>
  );
}


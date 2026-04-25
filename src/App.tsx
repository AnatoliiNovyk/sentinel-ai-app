import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import AppLayout from './components/AppLayout';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import Projects from './pages/Projects';
import Scans from './pages/Scans';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import PublicReport from './pages/PublicReport';
import Compliance from './pages/Compliance';
import Scheduler from './pages/Scheduler';
import NotFound from './pages/NotFound';
import AttackSurfaceMap from './pages/AttackSurfaceMap';
import DarkWebMonitor from './pages/DarkWebMonitor';
import PassiveRecon from './pages/PassiveRecon';
import SupplyChain from './pages/SupplyChain';
import KillChain from './pages/KillChain';
import Integrations from './pages/Integrations';
import ApiDocs from './pages/ApiDocs';
import { Shield } from 'lucide-react';
import { ToastProvider } from './lib/toastContext';
import ToastContainer from './components/ToastContainer';

function useShareToken(): string | null {
  return new URLSearchParams(window.location.search).get('share');
}

function Shell() {
  const { user, loading } = useAuth();
  const shareToken = useShareToken();


  if (shareToken) {
    return <PublicReport token={shareToken} />;
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
      <Routes>
        <Route path="/landing" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="*" element={<Navigate to="/landing" replace />} />
      </Routes>
    );
  }

  return (
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
        <Route path="settings" element={<Settings />} />
        <Route path="auth" element={<Navigate to="/landing" replace />} />
        <Route path="landing" element={<Landing />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ToastProvider>
          <Shell />
          <ToastContainer />
        </ToastProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}


import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { dispatchDueSchedules } from './lib/scanDispatch';
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
import { Shield } from 'lucide-react';

function useShareToken(): string | null {
  return new URLSearchParams(window.location.search).get('share');
}

function Shell() {
  const { user, loading } = useAuth();
  const shareToken = useShareToken();
  const location = useLocation();

  useEffect(() => {
    if (!user) return;
    dispatchDueSchedules(user.id).catch(() => {});
    const interval = setInterval(() => {
      dispatchDueSchedules(user.id).catch(() => {});
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user?.id]);

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
        <Route path="/landing" element={<Landing onNavigate={() => {}} />} />
        <Route path="/auth" element={<Auth mode="signin" onBack={() => {}} onSwitch={() => {}} />} />
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
        <Route path="settings" element={<Settings />} />
        <Route path="auth" element={<Navigate to="/" replace />} />
        <Route path="landing" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </AuthProvider>
  );
}


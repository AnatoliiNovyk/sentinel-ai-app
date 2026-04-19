import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { dispatchDueSchedules } from './lib/scheduler';
import AppLayout, { AppPage } from './components/AppLayout';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import Projects from './pages/Projects';
import Scans from './pages/Scans';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import PublicReport from './pages/PublicReport';
import { Shield } from 'lucide-react';

function useShareToken(): string | null {
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('share');
  });
  useEffect(() => {
    const onPop = () => {
      setToken(new URLSearchParams(window.location.search).get('share'));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  return token;
}

function Shell() {
  const { user, loading } = useAuth();
  const [publicPage, setPublicPage] = useState<'landing' | 'signin' | 'signup'>('landing');
  const [page, setPage] = useState<AppPage>('dashboard');
  const shareToken = useShareToken();

  if (shareToken) {
    return <PublicReport token={shareToken} />;
  }

  useEffect(() => {
    if (!user) return;
    dispatchDueSchedules(user.id).catch(() => {});
    const interval = setInterval(() => {
      dispatchDueSchedules(user.id).catch(() => {});
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user?.id]);

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
    if (publicPage === 'landing') {
      return <Landing onNavigate={(p) => setPublicPage(p)} />;
    }
    return (
      <Auth
        mode={publicPage}
        onBack={() => setPublicPage('landing')}
        onSwitch={() => setPublicPage(publicPage === 'signin' ? 'signup' : 'signin')}
      />
    );
  }

  return (
    <AppLayout current={page} onNavigate={setPage}>
      {page === 'dashboard' && <Dashboard onNavigate={setPage} />}
      {page === 'chat' && <Chat />}
      {page === 'projects' && <Projects />}
      {page === 'scans' && <Scans />}
      {page === 'reports' && <Reports />}
      {page === 'settings' && <Settings />}
    </AppLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}

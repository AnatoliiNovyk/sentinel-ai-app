import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
function useShareToken() {
    return new URLSearchParams(window.location.search).get('share');
}
function Shell() {
    const { user, loading } = useAuth();
    const shareToken = useShareToken();
    if (shareToken) {
        return _jsx(PublicReport, { token: shareToken });
    }
    if (loading) {
        return (_jsx("div", { className: "min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center", children: _jsxs("div", { className: "flex items-center gap-3 text-slate-400", children: [_jsx(Shield, { className: "w-5 h-5 text-emerald-400 animate-pulse" }), "Loading..."] }) }));
    }
    if (!user) {
        return (_jsxs(Routes, { children: [_jsx(Route, { path: "/landing", element: _jsx(Landing, {}) }), _jsx(Route, { path: "/auth", element: _jsx(Auth, {}) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/landing", replace: true }) })] }));
    }
    return (_jsx(Routes, { children: _jsxs(Route, { path: "/", element: _jsx(AppLayout, {}), children: [_jsx(Route, { index: true, element: _jsx(Dashboard, {}) }), _jsx(Route, { path: "chat", element: _jsx(Chat, {}) }), _jsx(Route, { path: "projects", element: _jsx(Projects, {}) }), _jsx(Route, { path: "scans", element: _jsx(Scans, {}) }), _jsx(Route, { path: "reports", element: _jsx(Reports, {}) }), _jsx(Route, { path: "compliance", element: _jsx(Compliance, {}) }), _jsx(Route, { path: "scheduler", element: _jsx(Scheduler, {}) }), _jsx(Route, { path: "attack-map", element: _jsx(AttackSurfaceMap, {}) }), _jsx(Route, { path: "dark-web", element: _jsx(DarkWebMonitor, {}) }), _jsx(Route, { path: "recon", element: _jsx(PassiveRecon, {}) }), _jsx(Route, { path: "supply-chain", element: _jsx(SupplyChain, {}) }), _jsx(Route, { path: "kill-chain", element: _jsx(KillChain, {}) }), _jsx(Route, { path: "integrations", element: _jsx(Integrations, {}) }), _jsx(Route, { path: "api", element: _jsx(ApiDocs, {}) }), _jsx(Route, { path: "settings", element: _jsx(Settings, {}) }), _jsx(Route, { path: "auth", element: _jsx(Navigate, { to: "/landing", replace: true }) }), _jsx(Route, { path: "landing", element: _jsx(Landing, {}) }), _jsx(Route, { path: "*", element: _jsx(NotFound, {}) })] }) }));
}
export default function App() {
    return (_jsx(AuthProvider, { children: _jsx(BrowserRouter, { children: _jsx(Shell, {}) }) }));
}

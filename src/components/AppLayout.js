import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Shield, LayoutDashboard, MessageSquare, Radar, FileText, Settings, LogOut, FolderKanban, ShieldCheck, CalendarClock, Network, Eye, Search, Terminal, Code, Box, Crosshair } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import NotificationBell from './NotificationBell';
const PAGE_TITLES = {
    '/': 'Dashboard',
    '/chat': 'AI Assistant',
    '/projects': 'Projects',
    '/scans': 'Scans',
    '/reports': 'Reports',
    '/compliance': 'Compliance',
    '/scheduler': 'Scan Scheduler',
    '/attack-map': 'Attack Surface Map',
    '/recon': 'Active Recon (Nmap)',
    '/dark-web': 'OSINT Analyzer',
    '/supply-chain': 'Supply Chain Analysis',
    '/kill-chain': 'AI Red Team',
    '/integrations': 'CI/CD Integrations',
    '/api': 'REST API & CLI',
    '/settings': 'Settings',
};
const nav = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { id: 'chat', label: 'AI Assistant', icon: MessageSquare, path: '/chat' },
    { id: 'projects', label: 'Projects', icon: FolderKanban, path: '/projects' },
    { id: 'scans', label: 'Scans', icon: Radar, path: '/scans' },
    { id: 'reports', label: 'Reports', icon: FileText, path: '/reports' },
    { id: 'compliance', label: 'Compliance', icon: ShieldCheck, path: '/compliance' },
    { id: 'scheduler', label: 'Scheduler', icon: CalendarClock, path: '/scheduler' },
    { id: 'attack-map', label: 'Attack Map', icon: Network, path: '/attack-map' },
    { id: 'dark-web', label: 'OSINT Analyzer', icon: Eye, path: '/dark-web' },
    { id: 'recon', label: 'Active Recon', icon: Search, path: '/recon' },
    { id: 'supply-chain', label: 'Supply Chain', icon: Box, path: '/supply-chain' },
    { id: 'kill-chain', label: 'AI Red Team', icon: Crosshair, path: '/kill-chain' },
    { id: 'integrations', label: 'Integrations', icon: Terminal, path: '/integrations' },
    { id: 'api', label: 'API & CLI', icon: Code, path: '/api' },
    { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
];
export default function AppLayout() {
    const location = useLocation();
    const { profile, signOut } = useAuth();
    const initials = (profile?.full_name || profile?.email || 'U')
        .split(' ')
        .map((s) => s[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
    return (_jsxs("div", { className: "min-h-screen bg-slate-950 text-slate-100 flex", children: [_jsxs("aside", { className: "w-64 shrink-0 border-r border-slate-800 bg-slate-950 flex flex-col", children: [_jsxs("div", { className: "h-16 flex items-center gap-2 px-5 border-b border-slate-800", children: [_jsx("div", { className: "w-8 h-8 rounded-md bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center", children: _jsx(Shield, { className: "w-5 h-5 text-slate-950", strokeWidth: 2.5 }) }), _jsx("span", { className: "text-sm font-semibold", children: "Sentinel AI" })] }), _jsx("nav", { className: "flex-1 p-3 space-y-1", children: nav.map(({ id, label, icon: Icon, path }) => {
                            return (_jsxs(NavLink, { to: path, className: ({ isActive }) => `w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition ${isActive
                                    ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'}`, children: [_jsx(Icon, { className: "w-4 h-4" }), label] }, id));
                        }) }), _jsx("div", { className: "border-t border-slate-800 p-3", children: _jsxs("div", { className: "flex items-center gap-3 px-2 py-2", children: [_jsx("div", { className: "w-8 h-8 rounded-full bg-slate-800 text-xs font-semibold flex items-center justify-center text-emerald-300", children: initials }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "text-sm text-white truncate", children: profile?.full_name || 'User' }), _jsx("div", { className: "text-xs text-slate-500 truncate", children: profile?.email })] }), _jsx("button", { onClick: signOut, className: "p-1.5 text-slate-500 hover:text-white hover:bg-slate-900 rounded transition", title: "Sign out", children: _jsx(LogOut, { className: "w-4 h-4" }) })] }) })] }), _jsxs("main", { className: "flex-1 overflow-auto flex flex-col", children: [_jsxs("header", { className: "sticky top-0 z-30 h-16 border-b border-slate-800 bg-slate-950/85 backdrop-blur flex items-center justify-between px-8", children: [_jsx("div", { className: "text-sm font-medium text-slate-300", children: PAGE_TITLES[location.pathname] || 'Sentinel AI' }), _jsx("div", { className: "flex items-center gap-2", children: _jsx(NotificationBell, {}) })] }), _jsx("div", { className: "flex-1", children: _jsx(Outlet, {}) })] })] }));
}

import type { Page } from '../types';

interface SidebarProps {
  activePage: Page;
  onNavigate: (p: Page) => void;
  sessionCount: number;
}

const NAV_ITEMS: { id: Page; label: string; icon: string }[] = [
  { id: 'browsers',   label: 'MultiView Grid', icon: '🖥️' },
  { id: 'dashboard',  label: 'Overview',       icon: '⊞' },
  { id: 'workflows',  label: 'Workflows',      icon: '⚡' },
  { id: 'scheduler',  label: 'Scheduler',      icon: '🕐' },
  { id: 'profiles',   label: 'Profiles',       icon: '👤' },
  { id: 'logs',       label: 'Logs',           icon: '📋' },
  { id: 'settings',   label: 'Settings',       icon: '⚙️' },
];

export function Sidebar({ activePage, onNavigate, sessionCount }: SidebarProps) {
  return (
    <aside className="w-56 shrink-0 bg-slate-950 border-r border-slate-800 flex flex-col select-none">
      {/* Brand Header with Logo */}
      <div className="px-4 py-4 border-b border-slate-800/80 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 via-indigo-500 to-purple-500 p-0.5 shadow-md shadow-sky-500/10 flex items-center justify-center shrink-0">
          <img src="/logo.svg" alt="MultiView Logo" className="w-full h-full rounded-[10px]" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-extrabold tracking-wide text-white flex items-center gap-1.5">
            MultiView
            <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded">Agent</span>
          </span>
          <span className="text-[10px] text-slate-400 font-medium tracking-tight truncate">Multi-Browser Platform</span>
        </div>
      </div>

      {/* Navigation list */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ id, label, icon }) => {
          const isActive = activePage === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-150 text-left
                ${isActive
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
            >
              <span className="text-sm">{icon}</span>
              <span className="truncate">{label}</span>
              {id === 'browsers' && sessionCount > 0 && (
                <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isActive ? 'bg-white text-blue-700' : 'bg-blue-600/30 text-blue-400 border border-blue-500/30'
                }`}>
                  {sessionCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* System Status Footer */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/60">
        <div className="bg-slate-900/90 rounded-lg p-2.5 border border-slate-800 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-300 font-medium">Control Engine</span>
          </div>
          <span className="text-slate-500 text-[10px] font-mono">v1.0</span>
        </div>
      </div>
    </aside>
  );
}

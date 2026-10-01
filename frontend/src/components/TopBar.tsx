import { useState } from 'react';
import type { GridLayout } from '../types';

interface TopBarProps {
  layout: GridLayout;
  sessionCount: number;
  backendOnline: boolean;
  wsConnected: boolean;
  isSpawning: boolean;
  onSelectTabCount: (n: GridLayout) => void;
  onAddBrowser: () => void;
  onCloseAll: () => void;
  onNavigateAll: (url: string) => void;
  onReloadAll: () => void;
  onStopAll: () => void;
}

const TAB_PRESETS: GridLayout[] = [10, 20, 30, 40, 50];

export function TopBar({
  layout, sessionCount, backendOnline, wsConnected, isSpawning,
  onSelectTabCount, onAddBrowser, onCloseAll,
  onNavigateAll, onReloadAll, onStopAll,
}: TopBarProps) {
  const [globalUrl, setGlobalUrl] = useState('');

  const handleGlobalNavigate = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = globalUrl.trim();
    if (trimmed) {
      onNavigateAll(trimmed);
    }
  };

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center px-4 gap-3 shrink-0 select-none">
      
      {/* ── UNIFIED TABS SELECTOR (10, 20, 30, 40, 50) ── */}
      <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 p-1 rounded-xl shadow-inner">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 flex items-center gap-1.5">
          {isSpawning && (
            <span className="w-2.5 h-2.5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
          )}
          Tabs:
        </span>
        <div className="flex items-center gap-1">
          {TAB_PRESETS.map((n) => {
            const isActive = layout === n;
            return (
              <button
                key={n}
                onClick={() => onSelectTabCount(n)}
                disabled={isSpawning}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all duration-150 flex items-center gap-1 ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 ring-1 ring-blue-400/40 scale-[1.02]'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-50'
                }`}
                title={`Launch & switch to ${n} parallel browser views`}
              >
                {n}
              </button>
            );
          })}
        </div>

        <div className="w-px h-4 bg-slate-800 mx-0.5" />

        {/* Quick +1 Add Button */}
        <button
          onClick={onAddBrowser}
          disabled={isSpawning}
          className="px-2.5 py-1 text-xs font-bold text-sky-400 bg-sky-950/40 hover:bg-sky-900/60 disabled:opacity-50 border border-sky-800/50 rounded-lg transition-colors flex items-center gap-1"
          title="Add 1 additional browser session"
        >
          <span>+1</span>
        </button>

        {/* Close All */}
        <button
          onClick={onCloseAll}
          disabled={sessionCount === 0 || isSpawning}
          className="px-2.5 py-1 text-xs font-bold text-red-400 bg-red-950/30 hover:bg-red-900/50 disabled:opacity-30 disabled:pointer-events-none border border-red-900/40 rounded-lg transition-colors"
          title="Close all browser tabs"
        >
          Reset
        </button>
      </div>

      {/* ── COMMON URL INPUT BOX ── */}
      <form onSubmit={handleGlobalNavigate} className="flex items-center gap-2 flex-1 max-w-2xl ml-1">
        <div className="relative flex-1">
          <input
            type="text"
            value={globalUrl}
            onChange={(e) => setGlobalUrl(e.target.value)}
            placeholder="Paste Common URL here to open in ALL tabs simultaneously..."
            className="w-full bg-slate-950 text-xs text-slate-100 placeholder-slate-500 pl-3.5 pr-8 py-2 rounded-xl border border-slate-700/80 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all shadow-inner"
          />
          {globalUrl && (
            <button
              type="button"
              onClick={() => setGlobalUrl('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs p-0.5"
              title="Clear"
            >
              ✕
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={!globalUrl.trim() || sessionCount === 0}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shrink-0 shadow-md shadow-blue-600/20 active:scale-95"
          title="Open this URL across all active browser views"
        >
          🌐 Open in All
        </button>
      </form>

      {/* Quick Global Actions */}
      <div className="flex items-center gap-1.5 ml-auto">
        <button
          onClick={onReloadAll}
          disabled={sessionCount === 0}
          className="bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 border border-slate-700 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors"
          title="Reload all browser tabs"
        >
          ↻
        </button>
        <button
          onClick={onStopAll}
          disabled={sessionCount === 0}
          className="bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 border border-slate-700 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors"
          title="Stop loading on all tabs"
        >
          ⏹
        </button>
      </div>

      {/* ── STATUS & VIEWS COUNTER BADGES ── */}
      <div className="flex items-center gap-2.5 text-xs pl-2 border-l border-slate-800">
        <div className="flex items-center gap-1.5 bg-gradient-to-r from-blue-950 to-indigo-950 border border-blue-700/60 px-3 py-1.5 rounded-xl shadow-sm">
          <span className="text-blue-400 font-bold text-[11px] uppercase tracking-wide">Total Views:</span>
          <span className="text-white font-extrabold text-sm font-mono">{sessionCount}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-950 rounded-lg border border-slate-800/80">
          <span className={`w-2 h-2 rounded-full ${backendOnline ? 'bg-emerald-400' : 'bg-rose-500'}`} />
          <span className="text-slate-400 text-[11px]">{backendOnline ? 'API' : 'Offline'}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-950 rounded-lg border border-slate-800/80">
          <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-400' : 'bg-amber-500'}`} />
          <span className="text-slate-400 text-[11px]">WS</span>
        </div>
      </div>

    </header>
  );
}

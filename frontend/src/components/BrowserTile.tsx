import { useState, useRef } from 'react';
import type { BrowserSession } from '../types';

interface BrowserTileProps {
  session: BrowserSession;
  isSelected: boolean;
  compact: boolean;
  onSelect: () => void;
  onClose: () => void;
  onNavigate: (id: string, url: string) => void;
  onReload: (id: string) => void;
  onBack: (id: string) => void;
  onForward: (id: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  RUNNING:    'bg-emerald-500 text-black',
  IDLE:       'bg-sky-500 text-black',
  AUTOMATING: 'bg-amber-400 text-black',
  STARTING:   'bg-slate-400 text-black',
  STOPPING:   'bg-orange-400 text-black',
  STOPPED:    'bg-slate-600 text-white',
  ERROR:      'bg-rose-500 text-white',
  CRASHED:    'bg-rose-700 text-white',
};

export function BrowserTile({
  session, isSelected, compact,
  onSelect, onClose, onNavigate, onReload, onBack, onForward,
}: BrowserTileProps) {
  const [urlInput, setUrlInput] = useState(session.current_url === 'about:blank' ? '' : session.current_url);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleNavigate = (e: React.FormEvent) => {
    e.preventDefault();
    const val = urlInput.trim();
    if (val) onNavigate(session.session_id, val);
  };

  const statusStyle = STATUS_COLORS[session.status] ?? 'bg-slate-500 text-white';
  const isPending = session.status === 'STARTING' || session.status === 'AUTOMATING';

  return (
    <div
      onClick={onSelect}
      className={`flex flex-col rounded-xl border transition-all duration-150 overflow-hidden cursor-pointer shadow-md bg-slate-900 ${
        isSelected
          ? 'border-sky-500 ring-2 ring-sky-500/30 shadow-sky-500/10'
          : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-950/90 border-b border-slate-800/80 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${isPending ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`} />
          <span className="text-[11px] font-bold font-mono text-slate-200 shrink-0">{session.session_id}</span>
          {!compact && (
            <span className="text-[11px] text-slate-400 truncate max-w-[140px]" title={session.title}>
              {session.title || 'Blank Page'}
            </span>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="text-slate-500 hover:text-rose-400 ml-2 shrink-0 transition-colors text-xs p-0.5"
          title="Close tab"
        >✕</button>
      </div>

      {/* ── Address bar ── */}
      <form
        onSubmit={handleNavigate}
        onClick={(e) => e.stopPropagation()}
        className="flex items-center gap-1 px-2 py-1 bg-slate-950/60 border-b border-slate-800 shrink-0"
      >
        <button type="button" onClick={() => onBack(session.session_id)}
          className="text-slate-400 hover:text-white px-1 text-xs transition-colors" title="Back">◀</button>
        <button type="button" onClick={() => onForward(session.session_id)}
          className="text-slate-400 hover:text-white px-1 text-xs transition-colors" title="Forward">▶</button>
        <button type="button" onClick={() => onReload(session.session_id)}
          className="text-slate-400 hover:text-white px-1 text-xs transition-colors" title="Reload">↻</button>
        <input
          ref={inputRef}
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onFocus={(e) => e.target.select()}
          placeholder="Enter URL…"
          className="flex-1 bg-slate-900 text-[11px] text-slate-200 px-2 py-0.5 rounded border border-slate-700/60 focus:border-sky-500 outline-none min-w-0 font-mono"
        />
        <button type="submit"
          className="bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-bold px-2 py-0.5 rounded transition-colors shrink-0">GO</button>
      </form>

      {/* ── Live Screencast View ── */}
      <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center min-h-[140px]">
        <img
          id={`screencast-${session.session_id}`}
          alt=""
          className="w-full h-full object-contain"
        />

        {/* Loading Overlay */}
        {isPending && (
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[1px] flex flex-col items-center justify-center gap-2 pointer-events-none">
            <span className="w-5 h-5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-[10px] text-sky-300 font-mono">
              {session.status === 'STARTING' ? 'Starting browser...' : 'Navigating...'}
            </span>
          </div>
        )}

        {/* Live Indicator Badge */}
        <div className="absolute top-1.5 right-1.5 bg-rose-600/90 text-white text-[9px] font-bold font-mono px-1.5 py-0.5 rounded shadow">
          LIVE
        </div>
      </div>

      {/* ── Status bar ── */}
      <div className="flex items-center justify-between px-2.5 py-1 bg-slate-950/90 border-t border-slate-800 shrink-0 text-[10px]">
        <span className={`font-bold px-1.5 py-0.2 rounded uppercase ${statusStyle}`}>
          {session.status}
        </span>
        <span className="text-slate-500 font-mono truncate max-w-[65%] text-right" title={session.current_url}>
          {session.current_url === 'about:blank' ? 'Ready' : session.current_url}
        </span>
      </div>
    </div>
  );
}

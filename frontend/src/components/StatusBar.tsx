import type { BrowserSession } from '../types';

interface StatusBarProps {
  sessions: BrowserSession[];
  backendOnline: boolean;
}

export function StatusBar({ sessions, backendOnline }: StatusBarProps) {
  const running = sessions.filter(s => s.status === 'RUNNING' || s.status === 'AUTOMATING').length;
  const errors  = sessions.filter(s => s.status === 'ERROR' || s.status === 'CRASHED').length;

  return (
    <footer className="h-7 bg-gray-950 border-t border-gray-800 flex items-center px-4 gap-6 shrink-0 text-[11px]">
      <span className={`font-semibold ${backendOnline ? 'text-green-400' : 'text-red-400'}`}>
        {backendOnline ? '● ONLINE' : '● OFFLINE'}
      </span>
      <span className="text-gray-400">Total Views / Tabs: <span className="text-blue-400 font-bold font-mono">{sessions.length}</span></span>
      <span className="text-gray-500">Active / Running: <span className="text-green-400 font-medium font-mono">{running}</span></span>
      {errors > 0 && (
        <span className="text-gray-500">Errors: <span className="text-red-400 font-mono">{errors}</span></span>
      )}
      <div className="flex-1" />
      <span className="text-gray-700">MultiView Agent v0.1</span>
    </footer>
  );
}

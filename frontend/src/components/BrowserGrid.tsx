import type { GridLayout, BrowserSession } from '../types';
import { BrowserTile } from './BrowserTile';

interface BrowserGridProps {
  sessions: BrowserSession[];
  layout: GridLayout;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNavigate: (id: string, url: string) => void;
  onReload: (id: string) => void;
  onBack: (id: string) => void;
  onForward: (id: string) => void;
}

// Responsive Grid classes per layout
const GRID_CLASSES: Record<GridLayout, string> = {
  1: 'grid-cols-1 max-w-4xl mx-auto',
  5: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
  10: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-5',
  20: 'grid-cols-2 sm:grid-cols-4 md:grid-cols-5',
  30: 'grid-cols-3 sm:grid-cols-5 md:grid-cols-6',
  40: 'grid-cols-3 sm:grid-cols-5 md:grid-cols-8',
  50: 'grid-cols-3 sm:grid-cols-5 md:grid-cols-8 xl:grid-cols-10',
};

export function BrowserGrid({
  sessions, layout, selectedId,
  onSelect, onClose, onNavigate, onReload, onBack, onForward,
}: BrowserGridProps) {
  const visible = sessions.slice(0, layout);
  const gridClass = GRID_CLASSES[layout] || 'grid-cols-2';
  const compact = layout >= 5;

  if (sessions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-500 select-none py-16">
        <div className="w-20 h-20 mb-4 bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-2xl flex items-center justify-center shadow-lg">
          <img src="/logo.svg" alt="MultiView Agent" className="w-12 h-12" />
        </div>
        <h2 className="text-xl font-bold text-gray-200">No Active Browser Views</h2>
        <p className="text-sm mt-1 text-gray-400">
          Click <span className="text-blue-400 font-semibold font-mono">[+5]</span>, <span className="text-blue-400 font-semibold font-mono">[+10]</span>, or <span className="text-blue-400 font-semibold font-mono">[+ Add Browser]</span> above to launch parallel views.
        </p>
      </div>
    );
  }

  return (
    <div className={`grid ${gridClass} gap-2.5 flex-1 auto-rows-fr`}>
      {visible.map(session => (
        <BrowserTile
          key={session.session_id}
          session={session}
          isSelected={selectedId === session.session_id}
          compact={compact}
          onSelect={() => onSelect(session.session_id)}
          onClose={() => onClose(session.session_id)}
          onNavigate={onNavigate}
          onReload={onReload}
          onBack={onBack}
          onForward={onForward}
        />
      ))}
    </div>
  );
}

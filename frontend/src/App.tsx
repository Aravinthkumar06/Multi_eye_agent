import { useState } from 'react';
import { Sidebar }     from './components/Sidebar';
import { TopBar }      from './components/TopBar';
import { BrowserGrid } from './components/BrowserGrid';
import { StatusBar }   from './components/StatusBar';
import { useWebSocket } from './hooks/useWebSocket';
import { useBrowserStore } from './store/useBrowserStore';
import type { Page } from './types';
import './index.css';

export default function App() {
  const [activePage, setActivePage] = useState<Page>('browsers');
  const store = useBrowserStore();

  // Connect WebSocket for live screencasts + events
  const wsRef = useWebSocket(store.handleWsMessage, store.handleBinaryFrame);

  // Detect WS open/close via the ref's readyState
  const wsConnected = wsRef.current?.readyState === WebSocket.OPEN;

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100 overflow-hidden">
      {/* ── Sidebar ── */}
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        sessionCount={store.sessions.length}
      />

      {/* ── Main area ── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top toolbar */}
        <TopBar
          layout={store.layout}
          sessionCount={store.sessions.length}
          backendOnline={store.backendOnline}
          wsConnected={wsConnected}
          isSpawning={store.isSpawning}
          onSelectTabCount={store.selectTabCount}
          onAddBrowser={store.addBrowser}
          onCloseAll={store.closeAll}
          onNavigateAll={store.navigateAll}
          onReloadAll={store.reloadAll}
          onStopAll={store.stopAll}
        />

        {/* Page content */}
        <main className="flex-1 overflow-auto p-3">
          {activePage === 'browsers' || activePage === 'dashboard' ? (
            <BrowserGrid
              sessions={store.sessions}
              layout={store.layout}
              selectedId={store.selectedId}
              onSelect={store.setSelectedId}
              onClose={store.closeBrowser}
              onNavigate={store.navigate}
              onReload={store.reload}
              onBack={store.goBack}
              onForward={store.goForward}
            />
          ) : (
            <ComingSoon page={activePage} />
          )}
        </main>

        {/* Status bar */}
        <StatusBar
          sessions={store.sessions}
          backendOnline={store.backendOnline}
        />
      </div>
    </div>
  );
}

function ComingSoon({ page }: { page: Page }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-600 select-none">
      <div className="text-5xl mb-4">🚧</div>
      <p className="text-lg font-semibold capitalize">{page}</p>
      <p className="text-sm mt-1">Coming in a future phase</p>
    </div>
  );
}

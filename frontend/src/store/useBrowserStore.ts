import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';
import type { BrowserSession, GridLayout } from '../types';

export function useBrowserStore() {
  const [sessions, setSessions] = useState<BrowserSession[]>([]);
  const [layout, setLayout] = useState<GridLayout>(10);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [backendOnline, setBackendOnline] = useState(false);
  const [isSpawning, setIsSpawning] = useState(false);
  const isSpawningRef = useRef(false);

  // Poll backend health + sessions every 2 s
  const refresh = useCallback(async () => {
    // Avoid overwriting optimistic state while a batch is actively in-flight
    if (isSpawningRef.current) return;
    try {
      const [health, list] = await Promise.all([api.health(), api.browsers.list()]);
      setBackendOnline(health?.status === 'ONLINE');
      setSessions(list);
    } catch {
      setBackendOnline(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [refresh]);

  // Track object URLs to revoke them after use (prevent memory leaks)
  const objUrlsRef = useRef<Map<string, string>>(new Map());

  // Handle incoming WS binary frame: sessionId + JPEG blob → update <img>
  const handleBinaryFrame = useCallback((sessionId: string, jpegBlob: Blob) => {
    const img = document.getElementById(`screencast-${sessionId}`) as HTMLImageElement | null;
    if (!img) return;

    // Revoke previous object URL for this session
    const prev = objUrlsRef.current.get(sessionId);
    if (prev) URL.revokeObjectURL(prev);

    const url = URL.createObjectURL(jpegBlob);
    objUrlsRef.current.set(sessionId, url);
    img.src = url;
  }, []);

  // Handle JSON text WS messages (events, status updates, etc.)
  const handleWsMessage = useCallback((_payload: Record<string, unknown>) => {
    // Reserved for future JSON event bus messages
  }, []);

  const addBrowser = useCallback(async () => {
    try {
      const s = await api.browsers.create();
      setSessions(prev => [...prev, s]);
      setSelectedId(s.session_id);
      if (layout < 5) setLayout(5);
    } catch (e: unknown) {
      alert(`Failed to add browser: ${(e as Error).message}`);
    }
  }, [layout]);

  const addMultiple = useCallback(async (count: number) => {
    if (isSpawningRef.current) return;
    isSpawningRef.current = true;
    setIsSpawning(true);
    try {
      const newSessions = await api.browsers.createBatch(count);
      setSessions(prev => [...prev, ...newSessions]);
    } catch (e: unknown) {
      console.error(e);
    } finally {
      isSpawningRef.current = false;
      setIsSpawning(false);
      await refresh();
    }
  }, [refresh]);

  const closeBrowser = useCallback(async (id: string) => {
    await api.browsers.close(id);
    setSessions(prev => prev.filter(s => s.session_id !== id));
    if (selectedId === id) setSelectedId(null);
  }, [selectedId]);

  const closeAll = useCallback(async () => {
    setSessions([]);
    setSelectedId(null);
    await api.browsers.stopAll().catch(() => {});
    const list = await api.browsers.list().catch(() => []);
    for (const s of list) {
      await api.browsers.close(s.session_id).catch(() => {});
    }
    await refresh();
  }, [refresh]);

  const navigate = useCallback(async (id: string, url: string) => {
    const updated = await api.browsers.navigate(id, url);
    setSessions(prev => prev.map(s => s.session_id === id ? updated : s));
  }, []);

  const reload = useCallback(async (id: string) => {
    await api.browsers.reload(id);
    refresh();
  }, [refresh]);

  const goBack = useCallback(async (id: string) => {
    await api.browsers.back(id);
    refresh();
  }, [refresh]);

  const goForward = useCallback(async (id: string) => {
    await api.browsers.forward(id);
    refresh();
  }, [refresh]);

  const navigateAll = useCallback(async (url: string) => {
    // Optimistically set all current sessions to AUTOMATING so user sees immediate feedback
    setSessions(prev => prev.map(s => ({ ...s, status: 'AUTOMATING' })));
    await api.browsers.navigateAll(url);
    await refresh();
  }, [refresh]);

  const reloadAll = useCallback(async () => {
    await api.browsers.reloadAll();
    refresh();
  }, [refresh]);

  const stopAll = useCallback(async () => {
    await api.browsers.stopAll();
    refresh();
  }, [refresh]);

  const selectTabCount = useCallback(async (targetCount: GridLayout) => {
    if (isSpawningRef.current) return;
    setLayout(targetCount);
    
    const currentCount = sessions.length;
    if (currentCount < targetCount) {
      const toAdd = targetCount - currentCount;
      
      // Optimistically create placeholder sessions immediately so user sees all tiles in 0ms!
      const placeholders: BrowserSession[] = [];
      for (let i = 1; i <= toAdd; i++) {
        const tempId = `browser-loading-${currentCount + i}`;
        placeholders.push({
          session_id: tempId,
          status: 'STARTING',
          current_url: 'about:blank',
          title: 'Initializing session...',
          creation_time: new Date().toISOString(),
          last_activity: new Date().toISOString(),
        });
      }
      setSessions(prev => [...prev, ...placeholders]);
      
      isSpawningRef.current = true;
      setIsSpawning(true);
      try {
        await api.browsers.createBatch(toAdd);
      } catch (e: unknown) {
        console.error("Batch creation failed:", e);
      } finally {
        isSpawningRef.current = false;
        setIsSpawning(false);
        const actualList = await api.browsers.list();
        setSessions(actualList);
      }
    }
  }, [sessions.length, refresh]);

  return {
    sessions, layout, setLayout,
    selectedId, setSelectedId,
    backendOnline, isSpawning,
    handleWsMessage, handleBinaryFrame,
    addBrowser, addMultiple, selectTabCount, closeBrowser, closeAll,
    navigate, reload, goBack, goForward,
    navigateAll, reloadAll, stopAll,
    refresh,
  };
}

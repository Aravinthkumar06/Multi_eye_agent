// API service layer — all backend calls go through here
import type { BrowserSession } from '../types';

const API_BASE = `http://${window.location.hostname}:8000`;
export const WS_URL = `ws://${window.location.hostname}:8000/ws`;

export const api = {
  health: () =>
    fetch(`${API_BASE}/health`).then(r => r.json()),

  browsers: {
    list: (): Promise<BrowserSession[]> =>
      fetch(`${API_BASE}/api/browsers`).then(r => r.json()),

    create: (): Promise<BrowserSession> =>
      fetch(`${API_BASE}/api/browsers`, { method: 'POST' }).then(r => {
        if (!r.ok) throw new Error(`Failed to create browser (${r.status})`);
        return r.json();
      }),

    createBatch: (count: number): Promise<BrowserSession[]> =>
      fetch(`${API_BASE}/api/browsers/batch/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count }),
      }).then(r => {
        if (!r.ok) throw new Error(`Failed to batch create browsers (${r.status})`);
        return r.json();
      }),

    close: (id: string) =>
      fetch(`${API_BASE}/api/browsers/${id}`, { method: 'DELETE' }).then(r => r.json()),

    navigate: (id: string, url: string): Promise<BrowserSession> =>
      fetch(`${API_BASE}/api/browsers/${id}/navigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.startsWith('http') ? url : `https://${url}` }),
      }).then(r => r.json()),

    reload: (id: string) =>
      fetch(`${API_BASE}/api/browsers/${id}/reload`, { method: 'POST' }).then(r => r.json()),

    back: (id: string) =>
      fetch(`${API_BASE}/api/browsers/${id}/back`, { method: 'POST' }).then(r => r.json()),

    forward: (id: string) =>
      fetch(`${API_BASE}/api/browsers/${id}/forward`, { method: 'POST' }).then(r => r.json()),

    stop: (id: string) =>
      fetch(`${API_BASE}/api/browsers/${id}/stop`, { method: 'POST' }).then(r => r.json()),

    navigateAll: (url: string) =>
      fetch(`${API_BASE}/api/browsers/batch/navigate-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.startsWith('http') ? url : `https://${url}` }),
      }).then(r => r.json()),

    reloadAll: () =>
      fetch(`${API_BASE}/api/browsers/batch/reload-all`, { method: 'POST' }).then(r => r.json()),

    stopAll: () =>
      fetch(`${API_BASE}/api/browsers/batch/stop-all`, { method: 'POST' }).then(r => r.json()),
  },
};

// API service layer — all backend calls go through here.
import type { BrowserSession } from '../types';

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, '');

// Render supplies these at build time. The local fallbacks keep `npm run dev`
// working when the frontend is run locally alongside the FastAPI server.
const API_BASE = stripTrailingSlash(
  import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`,
);

export const WS_URL =
  import.meta.env.VITE_WS_URL ||
  `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname}:8000/ws`;

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.json();
      detail = body?.detail ? `: ${body.detail}` : '';
    } catch {
      // Ignore non-JSON error bodies.
    }
    throw new Error(`Request failed (${response.status})${detail}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  health: () => requestJson<{ status: string }>(`${API_BASE}/health`),

  browsers: {
    list: (): Promise<BrowserSession[]> =>
      requestJson<BrowserSession[]>(`${API_BASE}/api/browsers`),

    create: (): Promise<BrowserSession> =>
      requestJson<BrowserSession>(`${API_BASE}/api/browsers`, { method: 'POST' }),

    createBatch: (count: number): Promise<BrowserSession[]> =>
      requestJson<BrowserSession[]>(`${API_BASE}/api/browsers/batch/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count }),
      }),

    close: (id: string) =>
      requestJson<{ status: string }>(`${API_BASE}/api/browsers/${id}`, { method: 'DELETE' }),

    navigate: (id: string, url: string): Promise<BrowserSession> =>
      requestJson<BrowserSession>(`${API_BASE}/api/browsers/${id}/navigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.startsWith('http') ? url : `https://${url}` }),
      }),

    reload: (id: string) =>
      requestJson<BrowserSession>(`${API_BASE}/api/browsers/${id}/reload`, { method: 'POST' }),

    back: (id: string) =>
      requestJson<BrowserSession>(`${API_BASE}/api/browsers/${id}/back`, { method: 'POST' }),

    forward: (id: string) =>
      requestJson<BrowserSession>(`${API_BASE}/api/browsers/${id}/forward`, { method: 'POST' }),

    stop: (id: string) =>
      requestJson<BrowserSession>(`${API_BASE}/api/browsers/${id}/stop`, { method: 'POST' }),

    navigateAll: (url: string) =>
      requestJson<{ status: string; count: number }>(`${API_BASE}/api/browsers/batch/navigate-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.startsWith('http') ? url : `https://${url}` }),
      }),

    reloadAll: () =>
      requestJson<{ status: string; count: number }>(`${API_BASE}/api/browsers/batch/reload-all`, {
        method: 'POST',
      }),

    stopAll: () =>
      requestJson<{ status: string; count: number }>(`${API_BASE}/api/browsers/batch/stop-all`, {
        method: 'POST',
      }),
  },
};

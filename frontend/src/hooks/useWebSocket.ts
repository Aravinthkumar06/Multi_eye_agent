import { useEffect, useRef, useCallback } from 'react';
import { WS_URL } from '../services/api';

type MessageHandler = (payload: Record<string, unknown>) => void;
type BinaryFrameHandler = (sessionId: string, jpegBlob: Blob) => void;

export function useWebSocket(
  onMessage: MessageHandler,
  onBinaryFrame: BinaryFrameHandler,
) {
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  const onBinaryFrameRef = useRef(onBinaryFrame);
  onMessageRef.current = onMessage;
  onBinaryFrameRef.current = onBinaryFrame;

  // Use a ref to hold the connect function so it can self-reference for reconnect
  const connectRef = useRef<() => void>(() => {});

  connectRef.current = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) {
        // Binary frame: [4 bytes: sid_len][sid bytes][jpeg bytes]
        const buf = e.data as ArrayBuffer;
        const view = new DataView(buf);
        const sidLen = view.getUint32(0, false);
        const sidBytes = new Uint8Array(buf, 4, sidLen);
        const sessionId = new TextDecoder().decode(sidBytes);
        const jpegBytes = new Uint8Array(buf, 4 + sidLen);
        const blob = new Blob([jpegBytes], { type: 'image/jpeg' });
        onBinaryFrameRef.current(sessionId, blob);
      } else {
        try {
          const payload = JSON.parse(e.data as string);
          onMessageRef.current(payload);
        } catch { /* ignore */ }
      }
    };

    ws.onclose = () => {
      setTimeout(() => connectRef.current(), 2000);
    };

    ws.onerror = () => ws.close();
  };

  const connect = useCallback(() => {
    connectRef.current();
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  return wsRef;
}

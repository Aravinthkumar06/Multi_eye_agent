from fastapi import WebSocket
from typing import Set
import json
import logging
import asyncio

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        async with self._lock:
            self.active_connections.add(websocket)

    async def disconnect(self, websocket: WebSocket):
        async with self._lock:
            self.active_connections.discard(websocket)

    async def broadcast_binary(self, payload: bytes):
        """Send raw binary data to all connected clients (used for screencast frames)."""
        if not self.active_connections:
            return
        async with self._lock:
            conns = list(self.active_connections)
        dead: Set[WebSocket] = set()
        for ws in conns:
            try:
                await ws.send_bytes(payload)
            except Exception:
                dead.add(ws)
        if dead:
            async with self._lock:
                self.active_connections -= dead

    async def broadcast(self, message: dict):
        """Send a JSON text message to all connected clients (events, status, etc.)."""
        if not self.active_connections:
            return
        payload = json.dumps(message)
        async with self._lock:
            conns = list(self.active_connections)
        dead: Set[WebSocket] = set()
        for ws in conns:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.add(ws)
        if dead:
            async with self._lock:
                self.active_connections -= dead


websocket_manager = ConnectionManager()

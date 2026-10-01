from enum import Enum
from pydantic import BaseModel
from typing import Optional
import datetime
import asyncio
import time
from playwright.async_api import Page, BrowserContext

class SessionStatus(str, Enum):
    STARTING = "STARTING"
    RUNNING = "RUNNING"
    IDLE = "IDLE"
    AUTOMATING = "AUTOMATING"
    STOPPING = "STOPPING"
    STOPPED = "STOPPED"
    ERROR = "ERROR"
    CRASHED = "CRASHED"

class BrowserSessionInfo(BaseModel):
    session_id: str
    status: SessionStatus
    current_url: str
    title: str
    creation_time: str
    last_activity: str

from app.websocket.manager import websocket_manager

# Target FPS per session for the screencast feed
_TARGET_FPS = 10
_FRAME_INTERVAL = 1.0 / _TARGET_FPS


class BrowserSession:
    def __init__(self, session_id: str, context: BrowserContext, page: Page):
        self.session_id = session_id
        self.context = context
        self.page = page
        self.status = SessionStatus.STARTING
        self.creation_time = datetime.datetime.now(datetime.UTC)
        self.last_activity = self.creation_time
        self.current_url = "about:blank"
        self.title = ""
        self.cdp_session = None
        self._last_frame_time: float = 0.0

    async def initialize(self):
        self.status = SessionStatus.RUNNING
        self.page.on("framenavigated", self._on_navigate)
        await self._start_screencast()

    async def _start_screencast(self):
        """Start (or restart) the CDP screencast for this session."""
        try:
            # Stop and detach old CDP session if it exists
            if self.cdp_session:
                try:
                    await self.cdp_session.send("Page.stopScreencast")
                except Exception:
                    pass
                try:
                    await self.cdp_session.detach()
                except Exception:
                    pass
                self.cdp_session = None

            self.cdp_session = await self.context.new_cdp_session(self.page)
            self.cdp_session.on("Page.screencastFrame", self._on_screencast_frame)
            await self.cdp_session.send("Page.startScreencast", {
                "format": "jpeg",
                "quality": 50,        # reduced for speed
                "maxWidth": 640,      # smaller = faster to encode + transmit
                "maxHeight": 360,
                "everyNthFrame": 2    # request every 2nd frame (~15fps source → ~7.5fps)
            })
        except Exception as e:
            print(f"Failed to start CDP screencast for {self.session_id}: {e}")

    async def _on_screencast_frame(self, event):
        """Receive a CDP screencast frame, throttle it, and broadcast via WebSocket."""
        # Throttle: drop frames faster than target FPS
        now = time.monotonic()
        if now - self._last_frame_time < _FRAME_INTERVAL:
            # Still ack so Chrome doesn't stall
            if self.cdp_session:
                try:
                    await self.cdp_session.send("Page.screencastFrameAck", {"sessionId": event["sessionId"]})
                except Exception:
                    pass
            return

        self._last_frame_time = now

        # Ack frame
        if self.cdp_session:
            try:
                await self.cdp_session.send("Page.screencastFrameAck", {"sessionId": event["sessionId"]})
            except Exception:
                pass

        # Broadcast binary frame (session_id + raw JPEG bytes)
        import base64
        try:
            jpeg_bytes = base64.b64decode(event["data"])
            sid_bytes = self.session_id.encode("utf-8")
            sid_len = len(sid_bytes).to_bytes(4, "big")
            payload = sid_len + sid_bytes + jpeg_bytes
            asyncio.create_task(websocket_manager.broadcast_binary(payload))
        except Exception as e:
            print(f"Frame broadcast error for {self.session_id}: {e}")

    async def _on_navigate(self, frame):
        if frame == self.page.main_frame:
            self.current_url = self.page.url
            try:
                self.title = await self.page.title()
            except Exception:
                pass
            self.update_activity()

    def update_activity(self):
        self.last_activity = datetime.datetime.now(datetime.UTC)

    async def navigate(self, url: str):
        self.status = SessionStatus.AUTOMATING
        url = url.strip()
        if not any(url.startswith(p) for p in ("http://", "https://", "about:", "data:", "file:", "chrome:")):
            url = "https://" + url
        try:
            self.current_url = url
            await self.page.goto(url, wait_until="commit", timeout=60000)
            self.status = SessionStatus.RUNNING
            try:
                self.title = await self.page.title()
            except Exception:
                pass
        except Exception as e:
            print(f"Navigation notice for {self.session_id}: {e}")
            self.status = SessionStatus.RUNNING
            if self.page.url:
                self.current_url = self.page.url
        finally:
            self.update_activity()
            # Restart screencast so the new document's frames come through
            asyncio.create_task(self._start_screencast())

    async def reload(self):
        await self.page.reload(wait_until="commit")
        self.update_activity()
        asyncio.create_task(self._start_screencast())

    async def back(self):
        await self.page.go_back(wait_until="commit")
        self.update_activity()
        asyncio.create_task(self._start_screencast())

    async def forward(self):
        await self.page.go_forward(wait_until="commit")
        self.update_activity()
        asyncio.create_task(self._start_screencast())

    async def stop_loading(self):
        await self.page.evaluate("window.stop()")
        self.update_activity()

    async def close(self):
        self.status = SessionStatus.STOPPING
        if self.cdp_session:
            try:
                await self.cdp_session.send("Page.stopScreencast")
            except Exception:
                pass
            try:
                await self.cdp_session.detach()
            except Exception:
                pass
            self.cdp_session = None
        await self.page.close()
        await self.context.close()
        self.status = SessionStatus.STOPPED

    def get_info(self) -> BrowserSessionInfo:
        return BrowserSessionInfo(
            session_id=self.session_id,
            status=self.status,
            current_url=self.current_url,
            title=self.title,
            creation_time=self.creation_time.isoformat(),
            last_activity=self.last_activity.isoformat()
        )

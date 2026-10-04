from enum import Enum
from pydantic import BaseModel
import datetime
import asyncio
from contextlib import suppress
from typing import Optional

from playwright.async_api import Page, BrowserContext

from app.websocket.manager import websocket_manager


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


# Playwright screenshots are used instead of Page.startScreencast/CDP.  This is
# more reliable on Render's headless Chromium and keeps the frontend protocol
# unchanged: [4-byte session-id length][session-id][JPEG bytes].
_FRAME_INTERVAL = 0.20  # ~5 FPS per browser
_SCREENSHOT_QUALITY = 50
_SCREENSHOT_WIDTH = 640
_SCREENSHOT_HEIGHT = 360


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
        self._screenshot_task: Optional[asyncio.Task] = None
        self._closed = False

    async def initialize(self):
        self.status = SessionStatus.RUNNING
        self.page.on("framenavigated", self._on_navigate)
        self._start_screenshot_loop()

    def _start_screenshot_loop(self):
        if self._screenshot_task and not self._screenshot_task.done():
            return
        self._screenshot_task = asyncio.create_task(self._screenshot_loop())

    async def _screenshot_loop(self):
        """Continuously capture the page and broadcast JPEG frames over WS."""
        while not self._closed:
            try:
                # Capture at a bounded size to keep Render CPU/network usage sane.
                jpeg_bytes = await self.page.screenshot(
                    type="jpeg",
                    quality=_SCREENSHOT_QUALITY,
                    full_page=False,
                    
                    timeout=5000,
                )

                sid_bytes = self.session_id.encode("utf-8")
                payload = (
                    len(sid_bytes).to_bytes(4, "big")
                    + sid_bytes
                    + jpeg_bytes
                )
                await websocket_manager.broadcast_binary(payload)
            except asyncio.CancelledError:
                raise
            except Exception as e:
                # Navigation can briefly invalidate a screenshot. Keep the loop alive.
                if not self._closed:
                    print(f"Screenshot frame notice for {self.session_id}: {e}")
            await asyncio.sleep(_FRAME_INTERVAL)

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
            self._start_screenshot_loop()

    async def reload(self):
        await self.page.reload(wait_until="commit")
        self.update_activity()
        self._start_screenshot_loop()

    async def back(self):
        await self.page.go_back(wait_until="commit")
        self.update_activity()
        self._start_screenshot_loop()

    async def forward(self):
        await self.page.go_forward(wait_until="commit")
        self.update_activity()
        self._start_screenshot_loop()

    async def stop_loading(self):
        await self.page.evaluate("window.stop()")
        self.update_activity()

    async def close(self):
        self.status = SessionStatus.STOPPING
        self._closed = True

        if self._screenshot_task:
            self._screenshot_task.cancel()
            with suppress(asyncio.CancelledError):
                await self._screenshot_task
            self._screenshot_task = None

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
            last_activity=self.last_activity.isoformat(),
        )

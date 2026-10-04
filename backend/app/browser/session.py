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


# Screenshot streaming settings
_FRAME_INTERVAL = 0.20  # ~5 FPS
_SCREENSHOT_QUALITY = 50


class BrowserSession:
    def __init__(
        self,
        session_id: str,
        context: BrowserContext,
        page: Page,
    ):
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

        # Start continuous screenshot streaming.
        self._start_screenshot_loop()

    # ---------------------------------------------------------
    # SCREENSHOT STREAMING
    # ---------------------------------------------------------

    def _start_screenshot_loop(self):
        if self._screenshot_task and not self._screenshot_task.done():
            return

        self._screenshot_task = asyncio.create_task(
            self._screenshot_loop()
        )

    async def _screenshot_loop(self):
        """
        Continuously capture the browser page as JPEG frames
        and broadcast them through the WebSocket.

        Payload format:

        [4-byte session ID length]
        [session ID]
        [JPEG bytes]
        """

        while not self._closed:
            try:
                jpeg_bytes = await self.page.screenshot(
                    type="jpeg",
                    quality=_SCREENSHOT_QUALITY,
                    full_page=False,
                    timeout=5000,
                )

                session_bytes = self.session_id.encode("utf-8")

                payload = (
                    len(session_bytes).to_bytes(4, "big")
                    + session_bytes
                    + jpeg_bytes
                )

                await websocket_manager.broadcast_binary(payload)

            except asyncio.CancelledError:
                raise

            except Exception as e:
                if not self._closed:
                    print(
                        f"Screenshot frame notice "
                        f"for {self.session_id}: {e}"
                    )

            await asyncio.sleep(_FRAME_INTERVAL)

    # ---------------------------------------------------------
    # VIDEO PLAYBACK
    # ---------------------------------------------------------

    async def _start_videos(self):
        """
        Attempt to start all HTML5 videos on the page.

        This is especially useful for YouTube and other sites
        where autoplay may otherwise remain paused.
        """

        try:
            await self.page.evaluate(
                """
                async () => {
                    const videos = Array.from(
                        document.querySelectorAll("video")
                    );

                    for (const video of videos) {
                        try {
                            video.muted = true;
                            video.autoplay = true;

                            if (video.paused) {
                                await video.play();
                            }
                        } catch (e) {
                            // Autoplay may still be blocked by the site.
                        }
                    }
                }
                """
            )
        except Exception:
            pass

    async def _on_navigate(self, frame):
        if frame != self.page.main_frame:
            return

        self.current_url = self.page.url

        try:
            self.title = await self.page.title()
        except Exception:
            pass

        # Give the page time to create its video element.
        try:
            await self.page.wait_for_timeout(1500)
            await self._start_videos()
        except Exception:
            pass

        self.update_activity()

    # ---------------------------------------------------------
    # ACTIVITY
    # ---------------------------------------------------------

    def update_activity(self):
        self.last_activity = datetime.datetime.now(datetime.UTC)

    # ---------------------------------------------------------
    # NAVIGATION
    # ---------------------------------------------------------

    async def navigate(self, url: str):
        self.status = SessionStatus.AUTOMATING

        url = url.strip()

        if not any(
            url.startswith(prefix)
            for prefix in (
                "http://",
                "https://",
                "about:",
                "data:",
                "file:",
                "chrome:",
            )
        ):
            url = "https://" + url

        try:
            self.current_url = url

            await self.page.goto(
                url,
                wait_until="commit",
                timeout=60000,
            )

            # Wait for the page to initialize.
            try:
                await self.page.wait_for_timeout(2000)
            except Exception:
                pass

            # Attempt HTML5 video playback.
            await self._start_videos()

            self.status = SessionStatus.RUNNING

            try:
                self.title = await self.page.title()
            except Exception:
                pass

        except Exception as e:
            print(
                f"Navigation notice for "
                f"{self.session_id}: {e}"
            )

            self.status = SessionStatus.RUNNING

            if self.page.url:
                self.current_url = self.page.url

        finally:
            self.update_activity()
            self._start_screenshot_loop()

    # ---------------------------------------------------------
    # RELOAD
    # ---------------------------------------------------------

    async def reload(self):
        try:
            await self.page.reload(
                wait_until="commit",
                timeout=60000,
            )

            await self.page.wait_for_timeout(2000)

            await self._start_videos()

        except Exception as e:
            print(
                f"Reload notice for "
                f"{self.session_id}: {e}"
            )

        self.update_activity()
        self._start_screenshot_loop()

    # ---------------------------------------------------------
    # BACK
    # ---------------------------------------------------------

    async def back(self):
        try:
            await self.page.go_back(
                wait_until="commit",
                timeout=60000,
            )

            await self.page.wait_for_timeout(1500)

            await self._start_videos()

        except Exception as e:
            print(
                f"Back navigation notice for "
                f"{self.session_id}: {e}"
            )

        self.update_activity()
        self._start_screenshot_loop()

    # ---------------------------------------------------------
    # FORWARD
    # ---------------------------------------------------------

    async def forward(self):
        try:
            await self.page.go_forward(
                wait_until="commit",
                timeout=60000,
            )

            await self.page.wait_for_timeout(1500)

            await self._start_videos()

        except Exception as e:
            print(
                f"Forward navigation notice for "
                f"{self.session_id}: {e}"
            )

        self.update_activity()
        self._start_screenshot_loop()

    # ---------------------------------------------------------
    # STOP LOADING
    # ---------------------------------------------------------

    async def stop_loading(self):
        try:
            await self.page.evaluate("window.stop()")
        except Exception:
            pass

        self.update_activity()

    # ---------------------------------------------------------
    # CLOSE
    # ---------------------------------------------------------

    async def close(self):
        self.status = SessionStatus.STOPPING
        self._closed = True

        # Stop screenshot task.
        if self._screenshot_task:
            self._screenshot_task.cancel()

            with suppress(asyncio.CancelledError):
                await self._screenshot_task

            self._screenshot_task = None

        # Close browser page/context.
        try:
            await self.page.close()
        except Exception:
            pass

        try:
            await self.context.close()
        except Exception:
            pass

        self.status = SessionStatus.STOPPED

    # ---------------------------------------------------------
    # SESSION INFO
    # ---------------------------------------------------------

    def get_info(self) -> BrowserSessionInfo:
        return BrowserSessionInfo(
            session_id=self.session_id,
            status=self.status,
            current_url=self.current_url,
            title=self.title,
            creation_time=self.creation_time.isoformat(),
            last_activity=self.last_activity.isoformat(),
        )
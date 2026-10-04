from playwright.async_api import async_playwright, Playwright, Browser
from .session import BrowserSession
from typing import Dict, List, Optional
import asyncio


class BrowserManager:
    def __init__(self):
        self.playwright: Optional[Playwright] = None
        self.browser: Optional[Browser] = None
        self.sessions: Dict[str, BrowserSession] = {}
        self._session_counter = 0

    async def start(self):
        self.playwright = await async_playwright().start()

        # Chromium configuration for:
        # - video playback
        # - autoplay
        # - software GPU rendering on Render
        # - avoiding background throttling
        # - container compatibility
        launch_args = [
            # -------------------------
            # AUTOPLAY / MEDIA
            # -------------------------
            "--autoplay-policy=no-user-gesture-required",
            "--enable-features=NetworkService,NetworkServiceLogging",
            "--enable-media-stream",

            # -------------------------
            # GPU / VIDEO RENDERING
            # -------------------------
            "--enable-gpu",
            "--use-gl=swiftshader",
            "--ignore-gpu-blocklist",
            "--enable-accelerated-video-decode",
            "--enable-accelerated-video-encode",

            # -------------------------
            # DON'T THROTTLE PAGES
            # -------------------------
            "--disable-background-timer-throttling",
            "--disable-backgrounding-occluded-windows",
            "--disable-renderer-backgrounding",

            # -------------------------
            # CONTAINER / RENDER
            # -------------------------
            "--disable-dev-shm-usage",
            "--no-sandbox",

            # -------------------------
            # BROWSER FEATURES
            # -------------------------
            "--disable-features=CalculateNativeWinOcclusion,IsolateOrigins,site-per-process",
            "--disable-web-security",
            "--allow-running-insecure-content",

            # -------------------------
            # MEDIA PERMISSIONS
            # -------------------------
            "--use-fake-ui-for-media-stream",

            # -------------------------
            # AUTOMATION
            # -------------------------
            "--disable-blink-features=AutomationControlled",

            # -------------------------
            # HTTPS
            # -------------------------
            "--ignore-certificate-errors",
        ]

        # Prefer installed Chrome because it generally has better
        # proprietary media codec support.
        try:
            print("Launching Google Chrome...")

            self.browser = await self.playwright.chromium.launch(
                channel="chrome",
                headless=True,
                args=launch_args,
            )

            print("Google Chrome launched successfully.")

        except Exception as chrome_error:
            print(f"Chrome launch failed: {chrome_error}")

            try:
                print("Trying Microsoft Edge...")

                self.browser = await self.playwright.chromium.launch(
                    channel="msedge",
                    headless=True,
                    args=launch_args,
                )

                print("Microsoft Edge launched successfully.")

            except Exception as edge_error:
                print(f"Edge launch failed: {edge_error}")

                print("Falling back to Playwright Chromium...")

                self.browser = await self.playwright.chromium.launch(
                    headless=True,
                    args=launch_args,
                )

                print("Playwright Chromium launched successfully.")

    async def stop(self):
        # Close all active sessions.
        for session in list(self.sessions.values()):
            try:
                await session.close()
            except Exception:
                pass

        self.sessions.clear()

        if self.browser:
            try:
                await self.browser.close()
            except Exception:
                pass

            self.browser = None

        if self.playwright:
            try:
                await self.playwright.stop()
            except Exception:
                pass

            self.playwright = None

    async def _create_single_session(
        self,
        session_id: str,
    ) -> Optional[BrowserSession]:

        try:
            if not self.browser:
                raise RuntimeError("Browser is not started")

            context = await self.browser.new_context(
                viewport={
                    "width": 1280,
                    "height": 720,
                },

                # Chrome-like user agent.
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 "
                    "(KHTML, like Gecko) "
                    "Chrome/133.0.0.0 Safari/537.36"
                ),

                ignore_https_errors=True,

                # Keep normal desktop media behavior.
                java_script_enabled=True,
            )

            # -------------------------------------------------
            # INIT SCRIPT
            # -------------------------------------------------
            #
            # Runs before every page's JavaScript.
            #
            # Purpose:
            # - hide webdriver
            # - enable autoplay
            # - repeatedly attempt to start HTML5 video
            #
            await context.add_init_script(
                """
                (() => {
                    // Hide webdriver flag.
                    try {
                        Object.defineProperty(
                            navigator,
                            "webdriver",
                            {
                                get: () => undefined
                            }
                        );
                    } catch (e) {}

                    // Make autoplay more permissive.
                    try {
                        Object.defineProperty(
                            HTMLMediaElement.prototype,
                            "autoplay",
                            {
                                configurable: true
                            }
                        );
                    } catch (e) {}

                    // Continuously look for video elements.
                    setInterval(() => {
                        try {
                            const videos =
                                document.querySelectorAll("video");

                            videos.forEach((video) => {
                                try {
                                    video.muted = true;
                                    video.autoplay = true;

                                    if (video.paused) {
                                        const promise = video.play();

                                        if (
                                            promise &&
                                            promise.catch
                                        ) {
                                            promise.catch(() => {});
                                        }
                                    }
                                } catch (e) {}
                            });
                        } catch (e) {}
                    }, 1000);
                })();
                """
            )

            page = await context.new_page()

            # -------------------------------------------------
            # PAGE SETTINGS
            # -------------------------------------------------

            # Try to make the browser appear as a normal desktop page.
            try:
                await page.set_extra_http_headers(
                    {
                        "Accept-Language": "en-US,en;q=0.9",
                    }
                )
            except Exception:
                pass

            # -------------------------------------------------
            # CREATE SESSION
            # -------------------------------------------------

            session = BrowserSession(
                session_id,
                context,
                page,
            )

            await session.initialize()

            return session

        except Exception as e:
            print(
                f"Error creating session "
                f"{session_id}: {e}"
            )

            return None

    async def create_session(self) -> BrowserSession:
        if not self.browser:
            raise RuntimeError(
                "Browser manager is not started"
            )

        self._session_counter += 1

        session_id = (
            f"browser-{self._session_counter:03d}"
        )

        session = await self._create_single_session(
            session_id
        )

        if not session:
            raise RuntimeError(
                f"Failed to create session {session_id}"
            )

        self.sessions[session_id] = session

        return session

    async def create_sessions_batch(
        self,
        count: int,
    ) -> List[BrowserSession]:

        if not self.browser:
            raise RuntimeError(
                "Browser manager is not started"
            )

        tasks = []

        for _ in range(count):
            self._session_counter += 1

            session_id = (
                f"browser-{self._session_counter:03d}"
            )

            tasks.append(
                self._create_single_session(
                    session_id
                )
            )

        created = await asyncio.gather(
            *tasks
        )

        valid_sessions = []

        for session in created:
            if session:
                self.sessions[
                    session.session_id
                ] = session

                valid_sessions.append(session)

        return valid_sessions

    async def close_session(
        self,
        session_id: str,
    ):
        session = self.sessions.pop(
            session_id,
            None,
        )

        if session:
            try:
                await session.close()
            except Exception:
                pass

    def get_session(
        self,
        session_id: str,
    ) -> Optional[BrowserSession]:

        return self.sessions.get(session_id)

    def list_sessions(
        self,
    ) -> List[BrowserSession]:

        return list(self.sessions.values())


browser_manager = BrowserManager()
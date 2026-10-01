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
        
        # Chromium launch arguments for smooth media playback and unthrottled rendering
        launch_args = [
            "--autoplay-policy=no-user-gesture-required",
            "--disable-background-timer-throttling",
            "--disable-backgrounding-occluded-windows",
            "--disable-renderer-backgrounding",
            "--disable-dev-shm-usage",
            "--no-sandbox",
            # Disable features that throttle/block media in headless
            "--disable-features=CalculateNativeWinOcclusion,IsolateOrigins,site-per-process",
            "--enable-features=NetworkService,NetworkServiceLogging",
            # Media / video playback
            "--disable-web-security",
            "--allow-running-insecure-content",
            "--use-fake-ui-for-media-stream",
            "--disable-blink-features=AutomationControlled",
            "--ignore-certificate-errors",
        ]
        
        # Prefer system Google Chrome or Edge for full proprietary codec support (H.264, AAC, VP9)
        try:
            self.browser = await self.playwright.chromium.launch(
                channel="chrome",
                headless=True,
                args=launch_args,
            )
        except Exception:
            try:
                self.browser = await self.playwright.chromium.launch(
                    channel="msedge",
                    headless=True,
                    args=launch_args,
                )
            except Exception:
                self.browser = await self.playwright.chromium.launch(
                    headless=True,
                    args=launch_args,
                )
        
    async def stop(self):
        # Close all active sessions
        for session in list(self.sessions.values()):
            await session.close()
        self.sessions.clear()

        if self.browser:
            await self.browser.close()
            self.browser = None
            
        if self.playwright:
            await self.playwright.stop()
            self.playwright = None

    async def _create_single_session(self, session_id: str) -> Optional[BrowserSession]:
        try:
            context = await self.browser.new_context(
                viewport={"width": 1280, "height": 720},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
                ignore_https_errors=True,
            )
            
            # Universal auto-play and media unpauser for video players
            await context.add_init_script("""() => {
                try {
                    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                } catch(e) {}
                
                setInterval(() => {
                    try {
                        document.querySelectorAll('video').forEach(v => {
                            if (v.paused) {
                                v.muted = true;
                                v.play().catch(() => {});
                            }
                        });
                    } catch(e) {}
                }, 1000);
            }""")
            
            page = await context.new_page()
            session = BrowserSession(session_id, context, page)
            await session.initialize()
            return session
        except Exception as e:
            print(f"Error creating session {session_id}: {e}")
            return None

    async def create_session(self) -> BrowserSession:
        if not self.browser:
            raise RuntimeError("Browser manager is not started")

        self._session_counter += 1
        session_id = f"browser-{self._session_counter:03d}"
        session = await self._create_single_session(session_id)
        if not session:
            raise RuntimeError(f"Failed to create session {session_id}")
        self.sessions[session_id] = session
        return session

    async def create_sessions_batch(self, count: int) -> List[BrowserSession]:
        if not self.browser:
            raise RuntimeError("Browser manager is not started")
        
        tasks = []
        for _ in range(count):
            self._session_counter += 1
            session_id = f"browser-{self._session_counter:03d}"
            tasks.append(self._create_single_session(session_id))
        
        created = await asyncio.gather(*tasks)
        valid_sessions = []
        for s in created:
            if s:
                self.sessions[s.session_id] = s
                valid_sessions.append(s)
        return valid_sessions

    async def close_session(self, session_id: str):
        session = self.sessions.pop(session_id, None)
        if session:
            try:
                await session.close()
            except Exception:
                pass

    def get_session(self, session_id: str) -> Optional[BrowserSession]:
        return self.sessions.get(session_id)

    def list_sessions(self) -> List[BrowserSession]:
        return list(self.sessions.values())

browser_manager = BrowserManager()

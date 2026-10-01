import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.browser.manager import browser_manager

@pytest.mark.anyio
async def test_browser_lifecycle():
    # Start the manager explicitly since httpx ASGITransport doesn't trigger lifespan automatically
    await browser_manager.start()
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            # Create browser
            response = await ac.post("/api/browsers")
            assert response.status_code == 200
            data = response.json()
            session_id = data["session_id"]
            assert session_id.startswith("browser-")
            assert data["status"] == "RUNNING"
            
            # List browsers
            response = await ac.get("/api/browsers")
            assert response.status_code == 200
            assert len(response.json()) == 1
            
            # Navigate
            response = await ac.post(f"/api/browsers/{session_id}/navigate", json={"url": "about:blank"})
            assert response.status_code == 200
            
            # Close browser
            response = await ac.delete(f"/api/browsers/{session_id}")
            assert response.status_code == 200
            
            # Verify it's closed
            response = await ac.get("/api/browsers")
            assert len(response.json()) == 0
    finally:
        await browser_manager.stop()

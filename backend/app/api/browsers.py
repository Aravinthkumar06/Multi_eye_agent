from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.browser.manager import browser_manager
from app.browser.session import BrowserSessionInfo
from typing import List

router = APIRouter(prefix="/api/browsers", tags=["browsers"])

class NavigateRequest(BaseModel):
    url: str

class CreateBatchRequest(BaseModel):
    count: int = 1

@router.get("", response_model=List[BrowserSessionInfo])
async def list_browsers():
    return [session.get_info() for session in browser_manager.list_sessions()]

@router.post("/batch/create", response_model=List[BrowserSessionInfo])
async def create_browsers_batch(req: CreateBatchRequest):
    sessions = await browser_manager.create_sessions_batch(req.count)
    return [s.get_info() for s in sessions]

@router.post("", response_model=BrowserSessionInfo)
async def create_browser():
    session = await browser_manager.create_session()
    return session.get_info()

@router.delete("/{session_id}")
async def delete_browser(session_id: str):
    session = browser_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await browser_manager.close_session(session_id)
    return {"status": "success"}

@router.post("/{session_id}/navigate", response_model=BrowserSessionInfo)
async def navigate(session_id: str, req: NavigateRequest):
    session = browser_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await session.navigate(req.url)
    return session.get_info()

@router.post("/{session_id}/reload", response_model=BrowserSessionInfo)
async def reload(session_id: str):
    session = browser_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await session.reload()
    return session.get_info()

@router.post("/{session_id}/back", response_model=BrowserSessionInfo)
async def back(session_id: str):
    session = browser_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await session.back()
    return session.get_info()

@router.post("/{session_id}/forward", response_model=BrowserSessionInfo)
async def forward(session_id: str):
    session = browser_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await session.forward()
    return session.get_info()

@router.post("/{session_id}/stop", response_model=BrowserSessionInfo)
async def stop(session_id: str):
    session = browser_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await session.stop_loading()
    return session.get_info()

@router.post("/batch/navigate-all")
async def navigate_all(req: NavigateRequest):
    sessions = browser_manager.list_sessions()
    import asyncio
    
    async def _staggered_nav(s, delay):
        if delay > 0:
            await asyncio.sleep(delay)
        return await s.navigate(req.url)

    tasks = [_staggered_nav(session, i * 0.04) for i, session in enumerate(sessions)]
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)
    return {"status": "success", "count": len(sessions)}

@router.post("/batch/reload-all")
async def reload_all():
    sessions = browser_manager.list_sessions()
    import asyncio
    tasks = [session.reload() for session in sessions]
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)
    return {"status": "success", "count": len(sessions)}

@router.post("/batch/stop-all")
async def stop_all():
    sessions = browser_manager.list_sessions()
    import asyncio
    tasks = [session.stop_loading() for session in sessions]
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)
    return {"status": "success", "count": len(sessions)}


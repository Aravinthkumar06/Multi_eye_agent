from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.browser.manager import browser_manager
from app.api.browsers import router as browsers_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting Browser Manager...")
    await browser_manager.start()
    yield
    # Shutdown
    logger.info("Stopping Browser Manager...")
    await browser_manager.stop()

app = FastAPI(title="MultiView Agent", lifespan=lifespan)

# CORS middleware - allow all local origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(browsers_router)

@app.get("/health")
async def health_check():
    return {"status": "ONLINE"}

from app.websocket.manager import websocket_manager

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket_manager.connect(websocket)
    logger.info("WebSocket connected")
    try:
        while True:
            # We just keep the connection open to listen for client messages if needed
            data = await websocket.receive_text()
            logger.info(f"Received from client: {data}")
    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket)
        logger.info("WebSocket disconnected")
    except Exception as e:
        websocket_manager.disconnect(websocket)
        logger.error(f"WebSocket error: {e}")

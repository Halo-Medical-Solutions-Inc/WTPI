import asyncio
import json
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator, Dict

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import analytics, auth, audit_logs, calls, invitations, mentions, messaging, practice, users, webhooks, websocket
from app.config import settings
from app.database.redis_client import close_redis, get_redis
from app.services.publisher_service import CHANNEL_NAME
from app.services.stale_call_service import run_stale_call_recovery_loop
from app.utils.errors import AppError
from app.websocket_manager import manager


async def redis_subscriber() -> None:
    redis = await get_redis()
    pubsub = redis.pubsub()
    await pubsub.subscribe(CHANNEL_NAME)

    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                try:
                    data = json.loads(message["data"])
                    target_user_ids = data.pop("target_user_ids", None)
                    if target_user_ids:
                        for user_id in target_user_ids:
                            await manager.send_to_user(user_id, data)
                    else:
                        await manager.broadcast(data)
                except Exception as e:
                    print(f"Error broadcasting message: {e}")
    except asyncio.CancelledError:
        await pubsub.unsubscribe(CHANNEL_NAME)
        await pubsub.close()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    subscriber_task = asyncio.create_task(redis_subscriber())
    stale_recovery_task = asyncio.create_task(run_stale_call_recovery_loop())

    print("WTPI AI Receptionist backend started")

    yield

    subscriber_task.cancel()
    stale_recovery_task.cancel()

    try:
        await subscriber_task
    except asyncio.CancelledError:
        pass

    try:
        await stale_recovery_task
    except asyncio.CancelledError:
        pass

    await close_redis()
    print("WTPI AI Receptionist backend stopped")


app = FastAPI(
    title="WTPI AI Receptionist",
    description="AI-powered receptionist for West Texas Pain Institute inbound calls",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "data": None,
            "message": exc.message,
        },
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    print(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "data": None,
            "message": "Internal server error",
        },
    )


app.include_router(analytics.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(invitations.router)
app.include_router(audit_logs.router)
app.include_router(messaging.router)
app.include_router(practice.router)
app.include_router(calls.router)
app.include_router(mentions.router)
app.include_router(webhooks.router)
app.include_router(websocket.router)


@app.get("/health")
async def health_check() -> Dict[str, Any]:
    return {
        "success": True,
        "data": {
            "status": "healthy",
            "version": "1.0.0",
            "websocket_connections": manager.get_connection_count(),
        },
        "message": "OK",
    }


@app.get("/")
async def root() -> Dict[str, Any]:
    return {
        "success": True,
        "data": {
            "name": "WTPI AI Receptionist",
            "version": "1.0.0",
        },
        "message": "Welcome to WTPI AI Receptionist API",
    }

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.services import user_service
from app.utils.jwt import decode_access_token
from app.websocket_manager import manager

router = APIRouter(tags=["websocket"])


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = "",
) -> None:
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return

    user_id = decode_access_token(token)
    if user_id is None:
        await websocket.close(code=4001, reason="Invalid token")
        return

    await manager.connect(websocket, str(user_id))

    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        await manager.disconnect(websocket, str(user_id))
    except Exception as e:
        print(f"WebSocket error: {e}")
        await manager.disconnect(websocket, str(user_id))

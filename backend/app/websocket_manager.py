import asyncio
import json
from typing import Dict, List

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._active_connections: Dict[str, List[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, user_id: str) -> None:
        await websocket.accept()
        async with self._lock:
            if user_id not in self._active_connections:
                self._active_connections[user_id] = []
            self._active_connections[user_id].append(websocket)
        print(f"WebSocket connected: user {user_id}")

    async def disconnect(self, websocket: WebSocket, user_id: str) -> None:
        async with self._lock:
            if user_id in self._active_connections:
                if websocket in self._active_connections[user_id]:
                    self._active_connections[user_id].remove(websocket)
                if not self._active_connections[user_id]:
                    del self._active_connections[user_id]
        print(f"WebSocket disconnected: user {user_id}")

    async def broadcast(self, message: dict) -> None:
        if not self._active_connections:
            return

        message_str = json.dumps(message)
        disconnected: List[tuple[WebSocket, str]] = []

        async with self._lock:
            for user_id, connections in self._active_connections.items():
                for connection in connections:
                    try:
                        await connection.send_text(message_str)
                    except Exception as e:
                        print(f"Failed to send to {user_id}: {e}")
                        disconnected.append((connection, user_id))

        for websocket, user_id in disconnected:
            await self.disconnect(websocket, user_id)

    async def send_to_user(self, user_id: str, message: dict) -> None:
        message_str = json.dumps(message)
        disconnected: List[WebSocket] = []

        async with self._lock:
            if user_id not in self._active_connections:
                return
            for connection in self._active_connections[user_id]:
                try:
                    await connection.send_text(message_str)
                except Exception as e:
                    print(f"Failed to send to {user_id}: {e}")
                    disconnected.append(connection)

            for websocket in disconnected:
                if websocket in self._active_connections.get(user_id, []):
                    self._active_connections[user_id].remove(websocket)
            if user_id in self._active_connections and not self._active_connections[user_id]:
                del self._active_connections[user_id]

    def get_connection_count(self) -> int:
        return sum(len(conns) for conns in self._active_connections.values())


manager = ConnectionManager()

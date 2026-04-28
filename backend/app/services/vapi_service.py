from typing import Any, Dict, Optional

import httpx

from app.config import settings

VAPI_BASE_URL = "https://api.vapi.ai"


async def get_call(vapi_call_id: str) -> Optional[Dict[str, Any]]:
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{VAPI_BASE_URL}/call/{vapi_call_id}",
                headers={
                    "Authorization": f"Bearer {settings.VAPI_API_KEY}",
                    "Content-Type": "application/json",
                },
                timeout=30.0,
            )
            if response.status_code == 200:
                return response.json()
            print(f"VAPI get_call failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"VAPI get_call error: {e}")
        return None

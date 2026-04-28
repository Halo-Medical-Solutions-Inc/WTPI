import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select

from app.database.session import AsyncSessionLocal
from app.models.call import Call
from app.services import call_service


async def inspect_call_by_phone(phone_search: str) -> None:
    async with AsyncSessionLocal() as db:
        calls = await call_service.get_calls(db, limit=500)
        
        matching_calls = []
        for call in calls:
            vapi_data = call_service.decrypt_vapi_data(call)
            if not vapi_data:
                continue
            
            phone_number = vapi_data.get("call", {}).get("customer", {}).get("number", "")
            caller_name = ""
            
            extraction_data = call_service.decrypt_extraction_data(call)
            if extraction_data:
                caller_name = extraction_data.get("caller_name", "")
            
            if not caller_name and vapi_data.get("analysis", {}).get("structuredData"):
                caller_name = vapi_data.get("analysis", {}).get("structuredData", {}).get("caller_name", "")
            
            phone_normalized = phone_number.replace("+", "").replace("-", "").replace(" ", "").replace("(", "").replace(")", "")
            search_normalized = phone_search.replace("+", "").replace("-", "").replace(" ", "").replace("(", "").replace(")", "")
            
            if (search_normalized in phone_normalized) or (caller_name and phone_search.lower() in caller_name.lower()):
                matching_calls.append({
                    "call": call,
                    "vapi_data": vapi_data,
                    "extraction_data": extraction_data,
                    "phone": phone_number,
                    "caller_name": caller_name,
                })
        
        if not matching_calls:
            print(f"No calls found matching '{phone_search}'")
            return
        
        for match in matching_calls:
            call = match["call"]
            vapi_data = match["vapi_data"]
            extraction_data = match["extraction_data"]
            
            print("=" * 80)
            print(f"Call ID: {call.id}")
            print(f"Twilio SID: {call.twilio_call_sid}")
            print(f"VAPI Call ID: {call.vapi_call_id}")
            print(f"Status: {call.status.value}")
            print(f"Extraction Status: {call.extraction_status.value if call.extraction_status else 'None'}")
            print(f"Is Reviewed: {call.is_reviewed}")
            print(f"Reviewed By: {call.reviewed_by}")
            print(f"Reviewed At: {call.reviewed_at}")
            print(f"Created At: {call.created_at}")
            print(f"Phone: {match['phone']}")
            print(f"Caller Name: {match['caller_name']}")
            print("-" * 80)
            
            if extraction_data:
                print("Extraction Data:")
                print(json.dumps(extraction_data, indent=2))
            else:
                print("Extraction Data: None")
            
            print("-" * 80)
            
            ended_reason = vapi_data.get("endedReason", "")
            print(f"Ended Reason: {ended_reason}")
            
            messages = vapi_data.get("artifact", {}).get("messages", []) or vapi_data.get("messages", [])
            transfer_found = False
            for msg in messages:
                if msg.get("role") == "tool_calls":
                    for tool_call in msg.get("toolCalls", []):
                        if tool_call.get("function", {}).get("name") == "transfer_call_tool":
                            transfer_found = True
                            args_str = tool_call.get("function", {}).get("arguments", "{}")
                            print(f"Transfer Tool Arguments: {args_str}")
                            try:
                                args = json.loads(args_str)
                                destination = args.get("destination", "")
                                print(f"Destination: {destination}")
                                parts = destination.split(",")
                                if len(parts) > 1:
                                    print(f"Extension: {parts[1]}")
                                else:
                                    print("Extension: None (Mainline)")
                            except:
                                pass
            
            if not transfer_found:
                print("No transfer_call_tool found in messages")
            
            print("=" * 80)
            print()


if __name__ == "__main__":
    search_term = sys.argv[1] if len(sys.argv) > 1 else "267-5211"
    asyncio.run(inspect_call_by_phone(search_term))

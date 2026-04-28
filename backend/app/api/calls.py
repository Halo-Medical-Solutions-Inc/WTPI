import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import (
    get_client_ip,
    get_current_user,
    get_user_agent,
    require_super_admin,
)
from app.database.session import get_db
from app.models.audit_log import AuditAction, EntityType
from app.models.call import Call, CallStatus
from app.models.user import User
from app.schemas.call import (
    CallDetailResponse,
    CallFlagUpdate,
    CallResponse,
    CallReviewUpdate,
    CallSearchRequest,
    CallTeamsUpdate,
)
from app.schemas.call_comment import CallCommentCreate, CallCommentResponse
from app.services import audit_service, call_comment_service, call_service, mention_service, publisher_service
from app.utils.errors import AppError

router = APIRouter(prefix="/api/calls", tags=["calls"])


def _success(data: Any = None, message: str = "Success") -> Dict[str, Any]:
    return {"success": True, "data": data, "message": message}


def _build_call_list_responses(calls: List[Call]) -> List[Dict[str, Any]]:
    results = []
    for call in calls:
        extraction_data = call_service.decrypt_extraction_data(call)
        results.append({
            "id": call.id,
            "twilio_call_sid": call.twilio_call_sid,
            "vapi_call_id": call.vapi_call_id,
            "status": call.status,
            "is_reviewed": call.is_reviewed,
            "reviewed_by": call.reviewed_by,
            "reviewed_at": call.reviewed_at,
            "is_flagged": call.is_flagged,
            "flagged_by": call.flagged_by,
            "flagged_at": call.flagged_at,
            "created_at": call.created_at,
            "updated_at": call.updated_at,
            "display_data": call_service.decrypt_display_data(call),
            "extraction_data": extraction_data,
            "extraction_status": call.extraction_status.value
            if call.extraction_status
            else None,
        })
    return results


@router.get("")
async def list_calls(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    status: Optional[CallStatus] = Query(None),
    is_reviewed: Optional[bool] = Query(None),
) -> Dict[str, Any]:
    calls = await call_service.get_calls(
        db=db,
        start_date=start_date,
        end_date=end_date,
        status=status,
        is_reviewed=is_reviewed,
    )

    call_responses = _build_call_list_responses(calls)

    return _success(call_responses)


@router.post("/search")
async def search_calls(
    body: CallSearchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    results = await call_service.search_calls(db, body)
    return _success([r.model_dump() for r in results])


@router.get("/{call_id}")
async def get_call(
    call_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    call = await call_service.get_call_by_id(db, call_id)
    if call is None:
        raise AppError("Call not found", 404)

    vapi_data = call_service.decrypt_vapi_data(call)
    extraction_data = call_service.decrypt_extraction_data(call)
    display_data = call_service.decrypt_display_data(call)
    return _success(
        CallDetailResponse(
            id=call.id,
            twilio_call_sid=call.twilio_call_sid,
            vapi_call_id=call.vapi_call_id,
            status=call.status,
            is_reviewed=call.is_reviewed,
            reviewed_by=call.reviewed_by,
            reviewed_at=call.reviewed_at,
            is_flagged=call.is_flagged,
            flagged_by=call.flagged_by,
            flagged_at=call.flagged_at,
            created_at=call.created_at,
            updated_at=call.updated_at,
            display_data=display_data,
            vapi_data=vapi_data,
            extraction_data=extraction_data,
            extraction_status=call.extraction_status.value if call.extraction_status else None,
        ).model_dump()
    )


@router.get("/{call_id}/comments")
async def get_call_comments(
    call_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    call = await call_service.get_call_by_id(db, call_id)
    if call is None:
        raise AppError("Call not found", 404)

    comments = await call_comment_service.get_call_comments(db, call_id)
    items = [
        {
            "id": str(c.id),
            "call_id": str(c.call_id),
            "user_id": str(c.user_id) if c.user_id else None,
            "user_name": c.user.full_name if c.user else None,
            "content": c.content,
            "created_at": c.created_at.isoformat(),
        }
        for c in comments
    ]
    return _success(items)


@router.post("/{call_id}/comments")
async def add_call_comment(
    call_id: uuid.UUID,
    body: CallCommentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    if not body.content or not body.content.strip():
        raise AppError("Comment content is required", 400)

    comment = await call_comment_service.add_call_comment(
        db=db,
        call_id=call_id,
        user_id=current_user.id,
        content=body.content,
    )
    if comment is None:
        raise AppError("Call not found", 404)

    from sqlalchemy import select
    from app.models.comment_mention import CommentMention
    at_mentioned_result = await db.execute(
        select(CommentMention.user_id).where(
            CommentMention.comment_id == comment.id,
            CommentMention.source == "call_comment",
        )
    )
    at_mentioned_ids = [uid for uid in at_mentioned_result.scalars().all()]

    await mention_service.notify_call_activity(
        db=db,
        call_id=call_id,
        actor_id=current_user.id,
        action="comment",
        snippet=comment.content,
        comment_id=comment.id,
        exclude_user_ids=at_mentioned_ids,
    )

    return _success(
        {
            "id": str(comment.id),
            "call_id": str(comment.call_id),
            "user_id": str(comment.user_id) if comment.user_id else None,
            "user_name": current_user.full_name,
            "content": comment.content,
            "created_at": comment.created_at.isoformat(),
        },
        message="Comment added",
    )


@router.delete("/{call_id}/comments/{comment_id}")
async def delete_call_comment(
    call_id: uuid.UUID,
    comment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    deleted = await call_comment_service.delete_call_comment(
        db=db,
        call_id=call_id,
        comment_id=comment_id,
        user_id=current_user.id,
    )
    if not deleted:
        raise AppError("Comment not found or not yours", 404)
    return _success(None, message="Comment archived")


@router.patch("/{call_id}/review")
async def update_review_status(
    request: Request,
    call_id: uuid.UUID,
    body: CallReviewUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    call = await call_service.update_review_status(
        db=db,
        call_id=call_id,
        is_reviewed=body.is_reviewed,
        reviewed_by=current_user.id,
    )
    if call is None:
        raise AppError("Call not found", 404)

    await audit_service.create_audit_log(
        db=db,
        entity_type=EntityType.CALL,
        action=AuditAction.REVIEW_TOGGLE,
        user_id=current_user.id,
        user_email=current_user.email,
        entity_id=call_id,
        details=f"Set reviewed to {body.is_reviewed}",
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
    )

    await publisher_service.publish_event(
        "call_updated",
        {
            "id": str(call.id),
            "is_reviewed": call.is_reviewed,
            "reviewed_by": str(call.reviewed_by) if call.reviewed_by else None,
        },
    )

    review_snippet = "marked as reviewed" if body.is_reviewed else "marked as needs review"
    await mention_service.notify_call_activity(
        db=db,
        call_id=call_id,
        actor_id=current_user.id,
        action="review",
        snippet=review_snippet,
    )

    vapi_data = call_service.decrypt_vapi_data(call)
    extraction_data = call_service.decrypt_extraction_data(call)
    display_data = call_service.decrypt_display_data(call)
    return _success(
        CallDetailResponse(
            id=call.id,
            twilio_call_sid=call.twilio_call_sid,
            vapi_call_id=call.vapi_call_id,
            status=call.status,
            is_reviewed=call.is_reviewed,
            reviewed_by=call.reviewed_by,
            reviewed_at=call.reviewed_at,
            is_flagged=call.is_flagged,
            flagged_by=call.flagged_by,
            flagged_at=call.flagged_at,
            created_at=call.created_at,
            updated_at=call.updated_at,
            display_data=display_data,
            vapi_data=vapi_data,
            extraction_data=extraction_data,
            extraction_status=call.extraction_status.value if call.extraction_status else None,
        ).model_dump()
    )


@router.patch("/{call_id}/flag")
async def update_flag_status(
    request: Request,
    call_id: uuid.UUID,
    body: CallFlagUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    call = await call_service.update_flag_status(
        db=db,
        call_id=call_id,
        is_flagged=body.is_flagged,
        flagged_by=current_user.id,
    )
    if call is None:
        raise AppError("Call not found", 404)

    await audit_service.create_audit_log(
        db=db,
        entity_type=EntityType.CALL,
        action=AuditAction.FLAG_TOGGLE,
        user_id=current_user.id,
        user_email=current_user.email,
        entity_id=call_id,
        details=f"Set is_flagged to {body.is_flagged}",
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
    )

    await publisher_service.publish_event(
        "call_updated",
        {
            "id": str(call.id),
            "is_flagged": call.is_flagged,
            "flagged_by": str(call.flagged_by) if call.flagged_by else None,
            "flagged_at": call.flagged_at.isoformat() if call.flagged_at else None,
        },
    )

    flag_snippet = "flagged this call" if body.is_flagged else "unflagged this call"
    await mention_service.notify_call_activity(
        db=db,
        call_id=call_id,
        actor_id=current_user.id,
        action="flag",
        snippet=flag_snippet,
    )

    vapi_data = call_service.decrypt_vapi_data(call)
    extraction_data = call_service.decrypt_extraction_data(call)
    display_data = call_service.decrypt_display_data(call)
    return _success(
        CallDetailResponse(
            id=call.id,
            twilio_call_sid=call.twilio_call_sid,
            vapi_call_id=call.vapi_call_id,
            status=call.status,
            is_reviewed=call.is_reviewed,
            reviewed_by=call.reviewed_by,
            reviewed_at=call.reviewed_at,
            is_flagged=call.is_flagged,
            flagged_by=call.flagged_by,
            flagged_at=call.flagged_at,
            created_at=call.created_at,
            updated_at=call.updated_at,
            display_data=display_data,
            vapi_data=vapi_data,
            extraction_data=extraction_data,
            extraction_status=call.extraction_status.value if call.extraction_status else None,
        ).model_dump()
    )


@router.patch("/{call_id}/teams")
async def update_call_teams(
    request: Request,
    call_id: uuid.UUID,
    body: CallTeamsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    call = await call_service.update_call_teams(
        db=db,
        call_id=call_id,
        call_teams=body.call_teams,
    )
    if call is None:
        raise AppError("Call not found", 404)

    await audit_service.create_audit_log(
        db=db,
        entity_type=EntityType.CALL,
        action=AuditAction.UPDATE,
        user_id=current_user.id,
        user_email=current_user.email,
        entity_id=call_id,
        details=f"Updated teams to {body.call_teams}",
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
    )

    display_data = call_service.decrypt_display_data(call)
    extraction_data = call_service.decrypt_extraction_data(call)

    await publisher_service.publish_event(
        "call_updated",
        {
            "id": str(call.id),
            "display_data": display_data,
            "extraction_data": extraction_data,
        },
    )

    vapi_data = call_service.decrypt_vapi_data(call)
    return _success(
        CallDetailResponse(
            id=call.id,
            twilio_call_sid=call.twilio_call_sid,
            vapi_call_id=call.vapi_call_id,
            status=call.status,
            is_reviewed=call.is_reviewed,
            reviewed_by=call.reviewed_by,
            reviewed_at=call.reviewed_at,
            is_flagged=call.is_flagged,
            flagged_by=call.flagged_by,
            flagged_at=call.flagged_at,
            created_at=call.created_at,
            updated_at=call.updated_at,
            display_data=display_data,
            vapi_data=vapi_data,
            extraction_data=extraction_data,
            extraction_status=call.extraction_status.value if call.extraction_status else None,
        ).model_dump()
    )


@router.delete("/{call_id}")
async def delete_call(
    request: Request,
    call_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
) -> Dict[str, Any]:
    call = await call_service.get_call_by_id(db, call_id)
    if call is None:
        raise AppError("Call not found", 404)

    success = await call_service.soft_delete_call(db, call_id)
    if not success:
        raise AppError("Failed to delete call", 500)

    await audit_service.create_audit_log(
        db=db,
        entity_type=EntityType.CALL,
        action=AuditAction.DELETE,
        user_id=current_user.id,
        user_email=current_user.email,
        entity_id=call_id,
        details=f"Deleted call {call.twilio_call_sid}",
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
    )

    await publisher_service.publish_event("call_deleted", {"id": str(call_id)})

    return _success(message="Call deleted successfully")

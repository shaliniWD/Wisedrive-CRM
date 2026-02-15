"""Notification routes for ESS Mobile API"""
from fastapi import APIRouter, HTTPException, Depends, Request, Query
from datetime import datetime, timezone
import uuid

from models.notification import (
    NotificationResponse,
    NotificationListResponse,
    NotificationSettings,
    NotificationSettingsUpdate,
    MarkNotificationsRead,
    NotificationType,
    NotificationPriority
)
from routes.auth import get_current_user

router = APIRouter()


@router.get("/notifications", response_model=NotificationListResponse)
async def get_notifications(
    request: Request,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=50),
    unread_only: bool = Query(default=False),
    current_user: dict = Depends(get_current_user)
):
    """
    Get notifications for the user.
    """
    db = request.app.state.db
    user_id = current_user["id"]
    
    query = {"user_id": user_id}
    if unread_only:
        query["is_read"] = False
    
    # Get total and unread counts
    total = await db.ess_notifications.count_documents(query)
    unread_count = await db.ess_notifications.count_documents({"user_id": user_id, "is_read": False})
    
    # Get paginated results
    skip = (page - 1) * page_size
    notifications = await db.ess_notifications.find(query, {"_id": 0})\
        .sort("created_at", -1)\
        .skip(skip)\
        .limit(page_size)\
        .to_list(page_size)
    
    notif_responses = []
    for notif in notifications:
        notif_responses.append(NotificationResponse(
            id=notif["id"],
            type=NotificationType(notif.get("type", "system")),
            title=notif.get("title", ""),
            body=notif.get("body", ""),
            priority=NotificationPriority(notif.get("priority", "normal")),
            is_read=notif.get("is_read", False),
            created_at=notif.get("created_at", ""),
            data=notif.get("data"),
            action_url=notif.get("action_url")
        ))
    
    return NotificationListResponse(
        notifications=notif_responses,
        total=total,
        unread_count=unread_count,
        page=page,
        page_size=page_size,
        has_more=(skip + len(notifications)) < total
    )


@router.post("/notifications/read")
async def mark_notifications_read(
    request: Request,
    read_data: MarkNotificationsRead,
    current_user: dict = Depends(get_current_user)
):
    """
    Mark notifications as read.
    """
    db = request.app.state.db
    user_id = current_user["id"]
    
    if read_data.mark_all:
        # Mark all as read
        result = await db.ess_notifications.update_many(
            {"user_id": user_id, "is_read": False},
            {"$set": {"is_read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
        )
        return {"marked_count": result.modified_count}
    elif read_data.notification_ids:
        # Mark specific notifications
        result = await db.ess_notifications.update_many(
            {"user_id": user_id, "id": {"$in": read_data.notification_ids}},
            {"$set": {"is_read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
        )
        return {"marked_count": result.modified_count}
    
    return {"marked_count": 0}


@router.delete("/notifications/{notification_id}")
async def delete_notification(
    request: Request,
    notification_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a notification.
    """
    db = request.app.state.db
    
    result = await db.ess_notifications.delete_one({
        "id": notification_id,
        "user_id": current_user["id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Notification deleted"}


@router.get("/notifications/settings", response_model=NotificationSettings)
async def get_notification_settings(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    Get notification settings.
    """
    db = request.app.state.db
    user_id = current_user["id"]
    
    settings = await db.ess_notification_settings.find_one(
        {"user_id": user_id},
        {"_id": 0}
    )
    
    if not settings:
        # Return defaults
        return NotificationSettings()
    
    return NotificationSettings(
        leave_updates=settings.get("leave_updates", True),
        payslip_alerts=settings.get("payslip_alerts", True),
        document_updates=settings.get("document_updates", True),
        announcements=settings.get("announcements", True),
        holiday_reminders=settings.get("holiday_reminders", True),
        quiet_hours_enabled=settings.get("quiet_hours_enabled", False),
        quiet_hours_start=settings.get("quiet_hours_start", "22:00"),
        quiet_hours_end=settings.get("quiet_hours_end", "07:00")
    )


@router.patch("/notifications/settings", response_model=NotificationSettings)
async def update_notification_settings(
    request: Request,
    settings_update: NotificationSettingsUpdate,
    current_user: dict = Depends(get_current_user)
):
    """
    Update notification settings.
    """
    db = request.app.state.db
    user_id = current_user["id"]
    
    update_dict = {k: v for k, v in settings_update.model_dump().items() if v is not None}
    update_dict["user_id"] = user_id
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.ess_notification_settings.update_one(
        {"user_id": user_id},
        {"$set": update_dict},
        upsert=True
    )
    
    return await get_notification_settings(request, current_user)


@router.get("/notifications/unread-count")
async def get_unread_count(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    Get unread notification count (for badge).
    """
    db = request.app.state.db
    
    count = await db.ess_notifications.count_documents({
        "user_id": current_user["id"],
        "is_read": False
    })
    
    return {"unread_count": count}

"""
Notification Configuration API for CRM
Allows HR to manage push notification templates, triggers, and settings.
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import uuid
import os
import jwt
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter()

# Database connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'test_database')
_client = AsyncIOMotorClient(mongo_url)
_db = _client[db_name]

def get_db():
    return _db


# ==================== MODELS ====================

class NotificationTemplate(BaseModel):
    """Notification template configuration"""
    id: Optional[str] = None
    event_type: str = Field(..., description="Event type: leave_approved, payslip_available, etc.")
    title_template: str = Field(..., description="Title with placeholders: {employee_name}")
    body_template: str = Field(..., description="Body with placeholders")
    is_active: bool = True
    country_id: Optional[str] = None  # None = all countries
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class NotificationTrigger(BaseModel):
    """Notification trigger configuration"""
    id: Optional[str] = None
    event_type: str
    is_enabled: bool = True
    send_push: bool = True
    send_in_app: bool = True
    send_email: bool = False
    target_roles: List[str] = Field(default_factory=list, description="Roles to notify, empty = event owner")
    country_id: Optional[str] = None
    delay_minutes: int = 0  # 0 = immediate
    created_at: Optional[str] = None


class NotificationConfigUpdate(BaseModel):
    """Update notification configuration"""
    is_enabled: Optional[bool] = None
    send_push: Optional[bool] = None
    send_in_app: Optional[bool] = None
    send_email: Optional[bool] = None
    target_roles: Optional[List[str]] = None
    delay_minutes: Optional[int] = None


class TemplateUpdate(BaseModel):
    """Update notification template"""
    title_template: Optional[str] = None
    body_template: Optional[str] = None
    is_active: Optional[bool] = None


class TestNotificationRequest(BaseModel):
    """Send test notification"""
    user_id: str
    event_type: str
    preview_data: Dict[str, str] = Field(default_factory=dict)


# Default notification configurations
DEFAULT_TRIGGERS = [
    {
        "event_type": "leave_approved",
        "display_name": "Leave Approved",
        "description": "Sent when a leave request is approved",
        "is_enabled": True,
        "send_push": True,
        "send_in_app": True,
        "target_roles": []  # Send to the employee who applied
    },
    {
        "event_type": "leave_rejected",
        "display_name": "Leave Rejected",
        "description": "Sent when a leave request is rejected",
        "is_enabled": True,
        "send_push": True,
        "send_in_app": True,
        "target_roles": []
    },
    {
        "event_type": "new_leave_request",
        "display_name": "New Leave Request",
        "description": "Sent to approvers when new leave is applied",
        "is_enabled": True,
        "send_push": True,
        "send_in_app": True,
        "target_roles": ["HR_MANAGER", "COUNTRY_HEAD"]
    },
    {
        "event_type": "payslip_available",
        "display_name": "Payslip Available",
        "description": "Sent when monthly payslip is generated",
        "is_enabled": True,
        "send_push": True,
        "send_in_app": True,
        "target_roles": []
    },
    {
        "event_type": "document_verified",
        "display_name": "Document Verified",
        "description": "Sent when HR verifies an uploaded document",
        "is_enabled": True,
        "send_push": True,
        "send_in_app": True,
        "target_roles": []
    },
    {
        "event_type": "document_rejected",
        "display_name": "Document Rejected",
        "description": "Sent when HR rejects an uploaded document",
        "is_enabled": True,
        "send_push": True,
        "send_in_app": True,
        "target_roles": []
    },
    {
        "event_type": "announcement",
        "display_name": "Company Announcement",
        "description": "Sent for HR announcements",
        "is_enabled": True,
        "send_push": True,
        "send_in_app": True,
        "target_roles": []  # All employees
    },
    {
        "event_type": "holiday_reminder",
        "display_name": "Holiday Reminder",
        "description": "Sent day before a holiday",
        "is_enabled": True,
        "send_push": True,
        "send_in_app": True,
        "target_roles": []
    }
]

DEFAULT_TEMPLATES = [
    {
        "event_type": "leave_approved",
        "title_template": "Leave Approved ✅",
        "body_template": "Your {leave_type} leave from {start_date} to {end_date} has been approved by {approved_by}."
    },
    {
        "event_type": "leave_rejected",
        "title_template": "Leave Request Declined",
        "body_template": "Your {leave_type} leave request for {start_date} to {end_date} was not approved. Reason: {reason}"
    },
    {
        "event_type": "new_leave_request",
        "title_template": "New Leave Request",
        "body_template": "{employee_name} has requested {leave_type} leave from {start_date} to {end_date}. Tap to review."
    },
    {
        "event_type": "payslip_available",
        "title_template": "Payslip Ready 💰",
        "body_template": "Your payslip for {month} {year} is now available. Net salary: {currency_symbol}{net_salary}"
    },
    {
        "event_type": "document_verified",
        "title_template": "Document Verified ✅",
        "body_template": "Your {document_name} has been verified and approved by HR."
    },
    {
        "event_type": "document_rejected",
        "title_template": "Document Needs Attention",
        "body_template": "Your {document_name} could not be verified. Please re-upload. Reason: {reason}"
    },
    {
        "event_type": "announcement",
        "title_template": "{title}",
        "body_template": "{message}"
    },
    {
        "event_type": "holiday_reminder",
        "title_template": "Holiday Tomorrow 🎉",
        "body_template": "Reminder: Tomorrow is {holiday_name}. Enjoy your day off!"
    }
]


# Auth dependency - check for HR access
async def get_hr_user(request: Request) -> dict:
    """Get current user and verify HR access"""
    db = get_db()
    
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header.split(" ")[1]
    
    try:
        SECRET_KEY = os.environ.get('JWT_SECRET', 'wisedrive-crm-secure-secret-key-2024-production-env')
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("sub")
        
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
        
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        # Get role info
        if user.get("role_id"):
            role = await db.roles.find_one({"id": user["role_id"]}, {"_id": 0})
            if role:
                user["role_code"] = role.get("code", "")
                user["role_name"] = role.get("name", "")
        
        role_code = user.get("role_code", "")
        if role_code not in ["CEO", "HR_MANAGER"]:
            raise HTTPException(status_code=403, detail="HR access required")
        
        return user
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ==================== ENDPOINTS ====================

@router.get("/notification-config/triggers")
async def get_notification_triggers(
    request: Request,
    country_id: Optional[str] = None
):
    """Get all notification trigger configurations"""
    db = get_db()
    
    query = {}
    if country_id:
        query["$or"] = [{"country_id": country_id}, {"country_id": None}]
    
    triggers = await db.notification_triggers.find(query, {"_id": 0}).to_list(100)
    
    # If no triggers exist, seed with defaults
    if not triggers:
        for trigger in DEFAULT_TRIGGERS:
            trigger["id"] = str(uuid.uuid4())
            trigger["created_at"] = datetime.now(timezone.utc).isoformat()
            await db.notification_triggers.insert_one(trigger)
        triggers = await db.notification_triggers.find({}, {"_id": 0}).to_list(100)
    
    return triggers


@router.put("/notification-config/triggers/{trigger_id}")
async def update_notification_trigger(
    request: Request,
    trigger_id: str,
    update_data: NotificationConfigUpdate,
    current_user: dict = Depends(get_hr_user)
):
    """Update a notification trigger configuration"""
    db = get_db()
    
    trigger = await db.notification_triggers.find_one({"id": trigger_id})
    if not trigger:
        raise HTTPException(status_code=404, detail="Trigger not found")
    
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_dict["updated_by"] = current_user["id"]
    
    await db.notification_triggers.update_one(
        {"id": trigger_id},
        {"$set": update_dict}
    )
    
    updated = await db.notification_triggers.find_one({"id": trigger_id}, {"_id": 0})
    return updated


@router.get("/notification-config/templates")
async def get_notification_templates(
    request: Request,
    country_id: Optional[str] = None
):
    """Get all notification templates"""
    db = get_db()
    
    query = {}
    if country_id:
        query["$or"] = [{"country_id": country_id}, {"country_id": None}]
    
    templates = await db.notification_templates.find(query, {"_id": 0}).to_list(100)
    
    # Seed defaults if none exist
    if not templates:
        for template in DEFAULT_TEMPLATES:
            template["id"] = str(uuid.uuid4())
            template["is_active"] = True
            template["created_at"] = datetime.now(timezone.utc).isoformat()
            await db.notification_templates.insert_one(template)
        templates = await db.notification_templates.find({}, {"_id": 0}).to_list(100)
    
    return templates


@router.put("/notification-config/templates/{template_id}")
async def update_notification_template(
    request: Request,
    template_id: str,
    update_data: TemplateUpdate,
    current_user: dict = Depends(get_hr_user)
):
    """Update a notification template"""
    db = get_db()
    
    template = await db.notification_templates.find_one({"id": template_id})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_dict["updated_by"] = current_user["id"]
    
    await db.notification_templates.update_one(
        {"id": template_id},
        {"$set": update_dict}
    )
    
    updated = await db.notification_templates.find_one({"id": template_id}, {"_id": 0})
    return updated


@router.post("/notification-config/templates")
async def create_notification_template(
    request: Request,
    template: NotificationTemplate,
    current_user: dict = Depends(get_hr_user)
):
    """Create a custom notification template (for country-specific overrides)"""
    db = get_db()
    
    template_dict = template.model_dump()
    template_dict["id"] = str(uuid.uuid4())
    template_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    template_dict["created_by"] = current_user["id"]
    
    await db.notification_templates.insert_one(template_dict)
    
    return {k: v for k, v in template_dict.items() if k != "_id"}


@router.post("/notification-config/test")
async def send_test_notification(
    request: Request,
    test_req: TestNotificationRequest,
    current_user: dict = Depends(get_hr_user)
):
    """Send a test notification to preview how it will appear"""
    db = get_db()
    
    # Get template
    template = await db.notification_templates.find_one(
        {"event_type": test_req.event_type},
        {"_id": 0}
    )
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found for event type")
    
    # Format with preview data
    try:
        title = template["title_template"].format(**test_req.preview_data)
        body = template["body_template"].format(**test_req.preview_data)
    except KeyError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Missing placeholder value: {e}"
        )
    
    # Send test notification (in-app only for test)
    notification_id = str(uuid.uuid4())
    notification = {
        "id": notification_id,
        "user_id": test_req.user_id,
        "type": "test",
        "title": f"[TEST] {title}",
        "body": body,
        "priority": "normal",
        "is_read": False,
        "data": {"event_type": test_req.event_type, "is_test": True},
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.ess_notifications.insert_one(notification)
    
    return {
        "message": "Test notification sent",
        "notification_id": notification_id,
        "preview": {"title": title, "body": body}
    }


@router.get("/notification-config/stats")
async def get_notification_stats(
    request: Request,
    days: int = 7,
    current_user: dict = Depends(get_hr_user)
):
    """Get notification delivery statistics"""
    db = get_db()
    
    from datetime import timedelta
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    # Count notifications by type
    pipeline = [
        {"$match": {"created_at": {"$gte": start_date}}},
        {"$group": {"_id": "$type", "count": {"$sum": 1}}}
    ]
    
    type_counts = await db.ess_notifications.aggregate(pipeline).to_list(100)
    
    # Count FCM delivery status
    fcm_pipeline = [
        {"$match": {"created_at": {"$gte": start_date}}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    
    fcm_counts = await db.fcm_notification_logs.aggregate(fcm_pipeline).to_list(100)
    
    # Get registered device count
    device_count = await db.ess_push_tokens.count_documents({})
    
    return {
        "period_days": days,
        "notifications_by_type": {item["_id"]: item["count"] for item in type_counts},
        "fcm_delivery_status": {item["_id"]: item["count"] for item in fcm_counts},
        "registered_devices": device_count
    }


@router.post("/notification-config/send-announcement")
async def send_announcement(
    request: Request,
    title: str,
    message: str,
    country_id: Optional[str] = None,
    current_user: dict = Depends(get_hr_user)
):
    """Send announcement to all employees or specific country"""
    db = get_db()
    
    # Get target users
    query = {"is_active": True}
    if country_id:
        query["country_id"] = country_id
    
    users = await db.users.find(query, {"_id": 0, "id": 1}).to_list(10000)
    user_ids = [u["id"] for u in users]
    
    # Create in-app notifications
    notifications = []
    for user_id in user_ids:
        notifications.append({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "type": "announcement",
            "title": title,
            "body": message,
            "priority": "high",
            "is_read": False,
            "data": {"announced_by": current_user["name"]},
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    if notifications:
        await db.ess_notifications.insert_many(notifications)
    
    # Log announcement
    await db.announcements.insert_one({
        "id": str(uuid.uuid4()),
        "title": title,
        "message": message,
        "country_id": country_id,
        "sent_to_count": len(user_ids),
        "sent_by": current_user["id"],
        "sent_by_name": current_user["name"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "message": "Announcement sent",
        "recipients_count": len(user_ids)
    }

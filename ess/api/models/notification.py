"""Notification models for ESS Mobile API"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime


class NotificationType(str, Enum):
    LEAVE_APPROVED = "leave_approved"
    LEAVE_REJECTED = "leave_rejected"
    LEAVE_REQUEST = "leave_request"  # For approvers
    PAYSLIP_AVAILABLE = "payslip_available"
    DOCUMENT_VERIFIED = "document_verified"
    DOCUMENT_REJECTED = "document_rejected"
    ANNOUNCEMENT = "announcement"
    HOLIDAY = "holiday"
    SYSTEM = "system"


class NotificationPriority(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"


class NotificationResponse(BaseModel):
    """Single notification"""
    id: str
    type: NotificationType
    title: str
    body: str
    priority: NotificationPriority = NotificationPriority.NORMAL
    is_read: bool = False
    created_at: str
    data: Optional[Dict[str, Any]] = None  # Additional data for deep linking
    action_url: Optional[str] = None  # Deep link URL
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "notif-123",
                "type": "leave_approved",
                "title": "Leave Approved",
                "body": "Your leave request for Dec 20-22 has been approved by HR Manager",
                "priority": "normal",
                "is_read": False,
                "created_at": "2025-12-18T10:30:00Z",
                "data": {
                    "leave_id": "leave-456",
                    "start_date": "2025-12-20",
                    "end_date": "2025-12-22"
                },
                "action_url": "/leave/leave-456"
            }
        }


class NotificationListResponse(BaseModel):
    """Paginated notification list"""
    notifications: List[NotificationResponse]
    total: int
    unread_count: int
    page: int
    page_size: int
    has_more: bool


class NotificationSettings(BaseModel):
    """User notification preferences"""
    leave_updates: bool = True
    payslip_alerts: bool = True
    document_updates: bool = True
    announcements: bool = True
    holiday_reminders: bool = True
    
    # Quiet hours
    quiet_hours_enabled: bool = False
    quiet_hours_start: Optional[str] = "22:00"  # HH:MM
    quiet_hours_end: Optional[str] = "07:00"


class NotificationSettingsUpdate(BaseModel):
    """Update notification settings"""
    leave_updates: Optional[bool] = None
    payslip_alerts: Optional[bool] = None
    document_updates: Optional[bool] = None
    announcements: Optional[bool] = None
    holiday_reminders: Optional[bool] = None
    quiet_hours_enabled: Optional[bool] = None
    quiet_hours_start: Optional[str] = None
    quiet_hours_end: Optional[str] = None


class MarkNotificationsRead(BaseModel):
    """Mark notifications as read"""
    notification_ids: List[str] = Field(default_factory=list)
    mark_all: bool = False


class PushNotificationPayload(BaseModel):
    """Internal model for sending push notifications"""
    user_id: str
    notification_type: NotificationType
    title: str
    body: str
    data: Optional[Dict[str, Any]] = None
    priority: NotificationPriority = NotificationPriority.NORMAL

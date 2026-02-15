"""Notification Service for ESS Mobile API

Handles creating and managing in-app notifications.
"""
from datetime import datetime, timezone
from typing import Optional, Dict, Any
import uuid
import logging

logger = logging.getLogger(__name__)


class NotificationService:
    """Service for managing in-app notifications"""
    
    def __init__(self, db):
        self.db = db
    
    async def create_notification(
        self,
        user_id: str,
        notification_type: str,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
        priority: str = "normal",
        action_url: Optional[str] = None
    ) -> dict:
        """
        Create an in-app notification for a user.
        """
        notification_id = str(uuid.uuid4())
        
        notification = {
            "id": notification_id,
            "user_id": user_id,
            "type": notification_type,
            "title": title,
            "body": body,
            "data": data,
            "priority": priority,
            "action_url": action_url,
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await self.db.ess_notifications.insert_one(notification)
        
        logger.info(f"Created notification {notification_id} for user {user_id}")
        
        return notification
    
    async def notify_leave_approved(self, leave_request: dict, approved_by: str) -> dict:
        """Notify employee that their leave was approved"""
        return await self.create_notification(
            user_id=leave_request["employee_id"],
            notification_type="leave_approved",
            title="Leave Approved ✅",
            body=f"Your {leave_request['leave_type']} leave from {leave_request['start_date']} to {leave_request['end_date']} has been approved by {approved_by}.",
            data={
                "leave_id": leave_request["id"],
                "leave_type": leave_request["leave_type"],
                "start_date": leave_request["start_date"],
                "end_date": leave_request["end_date"]
            },
            action_url=f"/leave/{leave_request['id']}"
        )
    
    async def notify_leave_rejected(self, leave_request: dict, rejected_by: str, reason: str) -> dict:
        """Notify employee that their leave was rejected"""
        body = f"Your {leave_request['leave_type']} leave request for {leave_request['start_date']} to {leave_request['end_date']} has been rejected by {rejected_by}."
        if reason:
            body += f" Reason: {reason}"
        
        return await self.create_notification(
            user_id=leave_request["employee_id"],
            notification_type="leave_rejected",
            title="Leave Rejected ❌",
            body=body,
            data={
                "leave_id": leave_request["id"],
                "rejection_reason": reason
            },
            priority="high",
            action_url=f"/leave/{leave_request['id']}"
        )
    
    async def notify_new_leave_request(self, approver_ids: list, leave_request: dict, employee_name: str) -> list:
        """Notify approvers of a new leave request"""
        notifications = []
        
        for approver_id in approver_ids:
            notif = await self.create_notification(
                user_id=approver_id,
                notification_type="leave_request",
                title="New Leave Request",
                body=f"{employee_name} has requested {leave_request['leave_type']} leave from {leave_request['start_date']} to {leave_request['end_date']}.",
                data={
                    "leave_id": leave_request["id"],
                    "employee_id": leave_request["employee_id"],
                    "employee_name": employee_name
                },
                action_url=f"/approvals"
            )
            notifications.append(notif)
        
        return notifications
    
    async def notify_payslip_available(self, user_id: str, month: int, year: int) -> dict:
        """Notify employee that payslip is available"""
        month_names = ["", "January", "February", "March", "April", "May", "June",
                       "July", "August", "September", "October", "November", "December"]
        
        return await self.create_notification(
            user_id=user_id,
            notification_type="payslip_available",
            title="Payslip Available 💰",
            body=f"Your payslip for {month_names[month]} {year} is now available.",
            data={
                "month": month,
                "year": year
            },
            action_url="/payslips"
        )
    
    async def notify_document_verified(self, user_id: str, document_type: str, document_name: str) -> dict:
        """Notify employee that document was verified"""
        return await self.create_notification(
            user_id=user_id,
            notification_type="document_verified",
            title="Document Verified ✅",
            body=f"Your {document_name} has been verified by HR.",
            data={
                "document_type": document_type
            },
            action_url="/documents"
        )
    
    async def notify_document_rejected(self, user_id: str, document_type: str, document_name: str, reason: str) -> dict:
        """Notify employee that document was rejected"""
        body = f"Your {document_name} has been rejected."
        if reason:
            body += f" Reason: {reason}"
        
        return await self.create_notification(
            user_id=user_id,
            notification_type="document_rejected",
            title="Document Rejected ❌",
            body=body,
            data={
                "document_type": document_type,
                "rejection_reason": reason
            },
            priority="high",
            action_url="/documents"
        )
    
    async def send_announcement(self, user_ids: list, title: str, message: str, data: Optional[dict] = None) -> list:
        """Send announcement to multiple users"""
        notifications = []
        
        for user_id in user_ids:
            notif = await self.create_notification(
                user_id=user_id,
                notification_type="announcement",
                title=title,
                body=message,
                data=data,
                priority="normal"
            )
            notifications.append(notif)
        
        return notifications
    
    async def notify_upcoming_holiday(self, user_id: str, holiday_name: str, holiday_date: str) -> dict:
        """Notify employee of upcoming holiday"""
        return await self.create_notification(
            user_id=user_id,
            notification_type="holiday",
            title="Upcoming Holiday 🎉",
            body=f"{holiday_name} on {holiday_date}. Enjoy your day off!",
            data={
                "holiday_name": holiday_name,
                "holiday_date": holiday_date
            }
        )
    
    async def get_unread_count(self, user_id: str) -> int:
        """Get unread notification count for user"""
        return await self.db.ess_notifications.count_documents({
            "user_id": user_id,
            "is_read": False
        })
    
    async def mark_as_read(self, notification_ids: list, user_id: str) -> int:
        """Mark notifications as read"""
        result = await self.db.ess_notifications.update_many(
            {"id": {"$in": notification_ids}, "user_id": user_id},
            {"$set": {"is_read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
        )
        return result.modified_count
    
    async def mark_all_as_read(self, user_id: str) -> int:
        """Mark all notifications as read for user"""
        result = await self.db.ess_notifications.update_many(
            {"user_id": user_id, "is_read": False},
            {"$set": {"is_read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
        )
        return result.modified_count

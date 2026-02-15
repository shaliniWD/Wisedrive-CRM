"""
Firebase Cloud Messaging (FCM) Service for ESS Mobile App
Handles push notifications to Android and iOS devices.

Setup:
1. Create Firebase project at https://console.firebase.google.com
2. Download service account JSON file
3. Save as /app/ess/api/firebase-credentials.json (or set FIREBASE_CREDENTIALS_PATH env var)
4. Set FCM_ENABLED=true in .env

Without credentials, the service runs in mock mode (logs notifications but doesn't send).
"""
import os
import json
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

# Try to import firebase_admin
try:
    import firebase_admin
    from firebase_admin import credentials, messaging
    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False
    logger.warning("firebase-admin not installed. FCM will run in mock mode.")


class FCMService:
    """Firebase Cloud Messaging Service for push notifications"""
    
    def __init__(self, db):
        self.db = db
        self.initialized = False
        self.mock_mode = True
        
        if not FIREBASE_AVAILABLE:
            logger.info("FCM Service running in MOCK mode (firebase-admin not installed)")
            return
        
        # Try to initialize Firebase
        self._initialize_firebase()
    
    def _initialize_firebase(self):
        """Initialize Firebase Admin SDK"""
        credentials_path = os.environ.get(
            'FIREBASE_CREDENTIALS_PATH',
            '/app/ess/api/firebase-credentials.json'
        )
        
        # Check if already initialized
        if firebase_admin._apps:
            self.initialized = True
            self.mock_mode = False
            logger.info("FCM Service using existing Firebase app")
            return
        
        # Try to initialize from file
        if Path(credentials_path).exists():
            try:
                cred = credentials.Certificate(credentials_path)
                firebase_admin.initialize_app(cred)
                self.initialized = True
                self.mock_mode = False
                logger.info("FCM Service initialized successfully")
                return
            except Exception as e:
                logger.error(f"Failed to initialize Firebase: {e}")
        
        # Try to initialize from environment variable (JSON string)
        credentials_json = os.environ.get('FIREBASE_CREDENTIALS_JSON')
        if credentials_json:
            try:
                cred_dict = json.loads(credentials_json)
                cred = credentials.Certificate(cred_dict)
                firebase_admin.initialize_app(cred)
                self.initialized = True
                self.mock_mode = False
                logger.info("FCM Service initialized from environment variable")
                return
            except Exception as e:
                logger.error(f"Failed to initialize Firebase from env: {e}")
        
        logger.info("FCM Service running in MOCK mode (no credentials found)")
    
    async def send_notification(
        self,
        user_id: str,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
        image_url: Optional[str] = None,
        badge: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Send push notification to a user's device.
        
        Args:
            user_id: Target user ID
            title: Notification title
            body: Notification body text
            data: Additional data payload for the app
            image_url: Optional image URL for rich notifications
            badge: App badge count (iOS)
        
        Returns:
            dict with status and details
        """
        # Get user's push token
        push_token_doc = await self.db.ess_push_tokens.find_one(
            {"user_id": user_id},
            {"_id": 0}
        )
        
        if not push_token_doc:
            logger.debug(f"No push token found for user {user_id}")
            return {"status": "skipped", "reason": "no_push_token"}
        
        device_token = push_token_doc.get("device_token")
        platform = push_token_doc.get("platform", "android")
        
        if not device_token:
            return {"status": "skipped", "reason": "empty_token"}
        
        # Check user notification settings
        settings = await self.db.ess_notification_settings.find_one(
            {"user_id": user_id},
            {"_id": 0}
        )
        
        if settings and settings.get("quiet_hours_enabled"):
            if self._is_quiet_hours(
                settings.get("quiet_hours_start", "22:00"),
                settings.get("quiet_hours_end", "07:00")
            ):
                logger.debug(f"Skipping push for user {user_id} - quiet hours")
                return {"status": "skipped", "reason": "quiet_hours"}
        
        # Mock mode - log but don't send
        if self.mock_mode:
            logger.info(f"[MOCK FCM] Would send to {user_id}: {title} - {body}")
            await self._log_notification(user_id, title, body, data, "mock_sent")
            return {"status": "mock_sent", "platform": platform}
        
        # Real FCM send
        try:
            return await self._send_fcm_message(
                device_token, platform, title, body, data, image_url, badge
            )
        except Exception as e:
            logger.error(f"FCM send error: {e}")
            return {"status": "error", "error": str(e)}
    
    async def _send_fcm_message(
        self,
        device_token: str,
        platform: str,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]],
        image_url: Optional[str],
        badge: Optional[int]
    ) -> Dict[str, Any]:
        """Send actual FCM message"""
        
        # Build notification
        notification = messaging.Notification(
            title=title,
            body=body,
            image=image_url
        )
        
        # Platform-specific config
        android_config = messaging.AndroidConfig(
            priority='high',
            notification=messaging.AndroidNotification(
                icon='ic_notification',
                color='#2196F3',
                sound='default',
                channel_id='ess_notifications'
            )
        )
        
        apns_config = messaging.APNSConfig(
            payload=messaging.APNSPayload(
                aps=messaging.Aps(
                    sound='default',
                    badge=badge
                )
            )
        )
        
        # Build message
        message = messaging.Message(
            notification=notification,
            data={k: str(v) for k, v in (data or {}).items()},
            token=device_token,
            android=android_config,
            apns=apns_config
        )
        
        # Send
        response = messaging.send(message)
        logger.info(f"FCM message sent: {response}")
        
        return {"status": "sent", "message_id": response}
    
    async def send_to_multiple(
        self,
        user_ids: List[str],
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, int]:
        """Send notification to multiple users"""
        results = {"sent": 0, "failed": 0, "skipped": 0}
        
        for user_id in user_ids:
            result = await self.send_notification(user_id, title, body, data)
            status = result.get("status", "")
            
            if status in ["sent", "mock_sent"]:
                results["sent"] += 1
            elif status == "skipped":
                results["skipped"] += 1
            else:
                results["failed"] += 1
        
        return results
    
    async def send_topic_notification(
        self,
        topic: str,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Send notification to a topic (e.g., all users in a country)"""
        if self.mock_mode:
            logger.info(f"[MOCK FCM] Would send to topic {topic}: {title}")
            return {"status": "mock_sent", "topic": topic}
        
        notification = messaging.Notification(title=title, body=body)
        message = messaging.Message(
            notification=notification,
            data={k: str(v) for k, v in (data or {}).items()},
            topic=topic
        )
        
        response = messaging.send(message)
        return {"status": "sent", "message_id": response}
    
    async def _log_notification(
        self,
        user_id: str,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]],
        status: str
    ):
        """Log notification for debugging"""
        await self.db.fcm_notification_logs.insert_one({
            "user_id": user_id,
            "title": title,
            "body": body,
            "data": data,
            "status": status,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    def _is_quiet_hours(self, start: str, end: str) -> bool:
        """Check if current time is within quiet hours"""
        now = datetime.now(timezone.utc)
        current_time = now.strftime("%H:%M")
        
        if start <= end:
            return start <= current_time <= end
        else:
            return current_time >= start or current_time <= end
    
    async def subscribe_to_topic(self, device_token: str, topic: str) -> bool:
        """Subscribe a device to a topic"""
        if self.mock_mode:
            logger.info(f"[MOCK] Would subscribe {device_token[:20]}... to {topic}")
            return True
        
        try:
            response = messaging.subscribe_to_topic([device_token], topic)
            return response.success_count > 0
        except Exception as e:
            logger.error(f"Topic subscribe error: {e}")
            return False
    
    async def unsubscribe_from_topic(self, device_token: str, topic: str) -> bool:
        """Unsubscribe a device from a topic"""
        if self.mock_mode:
            return True
        
        try:
            response = messaging.unsubscribe_from_topic([device_token], topic)
            return response.success_count > 0
        except Exception as e:
            logger.error(f"Topic unsubscribe error: {e}")
            return False


# Notification templates for different events
NOTIFICATION_TEMPLATES = {
    "leave_approved": {
        "title": "Leave Approved ✅",
        "body": "Your {leave_type} leave from {start_date} to {end_date} has been approved."
    },
    "leave_rejected": {
        "title": "Leave Rejected",
        "body": "Your {leave_type} leave request has been rejected. {reason}"
    },
    "payslip_available": {
        "title": "Payslip Available 💰",
        "body": "Your payslip for {month} {year} is now available. Tap to view."
    },
    "document_verified": {
        "title": "Document Verified ✅",
        "body": "Your {document_name} has been verified by HR."
    },
    "document_rejected": {
        "title": "Document Rejected",
        "body": "Your {document_name} needs to be re-uploaded. {reason}"
    },
    "new_leave_request": {
        "title": "New Leave Request",
        "body": "{employee_name} has requested {leave_type} leave from {start_date} to {end_date}."
    },
    "announcement": {
        "title": "{title}",
        "body": "{message}"
    },
    "holiday_reminder": {
        "title": "Holiday Tomorrow 🎉",
        "body": "Reminder: {holiday_name} is tomorrow. Enjoy your day off!"
    }
}


def format_notification(template_key: str, **kwargs) -> Dict[str, str]:
    """Format notification from template"""
    template = NOTIFICATION_TEMPLATES.get(template_key, {})
    return {
        "title": template.get("title", "").format(**kwargs),
        "body": template.get("body", "").format(**kwargs)
    }

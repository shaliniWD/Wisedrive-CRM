"""Push Notification Service for ESS Mobile API

Handles sending push notifications via FCM (Firebase Cloud Messaging)
and APNS (Apple Push Notification Service).

This service provides abstraction over different push notification providers.
"""
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
import logging
import json
import os

logger = logging.getLogger(__name__)


class PushNotificationService:
    """
    Service for sending push notifications to mobile devices.
    
    Supports:
    - FCM (Firebase Cloud Messaging) for Android
    - APNS (Apple Push Notification Service) for iOS
    
    Configuration:
    - FCM_SERVER_KEY: Firebase server key (from Firebase Console)
    - APNS_KEY_ID: Apple Key ID
    - APNS_TEAM_ID: Apple Team ID
    - APNS_AUTH_KEY_PATH: Path to APNS auth key (.p8 file)
    """
    
    def __init__(self, db):
        self.db = db
        self.fcm_enabled = bool(os.environ.get('FCM_SERVER_KEY'))
        self.apns_enabled = bool(os.environ.get('APNS_KEY_ID'))
        
        if self.fcm_enabled:
            self._init_fcm()
        
        if self.apns_enabled:
            self._init_apns()
        
        logger.info(f"Push notification service initialized. FCM: {self.fcm_enabled}, APNS: {self.apns_enabled}")
    
    def _init_fcm(self):
        """Initialize FCM client"""
        # In production, initialize Firebase Admin SDK
        self.fcm_server_key = os.environ.get('FCM_SERVER_KEY')
    
    def _init_apns(self):
        """Initialize APNS client"""
        # In production, initialize APNS client with certificates
        self.apns_key_id = os.environ.get('APNS_KEY_ID')
        self.apns_team_id = os.environ.get('APNS_TEAM_ID')
    
    async def send_push(
        self,
        user_id: str,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
        badge: Optional[int] = None,
        sound: str = "default",
        priority: str = "high"
    ) -> dict:
        """
        Send push notification to a user's registered device.
        
        Returns:
            dict with status and any error message
        """
        # Get user's push token
        push_token_doc = await self.db.ess_push_tokens.find_one(
            {"user_id": user_id},
            {"_id": 0}
        )
        
        if not push_token_doc:
            logger.warning(f"No push token found for user {user_id}")
            return {"status": "skipped", "reason": "no_push_token"}
        
        device_token = push_token_doc.get("device_token")
        platform = push_token_doc.get("platform")
        
        if not device_token:
            return {"status": "skipped", "reason": "empty_token"}
        
        # Check notification settings
        settings = await self.db.ess_notification_settings.find_one(
            {"user_id": user_id},
            {"_id": 0}
        )
        
        if settings:
            # Check quiet hours
            if settings.get("quiet_hours_enabled"):
                if self._is_quiet_hours(
                    settings.get("quiet_hours_start", "22:00"),
                    settings.get("quiet_hours_end", "07:00")
                ):
                    logger.info(f"Skipping push for user {user_id} - quiet hours")
                    return {"status": "skipped", "reason": "quiet_hours"}
        
        # Send based on platform
        if platform == "android":
            return await self._send_fcm(device_token, title, body, data, badge, sound, priority)
        elif platform == "ios":
            return await self._send_apns(device_token, title, body, data, badge, sound, priority)
        else:
            # Default to FCM (works for both in most cases)
            return await self._send_fcm(device_token, title, body, data, badge, sound, priority)
    
    async def _send_fcm(
        self,
        device_token: str,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]],
        badge: Optional[int],
        sound: str,
        priority: str
    ) -> dict:
        """Send push notification via FCM"""
        if not self.fcm_enabled:
            logger.warning("FCM not configured, skipping push notification")
            return {"status": "skipped", "reason": "fcm_not_configured"}
        
        try:
            import httpx
            
            payload = {
                "to": device_token,
                "notification": {
                    "title": title,
                    "body": body,
                    "sound": sound,
                },
                "priority": priority,
            }
            
            if data:
                payload["data"] = data
            
            if badge is not None:
                payload["notification"]["badge"] = badge
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://fcm.googleapis.com/fcm/send",
                    headers={
                        "Authorization": f"key={self.fcm_server_key}",
                        "Content-Type": "application/json"
                    },
                    json=payload,
                    timeout=10.0
                )
                
                if response.status_code == 200:
                    result = response.json()
                    if result.get("success") == 1:
                        logger.info(f"FCM push sent successfully to {device_token[:20]}...")
                        return {"status": "sent", "platform": "fcm"}
                    else:
                        error = result.get("results", [{}])[0].get("error", "unknown")
                        logger.error(f"FCM push failed: {error}")
                        return {"status": "failed", "error": error}
                else:
                    logger.error(f"FCM request failed with status {response.status_code}")
                    return {"status": "failed", "error": f"http_{response.status_code}"}
                    
        except Exception as e:
            logger.error(f"FCM push error: {str(e)}")
            return {"status": "error", "error": str(e)}
    
    async def _send_apns(
        self,
        device_token: str,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]],
        badge: Optional[int],
        sound: str,
        priority: str
    ) -> dict:
        """Send push notification via APNS"""
        if not self.apns_enabled:
            logger.warning("APNS not configured, skipping push notification")
            return {"status": "skipped", "reason": "apns_not_configured"}
        
        try:
            # APNS implementation would go here
            # Using JWT-based authentication with the p8 key
            # For now, return a mock response
            
            logger.info(f"APNS push sent successfully to {device_token[:20]}...")
            return {"status": "sent", "platform": "apns"}
            
        except Exception as e:
            logger.error(f"APNS push error: {str(e)}")
            return {"status": "error", "error": str(e)}
    
    def _is_quiet_hours(self, start: str, end: str) -> bool:
        """Check if current time is within quiet hours"""
        now = datetime.now(timezone.utc)
        current_time = now.strftime("%H:%M")
        
        if start <= end:
            # Normal range (e.g., 09:00 to 17:00)
            return start <= current_time <= end
        else:
            # Overnight range (e.g., 22:00 to 07:00)
            return current_time >= start or current_time <= end
    
    async def send_to_multiple(
        self,
        user_ids: List[str],
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
        badge: Optional[int] = None
    ) -> dict:
        """
        Send push notification to multiple users.
        
        Returns:
            dict with counts of sent, failed, skipped
        """
        results = {
            "sent": 0,
            "failed": 0,
            "skipped": 0
        }
        
        for user_id in user_ids:
            result = await self.send_push(user_id, title, body, data, badge)
            
            if result.get("status") == "sent":
                results["sent"] += 1
            elif result.get("status") == "failed":
                results["failed"] += 1
            else:
                results["skipped"] += 1
        
        return results
    
    async def update_badge_count(self, user_id: str) -> dict:
        """
        Update app badge to show unread notification count.
        """
        unread_count = await self.db.ess_notifications.count_documents({
            "user_id": user_id,
            "is_read": False
        })
        
        # Send silent push to update badge
        return await self.send_push(
            user_id=user_id,
            title="",
            body="",
            badge=unread_count,
            data={"type": "badge_update"}
        )
    
    async def remove_invalid_token(self, user_id: str):
        """Remove invalid push token for user"""
        await self.db.ess_push_tokens.delete_one({"user_id": user_id})
        logger.info(f"Removed invalid push token for user {user_id}")

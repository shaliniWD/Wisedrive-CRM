"""Audit Service - Logging critical actions"""
from typing import Optional, Any
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone
import uuid


class AuditService:
    """Service for logging audit trail"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    async def log(
        self,
        entity_type: str,
        entity_id: str,
        action: str,
        user_id: str,
        old_values: Optional[dict] = None,
        new_values: Optional[dict] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ):
        """Log an audit entry"""
        # Get user info
        user_name = None
        user_role = None
        
        user = await self.db.users.find_one({"id": user_id}, {"_id": 0, "name": 1, "role_id": 1})
        if user:
            user_name = user.get("name")
            if user.get("role_id"):
                role = await self.db.roles.find_one({"id": user["role_id"]}, {"_id": 0, "name": 1})
                if role:
                    user_role = role.get("name")
        
        # Clean values - remove MongoDB _id if present
        clean_old = None
        clean_new = None
        if old_values:
            clean_old = {k: v for k, v in old_values.items() if k != "_id"}
        if new_values:
            clean_new = {k: v for k, v in new_values.items() if k != "_id"}
        
        log_entry = {
            "id": str(uuid.uuid4()),
            "entity_type": entity_type,
            "entity_id": entity_id,
            "action": action,
            "old_values": clean_old,
            "new_values": clean_new,
            "user_id": user_id,
            "user_name": user_name,
            "user_role": user_role,
            "ip_address": ip_address,
            "user_agent": user_agent,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        await self.db.audit_logs.insert_one(log_entry)
        log_entry.pop("_id", None)  # Remove _id before returning
        return log_entry

    async def get_entity_history(self, entity_type: str, entity_id: str, limit: int = 50):
        """Get audit history for a specific entity"""
        logs = await self.db.audit_logs.find(
            {"entity_type": entity_type, "entity_id": entity_id},
            {"_id": 0}
        ).sort("timestamp", -1).to_list(limit)
        
        return logs

    async def get_user_activity(self, user_id: str, limit: int = 100):
        """Get audit history for a specific user"""
        logs = await self.db.audit_logs.find(
            {"user_id": user_id},
            {"_id": 0}
        ).sort("timestamp", -1).to_list(limit)
        
        return logs

    async def search_logs(
        self,
        entity_type: Optional[str] = None,
        action: Optional[str] = None,
        user_id: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 100
    ):
        """Search audit logs with filters"""
        query = {}
        
        if entity_type:
            query["entity_type"] = entity_type
        if action:
            query["action"] = action
        if user_id:
            query["user_id"] = user_id
        if start_date:
            query["timestamp"] = {"$gte": start_date}
        if end_date:
            if "timestamp" in query:
                query["timestamp"]["$lte"] = end_date
            else:
                query["timestamp"] = {"$lte": end_date}
        
        logs = await self.db.audit_logs.find(query, {"_id": 0}).sort("timestamp", -1).to_list(limit)
        return logs

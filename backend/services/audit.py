"""Audit Logging Service"""
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone
import uuid


class AuditService:
    """Service for audit logging"""
    
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
        # Get user details
        user = await self.db.users.find_one(
            {"id": user_id}, 
            {"_id": 0, "name": 1, "role_id": 1}
        )
        
        user_name = None
        user_role = None
        
        if user:
            user_name = user.get("name")
            role_id = user.get("role_id")
            if role_id:
                role = await self.db.roles.find_one({"id": role_id}, {"_id": 0, "name": 1})
                if role:
                    user_role = role.get("name")
        
        audit_entry = {
            "id": str(uuid.uuid4()),
            "entity_type": entity_type,
            "entity_id": entity_id,
            "action": action,
            "old_values": old_values,
            "new_values": new_values,
            "user_id": user_id,
            "user_name": user_name,
            "user_role": user_role,
            "ip_address": ip_address,
            "user_agent": user_agent,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        await self.db.audit_logs.insert_one(audit_entry)

    async def get_entity_history(
        self, 
        entity_type: str, 
        entity_id: str,
        limit: int = 50
    ) -> list:
        """Get audit history for an entity"""
        logs = await self.db.audit_logs.find(
            {"entity_type": entity_type, "entity_id": entity_id},
            {"_id": 0}
        ).sort("timestamp", -1).limit(limit).to_list(limit)
        
        return logs

    async def get_user_activity(
        self, 
        user_id: str,
        limit: int = 100
    ) -> list:
        """Get activity log for a user"""
        logs = await self.db.audit_logs.find(
            {"user_id": user_id},
            {"_id": 0}
        ).sort("timestamp", -1).limit(limit).to_list(limit)
        
        return logs

"""Audit log model"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, timezone
import uuid


class AuditLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    entity_type: str  # lead, customer, inspection, user, etc.
    entity_id: str
    action: str  # create, update, delete, reassign, login, etc.
    old_values: Optional[dict] = None
    new_values: Optional[dict] = None
    user_id: str
    user_name: Optional[str] = None
    user_role: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

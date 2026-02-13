"""Lead models"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, timezone
import uuid


class LeadBase(BaseModel):
    country_id: str
    name: str
    mobile: str
    email: Optional[str] = None
    city: str
    source: str = "WEBSITE"
    ad_id: Optional[str] = None
    status: str = "NEW"
    assigned_to: Optional[str] = None
    team_id: Optional[str] = None
    is_locked: bool = False  # Prevents round robin override
    service_type: Optional[str] = None
    reminder_date: Optional[str] = None
    reminder_time: Optional[str] = None
    reminder_reason: Optional[str] = None
    notes: Optional[str] = None
    payment_link: Optional[str] = None
    payment_link_sent_at: Optional[str] = None


class LeadCreate(LeadBase):
    pass


class LeadUpdate(BaseModel):
    name: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    source: Optional[str] = None
    ad_id: Optional[str] = None
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    team_id: Optional[str] = None
    is_locked: Optional[bool] = None
    service_type: Optional[str] = None
    reminder_date: Optional[str] = None
    reminder_time: Optional[str] = None
    reminder_reason: Optional[str] = None
    notes: Optional[str] = None
    payment_link: Optional[str] = None


class Lead(LeadBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    converted_at: Optional[datetime] = None
    customer_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_by: Optional[str] = None


class LeadReassignmentLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lead_id: str
    old_agent_id: Optional[str] = None
    new_agent_id: str
    reassigned_by: str
    reason: str  # MANDATORY
    reassignment_type: str = "manual"  # manual, round_robin, system
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class LeadReassignRequest(BaseModel):
    new_agent_id: str
    reason: str  # MANDATORY

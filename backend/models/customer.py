"""Customer models"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, timezone
import uuid


class CustomerBase(BaseModel):
    country_id: str
    lead_id: Optional[str] = None
    name: str
    mobile: str
    email: Optional[str] = None
    city: str
    address: Optional[str] = None
    payment_status: str = "PENDING"
    total_amount_paid: float = 0
    notes: Optional[str] = None


class CustomerCreate(CustomerBase):
    pass


class Customer(CustomerBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_by: Optional[str] = None

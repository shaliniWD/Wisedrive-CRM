"""Inspection models"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, timezone
import uuid


class InspectionBase(BaseModel):
    country_id: str
    customer_id: Optional[str] = None
    order_id: Optional[str] = None
    customer_name: str
    customer_mobile: str
    car_number: Optional[str] = None
    car_make: Optional[str] = None
    car_model: Optional[str] = None
    car_year: Optional[str] = None
    car_color: Optional[str] = None
    fuel_type: Optional[str] = None
    city: str
    address: Optional[str] = None
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    package_type: Optional[str] = None
    total_amount: float = 0
    amount_paid: float = 0
    pending_amount: float = 0
    payment_status: str = "PENDING"
    payment_type: Optional[str] = None  # Full or Partial
    payment_date: Optional[str] = None
    inspection_status: Optional[str] = None  # SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED
    scheduled_date: Optional[str] = None
    scheduled_time: Optional[str] = None
    mechanic_id: Optional[str] = None
    coordinator_id: Optional[str] = None
    report_reviewer_id: Optional[str] = None
    inspections_available: int = 1
    report_status: str = "pending"  # pending, in_review, completed
    report_url: Optional[str] = None
    notes: Optional[str] = None


class InspectionCreate(InspectionBase):
    pass


class InspectionUpdate(BaseModel):
    customer_name: Optional[str] = None
    customer_mobile: Optional[str] = None
    car_number: Optional[str] = None
    car_make: Optional[str] = None
    car_model: Optional[str] = None
    car_year: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    package_type: Optional[str] = None
    total_amount: Optional[float] = None
    amount_paid: Optional[float] = None
    pending_amount: Optional[float] = None
    payment_status: Optional[str] = None
    payment_type: Optional[str] = None
    inspection_status: Optional[str] = None
    scheduled_date: Optional[str] = None
    scheduled_time: Optional[str] = None
    mechanic_id: Optional[str] = None
    coordinator_id: Optional[str] = None
    report_reviewer_id: Optional[str] = None
    report_status: Optional[str] = None
    report_url: Optional[str] = None
    notes: Optional[str] = None


class Inspection(InspectionBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_by: Optional[str] = None

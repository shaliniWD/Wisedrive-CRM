"""Lead models"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone
import uuid


# All lead statuses from Wisedrive business process
LEAD_STATUSES = [
    {"value": "NEW LEAD", "label": "New Lead", "color": "blue"},
    {"value": "RNR", "label": "RNR", "color": "orange"},
    {"value": "RNR1", "label": "RNR1", "color": "orange"},
    {"value": "RNR2", "label": "RNR2", "color": "orange"},
    {"value": "RNR3", "label": "RNR3", "color": "red"},
    {"value": "FOLLOW UP", "label": "Follow Up", "color": "yellow"},
    {"value": "WHATSAPP FOLLOW UP", "label": "WhatsApp Follow Up", "color": "green"},
    {"value": "Repeat follow up", "label": "Repeat Follow Up", "color": "yellow"},
    {"value": "HOT LEADS", "label": "Hot Leads", "color": "red"},
    {"value": "NOT INTERESTED", "label": "Not Interested", "color": "gray"},
    {"value": "DEAD LEAD", "label": "Dead Lead", "color": "gray"},
    {"value": "ESCALATION", "label": "Escalation", "color": "red"},
    {"value": "STOP", "label": "Stop", "color": "gray"},
    {"value": "OUT OF SERVICE AREA", "label": "Out of Service Area", "color": "gray"},
    {"value": "WRONG NUMBER", "label": "Wrong Number", "color": "gray"},
    {"value": "PURCHASED FROM COMPETITOR", "label": "Purchased from Competitor", "color": "gray"},
    {"value": "PAYMENT LINK SENT", "label": "Payment Link Sent", "color": "purple"},
    {"value": "PAID", "label": "Paid", "color": "green"},
    {"value": "CAR FINALIZED", "label": "Car Finalized", "color": "green"},
    {"value": "Car purchased", "label": "Car Purchased", "color": "green"},
    {"value": "CC GENERATED", "label": "CC Generated", "color": "green"},
    {"value": "RCB WHATSAPP", "label": "RCB WhatsApp", "color": "blue"},
]


class LeadBase(BaseModel):
    country_id: Optional[str] = None
    name: str
    mobile: str
    email: Optional[str] = None
    city: Optional[str] = None
    city_id: Optional[str] = None
    source: str = "META_WHATSAPP"
    ad_id: Optional[str] = None
    campaign_id: Optional[str] = None
    platform: Optional[str] = None  # FB or Insta
    status: str = "NEW LEAD"
    assigned_to: Optional[str] = None
    assigned_to_name: Optional[str] = None
    team_id: Optional[str] = None
    is_locked: bool = False
    service_type: Optional[str] = None
    reminder_date: Optional[str] = None
    reminder_time: Optional[str] = None
    reminder_reason: Optional[str] = None
    notes: Optional[str] = None
    message: Optional[str] = None  # Initial WhatsApp message
    
    # Partner/Client for inspection flow
    partner_id: Optional[str] = None  # Links to partners collection
    partner_name: Optional[str] = None  # Denormalized for display
    
    # Vehicle information (captured for inspection)
    vehicle_number: Optional[str] = None  # Registration number e.g., KA01AB1234
    vehicle_make: Optional[str] = None  # Brand/manufacturer e.g., Maruti Suzuki
    vehicle_model: Optional[str] = None  # Model name e.g., Swift
    vehicle_year: Optional[str] = None  # Manufacturing year
    vehicle_fuel_type: Optional[str] = None  # Petrol, Diesel, CNG, Electric
    vehicle_data: Optional[dict] = None  # Full Vaahan API response
    
    # Payment fields
    package_id: Optional[str] = None
    package_name: Optional[str] = None
    payment_link: Optional[str] = None
    payment_link_id: Optional[str] = None
    payment_link_sent_at: Optional[str] = None
    payment_status: Optional[str] = None  # created, sent, paid, failed, expired
    payment_amount: Optional[float] = None
    razorpay_payment_id: Optional[str] = None


class LeadCreate(LeadBase):
    pass


class LeadUpdate(BaseModel):
    name: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    city_id: Optional[str] = None
    source: Optional[str] = None
    ad_id: Optional[str] = None
    campaign_id: Optional[str] = None
    platform: Optional[str] = None
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    team_id: Optional[str] = None
    is_locked: Optional[bool] = None
    service_type: Optional[str] = None
    reminder_date: Optional[str] = None
    reminder_time: Optional[str] = None
    reminder_reason: Optional[str] = None
    notes: Optional[str] = None
    package_id: Optional[str] = None
    payment_link: Optional[str] = None
    partner_id: Optional[str] = None
    partner_name: Optional[str] = None


class Lead(LeadBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    converted_at: Optional[datetime] = None
    customer_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_by: Optional[str] = None


class LeadNote(BaseModel):
    """Model for lead notes/comments"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lead_id: str
    user_id: str
    user_name: str
    note: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class LeadActivity(BaseModel):
    """Model for lead activity log"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lead_id: str
    user_id: str
    user_name: str
    action: str  # status_changed, note_added, assigned, payment_link_sent, etc.
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    details: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class LeadReassignmentLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lead_id: str
    old_agent_id: Optional[str] = None
    new_agent_id: str
    reassigned_by: str
    reason: str
    reassignment_type: str = "manual"  # manual, round_robin, system
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class LeadReassignRequest(BaseModel):
    new_agent_id: str
    reason: str


class PaymentLinkRequest(BaseModel):
    """Model for creating payment link"""
    package_id: str
    amount: Optional[float] = None  # If not provided, use package price
    description: Optional[str] = None
    send_via_whatsapp: bool = True

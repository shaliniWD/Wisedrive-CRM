"""Inspection models"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone
import uuid


# Payment Transaction for audit trail
class PaymentTransaction(BaseModel):
    """Individual payment transaction record"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    amount: float
    payment_type: str  # "partial", "balance", "full"
    payment_method: str = "razorpay"  # razorpay, cash, bank_transfer
    payment_link_id: Optional[str] = None
    payment_link_url: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    status: str = "pending"  # pending, completed, failed
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    completed_at: Optional[str] = None
    notes: Optional[str] = None


# Inspection status options
INSPECTION_STATUSES = [
    "NEW_INSPECTION",
    "ASSIGNED_TO_MECHANIC", 
    "INSPECTION_CONFIRMED",
    "INSPECTION_STARTED",
    "INSPECTION_IN_PROGRESS",
    "INSPECTION_COMPLETED"
]

# Payment status options
PAYMENT_STATUSES = [
    "PENDING",
    "PARTIAL_PAID",
    "FULLY_PAID",
    "REFUNDED"
]


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
    package_id: Optional[str] = None
    package_name: Optional[str] = None
    package_type: Optional[str] = None
    
    # Payment fields
    total_amount: float = 0
    discount_amount: float = 0
    offer_discount: float = 0
    final_amount: float = 0  # total - discount - offer_discount
    partial_payment_amount: float = 0  # Fixed partial amount from package
    amount_paid: float = 0
    balance_due: float = 0
    payment_status: str = "PENDING"  # PENDING, PARTIAL_PAID, FULLY_PAID
    payment_type: Optional[str] = None  # full, partial
    payment_link_id: Optional[str] = None
    payment_link_url: Optional[str] = None
    balance_payment_link_id: Optional[str] = None
    balance_payment_link_url: Optional[str] = None
    payment_transactions: List[dict] = []  # List of PaymentTransaction dicts
    
    # Inspection status (separate from payment)
    inspection_status: str = "NEW_INSPECTION"
    scheduled_date: Optional[str] = None
    scheduled_time: Optional[str] = None
    mechanic_id: Optional[str] = None
    mechanic_name: Optional[str] = None
    coordinator_id: Optional[str] = None
    report_reviewer_id: Optional[str] = None
    inspections_available: int = 1
    
    # Report fields
    report_status: str = "pending"  # pending, in_review, completed
    report_url: Optional[str] = None
    report_data: Optional[dict] = None  # Inspection findings
    report_sent: bool = False
    report_sent_at: Optional[str] = None
    
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
    discount_amount: Optional[float] = None
    offer_discount: Optional[float] = None
    final_amount: Optional[float] = None
    partial_payment_amount: Optional[float] = None
    amount_paid: Optional[float] = None
    balance_due: Optional[float] = None
    payment_status: Optional[str] = None
    payment_type: Optional[str] = None
    inspection_status: Optional[str] = None
    scheduled_date: Optional[str] = None
    scheduled_time: Optional[str] = None
    mechanic_id: Optional[str] = None
    mechanic_name: Optional[str] = None
    coordinator_id: Optional[str] = None
    report_reviewer_id: Optional[str] = None
    report_status: Optional[str] = None
    report_url: Optional[str] = None
    report_data: Optional[dict] = None
    report_sent: Optional[bool] = None
    notes: Optional[str] = None
    
    # AI Report & Assessment fields (NEW)
    overall_rating: Optional[float] = None
    recommended_to_buy: Optional[bool] = None
    market_value_min: Optional[float] = None
    market_value_max: Optional[float] = None
    assessment_summary: Optional[str] = None
    key_highlights: Optional[List[str]] = None
    
    # Vehicle Details (NEW)
    vehicle_make: Optional[str] = None
    vehicle_model: Optional[str] = None
    vehicle_year: Optional[str] = None
    fuel_type: Optional[str] = None
    transmission: Optional[str] = None
    vehicle_colour: Optional[str] = None
    engine_cc: Optional[int] = None
    kms_driven: Optional[int] = None
    owners: Optional[int] = None
    
    # Condition Ratings (NEW)
    engine_condition: Optional[str] = None
    interior_condition: Optional[str] = None
    exterior_condition: Optional[str] = None
    transmission_condition: Optional[str] = None
    
    # Vehicle History (NEW)
    accident_history: Optional[bool] = None
    flood_damage: Optional[bool] = None
    dents_scratches: Optional[bool] = None
    
    # Insurance (NEW)
    insurance_status: Optional[str] = None
    insurer_name: Optional[str] = None
    policy_number: Optional[str] = None
    insurance_expiry: Optional[str] = None
    policy_type: Optional[str] = None
    idv_value: Optional[float] = None
    
    # Repairs Estimation (NEW)
    repairs: Optional[List[dict]] = None
    total_repair_cost_min: Optional[float] = None
    total_repair_cost_max: Optional[float] = None
    
    # RTO Verification (NEW)
    rto_verification_status: Optional[str] = None
    hypothecation: Optional[str] = None
    blacklist_status: Optional[bool] = None
    registration_authority: Optional[str] = None
    
    # AI Category Ratings (for Q&A categories like Engine Health, Exterior, etc.)
    category_ratings: Optional[dict] = None
    
    # Market Price Research (RPP)
    market_price_research: Optional[dict] = None


class Inspection(InspectionBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_by: Optional[str] = None

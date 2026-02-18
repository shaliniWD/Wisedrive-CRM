"""Inspection Package models - defines the structure of inspection packages"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone
import uuid


class InspectionItem(BaseModel):
    """Individual inspection check item"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    is_benefit: bool = False  # True for "Additional Benefits" items


# ============= OFFER MODELS =============

class OfferBase(BaseModel):
    """Base offer model for promotional discounts"""
    name: str  # e.g., "Christmas Special", "New Year Offer"
    description: Optional[str] = None
    discount_type: str = "percentage"  # "percentage" or "fixed"
    discount_value: float = 0  # 10 for 10% or 100 for ₹100
    valid_from: datetime
    valid_until: datetime
    is_active: bool = True
    country_id: str


class OfferCreate(OfferBase):
    pass


class OfferUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    discount_type: Optional[str] = None
    discount_value: Optional[float] = None
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    is_active: Optional[bool] = None


class Offer(OfferBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_by: Optional[str] = None


class InspectionCategory(BaseModel):
    """Category of inspections (e.g., Physical/Manual, OBD2, RTO)"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    check_points: int = 0
    icon: Optional[str] = None  # Icon name for UI
    color: Optional[str] = None  # Color theme for UI
    items: List[InspectionItem] = []
    benefits: List[InspectionItem] = []  # Additional benefits
    is_free: bool = False  # For categories like "Additional Technical Support"
    order: int = 0  # Display order


class InspectionPackageBase(BaseModel):
    """Base inspection package model"""
    name: str  # e.g., "Standard", "Luxury"
    description: Optional[str] = None
    price: float
    currency: str = "INR"
    currency_symbol: str = "₹"
    country_id: str
    categories: List[str] = []  # List of category IDs included in this package
    total_check_points: int = 0
    no_of_inspections: int = 1  # Number of inspections customer can avail with this package
    is_active: bool = True
    is_recommended: bool = False  # Show "Recommended" badge
    order: int = 0  # Display order
    brands_covered: List[str] = []  # List of car brands covered
    
    # Partial Payment Configuration
    allow_partial_payment: bool = False
    partial_payment_type: str = "percentage"  # "percentage" or "fixed"
    partial_payment_value: float = 0  # e.g., 50 for 50% or 500 for ₹500
    
    # Discount Configuration  
    allow_discount: bool = False
    discount_type: str = "percentage"  # "percentage" or "fixed"
    discount_value: float = 0  # e.g., 10 for 10% or 100 for ₹100
    
    # Offers Configuration
    allow_offers: bool = False
    applicable_offer_ids: List[str] = []  # List of offer IDs that can be applied


class InspectionPackageCreate(InspectionPackageBase):
    pass


class InspectionPackageUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    categories: Optional[List[str]] = None
    total_check_points: Optional[int] = None
    no_of_inspections: Optional[int] = None
    is_active: Optional[bool] = None
    is_recommended: Optional[bool] = None
    order: Optional[int] = None
    brands_covered: Optional[List[str]] = None


class InspectionPackage(InspectionPackageBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_by: Optional[str] = None


class InspectionCategoryCreate(BaseModel):
    """Create category request"""
    name: str
    description: Optional[str] = None
    check_points: int = 0
    icon: Optional[str] = None
    color: Optional[str] = None
    items: List[dict] = []  # List of {name, description}
    benefits: List[dict] = []  # List of {name, description}
    is_free: bool = False
    order: int = 0


class InspectionCategoryUpdate(BaseModel):
    """Update category request"""
    name: Optional[str] = None
    description: Optional[str] = None
    check_points: Optional[int] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    items: Optional[List[dict]] = None
    benefits: Optional[List[dict]] = None
    is_free: Optional[bool] = None
    order: Optional[int] = None


class InspectionCategoryDB(BaseModel):
    """Category stored in database"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    check_points: int = 0
    icon: Optional[str] = None
    color: Optional[str] = None
    items: List[InspectionItem] = []
    benefits: List[InspectionItem] = []
    is_free: bool = False
    order: int = 0
    country_id: str
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_by: Optional[str] = None

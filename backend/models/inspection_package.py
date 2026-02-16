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
    is_active: bool = True
    is_recommended: bool = False  # Show "Recommended" badge
    order: int = 0  # Display order
    brands_covered: List[str] = []  # List of car brands covered


class InspectionPackageCreate(InspectionPackageBase):
    pass


class InspectionPackageUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    categories: Optional[List[str]] = None
    total_check_points: Optional[int] = None
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

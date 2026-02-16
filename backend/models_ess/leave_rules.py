"""Leave Rules models for ESS Mobile API"""
from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


class LeaveAllocationPeriod(str, Enum):
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"


class LeaveRulesConfig(BaseModel):
    """Leave rules configuration"""
    allocation_period: LeaveAllocationPeriod = LeaveAllocationPeriod.MONTHLY
    carry_forward_enabled: bool = False  # Always False - cannot carry forward
    sick_leaves_per_period: int = Field(default=2, description="Sick leaves per month/quarter")
    casual_leaves_per_period: int = Field(default=1, description="Casual leaves per month/quarter")
    
    class Config:
        json_schema_extra = {
            "example": {
                "allocation_period": "monthly",
                "carry_forward_enabled": False,
                "sick_leaves_per_period": 2,
                "casual_leaves_per_period": 1
            }
        }


class PeriodLeaveBalance(BaseModel):
    """Leave balance for current period (month/quarter)"""
    employee_id: str
    period_type: LeaveAllocationPeriod  # monthly or quarterly
    period_label: str  # e.g., "December 2025" or "Q4 2025"
    period_start: str  # Start date of period
    period_end: str  # End date of period
    
    # Casual leaves
    casual_allocated: int
    casual_used: float
    casual_available: float
    
    # Sick leaves
    sick_allocated: int
    sick_used: float
    sick_available: float
    
    # LOP (Loss of Pay) - unpaid leaves
    lop_days: float
    
    # Total availed this period
    total_availed: float
    
    # Can apply leave?
    can_apply_casual: bool
    can_apply_sick: bool
    
    class Config:
        json_schema_extra = {
            "example": {
                "employee_id": "emp-123",
                "period_type": "monthly",
                "period_label": "December 2025",
                "period_start": "2025-12-01",
                "period_end": "2025-12-31",
                "casual_allocated": 1,
                "casual_used": 0.5,
                "casual_available": 0.5,
                "sick_allocated": 2,
                "sick_used": 1,
                "sick_available": 1,
                "lop_days": 0,
                "total_availed": 1.5,
                "can_apply_casual": True,
                "can_apply_sick": True
            }
        }

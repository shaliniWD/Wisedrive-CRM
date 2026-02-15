"""Leave management models for ESS Mobile API"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date
from enum import Enum


class LeaveType(str, Enum):
    CASUAL = "casual"
    SICK = "sick"
    EARNED = "earned"
    UNPAID = "unpaid"
    MATERNITY = "maternity"
    PATERNITY = "paternity"
    BEREAVEMENT = "bereavement"


class LeaveStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class LeaveRequestCreate(BaseModel):
    """Create leave request"""
    leave_type: LeaveType
    start_date: str = Field(..., description="Start date (YYYY-MM-DD)")
    end_date: str = Field(..., description="End date (YYYY-MM-DD)")
    reason: str = Field(..., min_length=10, max_length=500)
    is_half_day: bool = False
    half_day_type: Optional[str] = Field(None, description="first_half or second_half")
    contact_number: Optional[str] = Field(None, description="Emergency contact during leave")
    
    class Config:
        json_schema_extra = {
            "example": {
                "leave_type": "casual",
                "start_date": "2025-12-20",
                "end_date": "2025-12-22",
                "reason": "Family function - attending cousin's wedding",
                "is_half_day": False
            }
        }


class LeaveRequestResponse(BaseModel):
    """Leave request response"""
    id: str
    employee_id: str
    leave_type: LeaveType
    start_date: str
    end_date: str
    days_count: float
    reason: str
    status: LeaveStatus
    is_half_day: bool
    half_day_type: Optional[str]
    applied_on: str
    approved_by: Optional[str]
    approved_on: Optional[str]
    rejection_reason: Optional[str]
    can_cancel: bool = False


class LeaveBalanceResponse(BaseModel):
    """Leave balance for an employee"""
    employee_id: str
    year: int
    casual_leaves: dict = Field(..., description="{'total': x, 'used': y, 'available': z}")
    sick_leaves: dict
    earned_leaves: dict
    unpaid_leaves: dict = Field(default_factory=lambda: {"used": 0})
    
    class Config:
        json_schema_extra = {
            "example": {
                "employee_id": "emp-123",
                "year": 2025,
                "casual_leaves": {"total": 12, "used": 3, "available": 9},
                "sick_leaves": {"total": 12, "used": 2, "available": 10},
                "earned_leaves": {"total": 15, "used": 0, "available": 15},
                "unpaid_leaves": {"used": 0}
            }
        }


class LeaveHistoryResponse(BaseModel):
    """Leave history with pagination"""
    leaves: List[LeaveRequestResponse]
    total: int
    page: int
    page_size: int
    has_more: bool


class LeaveApprover(BaseModel):
    """Approver info for leave request"""
    id: str
    name: str
    role: str
    email: str


class PendingApprovalResponse(BaseModel):
    """Pending approvals for managers/approvers"""
    id: str
    employee_id: str
    employee_name: str
    employee_photo: Optional[str]
    leave_type: LeaveType
    start_date: str
    end_date: str
    days_count: float
    reason: str
    applied_on: str


class LeaveApprovalAction(BaseModel):
    """Approve or reject leave"""
    action: str = Field(..., pattern="^(approve|reject)$")
    comments: Optional[str] = Field(None, max_length=500)

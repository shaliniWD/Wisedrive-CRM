"""Leave Management Models - HR Module Phase 1 (v1 Simple)"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone
from enum import Enum
import uuid


class LeaveType(str, Enum):
    CASUAL = "CASUAL"
    SICK = "SICK"


class LeaveStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class LeaveDuration(str, Enum):
    FULL_DAY = "FULL_DAY"
    HALF_DAY_FIRST = "HALF_DAY_FIRST"  # First half
    HALF_DAY_SECOND = "HALF_DAY_SECOND"  # Second half


# ==================== LEAVE BALANCE ====================

class LeaveBalanceBase(BaseModel):
    """Employee's annual leave balance"""
    employee_id: str
    year: int
    
    # Casual Leave
    casual_leave_total: int = 12  # Default annual casual leave
    casual_leave_used: float = 0  # Half days count as 0.5
    casual_leave_balance: float = 12
    
    # Sick Leave
    sick_leave_total: int = 12  # Default annual sick leave
    sick_leave_used: float = 0
    sick_leave_balance: float = 12
    
    # Carry forward (for future enhancement)
    carried_forward_casual: float = 0
    carried_forward_sick: float = 0


class LeaveBalanceCreate(BaseModel):
    employee_id: str
    year: int
    casual_leave_total: int = 12
    sick_leave_total: int = 12


class LeaveBalanceUpdate(BaseModel):
    casual_leave_total: Optional[int] = None
    sick_leave_total: Optional[int] = None
    casual_leave_used: Optional[float] = None
    sick_leave_used: Optional[float] = None


class LeaveBalance(LeaveBalanceBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ==================== LEAVE REQUEST ====================

class LeaveRequestBase(BaseModel):
    """Individual leave request"""
    employee_id: str
    employee_name: Optional[str] = None  # Snapshot
    
    leave_type: str  # CASUAL or SICK
    
    # Date range
    start_date: str  # YYYY-MM-DD
    end_date: str  # YYYY-MM-DD
    
    # Duration type
    duration_type: str = LeaveDuration.FULL_DAY.value
    
    # Calculated
    total_days: float = 1  # Half days = 0.5
    
    reason: str
    
    # Status
    status: str = LeaveStatus.PENDING.value
    
    # Approval
    approved_by: Optional[str] = None
    approved_by_name: Optional[str] = None
    approved_at: Optional[str] = None
    rejection_reason: Optional[str] = None
    
    # Cancellation
    cancelled_at: Optional[str] = None
    cancellation_reason: Optional[str] = None


class LeaveRequestCreate(BaseModel):
    leave_type: str  # CASUAL or SICK
    start_date: str
    end_date: str
    duration_type: str = LeaveDuration.FULL_DAY.value
    reason: str


class LeaveRequestUpdate(BaseModel):
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    duration_type: Optional[str] = None
    reason: Optional[str] = None


class LeaveApprovalRequest(BaseModel):
    """Request to approve or reject leave"""
    action: str  # APPROVED or REJECTED
    rejection_reason: Optional[str] = None  # Required if REJECTED


class LeaveRequest(LeaveRequestBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ==================== LEAVE SUMMARY ====================

class EmployeeLeaveSummary(BaseModel):
    """Summary of employee's leave status"""
    employee_id: str
    employee_name: str
    year: int
    
    # Balances
    casual_leave_balance: float = 0
    sick_leave_balance: float = 0
    total_leave_balance: float = 0
    
    # Used
    casual_leave_used: float = 0
    sick_leave_used: float = 0
    total_leave_used: float = 0
    
    # Pending requests
    pending_requests: int = 0
    
    # Monthly breakdown
    monthly_breakdown: List[dict] = []


class TeamLeaveSummary(BaseModel):
    """Team-level leave summary for managers"""
    team_id: Optional[str] = None
    team_name: Optional[str] = None
    
    total_employees: int = 0
    employees_on_leave_today: int = 0
    pending_approvals: int = 0
    
    # List of employees on leave today
    on_leave_today: List[dict] = []
    
    # Upcoming leaves
    upcoming_leaves: List[dict] = []


# ==================== LEAVE CALENDAR ====================

class LeaveCalendarEntry(BaseModel):
    """Single entry in leave calendar"""
    employee_id: str
    employee_name: str
    date: str  # YYYY-MM-DD
    leave_type: str
    duration_type: str
    status: str


class LeaveCalendarRequest(BaseModel):
    """Request for leave calendar data"""
    month: int
    year: int
    team_id: Optional[str] = None
    department_id: Optional[str] = None

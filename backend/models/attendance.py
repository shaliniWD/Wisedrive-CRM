"""Attendance & Session Tracking Models - HR Module Phase 1"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone
from enum import Enum
import uuid


class LogoutReason(str, Enum):
    MANUAL = "manual"
    INACTIVITY = "inactivity"
    ADMIN_FORCE = "admin_force"
    TOKEN_EXPIRED = "token_expired"


class AttendanceSystemStatus(str, Enum):
    PRESENT = "PRESENT"      # >= 9 hours (540 minutes)
    PENDING = "PENDING"      # < 9 hours, needs HR approval
    ABSENT = "ABSENT"        # 0 minutes logged


class AttendanceOverrideStatus(str, Enum):
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


# ==================== USER SESSIONS ====================

class UserSessionBase(BaseModel):
    """Tracks individual login sessions for attendance calculation"""
    user_id: str
    login_at: str  # ISO datetime
    logout_at: Optional[str] = None  # ISO datetime
    last_activity_at: str  # ISO datetime - updated on heartbeat
    is_active: bool = True
    logout_reason: Optional[str] = None  # manual, inactivity, admin_force
    
    # Session metadata
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    device_info: Optional[str] = None
    
    # For token invalidation
    token_hash: Optional[str] = None  # SHA256 hash of JWT token


class UserSessionCreate(BaseModel):
    user_id: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    device_info: Optional[str] = None
    token_hash: Optional[str] = None


class UserSession(UserSessionBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ==================== TOKEN BLACKLIST ====================

class TokenBlacklist(BaseModel):
    """Blacklisted tokens for forced logout/inactivity"""
    model_config = ConfigDict(extra="ignore")
    token_hash: str  # SHA256 hash of token
    user_id: str
    blacklisted_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    reason: str  # inactivity, manual_logout, admin_force
    expires_at: str  # Same as original token expiry - for TTL index


# ==================== ATTENDANCE RECORDS ====================

class AttendanceRecordBase(BaseModel):
    """Daily attendance record - immutable after lock"""
    employee_id: str
    date: str  # YYYY-MM-DD format
    
    # Calculated from sessions
    total_active_minutes: int = 0
    first_login: Optional[str] = None  # ISO datetime
    last_logout: Optional[str] = None  # ISO datetime
    
    # System calculated status
    system_status: str = AttendanceSystemStatus.ABSENT.value  # PRESENT, PENDING, ABSENT
    
    # HR Override (only fields modifiable after lock)
    hr_override_status: Optional[str] = None  # APPROVED, REJECTED
    override_by: Optional[str] = None  # HR user ID
    override_reason: Optional[str] = None
    override_at: Optional[str] = None  # ISO datetime
    
    # Lock status
    calculated_at: Optional[str] = None  # When cron calculated this
    is_locked: bool = False  # Locked at 00:30 AM next day


class AttendanceRecordCreate(BaseModel):
    employee_id: str
    date: str


class AttendanceOverrideRequest(BaseModel):
    """Request model for HR to override attendance status"""
    override_status: str  # APPROVED or REJECTED
    reason: str


class AttendanceRecord(AttendanceRecordBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ==================== SESSION ACTIVITY LOG ====================

class SessionActivity(BaseModel):
    """Individual activity within a session (for detailed tracking)"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    user_id: str
    activity_type: str  # heartbeat, api_call, page_view
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    endpoint: Optional[str] = None  # API endpoint accessed


# ==================== ATTENDANCE SUMMARY ====================

class AttendanceSummary(BaseModel):
    """Monthly attendance summary for an employee"""
    employee_id: str
    month: int  # 1-12
    year: int
    
    # Day counts
    working_days: int = 0  # Total working days in month
    present_days: int = 0  # Days with PRESENT status
    pending_days: int = 0  # Days with PENDING status (not yet approved)
    absent_days: int = 0  # Days with ABSENT status
    approved_days: int = 0  # PENDING days approved by HR
    rejected_days: int = 0  # PENDING days rejected by HR
    
    # Time tracking
    total_hours_worked: float = 0.0
    average_hours_per_day: float = 0.0
    
    # For payroll calculation
    unapproved_absent_days: int = 0  # PENDING + ABSENT without HR approval


class AttendanceExportRequest(BaseModel):
    """Request model for attendance export"""
    month: int
    year: int
    employee_ids: Optional[List[str]] = None  # None = all employees
    format: str = "csv"  # csv, excel

"""User and RBAC models"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone
import uuid


class PermissionBase(BaseModel):
    name: str  # e.g., "leads.view", "leads.edit", "leads.reassign"
    resource: str  # leads, customers, inspections, users, etc.
    action: str  # view, create, edit, delete, reassign, export
    description: Optional[str] = None


class Permission(PermissionBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))


class RoleBase(BaseModel):
    name: str
    code: str  # CEO, HR_MANAGER, COUNTRY_HEAD, SALES_HEAD, etc.
    level: int  # 1 = highest (CEO), 6 = lowest (Mechanic)
    department_id: Optional[str] = None
    is_system: bool = True  # System roles cannot be deleted
    description: Optional[str] = None


class RoleCreate(RoleBase):
    pass


class Role(RoleBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RolePermissionBase(BaseModel):
    role_id: str
    permission_id: str
    scope: str = "own"  # all, country, team, own


class RolePermission(RolePermissionBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserBase(BaseModel):
    email: str
    name: str
    phone: Optional[str] = None
    country_id: str
    department_id: str
    role_id: str  # Primary role ID (for backward compatibility)
    role_ids: List[str] = []  # Multiple roles support
    team_id: Optional[str] = None
    reports_to: Optional[str] = None
    employment_type: str = "fulltime"  # fulltime, freelancer, contract
    employment_status: str = "active"  # active, exited
    exit_date: Optional[str] = None
    exit_reason: Optional[str] = None
    exit_notes: Optional[str] = None
    rejoin_date: Optional[str] = None
    is_active: bool = True
    is_available_for_assignment: bool = True
    profile_image: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    country_id: Optional[str] = None
    department_id: Optional[str] = None
    role_id: Optional[str] = None
    role_ids: Optional[List[str]] = None  # Multiple roles support
    team_id: Optional[str] = None
    reports_to: Optional[str] = None
    employment_type: Optional[str] = None
    employment_status: Optional[str] = None  # active, exited
    exit_date: Optional[str] = None
    exit_reason: Optional[str] = None
    exit_notes: Optional[str] = None
    rejoin_date: Optional[str] = None
    is_active: Optional[bool] = None
    is_available_for_assignment: Optional[bool] = None


class User(UserBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    hashed_password: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    last_login: Optional[datetime] = None


class UserWithPermissions(BaseModel):
    """User response with role and permissions"""
    id: str
    email: str
    name: str
    phone: Optional[str] = None
    country_id: str
    country_name: Optional[str] = None
    department_id: str
    department_name: Optional[str] = None
    role_id: str
    role_name: Optional[str] = None
    role_code: Optional[str] = None
    role_level: Optional[int] = None
    team_id: Optional[str] = None
    team_name: Optional[str] = None
    is_active: bool
    permissions: List[dict] = []  # [{name, resource, action, scope}]
    visible_tabs: List[str] = []


class SalaryStructure(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    ctc: float = 0
    fixed_pay: float = 0
    variable_pay: float = 0
    commission_percentage: float = 0
    per_inspection_payout: float = 0
    incentive_structure: Optional[dict] = None
    currency: str = "INR"
    effective_from: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    effective_to: Optional[datetime] = None
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

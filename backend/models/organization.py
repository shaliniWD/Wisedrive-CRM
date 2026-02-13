"""Organization models - Countries, Departments, Teams"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone
import uuid


class CountryBase(BaseModel):
    name: str
    code: str  # IN, MY, TH, PH
    currency: str = "INR"
    timezone: str = "Asia/Kolkata"
    is_active: bool = True


class CountryCreate(CountryBase):
    pass


class Country(CountryBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DepartmentBase(BaseModel):
    name: str
    code: str  # EXEC, SALES, INSPECTION, HR
    description: Optional[str] = None
    is_active: bool = True


class DepartmentCreate(DepartmentBase):
    pass


class Department(DepartmentBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TeamBase(BaseModel):
    name: str
    country_id: str
    department_id: str
    team_lead_id: Optional[str] = None
    is_active: bool = True


class TeamCreate(TeamBase):
    pass


class Team(TeamBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

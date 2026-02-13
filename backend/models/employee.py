"""Employee models - Comprehensive HR module"""
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import Optional, List
from datetime import datetime, timezone
import uuid


class EmployeeBase(BaseModel):
    """Base employee data"""
    name: str
    email: EmailStr
    phone: Optional[str] = None
    country_id: str
    department_id: Optional[str] = None
    team_id: Optional[str] = None
    role_id: str
    
    # Personal Info
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    
    # Employment Info
    employee_code: Optional[str] = None
    employment_type: str = "full_time"  # full_time, part_time, freelancer, contractor
    joining_date: Optional[str] = None
    probation_end_date: Optional[str] = None
    
    # Bank Details (for salary)
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    pan_number: Optional[str] = None
    
    # Emergency Contact
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None
    
    # CRM Access
    has_crm_access: bool = True
    is_active: bool = True
    is_available_for_assignment: bool = True


class EmployeeCreate(EmployeeBase):
    password: str


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    country_id: Optional[str] = None
    department_id: Optional[str] = None
    team_id: Optional[str] = None
    role_id: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    employee_code: Optional[str] = None
    employment_type: Optional[str] = None
    joining_date: Optional[str] = None
    probation_end_date: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    pan_number: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None
    has_crm_access: Optional[bool] = None
    is_active: Optional[bool] = None
    is_available_for_assignment: Optional[bool] = None
    password: Optional[str] = None  # For password reset


class Employee(EmployeeBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    hashed_password: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    last_login: Optional[datetime] = None


# Salary Structure - Indian payroll components
class SalaryStructureBase(BaseModel):
    user_id: Optional[str] = None  # Set from URL path in API
    employment_type: str = "full_time"  # Determines which fields are relevant
    currency: str = "INR"
    
    # Full-time/Part-time employee components
    basic_salary: float = 0
    hra: float = 0  # House Rent Allowance
    conveyance_allowance: float = 0
    medical_allowance: float = 0
    special_allowance: float = 0
    variable_pay: float = 0
    
    # Calculated fields (gross)
    gross_salary: float = 0
    
    # Deductions
    pf_employee: float = 0  # Provident Fund (employee contribution)
    pf_employer: float = 0  # Provident Fund (employer contribution)
    professional_tax: float = 0
    income_tax: float = 0  # TDS
    other_deductions: float = 0
    
    # Net salary
    net_salary: float = 0
    
    # Freelancer/Mechanic specific
    price_per_inspection: float = 0
    commission_percentage: float = 0
    
    # Metadata
    effective_from: Optional[str] = None
    effective_to: Optional[str] = None


class SalaryStructureCreate(SalaryStructureBase):
    pass


class SalaryStructureUpdate(BaseModel):
    employment_type: Optional[str] = None
    currency: Optional[str] = None
    basic_salary: Optional[float] = None
    hra: Optional[float] = None
    conveyance_allowance: Optional[float] = None
    medical_allowance: Optional[float] = None
    special_allowance: Optional[float] = None
    variable_pay: Optional[float] = None
    gross_salary: Optional[float] = None
    pf_employee: Optional[float] = None
    pf_employer: Optional[float] = None
    professional_tax: Optional[float] = None
    income_tax: Optional[float] = None
    other_deductions: Optional[float] = None
    net_salary: Optional[float] = None
    price_per_inspection: Optional[float] = None
    commission_percentage: Optional[float] = None
    effective_from: Optional[str] = None
    effective_to: Optional[str] = None


class SalaryStructure(SalaryStructureBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None


# Attendance
class AttendanceBase(BaseModel):
    user_id: Optional[str] = None  # Set from URL path in API
    date: str  # YYYY-MM-DD
    status: str = "present"  # present, absent, half_day, on_leave, holiday, weekend
    check_in_time: Optional[str] = None
    check_out_time: Optional[str] = None
    working_hours: float = 0
    overtime_hours: float = 0
    leave_type: Optional[str] = None  # casual, sick, earned, maternity, etc.
    notes: Optional[str] = None


class AttendanceCreate(AttendanceBase):
    pass


class AttendanceUpdate(BaseModel):
    status: Optional[str] = None
    check_in_time: Optional[str] = None
    check_out_time: Optional[str] = None
    working_hours: Optional[float] = None
    overtime_hours: Optional[float] = None
    leave_type: Optional[str] = None
    notes: Optional[str] = None


class Attendance(AttendanceBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Onboarding Documents
class DocumentBase(BaseModel):
    user_id: Optional[str] = None  # Set from URL path in API
    document_type: str  # aadhaar, pan, passport, offer_letter, joining_letter, nda, etc.
    document_name: str
    document_url: Optional[str] = None
    document_number: Optional[str] = None
    issue_date: Optional[str] = None
    expiry_date: Optional[str] = None
    verification_status: str = "pending"  # pending, verified, rejected
    verified_by: Optional[str] = None
    verified_at: Optional[str] = None
    notes: Optional[str] = None


class DocumentCreate(DocumentBase):
    pass


class DocumentUpdate(BaseModel):
    document_name: Optional[str] = None
    document_url: Optional[str] = None
    document_number: Optional[str] = None
    issue_date: Optional[str] = None
    expiry_date: Optional[str] = None
    verification_status: Optional[str] = None
    verified_by: Optional[str] = None
    verified_at: Optional[str] = None
    notes: Optional[str] = None


class Document(DocumentBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Country with currency
class CountryBase(BaseModel):
    name: str
    code: str  # ISO code like IN, MY, TH
    currency: str = "INR"  # INR, MYR, THB, etc.
    currency_symbol: str = "₹"
    phone_code: str = "+91"
    is_active: bool = True


class CountryCreate(CountryBase):
    pass


class CountryUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    currency: Optional[str] = None
    currency_symbol: Optional[str] = None
    phone_code: Optional[str] = None
    is_active: Optional[bool] = None


class Country(CountryBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

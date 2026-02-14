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
    role_id: str  # Primary role ID (for backward compatibility)
    role_ids: List[str] = []  # Multiple roles support
    
    # Personal Info
    photo_url: Optional[str] = None  # Employee photo URL
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    
    # Employment Info
    employee_code: Optional[str] = None  # Auto-generated or manual Employee ID
    employment_type: str = "full_time"  # full_time, part_time, freelancer, contractor
    employment_status: str = "active"  # active, exited, on_leave
    joining_date: Optional[str] = None
    probation_end_date: Optional[str] = None
    exit_date: Optional[str] = None
    exit_reason: Optional[str] = None
    exit_notes: Optional[str] = None
    rejoin_date: Optional[str] = None
    
    # Reporting Structure
    reporting_manager_id: Optional[str] = None  # Manager's employee ID
    
    # Payroll Control
    payroll_active: bool = True  # If false, excluded from payroll generation
    
    # Weekly Off (rotating off days - 0=Sunday, 1=Monday, ... 6=Saturday)
    weekly_off_day: int = 0  # Default Sunday
    
    # Lead Assignment Control
    is_available_for_leads: bool = True  # Toggle to stop new lead assignments
    lead_assignment_paused_reason: Optional[str] = None  # Reason if paused
    
    # Bank Details (for salary) - ENCRYPTED at rest
    bank_name: Optional[str] = None
    bank_account_number_encrypted: Optional[str] = None  # Encrypted value
    bank_account_number_masked: Optional[str] = None  # Last 4 digits for display
    ifsc_code: Optional[str] = None
    pan_number: Optional[str] = None
    account_holder_name: Optional[str] = None
    bank_branch: Optional[str] = None
    
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
    role_ids: List[str] = []  # Optional list of role IDs
    bank_account_number: Optional[str] = None  # Will be encrypted before storage


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    photo_url: Optional[str] = None
    country_id: Optional[str] = None
    department_id: Optional[str] = None
    team_id: Optional[str] = None
    role_id: Optional[str] = None
    role_ids: Optional[List[str]] = None  # Multiple roles support
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    employee_code: Optional[str] = None
    employment_type: Optional[str] = None
    employment_status: Optional[str] = None  # active, exited, on_leave
    joining_date: Optional[str] = None
    probation_end_date: Optional[str] = None
    exit_date: Optional[str] = None
    exit_reason: Optional[str] = None
    exit_notes: Optional[str] = None
    rejoin_date: Optional[str] = None
    reporting_manager_id: Optional[str] = None
    payroll_active: Optional[bool] = None
    weekly_off_day: Optional[int] = None
    is_available_for_leads: Optional[bool] = None
    lead_assignment_paused_reason: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None  # Will be encrypted before storage
    ifsc_code: Optional[str] = None
    pan_number: Optional[str] = None
    account_holder_name: Optional[str] = None
    bank_branch: Optional[str] = None
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



# Salary Payment History
class SalaryPaymentBase(BaseModel):
    user_id: str
    month: int  # 1-12
    year: int
    
    # Payment details
    gross_salary: float = 0
    total_deductions: float = 0
    net_salary: float = 0
    
    # Attendance summary for this month
    working_days: int = 0
    days_present: int = 0
    days_absent: int = 0
    days_half_day: int = 0
    days_on_leave: int = 0
    leaves_taken: int = 0
    
    # For mechanics/freelancers
    inspections_completed: int = 0
    price_per_inspection: float = 0
    total_inspection_pay: float = 0
    
    # Payment status
    payment_status: str = "pending"  # pending, paid, partial
    payment_date: Optional[str] = None
    payment_method: Optional[str] = None  # bank_transfer, cash, cheque
    transaction_reference: Optional[str] = None
    
    notes: Optional[str] = None
    currency: str = "INR"


class SalaryPaymentCreate(SalaryPaymentBase):
    pass


class SalaryPaymentUpdate(BaseModel):
    gross_salary: Optional[float] = None
    total_deductions: Optional[float] = None
    net_salary: Optional[float] = None
    days_present: Optional[int] = None
    days_absent: Optional[int] = None
    days_on_leave: Optional[int] = None
    leaves_taken: Optional[int] = None
    inspections_completed: Optional[int] = None
    total_inspection_pay: Optional[float] = None
    payment_status: Optional[str] = None
    payment_date: Optional[str] = None
    payment_method: Optional[str] = None
    transaction_reference: Optional[str] = None
    notes: Optional[str] = None


class SalaryPayment(SalaryPaymentBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None

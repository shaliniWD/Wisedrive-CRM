"""Profile models for ESS Mobile API"""
from pydantic import BaseModel, Field
from typing import Optional, List


class EmployeeProfile(BaseModel):
    """Employee profile visible in ESS app"""
    id: str
    employee_code: str
    name: str
    email: str
    phone: Optional[str]
    photo_url: Optional[str]
    
    # Organization info
    department_name: Optional[str]
    role_name: Optional[str]
    country_name: Optional[str]
    team_name: Optional[str]
    
    # Employment info
    date_of_joining: Optional[str]
    employment_type: Optional[str]  # permanent, contract, freelancer
    employment_status: str  # active, on_leave, exited
    
    # Manager info
    reporting_manager_id: Optional[str]
    reporting_manager_name: Optional[str]
    
    # Personal info (limited visibility)
    date_of_birth: Optional[str]
    gender: Optional[str]
    blood_group: Optional[str]
    emergency_contact_name: Optional[str]
    emergency_contact_phone: Optional[str]
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "emp-123",
                "employee_code": "EMP0042",
                "name": "John Doe",
                "email": "john.doe@wisedrive.com",
                "phone": "+91 98765 43210",
                "photo_url": "https://storage.wisedrive.com/photos/emp-123.jpg",
                "department_name": "Sales",
                "role_name": "Sales Executive",
                "country_name": "India",
                "date_of_joining": "2024-01-15",
                "employment_type": "permanent",
                "employment_status": "active",
                "reporting_manager_name": "Jane Smith"
            }
        }


class EmployeeProfileUpdate(BaseModel):
    """Fields employee can update themselves"""
    phone: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    blood_group: Optional[str] = None
    
    # Address (optional)
    current_address: Optional[str] = None
    permanent_address: Optional[str] = None


class BankDetailsResponse(BaseModel):
    """Bank details (masked for security)"""
    bank_name: Optional[str]
    account_number_masked: Optional[str]  # e.g., "XXXX XXXX 1234"
    ifsc_code: Optional[str]
    account_holder_name: Optional[str]


class SalarySummary(BaseModel):
    """Salary summary visible to employee - matches CRM structure"""
    gross_salary: float
    net_salary: float
    currency: str
    currency_symbol: str
    
    # Earnings breakdown (matching CRM)
    basic_salary: Optional[float] = None
    hra: Optional[float] = None
    variable_pay: Optional[float] = None
    conveyance: Optional[float] = None
    medical: Optional[float] = None
    special_allowance: Optional[float] = None
    
    # Deductions breakdown (matching CRM)
    pf_employee: Optional[float] = None
    professional_tax: Optional[float] = None
    income_tax: Optional[float] = None
    other_deductions: Optional[float] = None


class AttendanceSummary(BaseModel):
    """Attendance summary for current month"""
    month: str
    year: int
    working_days: int
    present_days: int
    absent_days: int
    leaves_taken: int
    half_days: int
    overtime_days: int

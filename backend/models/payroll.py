"""Payroll & Payslip Models - HR Module Phase 1"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict
from datetime import datetime, timezone
from enum import Enum
import uuid


class PayrollBatchStatus(str, Enum):
    """Payroll batch lifecycle: DRAFT → CONFIRMED → CLOSED"""
    DRAFT = "DRAFT"           # Editable, not yet locked
    CONFIRMED = "CONFIRMED"   # Locked, ready for payment, payslips can be generated
    CLOSED = "CLOSED"         # Paid and closed, no further changes


class PayrollStatus(str, Enum):
    GENERATED = "GENERATED"
    PENDING = "PENDING"
    PAID = "PAID"


class PaymentMode(str, Enum):
    BANK_TRANSFER = "BANK_TRANSFER"
    NEFT = "NEFT"
    RTGS = "RTGS"
    IMPS = "IMPS"
    UPI = "UPI"
    CHEQUE = "CHEQUE"
    CASH = "CASH"


class AdjustmentType(str, Enum):
    BONUS = "BONUS"
    DEDUCTION = "DEDUCTION"
    CORRECTION = "CORRECTION"
    REIMBURSEMENT = "REIMBURSEMENT"


# ==================== PAYROLL BATCH ====================

class PayrollBatchBase(BaseModel):
    """Payroll batch for grouping records by month/year/country"""
    month: int  # 1-12
    year: int
    country_id: str
    country_name: Optional[str] = None
    
    status: str = PayrollBatchStatus.DRAFT.value
    
    # Summary stats
    employee_count: int = 0
    total_gross: float = 0
    total_statutory_deductions: float = 0
    total_attendance_deductions: float = 0
    total_other_deductions: float = 0
    total_net: float = 0
    
    # Generation metadata
    generated_by: Optional[str] = None
    generated_by_name: Optional[str] = None
    generated_at: Optional[str] = None
    
    # Confirmation metadata
    confirmed_by: Optional[str] = None
    confirmed_by_name: Optional[str] = None
    confirmed_at: Optional[str] = None
    
    # Payment/Close metadata
    closed_by: Optional[str] = None
    closed_by_name: Optional[str] = None
    closed_at: Optional[str] = None
    payment_date: Optional[str] = None
    payment_mode: Optional[str] = None
    transaction_reference: Optional[str] = None
    
    # Currency
    currency: str = "INR"
    currency_symbol: str = "₹"
    
    notes: Optional[str] = None


class PayrollBatchCreate(BaseModel):
    """Request to create a payroll batch"""
    month: int
    year: int
    country_id: str


class PayrollBatch(PayrollBatchBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ==================== PAYROLL RECORDS ====================

class PayrollRecordBase(BaseModel):
    """Monthly payroll record - IMMUTABLE after batch confirmation"""
    # Batch reference
    batch_id: Optional[str] = None  # Links to payroll_batches
    
    employee_id: str
    employee_name: str  # Snapshot at generation
    employee_code: Optional[str] = None
    department_name: Optional[str] = None
    
    month: int  # 1-12
    year: int
    country_id: Optional[str] = None
    
    # Salary structure snapshot (from employee's salary structure at generation time)
    basic_salary: float = 0
    hra: float = 0
    conveyance_allowance: float = 0
    medical_allowance: float = 0
    special_allowance: float = 0
    variable_pay: float = 0
    
    # Gross calculation - NOT EDITABLE
    gross_salary: float = 0  # Sum of all allowances
    
    # Statutory deductions - SEPARATE FIELDS (editable in DRAFT)
    pf_employee: float = 0           # PF Employee Contribution
    pf_employer: float = 0           # PF Employer Contribution (for record keeping)
    professional_tax: float = 0      # PT
    income_tax: float = 0            # TDS
    esi: float = 0                   # ESI (if applicable)
    other_statutory: float = 0       # Other statutory deductions
    total_statutory_deductions: float = 0  # Sum of above
    
    # Attendance-based deductions - AUTO CALCULATED (not editable unless override)
    # Formula: Per Day Salary = Gross / Working Days
    # Attendance Deduction = Per Day Salary * Unapproved Absent Days
    working_days_in_month: int = 0
    per_day_salary: float = 0
    unapproved_absent_days: int = 0
    attendance_deduction: float = 0
    attendance_override: bool = False  # If HR manually overrode attendance deduction
    attendance_override_reason: Optional[str] = None
    
    # Other deductions - EDITABLE
    other_deductions: float = 0
    other_deductions_reason: Optional[str] = None
    
    # Total deductions
    total_deductions: float = 0  # statutory + attendance + other
    
    # Attendance summary snapshot
    present_days: int = 0
    pending_days: int = 0
    absent_days: int = 0
    approved_leave_days: int = 0  # Approved leaves (not counted as absent)
    total_hours_worked: float = 0
    
    # Net salary calculation - AUTO CALCULATED
    # Net = Gross - Total Deductions
    net_salary: float = 0
    
    # For mechanics/freelancers
    is_freelancer: bool = False
    inspections_completed: int = 0
    price_per_inspection: float = 0
    total_inspection_pay: float = 0
    
    # Currency
    currency: str = "INR"
    currency_symbol: str = "₹"
    
    # Generation metadata
    generated_at: Optional[str] = None
    generated_by: Optional[str] = None
    generated_by_name: Optional[str] = None
    
    # Payment tracking
    payment_status: str = PayrollStatus.GENERATED.value
    payment_date: Optional[str] = None
    payment_by: Optional[str] = None
    payment_by_name: Optional[str] = None
    payment_mode: Optional[str] = None
    transaction_reference: Optional[str] = None
    payment_timestamp: Optional[str] = None
    
    # Bank details snapshot
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    
    # Immutability - locked when batch is CONFIRMED
    is_locked: bool = False
    version: int = 1
    
    # Payslip reference
    payslip_path: Optional[str] = None  # Path in object storage
    payslip_generated_at: Optional[str] = None


class PayrollRecordCreate(BaseModel):
    """Request to generate payroll for a month"""
    employee_id: str
    month: int
    year: int


class PayrollBulkGenerateRequest(BaseModel):
    """Request to generate payroll for multiple employees"""
    month: int
    year: int
    employee_ids: Optional[List[str]] = None  # None = all active employees
    country_id: Optional[str] = None  # Filter by country


class PayrollRecord(PayrollRecordBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ==================== PAYROLL ADJUSTMENTS ====================

class PayrollAdjustmentBase(BaseModel):
    """Adjustment record for corrections - original payroll remains immutable"""
    payroll_id: str  # Reference to original payroll record
    employee_id: str
    month: int
    year: int
    
    adjustment_type: str  # BONUS, DEDUCTION, CORRECTION, REIMBURSEMENT
    amount: float  # Positive for bonus/reimbursement, negative for deduction
    reason: str
    
    # Approval
    approved_by: Optional[str] = None
    approved_at: Optional[str] = None
    
    # Payment tracking (if adjustment is paid separately)
    is_paid: bool = False
    paid_with_payroll_id: Optional[str] = None  # If included in next month's payroll
    
    notes: Optional[str] = None


class PayrollAdjustmentCreate(BaseModel):
    payroll_id: str
    adjustment_type: str
    amount: float
    reason: str
    notes: Optional[str] = None


class PayrollAdjustment(PayrollAdjustmentBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    created_by: Optional[str] = None
    created_by_name: Optional[str] = None


# ==================== PAYMENT MARKING ====================

class PaymentMarkRequest(BaseModel):
    """Request to mark payroll as paid - requires transaction reference"""
    transaction_reference: str  # REQUIRED
    payment_date: str  # YYYY-MM-DD
    payment_mode: str  # BANK_TRANSFER, NEFT, RTGS, IMPS, UPI, CHEQUE, CASH
    notes: Optional[str] = None


class BulkPaymentMarkRequest(BaseModel):
    """Request to mark multiple payrolls as paid"""
    payroll_ids: List[str]
    transaction_reference: str
    payment_date: str
    payment_mode: str
    notes: Optional[str] = None


# ==================== PAYSLIP ====================

class PayslipData(BaseModel):
    """Data structure for generating payslip PDF"""
    # Company info
    company_name: str = "WiseDrive Technologies Private Limited"
    company_address: Optional[str] = None
    company_logo_url: Optional[str] = None
    
    # Employee info
    employee_name: str
    employee_code: Optional[str] = None
    employee_email: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    date_of_joining: Optional[str] = None
    
    # Pay period
    pay_period: str  # "February 2025"
    month: int
    year: int
    
    # Earnings breakdown
    earnings: Dict[str, float] = {}  # {"Basic Salary": 25000, "HRA": 10000, ...}
    gross_earnings: float = 0
    
    # Deductions breakdown
    deductions: Dict[str, float] = {}  # {"PF": 1800, "Professional Tax": 200, ...}
    attendance_deduction: float = 0
    total_deductions: float = 0
    
    # Net pay
    net_pay: float = 0
    net_pay_words: str = ""  # "Forty Five Thousand Only"
    
    # Attendance summary
    working_days: int = 0
    days_worked: int = 0
    days_absent: int = 0
    
    # Bank details
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    
    # Payment info
    payment_mode: Optional[str] = None
    transaction_reference: Optional[str] = None
    payment_date: Optional[str] = None
    
    # Currency
    currency_symbol: str = "₹"


# ==================== PAYROLL SUMMARY ====================

class PayrollMonthlySummary(BaseModel):
    """Monthly payroll summary for dashboard"""
    month: int
    year: int
    
    total_employees: int = 0
    total_gross_salary: float = 0
    total_deductions: float = 0
    total_net_salary: float = 0
    
    paid_count: int = 0
    pending_count: int = 0
    
    total_paid_amount: float = 0
    total_pending_amount: float = 0
    
    # By department
    department_breakdown: List[Dict] = []
    
    currency: str = "INR"
    currency_symbol: str = "₹"

"""Finance models - Comprehensive Finance Module"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone
import uuid


# Payment status enum values
PAYMENT_STATUS_PENDING = "pending"
PAYMENT_STATUS_SUBMITTED = "submitted"  # Finance Manager submitted for approval
PAYMENT_STATUS_APPROVED = "approved"    # Country Manager approved
PAYMENT_STATUS_REJECTED = "rejected"    # Country Manager rejected
PAYMENT_STATUS_PAID = "paid"            # Payment completed

# Payment modes
PAYMENT_MODES = ["bank_transfer", "cash", "cheque", "upi", "neft", "rtgs", "imps", "other"]


class PaymentBase(BaseModel):
    """Base payment model for both salary and mechanic payouts"""
    employee_id: str
    payment_type: str = "salary"  # salary, mechanic_payout
    month: int  # 1-12
    year: int
    
    # Amount details
    gross_amount: float = 0
    deductions: float = 0
    net_amount: float = 0
    
    # For mechanic payouts
    inspections_count: int = 0
    rate_per_inspection: float = 0
    bonus_amount: float = 0
    
    # Payment info
    payment_mode: Optional[str] = None  # bank_transfer, cash, cheque, upi, etc.
    payment_date: Optional[str] = None
    transaction_reference: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    
    # Status workflow
    status: str = PAYMENT_STATUS_PENDING
    
    # Approval workflow
    submitted_by: Optional[str] = None
    submitted_at: Optional[str] = None
    approved_by: Optional[str] = None
    approved_at: Optional[str] = None
    rejection_reason: Optional[str] = None
    
    # Additional details
    notes: Optional[str] = None
    country_id: Optional[str] = None
    currency: str = "INR"


class PaymentCreate(PaymentBase):
    pass


class PaymentUpdate(BaseModel):
    gross_amount: Optional[float] = None
    deductions: Optional[float] = None
    net_amount: Optional[float] = None
    inspections_count: Optional[int] = None
    rate_per_inspection: Optional[float] = None
    bonus_amount: Optional[float] = None
    payment_mode: Optional[str] = None
    payment_date: Optional[str] = None
    transaction_reference: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class Payment(PaymentBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None


class PaymentProofBase(BaseModel):
    """Payment proof - uploaded receipts/screenshots"""
    payment_id: str
    file_name: str
    file_url: str
    file_type: str = "image"  # image, pdf
    file_size: int = 0
    uploaded_by: Optional[str] = None


class PaymentProofCreate(PaymentProofBase):
    pass


class PaymentProof(PaymentProofBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PaymentApproval(BaseModel):
    """Model for approval/rejection action"""
    action: str  # approve, reject
    reason: Optional[str] = None


class PayslipData(BaseModel):
    """Model for payslip data - used for PDF generation"""
    # Employee info
    employee_name: str
    employee_code: Optional[str] = None
    employee_email: str
    department: Optional[str] = None
    designation: Optional[str] = None
    
    # Company info
    company_name: str = "WiseDrive Technologies"
    company_address: str = "Bangalore, India"
    
    # Payment period
    month: int
    year: int
    payment_date: Optional[str] = None
    
    # Bank details
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    pan_number: Optional[str] = None
    
    # For salary payments
    basic_salary: float = 0
    hra: float = 0
    conveyance_allowance: float = 0
    medical_allowance: float = 0
    special_allowance: float = 0
    variable_pay: float = 0
    gross_salary: float = 0
    
    # Deductions
    pf_employee: float = 0
    professional_tax: float = 0
    income_tax: float = 0
    other_deductions: float = 0
    total_deductions: float = 0
    
    # Net
    net_salary: float = 0
    
    # For mechanic payouts
    is_mechanic: bool = False
    inspections_count: int = 0
    rate_per_inspection: float = 0
    total_inspection_pay: float = 0
    bonus_amount: float = 0
    
    # Payment info
    payment_mode: Optional[str] = None
    transaction_reference: Optional[str] = None
    
    # Currency
    currency: str = "INR"
    currency_symbol: str = "₹"


class FinanceSummary(BaseModel):
    """Finance summary model for dashboard"""
    total_employees: int = 0
    total_payments_this_month: int = 0
    total_amount_this_month: float = 0
    pending_approvals: int = 0
    approved_payments: int = 0
    paid_payments: int = 0
    rejected_payments: int = 0
    
    # By payment type
    salary_payments_count: int = 0
    salary_payments_amount: float = 0
    mechanic_payouts_count: int = 0
    mechanic_payouts_amount: float = 0
    
    # By status
    status_breakdown: dict = {}
    
    # Monthly trend
    monthly_trend: List[dict] = []

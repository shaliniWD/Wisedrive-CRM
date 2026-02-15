"""Payslip models for ESS Mobile API"""
from pydantic import BaseModel, Field
from typing import Optional, List


class PayslipSummary(BaseModel):
    """Payslip summary for list view"""
    id: str
    period: str  # "December 2025"
    month: int
    year: int
    gross_salary: float
    total_deductions: float
    net_salary: float
    currency_symbol: str
    status: str  # confirmed, paid
    payment_date: Optional[str]
    can_download: bool = True
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "payslip-123",
                "period": "December 2025",
                "month": 12,
                "year": 2025,
                "gross_salary": 75000,
                "total_deductions": 12500,
                "net_salary": 62500,
                "currency_symbol": "₹",
                "status": "paid",
                "payment_date": "2025-12-31",
                "can_download": True
            }
        }


class PayslipEarning(BaseModel):
    """Individual earning component"""
    name: str
    amount: float


class PayslipDeduction(BaseModel):
    """Individual deduction component"""
    name: str
    amount: float


class PayslipDetail(BaseModel):
    """Detailed payslip view"""
    id: str
    employee_id: str
    employee_name: str
    employee_code: str
    period: str
    month: int
    year: int
    
    # Company info
    company_name: str
    company_address: Optional[str]
    
    # Earnings breakdown
    earnings: List[PayslipEarning]
    total_earnings: float
    
    # Deductions breakdown
    deductions: List[PayslipDeduction]
    total_deductions: float
    
    # Net
    net_salary: float
    currency: str
    currency_symbol: str
    
    # Additional info
    working_days: int
    days_worked: int
    lop_days: int
    overtime_days: int
    overtime_pay: float
    incentive_amount: float
    
    # Payment info
    status: str
    payment_date: Optional[str]
    payment_reference: Optional[str]
    
    # Bank details (masked)
    bank_name: Optional[str]
    account_number_masked: Optional[str]
    
    # Download
    pdf_url: Optional[str]
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "payslip-123",
                "employee_id": "emp-123",
                "employee_name": "John Doe",
                "employee_code": "EMP0042",
                "period": "December 2025",
                "month": 12,
                "year": 2025,
                "company_name": "WiseDrive Technologies Pvt Ltd",
                "earnings": [
                    {"name": "Basic Salary", "amount": 40000},
                    {"name": "HRA", "amount": 15000},
                    {"name": "Special Allowance", "amount": 20000}
                ],
                "total_earnings": 75000,
                "deductions": [
                    {"name": "Provident Fund", "amount": 4800},
                    {"name": "Professional Tax", "amount": 200},
                    {"name": "Income Tax (TDS)", "amount": 7500}
                ],
                "total_deductions": 12500,
                "net_salary": 62500,
                "currency": "INR",
                "currency_symbol": "₹",
                "working_days": 22,
                "days_worked": 22,
                "lop_days": 0,
                "overtime_days": 2,
                "overtime_pay": 3000,
                "incentive_amount": 0,
                "status": "paid",
                "payment_date": "2025-12-31"
            }
        }


class PayslipListResponse(BaseModel):
    """Paginated payslip list"""
    payslips: List[PayslipSummary]
    total: int
    page: int
    page_size: int
    has_more: bool

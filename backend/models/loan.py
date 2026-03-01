"""Loan Module Models - Used Car Loans for Inspection Customers"""
from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime
from enum import Enum


# Enums for Loan Status
class LoanLeadStatus(str, Enum):
    NEW = "NEW"
    INTERESTED = "INTERESTED"
    NOT_INTERESTED = "NOT_INTERESTED"
    RNR = "RNR"  # Ring No Response
    CALL_BACK = "CALL_BACK"
    FOLLOW_UP = "FOLLOW_UP"


class CustomerType(str, Enum):
    SALARIED = "SALARIED"
    SELF_EMPLOYED = "SELF_EMPLOYED"


class LoanApplicationStatus(str, Enum):
    DRAFT = "DRAFT"
    APPLIED = "APPLIED"
    ACCEPTED_BY_BANK = "ACCEPTED_BY_BANK"
    IN_PROCESS = "IN_PROCESS"
    REJECTED_BY_BANK = "REJECTED_BY_BANK"
    APPROVED_BY_BANK = "APPROVED_BY_BANK"
    OFFER_RECEIVED = "OFFER_RECEIVED"  # New: Bank has sent offer with charges
    OFFER_NEGOTIATED = "OFFER_NEGOTIATED"  # New: Customer negotiated charges
    OFFER_ACCEPTED = "OFFER_ACCEPTED"  # New: Customer accepted the offer
    LOAN_DISBURSED = "LOAN_DISBURSED"


# Loan Offer Charges Model
class LoanOfferCharge(BaseModel):
    """Individual charge in a loan offer"""
    charge_type: str  # processing_fee, document_handling, rto_charges, insurance_charges, other
    charge_name: str
    amount: float
    is_percentage: bool = False  # If true, amount is a percentage of loan amount
    percentage_value: Optional[float] = None  # Original percentage if applicable
    is_waived: bool = False
    is_negotiable: bool = True
    notes: Optional[str] = None


class LoanOffer(BaseModel):
    """Bank loan offer with all charges - created when bank approves"""
    id: str
    application_id: str
    loan_lead_id: str
    vehicle_loan_id: str
    bank_id: str
    bank_name: str
    
    # Approved amounts
    loan_amount_approved: float  # Principal approved by bank
    loan_insurance: float = 0  # Insurance added to loan
    total_loan_amount: float  # loan_amount_approved + loan_insurance
    
    # Interest and tenure
    interest_rate: float
    tenure_months: int
    emi_amount: float
    
    # Charges (deducted from total loan amount)
    charges: List[LoanOfferCharge] = []
    total_charges: float = 0  # Sum of all non-waived charges
    
    # Net disbursal
    net_disbursal_amount: float  # total_loan_amount - total_charges
    
    # Bank reference
    bank_reference_number: Optional[str] = None
    bank_sanction_letter_url: Optional[str] = None
    
    # Offer status
    offer_status: str = "PENDING"  # PENDING, NEGOTIATING, ACCEPTED, REJECTED, EXPIRED
    offer_valid_until: Optional[datetime] = None
    
    # Negotiation history
    negotiation_history: List[dict] = []
    
    # Final accepted values (after negotiation)
    final_charges: Optional[List[LoanOfferCharge]] = None
    final_net_disbursal: Optional[float] = None
    
    # Audit
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None


class LoanOfferCreate(BaseModel):
    """Create a new loan offer"""
    application_id: str
    loan_amount_approved: float
    loan_insurance: float = 0
    interest_rate: float
    tenure_months: int
    bank_reference_number: Optional[str] = None
    offer_valid_until: Optional[datetime] = None
    
    # Initial charges
    processing_fee_percent: Optional[float] = None  # 0-2%
    processing_fee_amount: Optional[float] = None  # Fixed amount if not percentage
    document_handling_fee: Optional[float] = None
    rto_charges: Optional[float] = None
    insurance_charges: Optional[float] = None  # If car doesn't have existing insurance
    other_charges: Optional[List[dict]] = None  # List of {name, amount}


class LoanOfferChargeUpdate(BaseModel):
    """Update a single charge (for negotiation)"""
    charge_type: str
    new_amount: Optional[float] = None
    is_waived: Optional[bool] = None
    notes: Optional[str] = None


class LoanOfferUpdate(BaseModel):
    """Update loan offer (including negotiation)"""
    offer_status: Optional[str] = None
    charges_updates: Optional[List[LoanOfferChargeUpdate]] = None
    negotiation_notes: Optional[str] = None


# Document Models
class LoanDocument(BaseModel):
    id: str
    document_type: str  # e.g., "salary_slip", "bank_statement", "itr", etc.
    file_url: str
    file_name: str
    uploaded_at: datetime
    uploaded_by: Optional[str] = None


class DocumentRequirement(BaseModel):
    """Document requirements based on customer type"""
    document_type: str
    display_name: str
    required: bool = True
    description: Optional[str] = None


# Bank Master Models
class BankPOC(BaseModel):
    """Point of Contact for a bank in a specific city"""
    city_id: str
    city_name: str
    contact_name: str
    contact_phone: str
    contact_email: Optional[str] = None


class EligibilityRule(BaseModel):
    """Eligibility rules for a bank"""
    min_income: Optional[float] = None  # Monthly income
    min_credit_score: Optional[int] = None
    min_vehicle_age: Optional[int] = None  # In years
    max_vehicle_age: Optional[int] = None  # In years
    min_loan_amount: Optional[float] = None
    max_loan_amount: Optional[float] = None
    employment_types: List[str] = ["SALARIED", "SELF_EMPLOYED"]


class BankMaster(BaseModel):
    """Bank master data for loan processing"""
    id: str
    bank_name: str
    bank_code: str  # Short code like "HDFC", "ICICI"
    logo_url: Optional[str] = None
    interest_rate_min: float  # Minimum interest rate %
    interest_rate_max: float  # Maximum interest rate %
    max_tenure_months: int = 84  # Max loan tenure in months
    max_ltv_percent: float = 80.0  # Max Loan to Value percentage
    processing_fee_percent: float = 1.0  # Processing fee %
    eligibility_rules: EligibilityRule = Field(default_factory=EligibilityRule)
    payout_commission_percent: float = 0.5  # Our commission %
    city_pocs: List[BankPOC] = []
    is_active: bool = True
    created_at: datetime
    updated_at: datetime


class BankMasterCreate(BaseModel):
    bank_name: str
    bank_code: str
    logo_url: Optional[str] = None
    interest_rate_min: float
    interest_rate_max: float
    max_tenure_months: int = 84
    max_ltv_percent: float = 80.0
    processing_fee_percent: float = 1.0
    eligibility_rules: Optional[EligibilityRule] = None
    payout_commission_percent: float = 0.5
    city_pocs: List[BankPOC] = []
    is_active: bool = True


class BankMasterUpdate(BaseModel):
    bank_name: Optional[str] = None
    bank_code: Optional[str] = None
    logo_url: Optional[str] = None
    interest_rate_min: Optional[float] = None
    interest_rate_max: Optional[float] = None
    max_tenure_months: Optional[int] = None
    max_ltv_percent: Optional[float] = None
    processing_fee_percent: Optional[float] = None
    eligibility_rules: Optional[EligibilityRule] = None
    payout_commission_percent: Optional[float] = None
    city_pocs: Optional[List[BankPOC]] = None
    is_active: Optional[bool] = None


# Vehicle Loan Details
class VehicleLoanDetails(BaseModel):
    """Loan details for a specific vehicle"""
    vehicle_id: str  # ID of the vehicle/inspection
    car_number: str
    car_make: Optional[str] = None
    car_model: Optional[str] = None
    car_year: Optional[int] = None
    car_variant: Optional[str] = None
    vehicle_valuation: Optional[float] = None  # Market value
    required_loan_amount: Optional[float] = None
    expected_emi: Optional[float] = None
    expected_interest_rate: Optional[float] = None
    expected_tenure_months: Optional[int] = None
    rc_card_url: Optional[str] = None
    insurance_doc_url: Optional[str] = None
    vaahan_data: Optional[dict] = None  # Raw Vaahan API data
    added_at: datetime


# Bank Eligibility Check Result
class BankEligibilityResult(BaseModel):
    """Result of bank eligibility check"""
    bank_id: str
    bank_name: str
    bank_code: str
    is_eligible: bool
    interest_rate: Optional[float] = None  # Offered interest rate
    max_loan_amount: Optional[float] = None  # Max eligible amount (80% of valuation)
    emi_amount: Optional[float] = None
    tenure_months: Optional[int] = None
    processing_fee: Optional[float] = None
    rejection_reason: Optional[str] = None
    checked_at: datetime


# Loan Application per Vehicle per Bank
class LoanApplication(BaseModel):
    """Loan application for a specific vehicle to a specific bank"""
    id: str
    loan_lead_id: str
    vehicle_loan_id: str  # Reference to VehicleLoanDetails
    bank_id: str
    bank_name: str
    status: LoanApplicationStatus = LoanApplicationStatus.DRAFT
    applied_amount: Optional[float] = None
    approved_amount: Optional[float] = None
    interest_rate: Optional[float] = None
    tenure_months: Optional[int] = None
    emi_amount: Optional[float] = None
    processing_fee: Optional[float] = None
    disbursement_date: Optional[datetime] = None
    bank_reference_number: Optional[str] = None
    remarks: Optional[str] = None
    status_history: List[dict] = []  # Track status changes
    created_at: datetime
    updated_at: datetime


# Loan Lead (Main customer record for loans)
class LoanLead(BaseModel):
    """Main loan lead record - represents a customer interested in loans"""
    id: str
    customer_id: str
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    city_id: Optional[str] = None
    city_name: Optional[str] = None
    
    # Status tracking
    status: LoanLeadStatus = LoanLeadStatus.NEW
    status_notes: Optional[str] = None
    last_contacted_at: Optional[datetime] = None
    next_follow_up_at: Optional[datetime] = None
    
    # Customer type and documents
    customer_type: Optional[CustomerType] = None
    documents: List[LoanDocument] = []
    
    # Vehicles for loan
    vehicles: List[VehicleLoanDetails] = []
    
    # Loan applications (per vehicle per bank)
    applications: List[LoanApplication] = []
    
    # Bank loan offers (after approval)
    loan_offers: List[LoanOffer] = []
    
    # Bank eligibility results
    eligibility_results: List[BankEligibilityResult] = []
    
    # Credit score (future use)
    credit_score: Optional[int] = None
    credit_score_fetched_at: Optional[datetime] = None
    credit_score_full_report: Optional[dict] = None
    
    # Audit
    assigned_to: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None


class LoanLeadCreate(BaseModel):
    customer_id: str
    status: Optional[LoanLeadStatus] = LoanLeadStatus.NEW
    status_notes: Optional[str] = None
    customer_type: Optional[CustomerType] = None
    assigned_to: Optional[str] = None


class LoanLeadUpdate(BaseModel):
    status: Optional[LoanLeadStatus] = None
    status_notes: Optional[str] = None
    customer_type: Optional[CustomerType] = None
    next_follow_up_at: Optional[datetime] = None
    credit_score: Optional[int] = None
    assigned_to: Optional[str] = None


class VehicleLoanDetailsCreate(BaseModel):
    car_number: str
    car_make: Optional[str] = None
    car_model: Optional[str] = None
    car_year: Optional[int] = None
    car_variant: Optional[str] = None
    vehicle_valuation: Optional[float] = None
    required_loan_amount: Optional[float] = None
    expected_emi: Optional[float] = None
    expected_interest_rate: Optional[float] = None
    expected_tenure_months: Optional[int] = None
    inspection_id: Optional[str] = None  # If from an inspection


class LoanApplicationCreate(BaseModel):
    vehicle_loan_id: str
    bank_id: str
    applied_amount: Optional[float] = None
    tenure_months: Optional[int] = None


class LoanApplicationUpdate(BaseModel):
    status: Optional[LoanApplicationStatus] = None
    approved_amount: Optional[float] = None
    interest_rate: Optional[float] = None
    tenure_months: Optional[int] = None
    emi_amount: Optional[float] = None
    processing_fee: Optional[float] = None
    disbursement_date: Optional[datetime] = None
    bank_reference_number: Optional[str] = None
    remarks: Optional[str] = None


# Document type definitions
SALARIED_DOCUMENTS = [
    DocumentRequirement(document_type="salary_slip_1", display_name="Salary Slip (Month 1)", required=True),
    DocumentRequirement(document_type="salary_slip_2", display_name="Salary Slip (Month 2)", required=True),
    DocumentRequirement(document_type="salary_slip_3", display_name="Salary Slip (Month 3)", required=True),
    DocumentRequirement(document_type="bank_statement", display_name="Bank Statement (6 months)", required=True),
    DocumentRequirement(document_type="id_proof", display_name="ID Proof (Aadhaar/PAN)", required=True),
    DocumentRequirement(document_type="address_proof", display_name="Address Proof", required=True),
    DocumentRequirement(document_type="photo", display_name="Passport Photo", required=False),
]

SELF_EMPLOYED_DOCUMENTS = [
    DocumentRequirement(document_type="itr_1", display_name="ITR (Year 1)", required=True),
    DocumentRequirement(document_type="itr_2", display_name="ITR (Year 2)", required=True),
    DocumentRequirement(document_type="bank_statement", display_name="Bank Statement (12 months)", required=True),
    DocumentRequirement(document_type="business_registration", display_name="Business Registration", required=True),
    DocumentRequirement(document_type="gst_returns", display_name="GST Returns (Last 6 months)", required=False),
    DocumentRequirement(document_type="id_proof", display_name="ID Proof (Aadhaar/PAN)", required=True),
    DocumentRequirement(document_type="address_proof", display_name="Address Proof", required=True),
    DocumentRequirement(document_type="photo", display_name="Passport Photo", required=False),
]

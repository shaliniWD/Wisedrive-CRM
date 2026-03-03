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


# Loan Offer Charge Types - Saved to DB for reuse
class ChargeType(BaseModel):
    """Reusable charge type that can be added to any offer"""
    id: str
    charge_key: str  # Unique key like 'processing_fee', 'valuation_charges', etc.
    charge_name: str  # Display name
    description: Optional[str] = None
    default_amount: Optional[float] = None
    is_percentage: bool = False
    default_percentage: Optional[float] = None
    is_negotiable: bool = True
    is_system: bool = False  # True for built-in charges, False for custom
    is_active: bool = True
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None


class ChargeTypeCreate(BaseModel):
    """Create a new charge type"""
    charge_key: str
    charge_name: str
    description: Optional[str] = None
    default_amount: Optional[float] = None
    is_percentage: bool = False
    default_percentage: Optional[float] = None
    is_negotiable: bool = True


# Loan Offer Charges Model
class LoanOfferCharge(BaseModel):
    """Individual charge in a loan offer"""
    charge_type: str  # processing_fee, document_handling, rto_charges, insurance_charges, valuation_charges, stamp_duty, custom
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
    
    # Initial charges - standard charges
    processing_fee_percent: Optional[float] = None  # 0-2%
    processing_fee_amount: Optional[float] = None  # Fixed amount if not percentage
    document_handling_fee: Optional[float] = None
    rto_charges: Optional[float] = None
    insurance_charges: Optional[float] = None  # If car doesn't have existing insurance
    valuation_charges: Optional[float] = None  # NEW: Valuation charges
    stamp_duty: Optional[float] = None  # NEW: Stamp duty amount
    other_charges: Optional[List[dict]] = None  # List of {charge_type, charge_name, amount, is_percentage, percentage_value}


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
    """Comprehensive eligibility rules for a bank based on actual bank policies"""
    
    # === CUSTOMER CRITERIA ===
    # Age Requirements
    min_age_salaried: Optional[int] = 23  # Minimum age for salaried
    min_age_self_employed: Optional[int] = 25  # Minimum age for self-employed
    max_age_at_maturity: Optional[int] = 65  # Age at loan maturity
    
    # Employment Requirements
    employment_types: List[str] = ["SALARIED", "SELF_EMPLOYED"]
    min_work_experience_years: Optional[int] = 2  # Minimum years of experience
    min_current_job_months: Optional[int] = 6  # Minimum months in current job
    
    # Income Requirements (Monthly)
    min_income_salaried: Optional[float] = 25000  # Min monthly salary
    min_income_self_employed: Optional[float] = 50000  # Min monthly income (ITR based)
    income_multiplier_salaried: Optional[float] = 20  # Loan = Salary * multiplier
    income_multiplier_self_employed: Optional[float] = 5  # Loan = Annual profit * multiplier
    
    # === CREDIT CRITERIA ===
    # CIBIL Score
    min_credit_score: Optional[int] = 700  # Minimum CIBIL score
    preferred_credit_score: Optional[int] = 750  # Score for best rates
    
    # Credit History
    max_bounces_3_months: Optional[int] = 0  # Max bounces in last 3 months
    max_bounces_6_months: Optional[int] = 1  # Max bounces in last 6 months
    max_bounces_12_months: Optional[int] = 2  # Max bounces in last 12 months
    max_dpd_30_plus: Optional[int] = 0  # Max DPD 30+ instances in last 12 months
    max_dpd_60_plus: Optional[int] = 0  # Max DPD 60+ instances in last 24 months
    max_dpd_90_plus: Optional[int] = 0  # Max DPD 90+ instances ever
    max_unsecured_loans_3_months: Optional[int] = 1  # Max new unsecured loans
    max_credit_enquiries_6_months: Optional[int] = 5  # Max enquiries
    
    # Existing Obligations
    max_foir_percent: Optional[float] = 65  # Fixed Obligations to Income Ratio
    max_emi_to_aqb_ratio: Optional[float] = 50  # EMI to Avg Quarterly Balance ratio
    
    # === VEHICLE CRITERIA ===
    # Vehicle Age
    min_vehicle_age_years: Optional[int] = 0  # Minimum vehicle age
    max_vehicle_age_years: Optional[int] = 10  # Maximum vehicle age at purchase
    max_vehicle_age_at_maturity: Optional[int] = 15  # Max age at loan end (EOT)
    
    # Vehicle Categories (Cat 1 = Premium SUV/Sedan, Cat 2 = Hatchback/Budget)
    supported_vehicle_categories: List[str] = ["CAT_1", "CAT_2", "PREMIUM", "MUV"]
    
    # Ownership
    max_ownership_count: Optional[int] = 3  # 1st, 2nd, 3rd owner
    
    # Excluded Makes (Banks like HDFC don't fund certain brands)
    excluded_car_makes: List[str] = []  # e.g., ["CHEVROLET", "FORD", "FIAT"]
    min_model_year: Optional[int] = None  # e.g., 2015 means only 2015+ cars
    
    # === LOAN PARAMETERS ===
    # Loan Amount
    min_loan_amount: Optional[float] = 100000  # Minimum loan amount
    max_loan_amount: Optional[float] = 2500000  # Maximum loan amount
    
    # LTV (Loan to Value) - varies by vehicle age
    ltv_0_3_years: Optional[float] = 85  # LTV for 0-3 year old cars
    ltv_3_5_years: Optional[float] = 80  # LTV for 3-5 year old cars
    ltv_5_7_years: Optional[float] = 75  # LTV for 5-7 year old cars
    ltv_7_10_years: Optional[float] = 70  # LTV for 7-10 year old cars
    ltv_10_plus_years: Optional[float] = 60  # LTV for 10+ year old cars
    max_ltv_percent: Optional[float] = 80  # Overall max LTV
    
    # Tenure
    min_tenure_months: Optional[int] = 12  # Minimum tenure
    max_tenure_months: Optional[int] = 60  # Maximum tenure (some banks 84)
    
    # Interest Rate (indicative)
    base_interest_rate: Optional[float] = 14.0  # Base rate
    max_interest_rate: Optional[float] = 18.0  # Max rate for risky profiles
    
    # Fees
    processing_fee_percent: Optional[float] = 1.0  # Processing fee %
    min_processing_fee: Optional[float] = 2500  # Minimum processing fee
    max_processing_fee: Optional[float] = 25000  # Maximum processing fee
    
    # === LOCATION CRITERIA ===
    # Some banks have different rules for rural/urban
    min_aqb_metro: Optional[float] = 10000  # Min AQB for metro customers
    min_aqb_non_metro: Optional[float] = 5000  # Min AQB for non-metro
    restricted_locations: List[str] = []  # Pincodes or cities not served
    
    # === ADDITIONAL FLAGS ===
    requires_guarantor: bool = False  # If guarantor is mandatory
    requires_property_proof: bool = False  # If property proof needed
    allows_top_up: bool = True  # If top-up loans allowed


class CustomerLocationType(str, Enum):
    """Customer location classification - affects loan eligibility"""
    RURAL = "RURAL"
    SEMI_URBAN = "SEMI_URBAN"
    URBAN = "URBAN"
    METRO = "METRO"


class BankStatementAnalysis(BaseModel):
    """AI-analyzed bank statement data"""
    bank_name: Optional[str] = None
    account_number_masked: Optional[str] = None  # Last 4 digits only
    statement_period_from: Optional[str] = None
    statement_period_to: Optional[str] = None
    
    # ABB Analysis
    average_bank_balance: Optional[float] = None
    minimum_balance: Optional[float] = None
    maximum_balance: Optional[float] = None
    end_of_month_balances: List[dict] = []  # [{month, balance}]
    
    # Income Analysis
    total_credits: Optional[float] = None
    average_monthly_credits: Optional[float] = None
    salary_credits_identified: Optional[float] = None
    regular_income_sources: List[dict] = []  # [{source, amount, frequency}]
    
    # Spending Patterns
    total_debits: Optional[float] = None
    average_monthly_debits: Optional[float] = None
    emi_payments_identified: List[dict] = []  # [{lender, amount, frequency}]
    loan_repayments_total: Optional[float] = None
    high_value_transactions: List[dict] = []  # [{date, amount, description}]
    
    # Risk Indicators
    bounce_count: int = 0
    low_balance_days: int = 0  # Days balance < 5000
    cash_withdrawal_ratio: Optional[float] = None  # % of total debits
    
    # Analysis Metadata
    analyzed_at: Optional[datetime] = None
    confidence_score: Optional[float] = None  # 0-100
    analysis_notes: Optional[str] = None
    raw_analysis: Optional[dict] = None  # Full AI response


class CreditProfileAnalysis(BaseModel):
    """Analyzed credit bureau report summary"""
    credit_score: Optional[int] = None
    score_rating: Optional[str] = None  # EXCELLENT, GOOD, FAIR, POOR
    bureau_source: Optional[str] = None  # equifax, experian, both
    
    # Account Summary
    total_accounts: int = 0
    active_accounts: int = 0
    closed_accounts: int = 0
    delinquent_accounts: int = 0
    
    # Outstanding
    total_outstanding: Optional[float] = None
    secured_outstanding: Optional[float] = None
    unsecured_outstanding: Optional[float] = None
    
    # Payment History
    on_time_payment_percent: Optional[float] = None
    max_dpd_last_12_months: int = 0  # Max Days Past Due
    
    # Existing Loans
    existing_auto_loans: List[dict] = []  # [{lender, amount, emi, status}]
    existing_personal_loans: List[dict] = []
    credit_cards: List[dict] = []  # [{bank, limit, utilization}]
    
    # Risk Flags
    has_write_offs: bool = False
    has_settlements: bool = False
    has_defaults: bool = False
    enquiry_count_last_6_months: int = 0
    
    analyzed_at: Optional[datetime] = None


class CustomerKYC(BaseModel):
    """Complete KYC details for customer"""
    # Basic Info
    full_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    father_name: Optional[str] = None
    
    # Identity
    pan_number: Optional[str] = None
    pan_verified: bool = False
    aadhaar_number_masked: Optional[str] = None  # Last 4 digits
    aadhaar_verified: bool = False
    
    # Contact
    mobile_primary: Optional[str] = None
    mobile_alternate: Optional[str] = None
    email: Optional[str] = None
    
    # Address
    current_address: Optional[str] = None
    current_city: Optional[str] = None
    current_state: Optional[str] = None
    current_pincode: Optional[str] = None
    address_proof_type: Optional[str] = None  # AADHAAR, UTILITY_BILL, etc.
    
    # Employment
    employment_type: Optional[str] = None  # SALARIED, SELF_EMPLOYED
    employer_name: Optional[str] = None
    designation: Optional[str] = None
    monthly_income: Optional[float] = None
    work_experience_years: Optional[int] = None
    
    # Bank Details
    bank_name: Optional[str] = None
    account_number_masked: Optional[str] = None
    ifsc_code: Optional[str] = None
    
    kyc_completed_at: Optional[datetime] = None
    kyc_verified_by: Optional[str] = None


class VehicleEligibilityAnalysis(BaseModel):
    """Vehicle analysis for loan eligibility"""
    vehicle_id: str
    car_number: str
    car_make: Optional[str] = None
    car_model: Optional[str] = None
    car_year: Optional[int] = None
    
    # Valuation
    vehicle_valuation: Optional[float] = None
    valuation_source: Optional[str] = None  # MANUAL, VAAHAN, INSPECTION
    
    # Age Analysis
    vehicle_age_years: Optional[int] = None
    is_within_10_years: bool = False
    is_within_15_years: bool = False
    
    # Make Analysis
    is_excluded_make: bool = False
    excluded_make_reason: Optional[str] = None  # "Ford/Chevy not funded - no service network"
    
    # Eligibility Summary
    eligible_banks_count: int = 0
    max_loan_eligible: Optional[float] = None  # Based on LTV
    recommended_loan_amount: Optional[float] = None


class CustomerProfile(BaseModel):
    """Complete customer profile for loan eligibility"""
    id: str
    loan_lead_id: str
    
    # Profile Status
    profile_status: str = "INCOMPLETE"  # INCOMPLETE, PARTIAL, COMPLETE, VERIFIED
    profile_score: int = 0  # 0-100 based on completeness
    
    # 1. Bank Statement Analysis
    bank_statement_analysis: Optional[BankStatementAnalysis] = None
    bank_statement_document_id: Optional[str] = None
    
    # 2. Credit Bureau Analysis
    credit_profile: Optional[CreditProfileAnalysis] = None
    
    # 3. Location Classification
    location_type: Optional[CustomerLocationType] = None
    location_auto_detected: bool = False
    location_city: Optional[str] = None
    location_pincode: Optional[str] = None
    
    # 4. Vehicle Analysis (per vehicle)
    vehicle_analyses: List[VehicleEligibilityAnalysis] = []
    
    # 5. KYC
    kyc: Optional[CustomerKYC] = None
    
    # Overall Eligibility
    overall_eligibility_score: Optional[int] = None  # 0-100
    eligibility_factors: List[dict] = []  # [{factor, score, weight, notes}]
    recommended_banks: List[str] = []  # Bank IDs in order of preference
    
    # Audit
    created_at: datetime
    updated_at: datetime
    analyzed_by: Optional[str] = None


class CustomerProfileUpdate(BaseModel):
    """Update customer profile fields"""
    location_type: Optional[CustomerLocationType] = None
    location_pincode: Optional[str] = None
    kyc: Optional[CustomerKYC] = None


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
    city_id: Optional[str] = None
    city_name: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    # Credit report fields
    pan_number: Optional[str] = None
    credit_first_name: Optional[str] = None
    credit_last_name: Optional[str] = None
    gender: Optional[str] = None
    email: Optional[str] = None


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
# Document requirement definitions based on bank policies
SALARIED_DOCUMENTS = [
    # KYC Documents
    DocumentRequirement(document_type="pan_card", display_name="PAN Card", required=True, description="For identity verification and tax records"),
    DocumentRequirement(document_type="aadhaar_card", display_name="Aadhaar Card", required=True, description="Government ID proof with address"),
    DocumentRequirement(document_type="photo", display_name="Passport Size Photo", required=True, description="Recent photograph"),
    
    # Income Documents
    DocumentRequirement(document_type="salary_slip_1", display_name="Salary Slip (Month 1)", required=True, description="Latest month salary slip"),
    DocumentRequirement(document_type="salary_slip_2", display_name="Salary Slip (Month 2)", required=True, description="Previous month salary slip"),
    DocumentRequirement(document_type="salary_slip_3", display_name="Salary Slip (Month 3)", required=True, description="2 months ago salary slip"),
    DocumentRequirement(document_type="bank_statement", display_name="Bank Statement (6 months)", required=True, description="Salary account statement showing credits"),
    
    # Employment Documents
    DocumentRequirement(document_type="employment_id", display_name="Employment ID Card", required=False, description="Company ID or offer letter"),
    DocumentRequirement(document_type="form_16", display_name="Form 16", required=False, description="Tax deduction certificate from employer"),
    
    # Address Documents
    DocumentRequirement(document_type="address_proof", display_name="Address Proof", required=True, description="Utility bill, rent agreement, or Aadhaar"),
    DocumentRequirement(document_type="rent_agreement", display_name="Rent Agreement", required=False, description="Required if renting - min 2 years"),
    
    # Vehicle Documents (for loan processing)
    DocumentRequirement(document_type="vehicle_rc", display_name="Vehicle RC Book", required=True, description="Registration Certificate of the vehicle"),
    DocumentRequirement(document_type="vehicle_insurance", display_name="Vehicle Insurance", required=True, description="Valid insurance - min 60 days remaining"),
]

SELF_EMPLOYED_DOCUMENTS = [
    # KYC Documents
    DocumentRequirement(document_type="pan_card", display_name="PAN Card", required=True, description="For identity verification and tax records"),
    DocumentRequirement(document_type="aadhaar_card", display_name="Aadhaar Card", required=True, description="Government ID proof with address"),
    DocumentRequirement(document_type="photo", display_name="Passport Size Photo", required=True, description="Recent photograph"),
    
    # Income Documents
    DocumentRequirement(document_type="itr_1", display_name="ITR (Year 1 - Latest)", required=True, description="Income Tax Return - Latest year"),
    DocumentRequirement(document_type="itr_2", display_name="ITR (Year 2)", required=True, description="Income Tax Return - Previous year"),
    DocumentRequirement(document_type="bank_statement", display_name="Bank Statement (12 months)", required=True, description="Business account statement"),
    DocumentRequirement(document_type="computation_of_income", display_name="Computation of Income", required=False, description="CA certified if available"),
    
    # Business Documents
    DocumentRequirement(document_type="business_registration", display_name="Business Registration", required=True, description="Shop Act / Udyam / Company Registration"),
    DocumentRequirement(document_type="gst_certificate", display_name="GST Certificate", required=False, description="GST registration certificate"),
    DocumentRequirement(document_type="gst_returns", display_name="GST Returns (6 months)", required=False, description="Monthly GST filings"),
    
    # Address Documents
    DocumentRequirement(document_type="address_proof", display_name="Address Proof", required=True, description="Utility bill, rent agreement, or Aadhaar"),
    DocumentRequirement(document_type="business_address_proof", display_name="Business Address Proof", required=False, description="Shop/office address proof"),
    
    # Vehicle Documents (for loan processing)
    DocumentRequirement(document_type="vehicle_rc", display_name="Vehicle RC Book", required=True, description="Registration Certificate of the vehicle"),
    DocumentRequirement(document_type="vehicle_insurance", display_name="Vehicle Insurance", required=True, description="Valid insurance - min 60 days remaining"),
]

# All available document types for reference
ALL_DOCUMENT_TYPES = {
    # KYC
    "pan_card": "PAN Card",
    "aadhaar_card": "Aadhaar Card",
    "photo": "Passport Size Photo",
    
    # Income - Salaried
    "salary_slip_1": "Salary Slip (Month 1)",
    "salary_slip_2": "Salary Slip (Month 2)",
    "salary_slip_3": "Salary Slip (Month 3)",
    "form_16": "Form 16",
    "employment_id": "Employment ID Card",
    
    # Income - Self Employed
    "itr_1": "ITR (Year 1)",
    "itr_2": "ITR (Year 2)",
    "computation_of_income": "Computation of Income",
    "gst_certificate": "GST Certificate",
    "gst_returns": "GST Returns",
    "business_registration": "Business Registration",
    
    # Bank & Financial
    "bank_statement": "Bank Statement",
    
    # Address
    "address_proof": "Address Proof",
    "rent_agreement": "Rent Agreement",
    "business_address_proof": "Business Address Proof",
    
    # Vehicle
    "vehicle_rc": "Vehicle RC Book",
    "vehicle_insurance": "Vehicle Insurance",
    "vehicle_photos": "Vehicle Photos",
}


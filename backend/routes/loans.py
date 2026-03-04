"""
Loans Module Routes - Bank Master & Loan Lead Management
Handles all loan-related endpoints including:
- Bank master CRUD
- Loan leads management
- Document upload/download
- Credit score check (Equifax/Experian)
- Vehicle loan details
- Bank eligibility checking
- Loan applications
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import logging
import httpx
import json
import os
import random

from models.loan import (
    BankMaster, BankMasterCreate, BankMasterUpdate, BankPOC,
    LoanLead, LoanLeadCreate, LoanLeadUpdate, LoanLeadStatus,
    VehicleLoanDetails, VehicleLoanDetailsCreate,
    LoanApplication, LoanApplicationCreate, LoanApplicationUpdate,
    LoanDocument, BankEligibilityResult, CustomerType,
    SALARIED_DOCUMENTS, SELF_EMPLOYED_DOCUMENTS, LoanApplicationStatus,
    LoanOffer, LoanOfferCreate, LoanOfferUpdate, LoanOfferCharge, LoanOfferChargeUpdate,
    ChargeType, ChargeTypeCreate,
    CustomerProfile, CustomerProfileUpdate, CustomerLocationType,
    BankStatementAnalysis, CreditProfileAnalysis, CustomerKYC, VehicleEligibilityAnalysis
)
from services.bank_statement_service import analyze_bank_statement_from_url
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Create router
router = APIRouter(tags=["Loans"])

# Security scheme
security = HTTPBearer()

# These will be set by init_loans_routes
db = None
_auth_validator = None  # Function to validate and return user from token
storage_service = None

# API Keys for Credit Score (from environment)
EXPERIAN_CLIENT_ID = os.environ.get('EXPERIAN_CLIENT_ID', '')
EXPERIAN_SECRET_KEY = os.environ.get('EXPERIAN_SECRET_KEY', '')


# Credit Score Request Models
class CreditScoreOTPRequest(BaseModel):
    first_name: str
    last_name: str
    pan_number: str
    dob: str  # Format: YYYYMMDD
    mobile_number: str
    email: str
    gender: str  # "male" or "female"
    pin_code: str
    bureau: str = "equifax"  # "equifax" (V1) or "experian" (V4)


class CreditScoreVerifyRequest(BaseModel):
    token: str
    otp: str
    bureau: str = "equifax"


def init_loans_routes(_db, _get_current_user, _storage_service=None):
    """Initialize loans routes with dependencies"""
    global db, _auth_validator, storage_service
    db = _db
    _auth_validator = _get_current_user
    storage_service = _storage_service


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Authenticate user using the injected validator"""
    if _auth_validator is None:
        raise HTTPException(status_code=500, detail="Auth not initialized")
    # Call the injected auth validator with credentials
    return await _auth_validator(credentials)


# ========================
# BANK MASTER ENDPOINTS
# ========================

@router.get("/banks")
async def get_banks(
    is_active: Optional[bool] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all banks from master data"""
    query = {}
    if is_active is not None:
        query["is_active"] = is_active
    
    banks = await db.bank_master.find(query, {"_id": 0}).sort("bank_name", 1).to_list(100)
    return banks


@router.get("/banks/{bank_id}")
async def get_bank(bank_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific bank"""
    bank = await db.bank_master.find_one({"id": bank_id}, {"_id": 0})
    if not bank:
        raise HTTPException(status_code=404, detail="Bank not found")
    return bank


@router.post("/banks")
async def create_bank(
    bank_data: BankMasterCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new bank in master data"""
    now = datetime.now(timezone.utc)
    
    existing = await db.bank_master.find_one({"bank_code": bank_data.bank_code})
    if existing:
        raise HTTPException(status_code=400, detail="Bank code already exists")
    
    bank = {
        "id": str(uuid.uuid4()),
        "bank_name": bank_data.bank_name,
        "bank_code": bank_data.bank_code.upper(),
        "logo_url": bank_data.logo_url,
        "interest_rate_min": bank_data.interest_rate_min,
        "interest_rate_max": bank_data.interest_rate_max,
        "max_tenure_months": bank_data.max_tenure_months,
        "max_ltv_percent": bank_data.max_ltv_percent,
        "processing_fee_percent": bank_data.processing_fee_percent,
        "eligibility_rules": bank_data.eligibility_rules.model_dump() if bank_data.eligibility_rules else {},
        "payout_commission_percent": bank_data.payout_commission_percent,
        "city_pocs": [poc.model_dump() for poc in bank_data.city_pocs] if bank_data.city_pocs else [],
        "is_active": bank_data.is_active,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.bank_master.insert_one(bank)
    bank.pop("_id", None)
    return bank


@router.put("/banks/{bank_id}")
async def update_bank(
    bank_id: str,
    bank_data: BankMasterUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a bank in master data"""
    bank = await db.bank_master.find_one({"id": bank_id})
    if not bank:
        raise HTTPException(status_code=404, detail="Bank not found")
    
    update_dict = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    for field, value in bank_data.model_dump(exclude_unset=True).items():
        if value is not None:
            if field == "eligibility_rules" and isinstance(value, dict):
                update_dict[field] = value
            elif field == "city_pocs" and isinstance(value, list):
                update_dict[field] = [poc if isinstance(poc, dict) else poc.model_dump() for poc in value]
            elif field == "bank_code":
                update_dict[field] = value.upper()
            else:
                update_dict[field] = value
    
    await db.bank_master.update_one({"id": bank_id}, {"$set": update_dict})
    updated = await db.bank_master.find_one({"id": bank_id}, {"_id": 0})
    return updated


@router.delete("/banks/{bank_id}")
async def delete_bank(bank_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a bank from master data"""
    result = await db.bank_master.delete_one({"id": bank_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bank not found")
    return {"message": "Bank deleted successfully"}


@router.post("/banks/seed-indian-banks")
async def seed_indian_banks(current_user: dict = Depends(get_current_user)):
    """Seed database with real Indian banks and NBFCs for used car financing"""
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Only CEO/HR can seed bank data")
    
    now = datetime.now(timezone.utc)
    
    # Real Indian Banks and NBFCs for used car financing
    banks_data = [
        # Public Sector Banks
        {
            "bank_name": "State Bank of India",
            "bank_code": "SBI",
            "bank_type": "PUBLIC_BANK",
            "interest_rate_min": 9.25,
            "interest_rate_max": 13.50,
            "tenure_min_months": 12,
            "tenure_max_months": 84,
            "ltv_percent": 85,
            "processing_fee_percent": 0.50,
            "eligibility_rules": {
                "min_credit_score": 650,
                "max_vehicle_age": 10,
                "excluded_car_makes": ["CHEVROLET", "FORD"],
                "employment_types": ["SALARIED", "SELF_EMPLOYED"]
            }
        },
        {
            "bank_name": "Bank of Baroda",
            "bank_code": "BOB",
            "bank_type": "PUBLIC_BANK",
            "interest_rate_min": 9.35,
            "interest_rate_max": 13.75,
            "tenure_min_months": 12,
            "tenure_max_months": 84,
            "ltv_percent": 80,
            "processing_fee_percent": 0.50,
            "eligibility_rules": {
                "min_credit_score": 650,
                "max_vehicle_age": 10,
                "excluded_car_makes": ["CHEVROLET", "FORD", "FIAT"],
                "employment_types": ["SALARIED", "SELF_EMPLOYED"]
            }
        },
        {
            "bank_name": "Punjab National Bank",
            "bank_code": "PNB",
            "bank_type": "PUBLIC_BANK",
            "interest_rate_min": 9.40,
            "interest_rate_max": 14.00,
            "tenure_min_months": 12,
            "tenure_max_months": 84,
            "ltv_percent": 80,
            "processing_fee_percent": 0.50,
            "eligibility_rules": {
                "min_credit_score": 650,
                "max_vehicle_age": 10,
                "excluded_car_makes": ["CHEVROLET", "FORD"],
                "employment_types": ["SALARIED", "SELF_EMPLOYED"]
            }
        },
        {
            "bank_name": "Canara Bank",
            "bank_code": "CANARA",
            "bank_type": "PUBLIC_BANK",
            "interest_rate_min": 9.30,
            "interest_rate_max": 13.50,
            "tenure_min_months": 12,
            "tenure_max_months": 84,
            "ltv_percent": 80,
            "processing_fee_percent": 0.50,
            "eligibility_rules": {
                "min_credit_score": 650,
                "max_vehicle_age": 10,
                "excluded_car_makes": ["CHEVROLET", "FORD"],
                "employment_types": ["SALARIED", "SELF_EMPLOYED"]
            }
        },
        {
            "bank_name": "Union Bank of India",
            "bank_code": "UBI",
            "bank_type": "PUBLIC_BANK",
            "interest_rate_min": 9.35,
            "interest_rate_max": 14.00,
            "tenure_min_months": 12,
            "tenure_max_months": 84,
            "ltv_percent": 80,
            "processing_fee_percent": 0.50,
            "eligibility_rules": {
                "min_credit_score": 650,
                "max_vehicle_age": 10,
                "excluded_car_makes": ["CHEVROLET", "FORD"],
                "employment_types": ["SALARIED", "SELF_EMPLOYED"]
            }
        },
        # Private Sector Banks
        {
            "bank_name": "HDFC Bank",
            "bank_code": "HDFC",
            "bank_type": "PRIVATE_BANK",
            "interest_rate_min": 15.00,
            "interest_rate_max": 18.00,
            "tenure_min_months": 12,
            "tenure_max_months": 60,
            "ltv_percent": 80,
            "processing_fee_percent": 1.00,
            "eligibility_rules": {
                # Customer criteria
                "min_age_salaried": 23,
                "min_age_self_employed": 25,
                "max_age_at_maturity": 65,
                "employment_types": ["SALARIED", "SELF_EMPLOYED"],
                "min_work_experience_years": 2,
                # Income
                "min_income_salaried": 25000,
                "min_income_self_employed": 100000,
                "income_multiplier_salaried": 20,
                # Credit
                "min_credit_score": 700,
                "preferred_credit_score": 730,
                "max_bounces_3_months": 0,
                "max_bounces_6_months": 1,
                "max_dpd_30_plus": 0,
                "max_foir_percent": 65,
                # Vehicle
                "max_vehicle_age_years": 10,
                "max_vehicle_age_at_maturity": 15,
                "max_ownership_count": 2,
                "excluded_car_makes": ["CHEVROLET", "FORD", "FIAT", "OPEL"],
                # LTV by vehicle age
                "ltv_0_3_years": 80,
                "ltv_3_5_years": 75,
                "ltv_5_7_years": 70,
                "ltv_7_10_years": 65,
                # Loan params
                "min_loan_amount": 100000,
                "max_loan_amount": 2500000,
                "max_tenure_months": 60,
                "base_interest_rate": 15.0,
                "processing_fee_percent": 1.0,
                "min_processing_fee": 3000,
                # Banking
                "min_aqb_metro": 10000,
                "min_aqb_non_metro": 5000
            }
        },
        {
            "bank_name": "ICICI Bank",
            "bank_code": "ICICI",
            "bank_type": "PRIVATE_BANK",
            "interest_rate_min": 8.90,
            "interest_rate_max": 13.00,
            "tenure_min_months": 12,
            "tenure_max_months": 84,
            "ltv_percent": 90,
            "processing_fee_percent": 0.50,
            "eligibility_rules": {
                "min_credit_score": 700,
                "max_vehicle_age": 10,
                "excluded_car_makes": ["CHEVROLET", "FORD", "FIAT"],
                "employment_types": ["SALARIED", "SELF_EMPLOYED"]
            }
        },
        {
            "bank_name": "Axis Bank",
            "bank_code": "AXIS",
            "bank_type": "PRIVATE_BANK",
            "interest_rate_min": 9.00,
            "interest_rate_max": 13.50,
            "tenure_min_months": 12,
            "tenure_max_months": 84,
            "ltv_percent": 85,
            "processing_fee_percent": 0.50,
            "eligibility_rules": {
                "min_credit_score": 700,
                "max_vehicle_age": 10,
                "excluded_car_makes": ["CHEVROLET", "FORD"],
                "employment_types": ["SALARIED", "SELF_EMPLOYED"]
            }
        },
        {
            "bank_name": "Kotak Mahindra Bank",
            "bank_code": "KOTAK",
            "bank_type": "PRIVATE_BANK",
            "interest_rate_min": 14.00,
            "interest_rate_max": 17.00,
            "tenure_min_months": 12,
            "tenure_max_months": 60,
            "ltv_percent": 75,
            "processing_fee_percent": 1.00,
            "eligibility_rules": {
                # Customer criteria
                "min_age_salaried": 25,
                "min_age_self_employed": 25,
                "max_age_at_maturity": 65,
                "employment_types": ["SALARIED", "SELF_EMPLOYED"],
                "min_work_experience_years": 2,
                # Income
                "min_income_salaried": 30000,
                "min_income_self_employed": 150000,
                "income_multiplier_salaried": 18,
                # Credit
                "min_credit_score": 725,
                "preferred_credit_score": 750,
                "max_bounces_3_months": 0,
                "max_bounces_6_months": 0,
                "max_dpd_30_plus": 0,
                "max_foir_percent": 60,
                "max_emi_to_aqb_ratio": 50,
                # Vehicle
                "max_vehicle_age_years": 8,
                "max_vehicle_age_at_maturity": 12,
                "max_ownership_count": 2,
                "excluded_car_makes": ["CHEVROLET", "FORD", "FIAT"],
                "supported_vehicle_categories": ["CAT_1", "PREMIUM", "MUV"],
                # LTV by vehicle age
                "ltv_0_3_years": 75,
                "ltv_3_5_years": 70,
                "ltv_5_7_years": 65,
                "ltv_7_10_years": 60,
                # Loan params
                "min_loan_amount": 150000,
                "max_loan_amount": 1200000,
                "max_tenure_months": 60,
                "base_interest_rate": 14.0,
                "processing_fee_percent": 1.0,
                # Banking
                "min_aqb_metro": 15000,
                "min_aqb_non_metro": 10000
            }
        },
        {
            "bank_name": "IndusInd Bank",
            "bank_code": "INDUSIND",
            "bank_type": "PRIVATE_BANK",
            "interest_rate_min": 9.50,
            "interest_rate_max": 14.50,
            "tenure_min_months": 12,
            "tenure_max_months": 84,
            "ltv_percent": 85,
            "processing_fee_percent": 1.00,
            "eligibility_rules": {
                "min_credit_score": 680,
                "max_vehicle_age": 12,
                "excluded_car_makes": ["CHEVROLET", "FORD"],
                "employment_types": ["SALARIED", "SELF_EMPLOYED"]
            }
        },
        {
            "bank_name": "Yes Bank",
            "bank_code": "YESBANK",
            "bank_type": "PRIVATE_BANK",
            "interest_rate_min": 10.00,
            "interest_rate_max": 15.00,
            "tenure_min_months": 12,
            "tenure_max_months": 72,
            "ltv_percent": 80,
            "processing_fee_percent": 1.00,
            "eligibility_rules": {
                "min_credit_score": 700,
                "max_vehicle_age": 10,
                "excluded_car_makes": ["CHEVROLET", "FORD", "FIAT"],
                "employment_types": ["SALARIED", "SELF_EMPLOYED"]
            }
        },
        {
            "bank_name": "IDFC First Bank",
            "bank_code": "IDFC",
            "bank_type": "PRIVATE_BANK",
            "interest_rate_min": 10.50,
            "interest_rate_max": 15.50,
            "tenure_min_months": 12,
            "tenure_max_months": 72,
            "ltv_percent": 80,
            "processing_fee_percent": 1.00,
            "eligibility_rules": {
                "min_credit_score": 650,
                "max_vehicle_age": 12,
                "excluded_car_makes": ["CHEVROLET", "FORD"],
                "employment_types": ["SALARIED", "SELF_EMPLOYED"]
            }
        },
        {
            "bank_name": "Federal Bank",
            "bank_code": "FEDERAL",
            "bank_type": "PRIVATE_BANK",
            "interest_rate_min": 9.50,
            "interest_rate_max": 14.00,
            "tenure_min_months": 12,
            "tenure_max_months": 84,
            "ltv_percent": 80,
            "processing_fee_percent": 0.75,
            "eligibility_rules": {
                "min_credit_score": 680,
                "max_vehicle_age": 10,
                "excluded_car_makes": ["CHEVROLET", "FORD"],
                "employment_types": ["SALARIED", "SELF_EMPLOYED"]
            }
        },
        # NBFCs (Non-Banking Financial Companies)
        {
            "bank_name": "Bajaj Finance",
            "bank_code": "BAJAJ",
            "bank_type": "NBFC",
            "interest_rate_min": 14.00,
            "interest_rate_max": 20.00,
            "tenure_min_months": 12,
            "tenure_max_months": 84,
            "ltv_percent": 150,
            "processing_fee_percent": 2.00,
            "eligibility_rules": {
                # Customer criteria
                "min_age_salaried": 23,
                "min_age_self_employed": 25,
                "max_age_at_maturity": 70,
                "employment_types": ["SALARIED", "SELF_EMPLOYED"],
                "min_work_experience_years": 2,
                "min_current_job_months": 6,
                # Income
                "min_income_salaried": 20000,
                "min_income_self_employed": 60000,
                "income_multiplier_salaried": 25,
                # Credit
                "min_credit_score": 700,
                "preferred_credit_score": 750,
                "max_bounces_3_months": 0,
                "max_bounces_6_months": 1,
                "max_bounces_12_months": 2,
                "max_dpd_30_plus": 0,
                "max_foir_percent": 70,
                "max_unsecured_loans_3_months": 1,
                # Vehicle
                "max_vehicle_age_years": 12,
                "max_vehicle_age_at_maturity": 15,
                "max_ownership_count": 3,
                "excluded_car_makes": ["CHEVROLET"],
                # LTV by vehicle age - Bajaj offers higher LTV
                "ltv_0_3_years": 150,
                "ltv_3_5_years": 130,
                "ltv_5_7_years": 110,
                "ltv_7_10_years": 90,
                "ltv_10_plus_years": 70,
                "max_ltv_percent": 150,
                # Loan params
                "min_loan_amount": 50000,
                "max_loan_amount": 2000000,
                "max_tenure_months": 84,
                "base_interest_rate": 14.0,
                "processing_fee_percent": 2.0,
                "min_processing_fee": 2500,
                # Banking
                "min_aqb_metro": 5000,
                "min_aqb_non_metro": 3000
            }
        },
        {
            "bank_name": "Tata Capital",
            "bank_code": "TATACAP",
            "bank_type": "NBFC",
            "interest_rate_min": 11.00,
            "interest_rate_max": 17.00,
            "tenure_min_months": 12,
            "tenure_max_months": 60,
            "ltv_percent": 85,
            "processing_fee_percent": 1.50,
            "eligibility_rules": {
                "min_credit_score": 630,
                "max_vehicle_age": 12,
                "excluded_car_makes": ["CHEVROLET", "FORD"],
                "employment_types": ["SALARIED", "SELF_EMPLOYED"]
            }
        },
        {
            "bank_name": "Mahindra Finance",
            "bank_code": "MAHFIN",
            "bank_type": "NBFC",
            "interest_rate_min": 16.00,
            "interest_rate_max": 18.50,
            "tenure_min_months": 12,
            "tenure_max_months": 60,
            "ltv_percent": 190,
            "processing_fee_percent": 1.00,
            "eligibility_rules": {
                # Customer criteria
                "min_age_salaried": 21,
                "min_age_self_employed": 21,
                "max_age_at_maturity": 65,
                "employment_types": ["SALARIED", "SELF_EMPLOYED"],
                "min_work_experience_years": 1,
                # Income
                "min_income_salaried": 15000,
                "min_income_self_employed": 50000,
                "income_multiplier_salaried": 30,
                # Credit
                "min_credit_score": 700,
                "preferred_credit_score": 725,
                "max_bounces_3_months": 0,
                "max_bounces_6_months": 1,
                "max_bounces_12_months": 3,
                "max_dpd_30_plus": 0,
                "max_dpd_60_plus": 0,
                "max_foir_percent": 70,
                # Vehicle
                "max_vehicle_age_years": 10,
                "max_vehicle_age_at_maturity": 10,  # EOT = 10 years
                "max_ownership_count": 3,
                "excluded_car_makes": [],  # No exclusions
                "supported_vehicle_categories": ["CAT_1", "CAT_2", "PREMIUM", "MUV"],
                # LTV by vehicle age - Mahindra offers highest LTV
                "ltv_0_3_years": 190,
                "ltv_3_5_years": 170,
                "ltv_5_7_years": 150,
                "ltv_7_10_years": 135,
                "max_ltv_percent": 190,
                # Loan params
                "min_loan_amount": 50000,
                "max_loan_amount": 2500000,
                "max_tenure_months": 60,
                "base_interest_rate": 16.0,
                "processing_fee_percent": 0.5,
                "min_processing_fee": 1500,
                "max_processing_fee": 10000,
                # Banking
                "min_aqb_metro": 5000,
                "min_aqb_non_metro": 3000,
                # Special flags
                "requires_property_proof": False
            }
        },
        {
            "bank_name": "Shriram Finance",
            "bank_code": "SHRIRAM",
            "bank_type": "NBFC",
            "interest_rate_min": 14.00,
            "interest_rate_max": 22.00,
            "tenure_min_months": 12,
            "tenure_max_months": 60,
            "ltv_percent": 95,
            "processing_fee_percent": 2.50,
            "eligibility_rules": {
                "min_credit_score": 500,
                "max_vehicle_age": 15,
                "excluded_car_makes": [],
                "employment_types": ["SALARIED", "SELF_EMPLOYED"]
            }
        },
        {
            "bank_name": "Cholamandalam Finance",
            "bank_code": "CHOLA",
            "bank_type": "NBFC",
            "interest_rate_min": 12.00,
            "interest_rate_max": 19.00,
            "tenure_min_months": 12,
            "tenure_max_months": 60,
            "ltv_percent": 85,
            "processing_fee_percent": 2.00,
            "eligibility_rules": {
                "min_credit_score": 580,
                "max_vehicle_age": 12,
                "excluded_car_makes": ["CHEVROLET"],
                "employment_types": ["SALARIED", "SELF_EMPLOYED"]
            }
        },
        {
            "bank_name": "Hero FinCorp",
            "bank_code": "HEROFIN",
            "bank_type": "NBFC",
            "interest_rate_min": 13.00,
            "interest_rate_max": 20.00,
            "tenure_min_months": 12,
            "tenure_max_months": 60,
            "ltv_percent": 80,
            "processing_fee_percent": 2.00,
            "eligibility_rules": {
                "min_credit_score": 600,
                "max_vehicle_age": 10,
                "excluded_car_makes": ["CHEVROLET", "FORD"],
                "employment_types": ["SALARIED", "SELF_EMPLOYED"]
            }
        },
        {
            "bank_name": "L&T Finance",
            "bank_code": "LTFIN",
            "bank_type": "NBFC",
            "interest_rate_min": 11.50,
            "interest_rate_max": 17.00,
            "tenure_min_months": 12,
            "tenure_max_months": 60,
            "ltv_percent": 85,
            "processing_fee_percent": 1.75,
            "eligibility_rules": {
                "min_credit_score": 620,
                "max_vehicle_age": 12,
                "excluded_car_makes": ["CHEVROLET", "FORD"],
                "employment_types": ["SALARIED", "SELF_EMPLOYED"]
            }
        },
        {
            "bank_name": "Sundaram Finance",
            "bank_code": "SUNDARAM",
            "bank_type": "NBFC",
            "interest_rate_min": 10.50,
            "interest_rate_max": 16.00,
            "tenure_min_months": 12,
            "tenure_max_months": 72,
            "ltv_percent": 80,
            "processing_fee_percent": 1.50,
            "eligibility_rules": {
                "min_credit_score": 650,
                "max_vehicle_age": 10,
                "excluded_car_makes": ["CHEVROLET", "FORD"],
                "employment_types": ["SALARIED", "SELF_EMPLOYED"]
            }
        },
        {
            "bank_name": "Muthoot Finance",
            "bank_code": "MUTHOOT",
            "bank_type": "NBFC",
            "interest_rate_min": 14.00,
            "interest_rate_max": 24.00,
            "tenure_min_months": 12,
            "tenure_max_months": 48,
            "ltv_percent": 95,
            "processing_fee_percent": 3.00,
            "eligibility_rules": {
                "min_credit_score": 450,
                "max_vehicle_age": 15,
                "excluded_car_makes": [],
                "employment_types": ["SALARIED", "SELF_EMPLOYED"]
            }
        },
        {
            "bank_name": "Poonawalla Fincorp",
            "bank_code": "POONAWALLA",
            "bank_type": "NBFC",
            "interest_rate_min": 10.50,
            "interest_rate_max": 16.00,
            "tenure_min_months": 12,
            "tenure_max_months": 60,
            "ltv_percent": 85,
            "processing_fee_percent": 1.50,
            "eligibility_rules": {
                "min_credit_score": 650,
                "max_vehicle_age": 10,
                "excluded_car_makes": ["CHEVROLET", "FORD"],
                "employment_types": ["SALARIED", "SELF_EMPLOYED"]
            }
        },
    ]
    
    created_count = 0
    updated_count = 0
    
    for bank_info in banks_data:
        # Check if bank already exists
        existing = await db.bank_master.find_one({"bank_code": bank_info["bank_code"]})
        
        if existing:
            # Update existing bank
            await db.bank_master.update_one(
                {"bank_code": bank_info["bank_code"]},
                {"$set": {**bank_info, "updated_at": now.isoformat()}}
            )
            updated_count += 1
        else:
            # Create new bank
            bank = {
                "id": str(uuid.uuid4()),
                **bank_info,
                "city_pocs": [],
                "is_active": True,
                "created_at": now.isoformat(),
                "updated_at": now.isoformat()
            }
            await db.bank_master.insert_one(bank)
            created_count += 1
    
    return {
        "success": True,
        "message": f"Seeded {created_count} new banks, updated {updated_count} existing banks",
        "total_banks": created_count + updated_count
    }


@router.post("/banks/{bank_id}/poc")
async def add_bank_poc(
    bank_id: str,
    poc_data: BankPOC,
    current_user: dict = Depends(get_current_user)
):
    """Add a point of contact to a bank"""
    bank = await db.bank_master.find_one({"id": bank_id})
    if not bank:
        raise HTTPException(status_code=404, detail="Bank not found")
    
    poc = poc_data.model_dump()
    
    await db.bank_master.update_one(
        {"id": bank_id},
        {
            "$push": {"city_pocs": poc},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return {"message": "POC added successfully", "poc": poc}


# ========================
# ELIGIBILITY ENGINE
# ========================

class EligibilityCheckRequest(BaseModel):
    """Request model for checking eligibility against all banks"""
    # Customer Info
    customer_type: str  # SALARIED or SELF_EMPLOYED
    age: Optional[int] = None
    monthly_income: Optional[float] = None
    work_experience_years: Optional[int] = None
    
    # Credit Info
    credit_score: Optional[int] = None
    bounces_3_months: Optional[int] = 0
    bounces_6_months: Optional[int] = 0
    bounces_12_months: Optional[int] = 0
    dpd_30_plus_count: Optional[int] = 0
    dpd_60_plus_count: Optional[int] = 0
    existing_emi_total: Optional[float] = 0
    
    # Vehicle Info
    vehicle_age_years: Optional[int] = None
    vehicle_make: Optional[str] = None
    vehicle_valuation: Optional[float] = None
    ownership_count: Optional[int] = 1
    
    # Banking Info
    average_bank_balance: Optional[float] = None
    
    # Location
    location_type: Optional[str] = "METRO"  # METRO, URBAN, SEMI_URBAN, RURAL


class EligibilityResult(BaseModel):
    """Result for a single bank eligibility check"""
    bank_id: str
    bank_name: str
    bank_code: str
    is_eligible: bool
    eligibility_score: int = 0  # 0-100 score
    rejection_reasons: List[str] = []
    warnings: List[str] = []  # Things that might affect approval
    
    # If eligible, these are calculated
    max_loan_amount: Optional[float] = None
    ltv_applicable: Optional[float] = None
    interest_rate_indicative: Optional[float] = None
    max_tenure_months: Optional[int] = None
    estimated_emi: Optional[float] = None
    processing_fee: Optional[float] = None


def calculate_emi(principal: float, annual_rate: float, tenure_months: int) -> float:
    """Calculate EMI using standard formula"""
    if annual_rate == 0:
        return principal / tenure_months
    monthly_rate = annual_rate / (12 * 100)
    emi = principal * monthly_rate * ((1 + monthly_rate) ** tenure_months) / (((1 + monthly_rate) ** tenure_months) - 1)
    return round(emi, 2)


def get_ltv_for_vehicle_age(rules: dict, vehicle_age: int) -> float:
    """Get applicable LTV based on vehicle age"""
    if vehicle_age <= 3:
        return rules.get("ltv_0_3_years", 85)
    elif vehicle_age <= 5:
        return rules.get("ltv_3_5_years", 80)
    elif vehicle_age <= 7:
        return rules.get("ltv_5_7_years", 75)
    elif vehicle_age <= 10:
        return rules.get("ltv_7_10_years", 70)
    else:
        return rules.get("ltv_10_plus_years", 60)


async def evaluate_bank_eligibility(bank: dict, req: EligibilityCheckRequest) -> EligibilityResult:
    """Evaluate eligibility for a single bank based on rules and customer data"""
    rules = bank.get("eligibility_rules", {})
    result = EligibilityResult(
        bank_id=bank["id"],
        bank_name=bank["bank_name"],
        bank_code=bank["bank_code"],
        is_eligible=True,
        eligibility_score=100
    )
    
    score_deductions = 0
    
    # === CHECK 1: Customer Type ===
    allowed_types = rules.get("employment_types", ["SALARIED", "SELF_EMPLOYED"])
    if req.customer_type not in allowed_types:
        result.is_eligible = False
        result.rejection_reasons.append(f"Customer type {req.customer_type} not supported")
        return result
    
    # === CHECK 2: Age ===
    if req.age:
        min_age = rules.get("min_age_salaried" if req.customer_type == "SALARIED" else "min_age_self_employed", 21)
        if req.age < min_age:
            result.is_eligible = False
            result.rejection_reasons.append(f"Age {req.age} below minimum {min_age}")
            return result
        
        max_age = rules.get("max_age_at_maturity", 65)
        max_tenure = rules.get("max_tenure_months", 60)
        age_at_maturity = req.age + (max_tenure / 12)
        if age_at_maturity > max_age:
            # Reduce tenure to fit age limit
            max_allowed_tenure = int((max_age - req.age) * 12)
            if max_allowed_tenure < 12:
                result.is_eligible = False
                result.rejection_reasons.append(f"Age {req.age} exceeds limit for loan tenure")
                return result
            result.warnings.append(f"Tenure limited to {max_allowed_tenure} months due to age")
            result.max_tenure_months = max_allowed_tenure
    
    # === CHECK 3: Credit Score ===
    if req.credit_score:
        min_score = rules.get("min_credit_score", 700)
        if req.credit_score < min_score:
            result.is_eligible = False
            result.rejection_reasons.append(f"Credit score {req.credit_score} below minimum {min_score}")
            return result
        
        preferred_score = rules.get("preferred_credit_score", 750)
        if req.credit_score < preferred_score:
            score_deductions += 10
            result.warnings.append(f"Credit score {req.credit_score} below preferred {preferred_score}")
    else:
        result.warnings.append("Credit score not provided - verification required")
        score_deductions += 15
    
    # === CHECK 4: Bounces/DPD ===
    if req.bounces_3_months > rules.get("max_bounces_3_months", 0):
        result.is_eligible = False
        result.rejection_reasons.append(f"Bounces in last 3 months ({req.bounces_3_months}) exceed limit")
        return result
    
    if req.bounces_6_months > rules.get("max_bounces_6_months", 1):
        result.is_eligible = False
        result.rejection_reasons.append(f"Bounces in last 6 months ({req.bounces_6_months}) exceed limit")
        return result
    
    if req.dpd_30_plus_count > rules.get("max_dpd_30_plus", 0):
        result.is_eligible = False
        result.rejection_reasons.append(f"DPD 30+ instances ({req.dpd_30_plus_count}) exceed limit")
        return result
    
    # === CHECK 5: Income ===
    if req.monthly_income:
        min_income = rules.get("min_income_salaried" if req.customer_type == "SALARIED" else "min_income_self_employed", 25000)
        if req.monthly_income < min_income:
            result.is_eligible = False
            result.rejection_reasons.append(f"Monthly income ₹{req.monthly_income:,.0f} below minimum ₹{min_income:,.0f}")
            return result
        
        # Check FOIR
        max_foir = rules.get("max_foir_percent", 65)
        if req.existing_emi_total:
            current_foir = (req.existing_emi_total / req.monthly_income) * 100
            if current_foir > max_foir:
                result.is_eligible = False
                result.rejection_reasons.append(f"FOIR {current_foir:.1f}% exceeds maximum {max_foir}%")
                return result
    else:
        result.warnings.append("Income not provided - verification required")
        score_deductions += 20
    
    # === CHECK 6: Work Experience ===
    if req.work_experience_years:
        min_exp = rules.get("min_work_experience_years", 2)
        if req.work_experience_years < min_exp:
            result.is_eligible = False
            result.rejection_reasons.append(f"Work experience {req.work_experience_years} years below minimum {min_exp}")
            return result
    
    # === CHECK 7: Vehicle Age ===
    if req.vehicle_age_years is not None:
        max_vehicle_age = rules.get("max_vehicle_age_years", 10)
        if req.vehicle_age_years > max_vehicle_age:
            result.is_eligible = False
            result.rejection_reasons.append(f"Vehicle age {req.vehicle_age_years} years exceeds maximum {max_vehicle_age}")
            return result
        
        # Check vehicle age at maturity
        max_age_at_maturity = rules.get("max_vehicle_age_at_maturity", 15)
        max_tenure = result.max_tenure_months or rules.get("max_tenure_months", 60)
        vehicle_age_at_maturity = req.vehicle_age_years + (max_tenure / 12)
        if vehicle_age_at_maturity > max_age_at_maturity:
            # Reduce tenure
            max_allowed_tenure = int((max_age_at_maturity - req.vehicle_age_years) * 12)
            if max_allowed_tenure < 12:
                result.is_eligible = False
                result.rejection_reasons.append(f"Vehicle too old for loan - would be {vehicle_age_at_maturity:.0f} years at maturity")
                return result
            result.max_tenure_months = min(result.max_tenure_months or 999, max_allowed_tenure)
            result.warnings.append(f"Tenure limited to {result.max_tenure_months} months due to vehicle age")
    
    # === CHECK 8: Vehicle Make ===
    if req.vehicle_make:
        excluded_makes = rules.get("excluded_car_makes", [])
        if req.vehicle_make.upper() in [m.upper() for m in excluded_makes]:
            result.is_eligible = False
            result.rejection_reasons.append(f"Vehicle make {req.vehicle_make} not funded by this bank")
            return result
    
    # === CHECK 9: Average Bank Balance ===
    if req.average_bank_balance:
        min_aqb = rules.get("min_aqb_metro" if req.location_type == "METRO" else "min_aqb_non_metro", 5000)
        if req.average_bank_balance < min_aqb:
            score_deductions += 10
            result.warnings.append(f"Average bank balance ₹{req.average_bank_balance:,.0f} below preferred ₹{min_aqb:,.0f}")
    
    # === CALCULATE LOAN PARAMETERS (if eligible) ===
    if result.is_eligible:
        # Get applicable LTV
        ltv = get_ltv_for_vehicle_age(rules, req.vehicle_age_years or 5)
        result.ltv_applicable = ltv
        
        # Calculate max loan amount
        if req.vehicle_valuation:
            max_by_ltv = req.vehicle_valuation * (ltv / 100)
        else:
            max_by_ltv = rules.get("max_loan_amount", 2500000)
        
        # Also limit by income multiplier
        if req.monthly_income:
            multiplier = rules.get("income_multiplier_salaried" if req.customer_type == "SALARIED" else "income_multiplier_self_employed", 20)
            max_by_income = req.monthly_income * multiplier
            result.max_loan_amount = min(max_by_ltv, max_by_income, rules.get("max_loan_amount", 2500000))
        else:
            result.max_loan_amount = min(max_by_ltv, rules.get("max_loan_amount", 2500000))
        
        result.max_loan_amount = max(result.max_loan_amount, rules.get("min_loan_amount", 100000))
        
        # Set tenure
        if not result.max_tenure_months:
            result.max_tenure_months = rules.get("max_tenure_months", 60)
        
        # Calculate interest rate (indicative)
        base_rate = rules.get("base_interest_rate", 14.0)
        if req.credit_score and req.credit_score >= 750:
            result.interest_rate_indicative = base_rate
        elif req.credit_score and req.credit_score >= 700:
            result.interest_rate_indicative = base_rate + 1.0
        else:
            result.interest_rate_indicative = base_rate + 2.0
        
        # Calculate EMI
        result.estimated_emi = calculate_emi(
            result.max_loan_amount,
            result.interest_rate_indicative,
            result.max_tenure_months
        )
        
        # Calculate processing fee
        pf_percent = rules.get("processing_fee_percent", 1.0)
        min_pf = rules.get("min_processing_fee", 2500)
        max_pf = rules.get("max_processing_fee", 25000)
        calculated_pf = result.max_loan_amount * (pf_percent / 100)
        result.processing_fee = max(min_pf, min(max_pf, calculated_pf))
    
    # Final score calculation
    result.eligibility_score = max(0, 100 - score_deductions)
    
    return result


@router.post("/eligibility/check")
async def check_eligibility_all_banks(
    request: EligibilityCheckRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Check customer eligibility against all active banks.
    Returns a list of banks sorted by eligibility score.
    """
    # Get all active banks
    banks = await db.bank_master.find({"is_active": True}, {"_id": 0}).to_list(100)
    
    if not banks:
        return {
            "success": False,
            "message": "No active banks found",
            "eligible_banks": [],
            "ineligible_banks": []
        }
    
    eligible_results = []
    ineligible_results = []
    
    for bank in banks:
        result = await evaluate_bank_eligibility(bank, request)
        if result.is_eligible:
            eligible_results.append(result.model_dump())
        else:
            ineligible_results.append(result.model_dump())
    
    # Sort eligible banks by score (descending)
    eligible_results.sort(key=lambda x: x["eligibility_score"], reverse=True)
    
    return {
        "success": True,
        "total_banks_checked": len(banks),
        "eligible_count": len(eligible_results),
        "ineligible_count": len(ineligible_results),
        "eligible_banks": eligible_results,
        "ineligible_banks": ineligible_results
    }


@router.post("/loan-leads/{lead_id}/check-eligibility")
async def check_lead_eligibility(
    lead_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Check eligibility for a loan lead against all banks.
    Uses the lead's customer profile and vehicle data.
    """
    # Get the loan lead with all related data
    lead = await db.loan_leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Loan lead not found")
    
    # Get customer profile if exists
    profile = await db.customer_profiles.find_one({"loan_lead_id": lead_id}, {"_id": 0})
    
    # Build eligibility request from lead data
    req = EligibilityCheckRequest(
        customer_type=lead.get("customer_type", "SALARIED"),
        age=None,  # TODO: Calculate from DOB if available
        monthly_income=lead.get("monthly_income"),
        work_experience_years=lead.get("work_experience_years"),
        credit_score=lead.get("credit_score"),
        bounces_3_months=0,
        bounces_6_months=0,
        bounces_12_months=0,
        dpd_30_plus_count=0,
        dpd_60_plus_count=0,
        existing_emi_total=lead.get("existing_emi_total", 0),
        location_type=lead.get("location_type", "METRO")
    )
    
    # Add credit profile data if available
    if profile and profile.get("credit_profile"):
        cp = profile["credit_profile"]
        req.credit_score = cp.get("credit_score") or req.credit_score
        req.bounces_3_months = cp.get("bounces_3_months", 0)
        req.bounces_6_months = cp.get("bounces_6_months", 0)
        req.bounces_12_months = cp.get("bounces_12_months", 0)
        req.dpd_30_plus_count = cp.get("dpd_30_plus", 0)
        req.dpd_60_plus_count = cp.get("dpd_60_plus", 0)
    
    # Add bank statement data if available
    if profile and profile.get("bank_statement_analysis"):
        bsa = profile["bank_statement_analysis"]
        req.average_bank_balance = bsa.get("average_bank_balance")
        req.monthly_income = bsa.get("average_monthly_credits") or req.monthly_income
        
        # Calculate existing EMI from identified EMI payments
        if bsa.get("emi_payments_identified"):
            total_emi = sum(e.get("amount", 0) for e in bsa["emi_payments_identified"])
            req.existing_emi_total = total_emi
    
    # Get primary vehicle data
    vehicles = lead.get("vehicles", [])
    primary_vehicle = next((v for v in vehicles if v.get("is_primary")), vehicles[0] if vehicles else None)
    
    if primary_vehicle:
        req.vehicle_make = primary_vehicle.get("car_make")
        req.vehicle_valuation = primary_vehicle.get("vehicle_valuation")
        
        # Calculate vehicle age
        car_year = primary_vehicle.get("car_year")
        if car_year:
            try:
                req.vehicle_age_years = datetime.now().year - int(car_year)
            except (ValueError, TypeError):
                pass
    
    # Check eligibility against all banks
    banks = await db.bank_master.find({"is_active": True}, {"_id": 0}).to_list(100)
    
    eligible_results = []
    ineligible_results = []
    
    for bank in banks:
        result = await evaluate_bank_eligibility(bank, req)
        if result.is_eligible:
            eligible_results.append(result.model_dump())
        else:
            ineligible_results.append(result.model_dump())
    
    # Sort by eligibility score
    eligible_results.sort(key=lambda x: x["eligibility_score"], reverse=True)
    
    # Save eligibility results to lead
    await db.loan_leads.update_one(
        {"id": lead_id},
        {
            "$set": {
                "eligibility_checked_at": datetime.now(timezone.utc).isoformat(),
                "eligible_banks": [r["bank_id"] for r in eligible_results],
                "eligibility_results": eligible_results[:5],  # Top 5 results
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {
        "success": True,
        "lead_id": lead_id,
        "customer_type": req.customer_type,
        "credit_score": req.credit_score,
        "monthly_income": req.monthly_income,
        "vehicle_age": req.vehicle_age_years,
        "vehicle_valuation": req.vehicle_valuation,
        "total_banks_checked": len(banks),
        "eligible_count": len(eligible_results),
        "ineligible_count": len(ineligible_results),
        "eligible_banks": eligible_results,
        "ineligible_banks": ineligible_results,
        "recommended_bank": eligible_results[0] if eligible_results else None
    }


# ========================
# LOAN LEADS ENDPOINTS
# ========================

def convert_local_date_to_utc_range_loans(local_date: str, timezone_offset_minutes: int = 330) -> tuple:
    """
    Convert a local date string to UTC datetime range.
    """
    from datetime import datetime as dt, timedelta, timezone as tz
    
    local_date_obj = dt.strptime(local_date, "%Y-%m-%d")
    offset = timedelta(minutes=timezone_offset_minutes)
    local_tz = tz(offset)
    
    local_start = local_date_obj.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=local_tz)
    utc_start = local_start.astimezone(tz.utc)
    
    local_end = local_date_obj.replace(hour=23, minute=59, second=59, microsecond=999999, tzinfo=local_tz)
    utc_end = local_end.astimezone(tz.utc)
    
    return utc_start.isoformat().replace('+00:00', 'Z'), utc_end.isoformat().replace('+00:00', 'Z')


@router.get("/loan-leads")
async def get_loan_leads(
    status: Optional[str] = None,
    city_id: Optional[str] = None,
    search: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    timezone_offset: Optional[int] = 330,  # User's timezone offset in minutes (default IST)
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get loan leads with filtering"""
    query = {}
    
    if status:
        query["status"] = status
    if city_id:
        query["city_id"] = city_id
    if search:
        query["$or"] = [
            {"customer_name": {"$regex": search, "$options": "i"}},
            {"customer_phone": {"$regex": search, "$options": "i"}}
        ]
    
    # Timezone-aware date filtering
    if date_from or date_to:
        date_query = {}
        if date_from:
            utc_from, _ = convert_local_date_to_utc_range_loans(date_from, timezone_offset)
            date_query["$gte"] = utc_from
        if date_to:
            _, utc_to = convert_local_date_to_utc_range_loans(date_to, timezone_offset)
            date_query["$lte"] = utc_to
        if date_query:
            query["created_at"] = date_query
    
    total = await db.loan_leads.count_documents(query)
    leads = await db.loan_leads.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "leads": leads,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.get("/loan-leads/sync-customers")
async def sync_loan_leads_from_customers(
    current_user: dict = Depends(get_current_user)
):
    """Sync loan leads from customers who have paid inspections"""
    now = datetime.now(timezone.utc)
    synced_count = 0
    
    # Find customers with paid inspections (FULLY_PAID or Completed)
    paid_inspections = await db.inspections.find(
        {"payment_status": {"$in": ["FULLY_PAID", "Completed", "paid", "PAID"]}},
        {"customer_id": 1, "customer_name": 1, "customer_phone": 1, "customer_mobile": 1, 
         "customer_email": 1, "city_id": 1, "city_name": 1, "city": 1, "address": 1,
         "car_number": 1, "car_make": 1, "car_model": 1, "car_year": 1}
    ).to_list(1000)
    
    # Build a city lookup cache from cities collection
    cities_cursor = await db.cities.find({}, {"_id": 0}).to_list(500)
    city_lookup = {}
    for city in cities_cursor:
        # Index by city name (case insensitive)
        city_name = (city.get("name") or city.get("city_name") or "").lower()
        if city_name:
            city_lookup[city_name] = {"id": city.get("id"), "name": city.get("name") or city.get("city_name")}
    
    customer_ids_processed = set()
    
    for inspection in paid_inspections:
        customer_id = inspection.get("customer_id")
        if not customer_id or customer_id in customer_ids_processed:
            continue
        
        customer_ids_processed.add(customer_id)
        
        existing_lead = await db.loan_leads.find_one({"customer_id": customer_id})
        if existing_lead:
            continue
        
        # Get all paid inspections for this customer to collect vehicle data
        customer_inspections = await db.inspections.find({
            "customer_id": customer_id,
            "payment_status": {"$in": ["FULLY_PAID", "Completed", "paid", "PAID"]}
        }).to_list(100)
        
        # Get city info - try multiple fields
        city_name = inspection.get("city_name") or inspection.get("city") or ""
        city_id = inspection.get("city_id")
        
        # If no city_id, try to look it up from city name
        if not city_id and city_name:
            city_match = city_lookup.get(city_name.lower())
            if city_match:
                city_id = city_match["id"]
                city_name = city_match["name"]
        
        # If still no city, try to get from customer record
        if not city_name or not city_id:
            customer_record = await db.customers.find_one(
                {"id": customer_id},
                {"_id": 0, "city": 1, "city_id": 1, "city_name": 1, "address": 1}
            )
            if customer_record:
                if not city_name:
                    city_name = customer_record.get("city_name") or customer_record.get("city") or ""
                if not city_id:
                    city_id = customer_record.get("city_id")
                # Try to look up again from customer city
                if city_name and not city_id:
                    city_match = city_lookup.get(city_name.lower())
                    if city_match:
                        city_id = city_match["id"]
                        city_name = city_match["name"]
        
        # Build vehicles list from inspections
        vehicles = []
        for insp in customer_inspections:
            if insp.get("car_number"):
                vehicle = {
                    "vehicle_id": str(uuid.uuid4()),
                    "car_number": insp.get("car_number", ""),
                    "car_make": insp.get("car_make", ""),
                    "car_model": insp.get("car_model", ""),
                    "car_year": insp.get("car_year"),
                    "inspection_id": insp.get("id"),
                    "vehicle_valuation": None,
                    "expected_loan_amount": None,
                    "expected_emi": None,
                    "expected_interest_rate": None,
                    "expected_tenure_months": 60,
                    "created_at": now.isoformat()
                }
                # Avoid duplicate vehicles by car_number
                if not any(v.get("car_number") == vehicle["car_number"] for v in vehicles):
                    vehicles.append(vehicle)
        
        # Get phone - try multiple fields from inspection and customer
        customer_phone = inspection.get("customer_phone") or inspection.get("customer_mobile") or ""
        
        # If no phone from inspection, try to get from customer record
        if not customer_phone:
            customer_record = await db.customers.find_one(
                {"id": customer_id},
                {"_id": 0, "mobile": 1, "phone": 1}
            )
            if customer_record:
                customer_phone = customer_record.get("mobile") or customer_record.get("phone") or ""
        
        # Clean up phone number format
        if customer_phone:
            customer_phone = str(customer_phone).replace(" ", "").replace("-", "")
            # Ensure it has country code
            if not customer_phone.startswith("+"):
                # Remove leading 91 if present without +
                if customer_phone.startswith("91") and len(customer_phone) > 10:
                    customer_phone = "+" + customer_phone
                elif len(customer_phone) == 10:
                    customer_phone = "+91" + customer_phone
        
        loan_lead = {
            "id": str(uuid.uuid4()),
            "customer_id": customer_id,
            "customer_name": inspection.get("customer_name", "Unknown"),
            "customer_phone": customer_phone,
            "customer_email": inspection.get("customer_email"),
            "city_id": city_id,
            "city_name": city_name,
            "status": "NEW",
            "status_notes": None,
            "last_contacted_at": None,
            "next_follow_up_at": None,
            "customer_type": None,
            "documents": [],
            "vehicles": vehicles,
            "applications": [],
            "eligibility_results": [],
            "loan_offers": [],
            "credit_score": None,
            "credit_score_fetched_at": None,
            "assigned_to": None,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "created_by": current_user.get("id")
        }
        
        await db.loan_leads.insert_one(loan_lead)
        synced_count += 1
    
    return {
        "message": f"Synced {synced_count} new loan leads from paid inspections",
        "synced_count": synced_count,
        "total_processed": len(customer_ids_processed)
    }


@router.get("/loan-leads/stats")
async def get_loan_lead_stats(current_user: dict = Depends(get_current_user)):
    """Get loan lead statistics"""
    pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    
    status_counts = {}
    async for doc in db.loan_leads.aggregate(pipeline):
        status_counts[doc["_id"]] = doc["count"]
    
    total = await db.loan_leads.count_documents({})
    
    return {
        "total": total,
        "by_status": status_counts,
        "with_credit_score": await db.loan_leads.count_documents({"credit_score": {"$ne": None}}),
        "with_applications": await db.loan_leads.count_documents({"applications.0": {"$exists": True}})
    }


@router.post("/loan-leads/update-cities")
async def update_loan_lead_cities(current_user: dict = Depends(get_current_user)):
    """Update city data for existing loan leads from their inspection data"""
    
    # Build city lookup cache
    cities_cursor = await db.cities.find({}, {"_id": 0}).to_list(500)
    city_lookup = {}
    for city in cities_cursor:
        city_name = (city.get("name") or city.get("city_name") or "").lower()
        if city_name:
            city_lookup[city_name] = {"id": city.get("id"), "name": city.get("name") or city.get("city_name")}
    
    # Find leads without city
    leads_without_city = await db.loan_leads.find(
        {"$or": [{"city_name": None}, {"city_name": ""}, {"city_name": {"$exists": False}}]}
    ).to_list(1000)
    
    updated_count = 0
    
    for lead in leads_without_city:
        customer_id = lead.get("customer_id")
        if not customer_id:
            continue
        
        # Find inspection for this customer
        inspection = await db.inspections.find_one(
            {"customer_id": customer_id},
            {"city": 1, "city_name": 1, "city_id": 1}
        )
        
        if not inspection:
            continue
        
        city_name = inspection.get("city_name") or inspection.get("city") or ""
        city_id = inspection.get("city_id")
        
        # Look up city_id from name if not present
        if not city_id and city_name:
            city_match = city_lookup.get(city_name.lower())
            if city_match:
                city_id = city_match["id"]
                city_name = city_match["name"]
        
        if city_name:
            await db.loan_leads.update_one(
                {"id": lead["id"]},
                {"$set": {"city_name": city_name, "city_id": city_id}}
            )
            updated_count += 1
    
    return {
        "message": f"Updated city data for {updated_count} loan leads",
        "updated_count": updated_count,
        "total_without_city": len(leads_without_city)
    }


@router.post("/loan-leads/update-phones")
async def update_loan_lead_phones(current_user: dict = Depends(get_current_user)):
    """Update phone numbers for existing loan leads from their inspection data"""
    
    # Find leads without phone
    leads_without_phone = await db.loan_leads.find(
        {"$or": [{"customer_phone": None}, {"customer_phone": ""}, {"customer_phone": {"$exists": False}}]}
    ).to_list(1000)
    
    updated_count = 0
    
    for lead in leads_without_phone:
        customer_id = lead.get("customer_id")
        if not customer_id:
            continue
        
        # Find inspection for this customer
        inspection = await db.inspections.find_one(
            {"customer_id": customer_id},
            {"customer_phone": 1, "customer_mobile": 1, "mobile": 1, "phone": 1}
        )
        
        if not inspection:
            continue
        
        # Try multiple phone fields
        phone = (inspection.get("customer_phone") or 
                 inspection.get("customer_mobile") or 
                 inspection.get("mobile") or 
                 inspection.get("phone") or "")
        
        if phone:
            await db.loan_leads.update_one(
                {"id": lead["id"]},
                {"$set": {"customer_phone": phone}}
            )
            updated_count += 1
    
    return {
        "message": f"Updated phone numbers for {updated_count} loan leads",
        "updated_count": updated_count,
        "total_without_phone": len(leads_without_phone)
    }


@router.get("/loan-leads/{lead_id}")
async def get_loan_lead(lead_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific loan lead with all details"""
    lead = await db.loan_leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Loan lead not found")
    return lead


@router.put("/loan-leads/{lead_id}")
async def update_loan_lead(
    lead_id: str,
    update_data: LoanLeadUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a loan lead"""
    lead = await db.loan_leads.find_one({"id": lead_id})
    if not lead:
        raise HTTPException(status_code=404, detail="Loan lead not found")
    
    update_dict = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    for field, value in update_data.model_dump(exclude_unset=True).items():
        if value is not None:
            if isinstance(value, datetime):
                update_dict[field] = value.isoformat()
            else:
                update_dict[field] = value
    
    if "status" in update_dict:
        update_dict["last_contacted_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.loan_leads.update_one({"id": lead_id}, {"$set": update_dict})
    updated = await db.loan_leads.find_one({"id": lead_id}, {"_id": 0})
    return updated


# ========================
# DOCUMENT MANAGEMENT
# ========================

@router.get("/loan-leads/{lead_id}/document-requirements")
async def get_document_requirements(
    lead_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get document requirements based on customer type"""
    lead = await db.loan_leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Loan lead not found")
    
    customer_type = lead.get("customer_type")
    
    if customer_type == "SALARIED":
        requirements = [doc.model_dump() for doc in SALARIED_DOCUMENTS]
    elif customer_type == "SELF_EMPLOYED":
        requirements = [doc.model_dump() for doc in SELF_EMPLOYED_DOCUMENTS]
    else:
        requirements = [doc.model_dump() for doc in SALARIED_DOCUMENTS]
    
    existing_docs = {doc.get("document_type"): doc for doc in lead.get("documents", [])}
    
    for req in requirements:
        req["uploaded"] = req["document_type"] in existing_docs
        if req["uploaded"]:
            req["file_info"] = existing_docs[req["document_type"]]
    
    return {
        "customer_type": customer_type,
        "requirements": requirements
    }


class DocumentMetadata(BaseModel):
    document_type: str
    file_name: str
    file_url: str
    content_type: Optional[str] = None


@router.post("/loan-leads/{lead_id}/documents")
async def add_loan_document(
    lead_id: str,
    doc_data: DocumentMetadata,
    current_user: dict = Depends(get_current_user)
):
    """Add or update a document for a loan lead"""
    lead = await db.loan_leads.find_one({"id": lead_id})
    if not lead:
        raise HTTPException(status_code=404, detail="Loan lead not found")
    
    now = datetime.now(timezone.utc)
    
    document = {
        "id": str(uuid.uuid4()),
        "document_type": doc_data.document_type,
        "file_url": doc_data.file_url,
        "file_name": doc_data.file_name,
        "content_type": doc_data.content_type,
        "uploaded_at": now.isoformat(),
        "uploaded_by": current_user.get("id")
    }
    
    # Remove existing document of same type
    await db.loan_leads.update_one(
        {"id": lead_id},
        {"$pull": {"documents": {"document_type": doc_data.document_type}}}
    )
    
    # Add new document
    await db.loan_leads.update_one(
        {"id": lead_id},
        {
            "$push": {"documents": document},
            "$set": {"updated_at": now.isoformat()}
        }
    )
    
    return {"message": "Document added successfully", "document": document}


@router.delete("/loan-leads/{lead_id}/documents/{document_id}")
async def delete_loan_document(
    lead_id: str,
    document_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a document from a loan lead"""
    result = await db.loan_leads.update_one(
        {"id": lead_id},
        {
            "$pull": {"documents": {"id": document_id}},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return {"message": "Document deleted successfully"}


class GenerateUploadUrlRequest(BaseModel):
    document_type: str
    file_name: str
    content_type: str


@router.post("/loan-leads/{lead_id}/documents/generate-upload-url")
async def generate_document_upload_url(
    lead_id: str,
    request_data: GenerateUploadUrlRequest,
    current_user: dict = Depends(get_current_user)
):
    """Generate a signed URL for document upload"""
    lead = await db.loan_leads.find_one({"id": lead_id})
    if not lead:
        raise HTTPException(status_code=404, detail="Loan lead not found")
    
    if not storage_service:
        raise HTTPException(status_code=500, detail="Storage service not configured")
    
    # Generate unique file path
    file_ext = request_data.file_name.split('.')[-1] if '.' in request_data.file_name else 'pdf'
    storage_path = f"loan_documents/{lead_id}/{request_data.document_type}_{str(uuid.uuid4())[:8]}.{file_ext}"
    
    try:
        # Get signed URL for upload
        result = await storage_service.get_signed_upload_url(
            storage_path,
            content_type=request_data.content_type,
            expires_in=3600
        )
        
        # Handle different storage service responses
        if isinstance(result, dict):
            # Local storage returns dict with upload_url and file_path
            return {
                "upload_url": result.get("upload_url"),
                "file_url": result.get("file_path") or result.get("key"),
                "storage_path": result.get("key") or storage_path,
                "fields": result.get("fields", {})
            }
        else:
            # Firebase/S3 returns signed URL string
            bucket_name = getattr(storage_service, 'bucket_name', 'local')
            public_url = f"https://firebasestorage.googleapis.com/v0/b/{bucket_name}/o/{storage_path.replace('/', '%2F')}?alt=media"
            
            return {
                "upload_url": result,
                "file_url": public_url,
                "storage_path": storage_path
            }
    except Exception as e:
        logger.error(f"Failed to generate upload URL: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate upload URL: {str(e)}")


@router.post("/loan-leads/{lead_id}/documents/{document_id}/download-url")
async def generate_document_download_url(
    lead_id: str,
    document_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Generate a signed URL for document download"""
    lead = await db.loan_leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Loan lead not found")
    
    document = None
    for doc in lead.get("documents", []):
        if doc.get("id") == document_id:
            document = doc
            break
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    file_url = document.get("file_url", "")
    
    if "firebasestorage.googleapis.com" in file_url:
        return {"download_url": file_url, "file_name": document.get("file_name")}
    
    return {"download_url": file_url, "file_name": document.get("file_name")}


# ========================
# CREDIT SCORE ENDPOINTS
# ========================

@router.post("/loan-leads/{lead_id}/credit-score/request-otp")
async def request_credit_score_otp(
    lead_id: str,
    request_data: CreditScoreOTPRequest,
    current_user: dict = Depends(get_current_user)
):
    """Request OTP for credit score check via Equifax (V1) or Experian (V4)"""
    try:
        lead = await db.loan_leads.find_one({"id": lead_id})
        if not lead:
            raise HTTPException(status_code=404, detail="Loan lead not found")
        
        if not EXPERIAN_CLIENT_ID or not EXPERIAN_SECRET_KEY:
            raise HTTPException(status_code=500, detail="Credit score API not configured")
        
        bureau = request_data.bureau.lower() if request_data.bureau else "equifax"
        logger.info(f"[CREDIT_SCORE] Requesting OTP via {bureau.upper()} for lead {lead_id}")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            if bureau == "experian":
                response = await client.post(
                    "https://api.invincibleocean.com/invincible/genOtp/creditScoreCheckV4",
                    headers={
                        "Content-Type": "application/json",
                        "clientId": EXPERIAN_CLIENT_ID,
                        "secretKey": EXPERIAN_SECRET_KEY
                    },
                    json={
                        "firstName": request_data.first_name,
                        "surName": request_data.last_name,
                        "panNumber": request_data.pan_number,
                        "dateOfBirth": request_data.dob,
                        "mobileNumber": request_data.mobile_number,
                        "email": request_data.email,
                        "gender": request_data.gender.upper()[0] if request_data.gender else "M",
                        "flatno": "",
                        "city": "",
                        "state": "",
                        "pincode": request_data.pin_code
                    }
                )
            else:
                response = await client.post(
                    "https://api.invincibleocean.com/invincible/genOtp/creditScoreCheckV1",
                    headers={
                        "Content-Type": "application/json",
                        "clientId": EXPERIAN_CLIENT_ID,
                        "secretKey": EXPERIAN_SECRET_KEY
                    },
                    json={
                        "name": f"{request_data.first_name} {request_data.last_name}",
                        "panNumber": request_data.pan_number,
                        "mobileNumber": request_data.mobile_number
                    }
                )
        
        result = response.json()
        logger.info(f"[CREDIT_SCORE] {bureau.upper()} OTP API response code: {result.get('code')}")
        
        if result.get("code") == 200:
            token = result.get("token") or result.get("result", {}).get("token")
            
            await db.loan_leads.update_one(
                {"id": lead_id},
                {
                    "$set": {
                        "credit_score_request": {
                            "status": "OTP_SENT",
                            "bureau": bureau,
                            "mobile_number": request_data.mobile_number,
                            "pan_number": request_data.pan_number[:5] + "XXXXX" + request_data.pan_number[-1],
                            "requested_at": datetime.now(timezone.utc).isoformat(),
                            "requested_by": current_user.get("email")
                        }
                    }
                }
            )
            
            return {
                "success": True,
                "message": result.get("message", "OTP sent successfully"),
                "token": token,
                "bureau": bureau
            }
        else:
            error_msg = result.get("message", "Failed to send OTP")
            logger.error(f"[CREDIT_SCORE] {bureau.upper()} OTP request failed: {error_msg}")
            raise HTTPException(status_code=400, detail=error_msg)
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[CREDIT_SCORE] Error requesting OTP: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to request OTP: {str(e)}")


@router.post("/loan-leads/{lead_id}/credit-score/verify-otp")
async def verify_credit_score_otp(
    lead_id: str,
    verify_data: CreditScoreVerifyRequest,
    current_user: dict = Depends(get_current_user)
):
    """Verify OTP and fetch credit score report from Equifax (V1) or Experian (V4)"""
    try:
        lead = await db.loan_leads.find_one({"id": lead_id})
        if not lead:
            raise HTTPException(status_code=404, detail="Loan lead not found")
        
        if not EXPERIAN_CLIENT_ID or not EXPERIAN_SECRET_KEY:
            raise HTTPException(status_code=500, detail="Credit score API not configured")
        
        bureau = verify_data.bureau.lower() if verify_data.bureau else lead.get("credit_score_request", {}).get("bureau", "equifax")
        logger.info(f"[CREDIT_SCORE] Verifying OTP via {bureau.upper()} for lead {lead_id}")
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            if bureau == "experian":
                response = await client.post(
                    "https://api.invincibleocean.com/invincible/verifyOtp/getCreditScoreCheckV4",
                    headers={
                        "Content-Type": "application/json",
                        "clientId": EXPERIAN_CLIENT_ID,
                        "secretKey": EXPERIAN_SECRET_KEY
                    },
                    json={"token": verify_data.token, "otp": verify_data.otp}
                )
            else:
                response = await client.post(
                    "https://api.invincibleocean.com/invincible/verifyOtp/getCreditScoreCheckV1",
                    headers={
                        "Content-Type": "application/json",
                        "clientId": EXPERIAN_CLIENT_ID,
                        "secretKey": EXPERIAN_SECRET_KEY
                    },
                    json={"token": verify_data.token, "otp": verify_data.otp}
                )
        
        result = response.json()
        logger.info(f"[CREDIT_SCORE] {bureau.upper()} Verify API response code: {result.get('code')}")
        
        if result.get("code") == 200:
            credit_data = result.get("result", {})
            
            # Extract score - handle both structures
            if bureau == "experian":
                score_data = credit_data.get("SCORE", {})
                credit_score = score_data.get("FCIREXScore", 0) or score_data.get("BureauScore", 0)
                cais_summary = credit_data.get("CAIS_Account", {}).get("CAIS_Summary", {})
            else:
                credit_score = (
                    credit_data.get("creditScore") or 
                    credit_data.get("score") or
                    credit_data.get("SCORE", {}).get("FCIREXScore") or
                    credit_data.get("SCORE", {}).get("BureauScore") or
                    0
                )
                cais_summary = credit_data.get("CAIS_Account", {}).get("CAIS_Summary", {}) or credit_data.get("accountSummary", {})
                score_data = credit_data.get("SCORE", {}) or {"score": credit_score}
            
            credit_account = cais_summary.get("Credit_Account", {}) or cais_summary.get("creditAccount", {})
            outstanding = cais_summary.get("Total_Outstanding_Balance", {}) or cais_summary.get("outstandingBalance", {})
            total_caps = credit_data.get("TotalCAPS_Summary", {}) or credit_data.get("enquirySummary", {})
            
            credit_summary = {
                "score": credit_score,
                "bureau": bureau,
                "score_confidence": score_data.get("FCIREXScoreConfidLevel", "") or score_data.get("confidence", ""),
                "report_date": credit_data.get("CreditProfileHeader", {}).get("ReportDate") or credit_data.get("reportDate"),
                "report_number": credit_data.get("CreditProfileHeader", {}).get("ReportNumber") or credit_data.get("reportNumber"),
                "accounts": {
                    "total": credit_account.get("CreditAccountTotal", 0) or credit_account.get("total", 0),
                    "active": credit_account.get("CreditAccountActive", 0) or credit_account.get("active", 0),
                    "closed": credit_account.get("CreditAccountClosed", 0) or credit_account.get("closed", 0),
                    "default": credit_account.get("CreditAccountDefault", 0) or credit_account.get("default", 0)
                },
                "outstanding_balance": {
                    "total": outstanding.get("Outstanding_Balance_All", 0) or outstanding.get("total", 0),
                    "secured": outstanding.get("Outstanding_Balance_Secured", 0) or outstanding.get("secured", 0),
                    "unsecured": outstanding.get("Outstanding_Balance_UnSecured", 0) or outstanding.get("unsecured", 0)
                },
                "enquiries": {
                    "last_7_days": total_caps.get("TotalCAPSLast7Days", 0) or total_caps.get("last7Days", 0),
                    "last_30_days": total_caps.get("TotalCAPSLast30Days", 0) or total_caps.get("last30Days", 0),
                    "last_90_days": total_caps.get("TotalCAPSLast90Days", 0) or total_caps.get("last90Days", 0),
                    "last_180_days": total_caps.get("TotalCAPSLast180Days", 0) or total_caps.get("last180Days", 0)
                }
            }
            
            now = datetime.now(timezone.utc)
            await db.loan_leads.update_one(
                {"id": lead_id},
                {
                    "$set": {
                        "credit_score": credit_score,
                        "credit_score_bureau": bureau,
                        "credit_score_summary": credit_summary,
                        "credit_score_full_report": credit_data,
                        "credit_score_request.status": "COMPLETED",
                        "credit_score_request.completed_at": now.isoformat(),
                        "updated_at": now
                    }
                }
            )
            
            logger.info(f"[CREDIT_SCORE] Successfully fetched {bureau.upper()} score {credit_score} for lead {lead_id}")
            
            return {
                "success": True,
                "message": "Credit report fetched successfully",
                "credit_score": credit_score,
                "bureau": bureau,
                "summary": credit_summary,
                "full_report": credit_data
            }
        else:
            error_msg = result.get("message", "Failed to verify OTP")
            logger.error(f"[CREDIT_SCORE] {bureau.upper()} OTP verification failed: {error_msg}")
            
            await db.loan_leads.update_one(
                {"id": lead_id},
                {"$set": {"credit_score_request.status": "FAILED", "credit_score_request.error": error_msg}}
            )
            
            raise HTTPException(status_code=400, detail=error_msg)
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[CREDIT_SCORE] Error verifying OTP: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to verify OTP: {str(e)}")


@router.get("/loan-leads/{lead_id}/credit-score")
async def get_credit_score(
    lead_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get stored credit score for a loan lead"""
    lead = await db.loan_leads.find_one(
        {"id": lead_id},
        {"_id": 0, "credit_score": 1, "credit_score_summary": 1, "credit_score_full_report": 1, "credit_score_request": 1}
    )
    if not lead:
        raise HTTPException(status_code=404, detail="Loan lead not found")
    
    return {
        "credit_score": lead.get("credit_score"),
        "summary": lead.get("credit_score_summary"),
        "full_report": lead.get("credit_score_full_report"),
        "request_status": lead.get("credit_score_request", {}).get("status")
    }


# ========================
# VEHICLE MANAGEMENT
# ========================

@router.post("/loan-leads/{lead_id}/vehicles")
async def add_vehicle_to_loan_lead(
    lead_id: str,
    vehicle_data: VehicleLoanDetailsCreate,
    current_user: dict = Depends(get_current_user)
):
    """Add a vehicle to a loan lead"""
    lead = await db.loan_leads.find_one({"id": lead_id})
    if not lead:
        raise HTTPException(status_code=404, detail="Loan lead not found")
    
    now = datetime.now(timezone.utc)
    
    vehicle = {
        "vehicle_id": str(uuid.uuid4()),
        "car_number": vehicle_data.car_number.upper().replace(" ", ""),
        "car_make": vehicle_data.car_make,
        "car_model": vehicle_data.car_model,
        "car_year": vehicle_data.car_year,
        "car_variant": vehicle_data.car_variant,
        "vehicle_valuation": vehicle_data.vehicle_valuation,
        "required_loan_amount": vehicle_data.required_loan_amount,
        "expected_emi": vehicle_data.expected_emi,
        "expected_interest_rate": vehicle_data.expected_interest_rate,
        "expected_tenure_months": vehicle_data.expected_tenure_months,
        "rc_card_url": None,
        "insurance_doc_url": None,
        "vaahan_data": None,
        "added_at": now.isoformat()
    }
    
    # Check for existing inspection data
    if vehicle_data.inspection_id:
        inspection = await db.inspections.find_one({"id": vehicle_data.inspection_id}, {"_id": 0})
        if inspection:
            vehicle["car_make"] = inspection.get("car_make") or vehicle["car_make"]
            vehicle["car_model"] = inspection.get("car_model") or vehicle["car_model"]
            vehicle["car_year"] = inspection.get("car_year") or vehicle["car_year"]
            vehicle["car_variant"] = inspection.get("car_variant") or vehicle["car_variant"]
            vehicle["vaahan_data"] = inspection.get("vaahan_data")
    
    await db.loan_leads.update_one(
        {"id": lead_id},
        {
            "$push": {"vehicles": vehicle},
            "$set": {"updated_at": now.isoformat()}
        }
    )
    
    return {"message": "Vehicle added successfully", "vehicle": vehicle}


@router.put("/loan-leads/{lead_id}/vehicles/{vehicle_id}")
async def update_vehicle_in_loan_lead(
    lead_id: str,
    vehicle_id: str,
    vehicle_data: VehicleLoanDetailsCreate,
    current_user: dict = Depends(get_current_user)
):
    """Update a vehicle in a loan lead"""
    lead = await db.loan_leads.find_one({"id": lead_id})
    if not lead:
        raise HTTPException(status_code=404, detail="Loan lead not found")
    
    now = datetime.now(timezone.utc)
    
    # Build update document dynamically to only set provided fields
    update_fields = {"updated_at": now.isoformat()}
    
    if vehicle_data.car_number:
        update_fields["vehicles.$.car_number"] = vehicle_data.car_number.upper().replace(" ", "")
    if vehicle_data.car_make:
        update_fields["vehicles.$.car_make"] = vehicle_data.car_make
    if vehicle_data.car_model:
        update_fields["vehicles.$.car_model"] = vehicle_data.car_model
    if vehicle_data.car_year:
        update_fields["vehicles.$.car_year"] = vehicle_data.car_year
    if vehicle_data.car_variant:
        update_fields["vehicles.$.car_variant"] = vehicle_data.car_variant
    if vehicle_data.vehicle_valuation is not None:
        update_fields["vehicles.$.vehicle_valuation"] = vehicle_data.vehicle_valuation
    if vehicle_data.required_loan_amount is not None:
        update_fields["vehicles.$.required_loan_amount"] = vehicle_data.required_loan_amount
    if vehicle_data.expected_emi is not None:
        update_fields["vehicles.$.expected_emi"] = vehicle_data.expected_emi
    if vehicle_data.expected_tenure_months is not None:
        update_fields["vehicles.$.expected_tenure_months"] = vehicle_data.expected_tenure_months
    
    result = await db.loan_leads.update_one(
        {"id": lead_id, "vehicles.vehicle_id": vehicle_id},
        {"$set": update_fields}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    return {"message": "Vehicle updated successfully"}


@router.delete("/loan-leads/{lead_id}/vehicles/{vehicle_id}")
async def delete_vehicle_from_loan_lead(
    lead_id: str,
    vehicle_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a vehicle from a loan lead"""
    result = await db.loan_leads.update_one(
        {"id": lead_id},
        {
            "$pull": {"vehicles": {"vehicle_id": vehicle_id}},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    return {"message": "Vehicle deleted successfully"}


@router.post("/loan-leads/{lead_id}/vehicles/{vehicle_id}/fetch-vaahan")
async def fetch_vaahan_for_loan_vehicle(
    lead_id: str,
    vehicle_id: str,
    force_refresh: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """
    Fetch vehicle data from Vaahan API (with local DB caching) and update the loan vehicle record.
    
    Flow:
    1. First checks local vehicles collection for cached data
    2. Only calls Vaahan API if not found or force_refresh=true
    3. Saves to local DB for future use
    4. Updates the vehicle in the loan lead
    """
    from services.vaahan_service import vaahan_service
    from services.brand_mapper import brand_mapper
    
    lead = await db.loan_leads.find_one({"id": lead_id})
    if not lead:
        raise HTTPException(status_code=404, detail="Loan lead not found")
    
    vehicle = None
    vehicle_index = -1
    for i, v in enumerate(lead.get("vehicles", [])):
        if v.get("vehicle_id") == vehicle_id:
            vehicle = v
            vehicle_index = i
            break
    
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    car_number = vehicle.get("car_number", "")
    if not car_number:
        raise HTTPException(status_code=400, detail="No vehicle number found")
    
    # Clean registration number
    clean_number = car_number.replace(" ", "").replace("-", "").upper()
    
    # Step 1: Check local DB first (unless force_refresh)
    vehicle_data = None
    source = "local_db"
    
    if not force_refresh:
        cached_vehicle = await db.vehicles.find_one(
            {"registration_number": {"$regex": f"^{clean_number}$", "$options": "i"}},
            {"_id": 0}
        )
        if cached_vehicle:
            logger.info(f"Vehicle {clean_number} found in local DB for loan lead {lead_id}")
            vehicle_data = cached_vehicle.get("vaahan_raw_response", cached_vehicle)
    
    # Step 2: If not in cache or force_refresh, call Vaahan API
    if vehicle_data is None:
        logger.info(f"Fetching vehicle {clean_number} from Vaahan API for loan lead {lead_id}")
        result = await vaahan_service.get_vehicle_details(clean_number)
        
        if not result.get("success"):
            return {
                "success": False,
                "error": result.get("error", "Failed to fetch vehicle details"),
                "vehicle": vehicle
            }
        
        vehicle_data = result.get("data", {})
        source = "vaahan_api"
        
        # Save to local DB for future use
        vehicle_record = {
            "id": str(uuid.uuid4()),
            "registration_number": clean_number,
            "manufacturer": vehicle_data.get("manufacturer", ""),
            "model": vehicle_data.get("model", ""),
            "color": vehicle_data.get("color", ""),
            "fuel_type": vehicle_data.get("fuel_type", ""),
            "manufacturing_date": vehicle_data.get("manufacturing_date", ""),
            "owner_count": vehicle_data.get("owner_count", ""),
            "insurance_company": vehicle_data.get("insurance_company", ""),
            "insurance_valid_upto": vehicle_data.get("insurance_valid_upto", ""),
            "hypothecation_bank": vehicle_data.get("hypothecation_bank", ""),
            "blacklist_status": vehicle_data.get("blacklist_status", ""),
            "vaahan_raw_response": vehicle_data,
            "country_id": current_user.get("country_id"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": current_user["id"],
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": current_user["id"],
        }
        
        await db.vehicles.update_one(
            {"registration_number": {"$regex": f"^{clean_number}$", "$options": "i"}},
            {"$set": vehicle_record},
            upsert=True
        )
        logger.info(f"Vehicle {clean_number} saved to local DB")
    
    # Update the vehicle in the loan lead with Vaahan data
    now = datetime.now(timezone.utc).isoformat()
    
    # Normalize manufacturer
    raw_manufacturer = vehicle_data.get("manufacturer", "")
    normalized_make = brand_mapper.get_brand_with_fallback(raw_manufacturer) if raw_manufacturer else vehicle.get("car_make", "")
    
    # Extract year from manufacturing date
    car_year = vehicle.get("car_year", "")
    mfg_date = vehicle_data.get("manufacturing_date", "")
    if mfg_date:
        try:
            if "/" in mfg_date:
                car_year = mfg_date.split("/")[-1]
            else:
                car_year = mfg_date[:4] if len(mfg_date) >= 4 else car_year
        except (ValueError, TypeError, AttributeError):
            pass
    
    update_data = {
        f"vehicles.{vehicle_index}.car_make": normalized_make or vehicle.get("car_make", ""),
        f"vehicles.{vehicle_index}.car_model": vehicle_data.get("model", "") or vehicle.get("car_model", ""),
        f"vehicles.{vehicle_index}.car_year": car_year,
        f"vehicles.{vehicle_index}.fuel_type": vehicle_data.get("fuel_type", ""),
        f"vehicles.{vehicle_index}.color": vehicle_data.get("color", ""),
        f"vehicles.{vehicle_index}.owner_count": vehicle_data.get("owner_count", ""),
        f"vehicles.{vehicle_index}.vaahan_data": vehicle_data,
        f"vehicles.{vehicle_index}.vaahan_fetched_at": now,
        "updated_at": now
    }
    
    await db.loan_leads.update_one({"id": lead_id}, {"$set": update_data})
    
    # Return updated vehicle
    updated_lead = await db.loan_leads.find_one({"id": lead_id}, {"_id": 0})
    updated_vehicle = updated_lead.get("vehicles", [])[vehicle_index] if updated_lead else vehicle
    
    return {
        "success": True,
        "message": f"Vehicle data loaded from {source}",
        "source": source,
        "vaahan_data": vehicle_data,
        "vehicle": updated_vehicle
    }


# ========================
# BANK ELIGIBILITY
# ========================

@router.post("/loan-leads/{lead_id}/vehicles/{vehicle_id}/check-eligibility")
async def check_bank_eligibility(
    lead_id: str,
    vehicle_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Check bank eligibility for a vehicle - MOCKED for now"""
    lead = await db.loan_leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Loan lead not found")
    
    vehicle = None
    for v in lead.get("vehicles", []):
        if v.get("vehicle_id") == vehicle_id:
            vehicle = v
            break
    
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    banks = await db.bank_master.find({"is_active": True}, {"_id": 0}).to_list(100)
    
    now = datetime.now(timezone.utc)
    eligibility_results = []
    
    vehicle_value = vehicle.get("vehicle_valuation") or 500000
    required_amount = vehicle.get("required_loan_amount") or (vehicle_value * 0.7)
    
    for bank in banks:
        # MOCKED eligibility check - 70% approval rate
        is_eligible = random.random() > 0.3
        
        if is_eligible:
            max_loan = min(required_amount, vehicle_value * (bank.get("max_ltv_percent", 80) / 100))
            interest_rate = round(random.uniform(bank.get("interest_rate_min", 9), bank.get("interest_rate_max", 14)), 2)
            tenure = min(vehicle.get("expected_tenure_months") or 60, bank.get("max_tenure_months", 84))
            
            monthly_rate = interest_rate / 12 / 100
            emi = max_loan * monthly_rate * ((1 + monthly_rate) ** tenure) / (((1 + monthly_rate) ** tenure) - 1)
            
            result = {
                "bank_id": bank["id"],
                "bank_name": bank["bank_name"],
                "bank_code": bank.get("bank_code"),
                "is_eligible": True,
                "interest_rate": interest_rate,
                "max_loan_amount": round(max_loan, 0),
                "emi_amount": round(emi, 0),
                "tenure_months": tenure,
                "processing_fee": round(max_loan * bank.get("processing_fee_percent", 1) / 100, 0),
                "rejection_reason": None,
                "checked_at": now.isoformat()
            }
        else:
            reasons = [
                "Vehicle age exceeds limit",
                "Required documents pending",
                "Credit score below threshold",
                "Income criteria not met"
            ]
            result = {
                "bank_id": bank["id"],
                "bank_name": bank["bank_name"],
                "bank_code": bank.get("bank_code"),
                "is_eligible": False,
                "rejection_reason": random.choice(reasons),
                "checked_at": now.isoformat()
            }
        
        eligibility_results.append(result)
    
    # Store results
    await db.loan_leads.update_one(
        {"id": lead_id, "vehicles.vehicle_id": vehicle_id},
        {
            "$set": {
                "vehicles.$.eligibility_results": eligibility_results,
                "vehicles.$.eligibility_checked_at": now.isoformat(),
                "updated_at": now.isoformat()
            }
        }
    )
    
    return {
        "vehicle_id": vehicle_id,
        "eligibility_results": eligibility_results,
        "eligible_banks": len([r for r in eligibility_results if r["is_eligible"]]),
        "total_banks": len(eligibility_results)
    }


# ========================
# LOAN APPLICATIONS
# ========================

@router.post("/loan-leads/{lead_id}/applications")
async def create_loan_application(
    lead_id: str,
    application_data: LoanApplicationCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a loan application for a vehicle to a bank"""
    lead = await db.loan_leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Loan lead not found")
    
    # Verify vehicle exists
    vehicle = None
    for v in lead.get("vehicles", []):
        if v.get("vehicle_id") == application_data.vehicle_loan_id:
            vehicle = v
            break
    
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Get bank details
    bank = await db.bank_master.find_one({"id": application_data.bank_id}, {"_id": 0})
    if not bank:
        raise HTTPException(status_code=404, detail="Bank not found")
    
    now = datetime.now(timezone.utc)
    
    application = {
        "id": str(uuid.uuid4()),
        "loan_lead_id": lead_id,
        "vehicle_loan_id": application_data.vehicle_loan_id,
        "bank_id": application_data.bank_id,
        "bank_name": bank["bank_name"],
        "status": "DRAFT",
        "applied_amount": application_data.applied_amount,
        "tenure_months": application_data.tenure_months,
        "status_history": [{
            "status": "DRAFT",
            "changed_at": now.isoformat(),
            "changed_by": current_user.get("email")
        }],
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.loan_leads.update_one(
        {"id": lead_id},
        {
            "$push": {"applications": application},
            "$set": {"updated_at": now.isoformat()}
        }
    )
    
    return {"message": "Loan application created", "application": application}


@router.put("/loan-leads/{lead_id}/applications/{application_id}")
async def update_loan_application(
    lead_id: str,
    application_id: str,
    update_data: LoanApplicationUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update loan application status and details"""
    lead = await db.loan_leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Loan lead not found")
    
    # Find application
    app_index = None
    for i, app in enumerate(lead.get("applications", [])):
        if app.get("id") == application_id:
            app_index = i
            break
    
    if app_index is None:
        raise HTTPException(status_code=404, detail="Application not found")
    
    now = datetime.now(timezone.utc)
    update_dict = {"updated_at": now.isoformat()}
    
    for field, value in update_data.model_dump(exclude_unset=True).items():
        if value is not None:
            update_dict[f"applications.{app_index}.{field}"] = value if not isinstance(value, datetime) else value.isoformat()
    
    # Track status change
    if update_data.status:
        status_entry = {
            "status": update_data.status,
            "changed_at": now.isoformat(),
            "changed_by": current_user.get("email"),
            "remarks": update_data.remarks
        }
        await db.loan_leads.update_one(
            {"id": lead_id},
            {"$push": {f"applications.{app_index}.status_history": status_entry}}
        )
    
    await db.loan_leads.update_one({"id": lead_id}, {"$set": update_dict})
    
    updated = await db.loan_leads.find_one({"id": lead_id}, {"_id": 0})
    return {"message": "Application updated", "application": updated["applications"][app_index]}


# ========================
# LOAN OFFERS
# ========================

@router.get("/loan-leads/{lead_id}/offers")
async def get_loan_offers(
    lead_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all loan offers for a lead"""
    lead = await db.loan_leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Loan lead not found")
    
    return lead.get("loan_offers", [])


@router.post("/loan-leads/{lead_id}/offers")
async def create_loan_offer(
    lead_id: str,
    offer_data: LoanOfferCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new loan offer from a bank (after approval)"""
    lead = await db.loan_leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Loan lead not found")
    
    # Find the application
    application = None
    for app in lead.get("applications", []):
        if app.get("id") == offer_data.application_id:
            application = app
            break
    
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    # Get bank details
    bank = await db.bank_master.find_one({"id": application["bank_id"]}, {"_id": 0})
    if not bank:
        raise HTTPException(status_code=404, detail="Bank not found")
    
    now = datetime.now(timezone.utc)
    
    # Calculate total loan amount
    total_loan_amount = offer_data.loan_amount_approved + offer_data.loan_insurance
    
    # Build charges list
    charges = []
    total_charges = 0
    
    # Processing Fee
    if offer_data.processing_fee_percent is not None:
        proc_fee = round(offer_data.loan_amount_approved * offer_data.processing_fee_percent / 100, 0)
        charges.append({
            "charge_type": "processing_fee",
            "charge_name": "Processing Fee",
            "amount": proc_fee,
            "is_percentage": True,
            "percentage_value": offer_data.processing_fee_percent,
            "is_waived": False,
            "is_negotiable": True,
            "notes": f"{offer_data.processing_fee_percent}% of loan amount"
        })
        total_charges += proc_fee
    elif offer_data.processing_fee_amount is not None:
        charges.append({
            "charge_type": "processing_fee",
            "charge_name": "Processing Fee",
            "amount": offer_data.processing_fee_amount,
            "is_percentage": False,
            "is_waived": False,
            "is_negotiable": True,
            "notes": None
        })
        total_charges += offer_data.processing_fee_amount
    
    # Document Handling Fee
    if offer_data.document_handling_fee:
        charges.append({
            "charge_type": "document_handling",
            "charge_name": "Document Handling Fee",
            "amount": offer_data.document_handling_fee,
            "is_percentage": False,
            "is_waived": False,
            "is_negotiable": True,
            "notes": None
        })
        total_charges += offer_data.document_handling_fee
    
    # RTO Charges
    if offer_data.rto_charges:
        charges.append({
            "charge_type": "rto_charges",
            "charge_name": "RTO Charges",
            "amount": offer_data.rto_charges,
            "is_percentage": False,
            "is_waived": False,
            "is_negotiable": True,
            "notes": None
        })
        total_charges += offer_data.rto_charges
    
    # Insurance Charges
    if offer_data.insurance_charges:
        charges.append({
            "charge_type": "insurance_charges",
            "charge_name": "Insurance Charges",
            "amount": offer_data.insurance_charges,
            "is_percentage": False,
            "is_waived": False,
            "is_negotiable": True,
            "notes": "Vehicle insurance required"
        })
        total_charges += offer_data.insurance_charges
    
    # Valuation Charges
    if offer_data.valuation_charges:
        charges.append({
            "charge_type": "valuation_charges",
            "charge_name": "Valuation Charges",
            "amount": offer_data.valuation_charges,
            "is_percentage": False,
            "is_waived": False,
            "is_negotiable": True,
            "notes": None
        })
        total_charges += offer_data.valuation_charges
    
    # Stamp Duty
    if offer_data.stamp_duty:
        charges.append({
            "charge_type": "stamp_duty",
            "charge_name": "Stamp Duty Amount",
            "amount": offer_data.stamp_duty,
            "is_percentage": False,
            "is_waived": False,
            "is_negotiable": False,
            "notes": "Government stamp duty"
        })
        total_charges += offer_data.stamp_duty
    
    # Other charges
    if offer_data.other_charges:
        for other in offer_data.other_charges:
            charges.append({
                "charge_type": "other",
                "charge_name": other.get("name", "Other Charge"),
                "amount": other.get("amount", 0),
                "is_percentage": False,
                "is_waived": False,
                "is_negotiable": True,
                "notes": other.get("notes")
            })
            total_charges += other.get("amount", 0)
    
    # Calculate EMI
    monthly_rate = offer_data.interest_rate / 12 / 100
    tenure = offer_data.tenure_months
    emi = total_loan_amount * monthly_rate * ((1 + monthly_rate) ** tenure) / (((1 + monthly_rate) ** tenure) - 1)
    
    # Calculate net disbursal
    net_disbursal = total_loan_amount - total_charges
    
    offer = {
        "id": str(uuid.uuid4()),
        "application_id": offer_data.application_id,
        "loan_lead_id": lead_id,
        "vehicle_loan_id": application.get("vehicle_loan_id"),
        "bank_id": application["bank_id"],
        "bank_name": bank["bank_name"],
        
        # Amounts
        "loan_amount_approved": offer_data.loan_amount_approved,
        "loan_insurance": offer_data.loan_insurance,
        "total_loan_amount": total_loan_amount,
        
        # Interest and EMI
        "interest_rate": offer_data.interest_rate,
        "tenure_months": offer_data.tenure_months,
        "emi_amount": round(emi, 0),
        
        # Charges
        "charges": charges,
        "total_charges": total_charges,
        "net_disbursal_amount": net_disbursal,
        
        # Bank reference
        "bank_reference_number": offer_data.bank_reference_number,
        "bank_sanction_letter_url": None,
        
        # Status
        "offer_status": "PENDING",
        "offer_valid_until": offer_data.offer_valid_until.isoformat() if offer_data.offer_valid_until else None,
        
        # History
        "negotiation_history": [],
        "final_charges": None,
        "final_net_disbursal": None,
        
        # Audit
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "created_by": current_user.get("email")
    }
    
    # Update application status
    app_index = None
    for i, app in enumerate(lead.get("applications", [])):
        if app.get("id") == offer_data.application_id:
            app_index = i
            break
    
    update_ops = {
        "$push": {"loan_offers": offer},
        "$set": {
            "updated_at": now.isoformat(),
            f"applications.{app_index}.status": "OFFER_RECEIVED",
            f"applications.{app_index}.approved_amount": offer_data.loan_amount_approved,
            f"applications.{app_index}.interest_rate": offer_data.interest_rate,
            f"applications.{app_index}.tenure_months": offer_data.tenure_months,
            f"applications.{app_index}.emi_amount": round(emi, 0)
        }
    }
    
    await db.loan_leads.update_one({"id": lead_id}, update_ops)
    
    return {"message": "Loan offer created", "offer": offer}


@router.get("/loan-leads/{lead_id}/offers/{offer_id}")
async def get_loan_offer(
    lead_id: str,
    offer_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific loan offer"""
    lead = await db.loan_leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Loan lead not found")
    
    for offer in lead.get("loan_offers", []):
        if offer.get("id") == offer_id:
            return offer
    
    raise HTTPException(status_code=404, detail="Offer not found")


@router.put("/loan-leads/{lead_id}/offers/{offer_id}")
async def update_loan_offer(
    lead_id: str,
    offer_id: str,
    update_data: LoanOfferUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update loan offer (status, charges negotiation)"""
    lead = await db.loan_leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Loan lead not found")
    
    # Find offer
    offer_index = None
    offer = None
    for i, o in enumerate(lead.get("loan_offers", [])):
        if o.get("id") == offer_id:
            offer_index = i
            offer = o
            break
    
    if offer_index is None:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    now = datetime.now(timezone.utc)
    update_dict = {f"loan_offers.{offer_index}.updated_at": now.isoformat()}
    
    # Update offer status
    if update_data.offer_status:
        update_dict[f"loan_offers.{offer_index}.offer_status"] = update_data.offer_status
    
    # Process charge updates (negotiation)
    if update_data.charges_updates:
        charges = offer.get("charges", [])
        new_total_charges = 0
        
        for charge_update in update_data.charges_updates:
            for i, charge in enumerate(charges):
                if charge.get("charge_type") == charge_update.charge_type:
                    if charge_update.new_amount is not None:
                        charges[i]["amount"] = charge_update.new_amount
                    if charge_update.is_waived is not None:
                        charges[i]["is_waived"] = charge_update.is_waived
                    if charge_update.notes:
                        charges[i]["notes"] = charge_update.notes
                    break
        
        # Recalculate total charges
        for charge in charges:
            if not charge.get("is_waived"):
                new_total_charges += charge.get("amount", 0)
        
        # Calculate new net disbursal
        total_loan_amount = offer.get("total_loan_amount", 0)
        new_net_disbursal = total_loan_amount - new_total_charges
        
        update_dict[f"loan_offers.{offer_index}.charges"] = charges
        update_dict[f"loan_offers.{offer_index}.total_charges"] = new_total_charges
        update_dict[f"loan_offers.{offer_index}.net_disbursal_amount"] = new_net_disbursal
        
        # Record negotiation history
        negotiation_entry = {
            "timestamp": now.isoformat(),
            "user": current_user.get("email"),
            "changes": [cu.model_dump() for cu in update_data.charges_updates],
            "notes": update_data.negotiation_notes,
            "new_total_charges": new_total_charges,
            "new_net_disbursal": new_net_disbursal
        }
        
        await db.loan_leads.update_one(
            {"id": lead_id},
            {"$push": {f"loan_offers.{offer_index}.negotiation_history": negotiation_entry}}
        )
    
    update_dict["updated_at"] = now.isoformat()
    
    await db.loan_leads.update_one({"id": lead_id}, {"$set": update_dict})
    
    updated_lead = await db.loan_leads.find_one({"id": lead_id}, {"_id": 0})
    return {"message": "Offer updated", "offer": updated_lead["loan_offers"][offer_index]}


@router.post("/loan-leads/{lead_id}/offers/{offer_id}/accept")
async def accept_loan_offer(
    lead_id: str,
    offer_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Accept a loan offer - finalizes the charges and marks as accepted"""
    lead = await db.loan_leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Loan lead not found")
    
    # Find offer
    offer_index = None
    offer = None
    for i, o in enumerate(lead.get("loan_offers", [])):
        if o.get("id") == offer_id:
            offer_index = i
            offer = o
            break
    
    if offer_index is None:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    now = datetime.now(timezone.utc)
    
    # Store final values
    final_charges = offer.get("charges", [])
    final_net_disbursal = offer.get("net_disbursal_amount")
    
    update_dict = {
        f"loan_offers.{offer_index}.offer_status": "ACCEPTED",
        f"loan_offers.{offer_index}.final_charges": final_charges,
        f"loan_offers.{offer_index}.final_net_disbursal": final_net_disbursal,
        f"loan_offers.{offer_index}.updated_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    # Also update the application status
    app_id = offer.get("application_id")
    for i, app in enumerate(lead.get("applications", [])):
        if app.get("id") == app_id:
            update_dict[f"applications.{i}.status"] = "OFFER_ACCEPTED"
            break
    
    await db.loan_leads.update_one({"id": lead_id}, {"$set": update_dict})
    
    return {"message": "Offer accepted", "final_net_disbursal": final_net_disbursal}


@router.post("/loan-leads/{lead_id}/manual-offer")
async def create_manual_bank_offer(
    lead_id: str,
    bank_id: str,
    vehicle_loan_id: str,
    loan_amount_approved: float,
    interest_rate: float,
    tenure_months: int,
    loan_insurance: float = 0,
    processing_fee_percent: Optional[float] = None,
    processing_fee_amount: Optional[float] = None,
    document_handling_fee: Optional[float] = None,
    rto_charges: Optional[float] = None,
    insurance_charges: Optional[float] = None,
    bank_reference_number: Optional[str] = None,
    notes: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Manually add a bank offer even if not eligible by system rules.
    Used when banker approves a loan outside normal eligibility criteria.
    """
    lead = await db.loan_leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Loan lead not found")
    
    # Verify vehicle exists
    vehicle = None
    for v in lead.get("vehicles", []):
        if v.get("vehicle_id") == vehicle_loan_id:
            vehicle = v
            break
    
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Get bank details
    bank = await db.bank_master.find_one({"id": bank_id}, {"_id": 0})
    if not bank:
        raise HTTPException(status_code=404, detail="Bank not found")
    
    now = datetime.now(timezone.utc)
    
    # First create a manual application if it doesn't exist
    application_id = None
    for app in lead.get("applications", []):
        if app.get("bank_id") == bank_id and app.get("vehicle_loan_id") == vehicle_loan_id:
            application_id = app.get("id")
            break
    
    if not application_id:
        # Create new application
        application_id = str(uuid.uuid4())
        application = {
            "id": application_id,
            "loan_lead_id": lead_id,
            "vehicle_loan_id": vehicle_loan_id,
            "bank_id": bank_id,
            "bank_name": bank["bank_name"],
            "status": "OFFER_RECEIVED",
            "applied_amount": loan_amount_approved,
            "approved_amount": loan_amount_approved,
            "interest_rate": interest_rate,
            "tenure_months": tenure_months,
            "remarks": notes or "Manual application - banker approved outside normal criteria",
            "status_history": [{
                "status": "OFFER_RECEIVED",
                "changed_at": now.isoformat(),
                "changed_by": current_user.get("email"),
                "remarks": "Manual offer created"
            }],
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }
        
        await db.loan_leads.update_one(
            {"id": lead_id},
            {"$push": {"applications": application}}
        )
    
    # Calculate amounts
    total_loan_amount = loan_amount_approved + loan_insurance
    
    # Build charges
    charges = []
    total_charges = 0
    
    if processing_fee_percent is not None:
        proc_fee = round(loan_amount_approved * processing_fee_percent / 100, 0)
        charges.append({
            "charge_type": "processing_fee",
            "charge_name": "Processing Fee",
            "amount": proc_fee,
            "is_percentage": True,
            "percentage_value": processing_fee_percent,
            "is_waived": False,
            "is_negotiable": True,
            "notes": f"{processing_fee_percent}% of loan amount"
        })
        total_charges += proc_fee
    elif processing_fee_amount is not None:
        charges.append({
            "charge_type": "processing_fee",
            "charge_name": "Processing Fee",
            "amount": processing_fee_amount,
            "is_percentage": False,
            "is_waived": False,
            "is_negotiable": True,
            "notes": None
        })
        total_charges += processing_fee_amount
    
    if document_handling_fee:
        charges.append({
            "charge_type": "document_handling",
            "charge_name": "Document Handling Fee",
            "amount": document_handling_fee,
            "is_percentage": False,
            "is_waived": False,
            "is_negotiable": True,
            "notes": None
        })
        total_charges += document_handling_fee
    
    if rto_charges:
        charges.append({
            "charge_type": "rto_charges",
            "charge_name": "RTO Charges",
            "amount": rto_charges,
            "is_percentage": False,
            "is_waived": False,
            "is_negotiable": True,
            "notes": None
        })
        total_charges += rto_charges
    
    if insurance_charges:
        charges.append({
            "charge_type": "insurance_charges",
            "charge_name": "Insurance Charges",
            "amount": insurance_charges,
            "is_percentage": False,
            "is_waived": False,
            "is_negotiable": True,
            "notes": "Vehicle insurance required"
        })
        total_charges += insurance_charges
    
    # Calculate EMI
    monthly_rate = interest_rate / 12 / 100
    emi = total_loan_amount * monthly_rate * ((1 + monthly_rate) ** tenure_months) / (((1 + monthly_rate) ** tenure_months) - 1)
    
    # Calculate net disbursal
    net_disbursal = total_loan_amount - total_charges
    
    offer = {
        "id": str(uuid.uuid4()),
        "application_id": application_id,
        "loan_lead_id": lead_id,
        "vehicle_loan_id": vehicle_loan_id,
        "bank_id": bank_id,
        "bank_name": bank["bank_name"],
        
        "loan_amount_approved": loan_amount_approved,
        "loan_insurance": loan_insurance,
        "total_loan_amount": total_loan_amount,
        
        "interest_rate": interest_rate,
        "tenure_months": tenure_months,
        "emi_amount": round(emi, 0),
        
        "charges": charges,
        "total_charges": total_charges,
        "net_disbursal_amount": net_disbursal,
        
        "bank_reference_number": bank_reference_number,
        "bank_sanction_letter_url": None,
        
        "offer_status": "PENDING",
        "offer_valid_until": None,
        
        "negotiation_history": [],
        "final_charges": None,
        "final_net_disbursal": None,
        
        "is_manual": True,  # Flag to indicate this was manually added
        "manual_notes": notes,
        
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "created_by": current_user.get("email")
    }
    
    await db.loan_leads.update_one(
        {"id": lead_id},
        {
            "$push": {"loan_offers": offer},
            "$set": {"updated_at": now.isoformat()}
        }
    )
    
    return {"message": "Manual bank offer created successfully", "offer": offer}



# ==================== CHARGE TYPE MANAGEMENT ====================

# Default system charge types
SYSTEM_CHARGE_TYPES = [
    {"charge_key": "processing_fee", "charge_name": "Processing Fee", "is_percentage": True, "default_percentage": 1.5, "is_negotiable": True, "is_system": True},
    {"charge_key": "document_handling", "charge_name": "Document Handling Fee", "is_percentage": False, "default_amount": 1500, "is_negotiable": True, "is_system": True},
    {"charge_key": "rto_charges", "charge_name": "RTO Charges", "is_percentage": False, "default_amount": 3000, "is_negotiable": True, "is_system": True},
    {"charge_key": "insurance_charges", "charge_name": "Insurance Charges", "is_percentage": False, "is_negotiable": True, "is_system": True, "description": "If vehicle doesn't have existing insurance"},
    {"charge_key": "valuation_charges", "charge_name": "Valuation Charges", "is_percentage": False, "default_amount": 2000, "is_negotiable": True, "is_system": True},
    {"charge_key": "stamp_duty", "charge_name": "Stamp Duty Amount", "is_percentage": False, "is_negotiable": False, "is_system": True, "description": "Government stamp duty"},
]


@router.get("/charge-types")
async def get_charge_types(
    include_inactive: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Get all charge types (system + custom)"""
    query = {} if include_inactive else {"is_active": True}
    
    # Check if charge_types collection exists and has data
    count = await db.charge_types.count_documents({})
    
    if count == 0:
        # Initialize with system charge types
        now = datetime.now(timezone.utc)
        for ct in SYSTEM_CHARGE_TYPES:
            await db.charge_types.insert_one({
                "id": str(uuid.uuid4()),
                **ct,
                "is_active": True,
                "created_at": now.isoformat(),
                "updated_at": now.isoformat(),
                "created_by": "system"
            })
    
    cursor = db.charge_types.find(query, {"_id": 0}).sort("charge_name", 1)
    charge_types = await cursor.to_list(length=100)
    
    return charge_types


@router.post("/charge-types")
async def create_charge_type(
    data: ChargeTypeCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new custom charge type"""
    # Check if charge_key already exists
    existing = await db.charge_types.find_one({"charge_key": data.charge_key})
    if existing:
        raise HTTPException(status_code=400, detail="Charge type with this key already exists")
    
    now = datetime.now(timezone.utc)
    charge_type = {
        "id": str(uuid.uuid4()),
        "charge_key": data.charge_key.lower().replace(" ", "_"),
        "charge_name": data.charge_name,
        "description": data.description,
        "default_amount": data.default_amount,
        "is_percentage": data.is_percentage,
        "default_percentage": data.default_percentage,
        "is_negotiable": data.is_negotiable,
        "is_system": False,  # Custom charge types are not system
        "is_active": True,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "created_by": current_user.get("email")
    }
    
    await db.charge_types.insert_one(charge_type)
    charge_type.pop("_id", None)
    
    return {"message": "Charge type created successfully", "charge_type": charge_type}


@router.put("/charge-types/{charge_type_id}")
async def update_charge_type(
    charge_type_id: str,
    charge_name: Optional[str] = None,
    description: Optional[str] = None,
    default_amount: Optional[float] = None,
    is_percentage: Optional[bool] = None,
    default_percentage: Optional[float] = None,
    is_negotiable: Optional[bool] = None,
    is_active: Optional[bool] = None,
    current_user: dict = Depends(get_current_user)
):
    """Update a charge type"""
    existing = await db.charge_types.find_one({"id": charge_type_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Charge type not found")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if charge_name is not None:
        update_data["charge_name"] = charge_name
    if description is not None:
        update_data["description"] = description
    if default_amount is not None:
        update_data["default_amount"] = default_amount
    if is_percentage is not None:
        update_data["is_percentage"] = is_percentage
    if default_percentage is not None:
        update_data["default_percentage"] = default_percentage
    if is_negotiable is not None:
        update_data["is_negotiable"] = is_negotiable
    if is_active is not None:
        update_data["is_active"] = is_active
    
    await db.charge_types.update_one(
        {"id": charge_type_id},
        {"$set": update_data}
    )
    
    updated = await db.charge_types.find_one({"id": charge_type_id}, {"_id": 0})
    return {"message": "Charge type updated successfully", "charge_type": updated}


@router.delete("/charge-types/{charge_type_id}")
async def delete_charge_type(
    charge_type_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete (deactivate) a custom charge type. System charge types cannot be deleted."""
    existing = await db.charge_types.find_one({"id": charge_type_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Charge type not found")
    
    if existing.get("is_system"):
        raise HTTPException(status_code=400, detail="System charge types cannot be deleted")
    
    # Soft delete by setting is_active to False
    await db.charge_types.update_one(
        {"id": charge_type_id},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Charge type deleted successfully"}


@router.post("/loan-leads/{lead_id}/offers/{offer_id}/add-charge")
async def add_charge_to_offer(
    lead_id: str,
    offer_id: str,
    charge_type: str,
    charge_name: str,
    amount: float,
    is_percentage: bool = False,
    percentage_value: Optional[float] = None,
    is_negotiable: bool = True,
    notes: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Add a new charge to an existing offer"""
    lead = await db.loan_leads.find_one({"id": lead_id})
    if not lead:
        raise HTTPException(status_code=404, detail="Loan lead not found")
    
    # Find the offer
    offers = lead.get("loan_offers", [])
    offer_idx = next((i for i, o in enumerate(offers) if o.get("id") == offer_id), None)
    
    if offer_idx is None:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    offer = offers[offer_idx]
    
    if offer.get("offer_status") not in ["PENDING", "NEGOTIATING"]:
        raise HTTPException(status_code=400, detail="Cannot add charges to accepted/rejected offers")
    
    # Calculate actual amount if percentage
    actual_amount = amount
    if is_percentage:
        actual_amount = offer.get("loan_amount_approved", 0) * (amount / 100)
    
    new_charge = {
        "charge_type": charge_type,
        "charge_name": charge_name,
        "amount": actual_amount,
        "is_percentage": is_percentage,
        "percentage_value": amount if is_percentage else None,
        "is_waived": False,
        "is_negotiable": is_negotiable,
        "notes": notes
    }
    
    # Add to charges list
    charges = offer.get("charges", [])
    charges.append(new_charge)
    
    # Recalculate totals
    total_charges = sum(c.get("amount", 0) for c in charges if not c.get("is_waived"))
    net_disbursal = offer.get("total_loan_amount", 0) - total_charges
    
    now = datetime.now(timezone.utc)
    
    # Update the offer
    await db.loan_leads.update_one(
        {"id": lead_id, "loan_offers.id": offer_id},
        {
            "$set": {
                "loan_offers.$.charges": charges,
                "loan_offers.$.total_charges": total_charges,
                "loan_offers.$.net_disbursal_amount": net_disbursal,
                "loan_offers.$.updated_at": now.isoformat()
            },
            "$push": {
                "loan_offers.$.negotiation_history": {
                    "action": "add_charge",
                    "charge_type": charge_type,
                    "charge_name": charge_name,
                    "amount": actual_amount,
                    "timestamp": now.isoformat(),
                    "user": current_user.get("email")
                }
            }
        }
    )
    
    return {
        "message": "Charge added successfully",
        "charge": new_charge,
        "new_total_charges": total_charges,
        "new_net_disbursal": net_disbursal
    }


@router.delete("/loan-leads/{lead_id}/offers/{offer_id}/charges/{charge_type}")
async def remove_charge_from_offer(
    lead_id: str,
    offer_id: str,
    charge_type: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove a charge from an offer"""
    lead = await db.loan_leads.find_one({"id": lead_id})
    if not lead:
        raise HTTPException(status_code=404, detail="Loan lead not found")
    
    # Find the offer
    offers = lead.get("loan_offers", [])
    offer_idx = next((i for i, o in enumerate(offers) if o.get("id") == offer_id), None)
    
    if offer_idx is None:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    offer = offers[offer_idx]
    
    if offer.get("offer_status") not in ["PENDING", "NEGOTIATING"]:
        raise HTTPException(status_code=400, detail="Cannot modify charges on accepted/rejected offers")
    
    # Remove the charge
    charges = [c for c in offer.get("charges", []) if c.get("charge_type") != charge_type]
    
    # Recalculate totals
    total_charges = sum(c.get("amount", 0) for c in charges if not c.get("is_waived"))
    net_disbursal = offer.get("total_loan_amount", 0) - total_charges
    
    now = datetime.now(timezone.utc)
    
    await db.loan_leads.update_one(
        {"id": lead_id, "loan_offers.id": offer_id},
        {
            "$set": {
                "loan_offers.$.charges": charges,
                "loan_offers.$.total_charges": total_charges,
                "loan_offers.$.net_disbursal_amount": net_disbursal,
                "loan_offers.$.updated_at": now.isoformat()
            },
            "$push": {
                "loan_offers.$.negotiation_history": {
                    "action": "remove_charge",
                    "charge_type": charge_type,
                    "timestamp": now.isoformat(),
                    "user": current_user.get("email")
                }
            }
        }
    )
    
    return {
        "message": "Charge removed successfully",
        "new_total_charges": total_charges,
        "new_net_disbursal": net_disbursal
    }


# ========================
# CUSTOMER PROFILE ENDPOINTS
# ========================

# Location classification based on city tier
METRO_CITIES = ["Mumbai", "Delhi", "Bangalore", "Bengaluru", "Chennai", "Kolkata", "Hyderabad", "Pune"]
URBAN_CITIES = ["Ahmedabad", "Surat", "Jaipur", "Lucknow", "Kanpur", "Nagpur", "Indore", "Thane", "Bhopal", 
                "Visakhapatnam", "Patna", "Vadodara", "Ghaziabad", "Ludhiana", "Agra", "Nashik", "Faridabad",
                "Meerut", "Rajkot", "Varanasi", "Srinagar", "Aurangabad", "Dhanbad", "Amritsar", "Allahabad"]


def classify_location(city_name: str, pincode: str = None) -> str:
    """Classify location as METRO, URBAN, SEMI_URBAN, or RURAL"""
    if not city_name:
        return None
    
    city_upper = city_name.upper().strip()
    
    # Check metro cities
    for metro in METRO_CITIES:
        if metro.upper() in city_upper or city_upper in metro.upper():
            return "METRO"
    
    # Check urban cities
    for urban in URBAN_CITIES:
        if urban.upper() in city_upper or city_upper in urban.upper():
            return "URBAN"
    
    # Use pincode if available (first digit indicates region)
    if pincode and len(pincode) >= 6:
        # Metro areas typically have lower pincodes
        try:
            pin_prefix = int(pincode[:2])
            # Basic heuristic - can be refined with actual pincode data
            if pin_prefix in [11, 40, 56, 60, 50, 70]:  # Delhi, Mumbai, Bangalore, Chennai, Hyderabad, Kolkata
                return "METRO"
        except Exception:
            pass
    
    # Default to semi-urban for unrecognized cities
    return "SEMI_URBAN"


def calculate_vehicle_age(car_year) -> dict:
    """Calculate vehicle age and eligibility flags"""
    if not car_year:
        return {"age_years": None, "is_within_10_years": False, "is_within_15_years": False}
    
    # Convert to int if string
    try:
        car_year = int(car_year)
    except (ValueError, TypeError):
        return {"age_years": None, "is_within_10_years": False, "is_within_15_years": False}
    
    current_year = datetime.now().year
    age = current_year - car_year
    
    return {
        "age_years": age,
        "is_within_10_years": age <= 10,
        "is_within_15_years": age <= 15
    }


EXCLUDED_MAKES_INDIA = {
    "CHEVROLET": "Chevrolet exited India - no service network available",
    "FORD": "Ford exited India - limited service network",
    "FIAT": "Fiat exited India - limited parts availability"
}


def check_excluded_make(car_make: str) -> dict:
    """Check if car make is excluded from financing"""
    if not car_make:
        return {"is_excluded": False, "reason": None}
    
    make_upper = car_make.upper().strip()
    for excluded, reason in EXCLUDED_MAKES_INDIA.items():
        if excluded in make_upper:
            return {"is_excluded": True, "reason": reason}
    
    return {"is_excluded": False, "reason": None}


@router.get("/loan-leads/{lead_id}/profile")
async def get_customer_profile(
    lead_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get customer profile for a loan lead"""
    lead = await db.loan_leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Loan lead not found")
    
    # Check if profile exists
    profile = await db.customer_profiles.find_one({"loan_lead_id": lead_id}, {"_id": 0})
    
    if not profile:
        # Create initial profile
        profile = await create_initial_profile(lead_id, lead)
    
    return profile


async def create_initial_profile(lead_id: str, lead: dict) -> dict:
    """Create initial customer profile with auto-detected values"""
    now = datetime.now(timezone.utc)
    
    # Auto-detect location
    city_name = lead.get("city_name", "")
    location_type = classify_location(city_name)
    
    # Analyze vehicles
    vehicles = lead.get("vehicles", [])
    vehicle_analyses = []
    
    for v in vehicles:
        age_info = calculate_vehicle_age(v.get("car_year"))
        excluded_info = check_excluded_make(v.get("car_make"))
        
        vehicle_analyses.append({
            "vehicle_id": v.get("vehicle_id"),
            "car_number": v.get("car_number"),
            "car_make": v.get("car_make"),
            "car_model": v.get("car_model"),
            "car_year": v.get("car_year"),
            "vehicle_valuation": v.get("vehicle_valuation"),
            "valuation_source": "MANUAL" if v.get("vehicle_valuation") else None,
            "vehicle_age_years": age_info["age_years"],
            "is_within_10_years": age_info["is_within_10_years"],
            "is_within_15_years": age_info["is_within_15_years"],
            "is_excluded_make": excluded_info["is_excluded"],
            "excluded_make_reason": excluded_info["reason"],
            "eligible_banks_count": 0,
            "max_loan_eligible": None,
            "recommended_loan_amount": None
        })
    
    # Extract KYC from lead
    kyc = {
        "full_name": lead.get("customer_name"),
        "mobile_primary": lead.get("customer_phone"),
        "email": lead.get("customer_email"),
        "current_city": city_name,
        "employment_type": lead.get("customer_type")
    }
    
    # Create profile
    profile = {
        "id": str(uuid.uuid4()),
        "loan_lead_id": lead_id,
        "profile_status": "INCOMPLETE",
        "profile_score": 0,
        "bank_statement_analysis": None,
        "bank_statement_document_id": None,
        "credit_profile": None,
        "location_type": location_type,
        "location_auto_detected": True,
        "location_city": city_name,
        "location_pincode": None,
        "vehicle_analyses": vehicle_analyses,
        "kyc": kyc,
        "overall_eligibility_score": None,
        "eligibility_factors": [],
        "recommended_banks": [],
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "analyzed_by": None
    }
    
    # Calculate initial profile score
    profile["profile_score"] = calculate_profile_score(profile)
    profile["profile_status"] = get_profile_status(profile["profile_score"])
    
    # Save to database
    await db.customer_profiles.insert_one(profile)
    
    # Remove _id before returning (MongoDB adds it during insert)
    profile.pop("_id", None)
    
    return profile


def calculate_profile_score(profile: dict) -> int:
    """Calculate profile completeness score (0-100)"""
    score = 0
    
    # Bank statement analysis (25 points)
    if profile.get("bank_statement_analysis"):
        score += 25
    
    # Credit profile (25 points)
    if profile.get("credit_profile"):
        score += 25
    
    # Location (10 points)
    if profile.get("location_type"):
        score += 10
    
    # Vehicle analysis (20 points)
    vehicles = profile.get("vehicle_analyses", [])
    if vehicles:
        complete_vehicles = sum(1 for v in vehicles if v.get("vehicle_valuation"))
        score += min(20, (complete_vehicles / len(vehicles)) * 20) if vehicles else 0
    
    # KYC (20 points)
    kyc = profile.get("kyc", {})
    kyc_fields = ["full_name", "mobile_primary", "pan_number", "current_address", "employment_type"]
    filled = sum(1 for f in kyc_fields if kyc.get(f))
    score += (filled / len(kyc_fields)) * 20
    
    return int(score)


def get_profile_status(score: int) -> str:
    """Get profile status based on score"""
    if score >= 90:
        return "VERIFIED"
    elif score >= 60:
        return "COMPLETE"
    elif score >= 30:
        return "PARTIAL"
    return "INCOMPLETE"


@router.put("/loan-leads/{lead_id}/profile")
async def update_customer_profile(
    lead_id: str,
    data: CustomerProfileUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update customer profile"""
    profile = await db.customer_profiles.find_one({"loan_lead_id": lead_id})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    now = datetime.now(timezone.utc)
    updates = {"updated_at": now.isoformat()}
    
    if data.location_type:
        updates["location_type"] = data.location_type
        updates["location_auto_detected"] = False
    
    if data.location_pincode:
        updates["location_pincode"] = data.location_pincode
    
    if data.kyc:
        # Merge KYC data
        existing_kyc = profile.get("kyc", {})
        new_kyc = data.kyc.model_dump(exclude_none=True)
        merged_kyc = {**existing_kyc, **new_kyc}
        updates["kyc"] = merged_kyc
    
    await db.customer_profiles.update_one(
        {"loan_lead_id": lead_id},
        {"$set": updates}
    )
    
    # Recalculate score
    updated_profile = await db.customer_profiles.find_one({"loan_lead_id": lead_id}, {"_id": 0})
    new_score = calculate_profile_score(updated_profile)
    new_status = get_profile_status(new_score)
    
    await db.customer_profiles.update_one(
        {"loan_lead_id": lead_id},
        {"$set": {"profile_score": new_score, "profile_status": new_status}}
    )
    
    return await db.customer_profiles.find_one({"loan_lead_id": lead_id}, {"_id": 0})


class BankStatementAnalyzeRequest(BaseModel):
    """Request model for direct URL bank statement analysis"""
    file_url: str
    password: Optional[str] = None


@router.post("/loan-leads/analyze-bank-statement-url")
async def analyze_bank_statement_from_url_endpoint(
    request: BankStatementAnalyzeRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Analyze a bank statement directly from URL (useful for testing).
    Supports password-protected PDFs.
    """
    try:
        analysis_result = await analyze_bank_statement_from_url(
            request.file_url, 
            storage_service,
            password=request.password
        )
        
        if not analysis_result.get("success"):
            raise HTTPException(
                status_code=500,
                detail=analysis_result.get("error", "Analysis failed")
            )
        
        return {
            "success": True,
            "message": "Bank statement analyzed successfully",
            "analysis": analysis_result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Bank statement URL analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.post("/loan-leads/{lead_id}/profile/analyze-bank-statement")
async def analyze_bank_statement_endpoint(
    lead_id: str,
    document_id: str,
    password: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Analyze bank statement document using AI. Supports password-protected PDFs."""
    # Get the lead
    lead = await db.loan_leads.find_one({"id": lead_id})
    if not lead:
        raise HTTPException(status_code=404, detail="Loan lead not found")
    
    # Find the document
    documents = lead.get("documents", [])
    doc = next((d for d in documents if d.get("id") == document_id), None)
    
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if doc.get("document_type") != "bank_statement":
        raise HTTPException(status_code=400, detail="Document is not a bank statement")
    
    file_url = doc.get("file_url")
    if not file_url:
        raise HTTPException(status_code=400, detail="Document has no file URL")
    
    logger.info(f"Bank statement analysis - file_url from DB: {file_url}")
    
    # Handle different file_url formats:
    # 1. Full Firebase URL: https://firebasestorage.googleapis.com/...
    # 2. Local storage path: /app/storage/loan_documents/... or loan_documents/...
    # 3. gs:// path: gs://bucket-name/path
    
    download_url = None
    temp_file_path = None
    
    try:
        if file_url.startswith(('http://', 'https://')):
            # It's already a valid HTTP URL
            download_url = file_url
            logger.info(f"Using HTTP URL directly: {download_url}")
        elif file_url.startswith('gs://'):
            # Firebase gs:// path - need to convert to download URL
            download_url = file_url.replace('gs://', 'https://storage.googleapis.com/')
            logger.info(f"Converted gs:// to HTTP URL: {download_url}")
        elif '/app/storage/' in file_url or file_url.startswith('loan_documents/'):
            # It's a local storage path - file is likely in Firebase
            # Extract the relative path and try to download from Firebase
            if '/app/storage/' in file_url:
                firebase_path = file_url.replace('/app/storage/', '')
            else:
                firebase_path = file_url
            
            logger.info(f"Attempting Firebase download for path: {firebase_path}")
            
            # Try to download from Firebase using the SDK
            try:
                import firebase_admin
                from firebase_admin import storage as firebase_storage
                
                # Get Firebase bucket
                try:
                    bucket = firebase_storage.bucket()
                except ValueError:
                    # Firebase not initialized, try to initialize
                    cred_path = "/app/ess/api/firebase-credentials.json"
                    if os.path.exists(cred_path):
                        from firebase_admin import credentials
                        cred = credentials.Certificate(cred_path)
                        firebase_admin.initialize_app(cred, {
                            'storageBucket': 'wisedrive-ess-app.firebasestorage.app'
                        })
                        bucket = firebase_storage.bucket()
                    else:
                        raise HTTPException(status_code=500, detail="Firebase not configured")
                
                blob = bucket.blob(firebase_path)
                
                # Check if blob exists
                if blob.exists():
                    # Generate signed URL for download
                    from datetime import timedelta
                    expiration = datetime.now(timezone.utc) + timedelta(hours=1)
                    download_url = blob.generate_signed_url(
                        version="v4",
                        expiration=expiration,
                        method="GET"
                    )
                    logger.info(f"Generated Firebase signed URL for download")
                else:
                    logger.warning(f"File not found in Firebase: {firebase_path}")
                    # Try alternate paths
                    alternate_paths = [
                        firebase_path,
                        f"loan_documents/{firebase_path.split('/')[-2]}/{firebase_path.split('/')[-1]}" if '/' in firebase_path else firebase_path,
                    ]
                    
                    logger.info(f"Trying alternate paths: {alternate_paths}")
                    for alt_path in alternate_paths:
                        alt_blob = bucket.blob(alt_path)
                        if alt_blob.exists():
                            expiration = datetime.now(timezone.utc) + timedelta(hours=1)
                            download_url = alt_blob.generate_signed_url(
                                version="v4",
                                expiration=expiration,
                                method="GET"
                            )
                            logger.info(f"Found file at alternate path: {alt_path}")
                            break
                    
                    if not download_url:
                        # Last resort - check if file exists locally
                        local_paths = [file_url, f"/app/storage/{firebase_path}", f"/app/{file_url}"]
                        logger.info(f"Checking local paths: {local_paths}")
                        for local_path in local_paths:
                            if os.path.exists(local_path):
                                temp_file_path = local_path
                                logger.info(f"Found local file: {local_path}")
                                break
                        
                        if not temp_file_path:
                            logger.error(f"File not found anywhere - raising 404")
                            raise HTTPException(
                                status_code=404, 
                                detail=f"File not found in Firebase or locally. The file was uploaded to server storage and is only accessible from the production server. Path: {firebase_path}"
                            )
            except ImportError:
                logger.error("Firebase Admin SDK not installed")
                raise HTTPException(status_code=500, detail="Firebase SDK not available")
        else:
            # Unknown format - try as direct URL
            download_url = file_url
            logger.warning(f"Unknown file_url format, trying as-is: {file_url}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to resolve file URL: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to access document: {str(e)}")
    
    # Analyze using AI (with optional password for encrypted PDFs)
    try:
        if temp_file_path:
            # File is local, analyze directly
            from services.bank_statement_service import BankStatementAnalyzer
            analyzer = BankStatementAnalyzer()
            analysis_result = await analyzer.analyze_statement(temp_file_path)
        else:
            analysis_result = await analyze_bank_statement_from_url(download_url, storage_service, password=password)
    except Exception as e:
        logger.error(f"Bank statement analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
    
    if not analysis_result.get("success"):
        raise HTTPException(
            status_code=500, 
            detail=analysis_result.get("error", "Analysis failed")
        )
    
    # Update profile with analysis
    now = datetime.now(timezone.utc)
    
    bank_statement_analysis = {
        "bank_name": analysis_result.get("bank_name"),
        "account_number_masked": analysis_result.get("account_number_masked"),
        "statement_period_from": analysis_result.get("statement_period_from"),
        "statement_period_to": analysis_result.get("statement_period_to"),
        "average_bank_balance": analysis_result.get("average_bank_balance"),
        "minimum_balance": analysis_result.get("minimum_balance"),
        "maximum_balance": analysis_result.get("maximum_balance"),
        "end_of_month_balances": analysis_result.get("end_of_month_balances", []),
        "total_credits": analysis_result.get("total_credits"),
        "average_monthly_credits": analysis_result.get("average_monthly_credits"),
        "salary_credits_identified": analysis_result.get("salary_credits_identified"),
        "regular_income_sources": analysis_result.get("regular_income_sources", []),
        "total_debits": analysis_result.get("total_debits"),
        "average_monthly_debits": analysis_result.get("average_monthly_debits"),
        "emi_payments_identified": analysis_result.get("emi_payments_identified", []),
        "loan_repayments_total": analysis_result.get("loan_repayments_total"),
        "high_value_transactions": analysis_result.get("high_value_transactions", []),
        "bounce_count": analysis_result.get("bounce_count", 0),
        "low_balance_days": analysis_result.get("low_balance_days", 0),
        "cash_withdrawal_ratio": analysis_result.get("cash_withdrawal_ratio"),
        "analyzed_at": now.isoformat(),
        "confidence_score": analysis_result.get("confidence_score"),
        "analysis_notes": analysis_result.get("analysis_notes"),
        "raw_analysis": analysis_result
    }
    
    # Ensure profile exists
    profile = await db.customer_profiles.find_one({"loan_lead_id": lead_id})
    if not profile:
        await create_initial_profile(lead_id, lead)
    
    # Update profile
    await db.customer_profiles.update_one(
        {"loan_lead_id": lead_id},
        {
            "$set": {
                "bank_statement_analysis": bank_statement_analysis,
                "bank_statement_document_id": document_id,
                "updated_at": now.isoformat()
            }
        }
    )
    
    # Recalculate profile score
    updated_profile = await db.customer_profiles.find_one({"loan_lead_id": lead_id}, {"_id": 0})
    new_score = calculate_profile_score(updated_profile)
    new_status = get_profile_status(new_score)
    
    await db.customer_profiles.update_one(
        {"loan_lead_id": lead_id},
        {"$set": {"profile_score": new_score, "profile_status": new_status}}
    )
    
    return {
        "success": True,
        "message": "Bank statement analyzed successfully",
        "analysis": bank_statement_analysis
    }


@router.post("/loan-leads/{lead_id}/profile/sync-credit-report")
async def sync_credit_report_to_profile(
    lead_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Sync credit report from lead to profile"""
    lead = await db.loan_leads.find_one({"id": lead_id})
    if not lead:
        raise HTTPException(status_code=404, detail="Loan lead not found")
    
    credit_report = lead.get("credit_score_full_report")
    if not credit_report:
        raise HTTPException(status_code=400, detail="No credit report available. Please check credit score first.")
    
    # Extract key metrics from credit report
    credit_profile = {
        "credit_score": lead.get("credit_score"),
        "score_rating": get_score_rating(lead.get("credit_score")),
        "bureau_source": credit_report.get("bureau", "unknown"),
        "total_accounts": 0,
        "active_accounts": 0,
        "closed_accounts": 0,
        "delinquent_accounts": 0,
        "total_outstanding": 0,
        "secured_outstanding": 0,
        "unsecured_outstanding": 0,
        "on_time_payment_percent": None,
        "max_dpd_last_12_months": 0,
        "existing_auto_loans": [],
        "existing_personal_loans": [],
        "credit_cards": [],
        "has_write_offs": False,
        "has_settlements": False,
        "has_defaults": False,
        "enquiry_count_last_6_months": 0,
        "analyzed_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Parse accounts if available
    accounts = credit_report.get("accounts", [])
    for acc in accounts:
        if acc.get("account_status") == "Active":
            credit_profile["active_accounts"] += 1
        elif acc.get("account_status") == "Closed":
            credit_profile["closed_accounts"] += 1
        
        if acc.get("dpd", 0) > 0:
            credit_profile["delinquent_accounts"] += 1
        
        outstanding = acc.get("current_balance", 0) or 0
        credit_profile["total_outstanding"] += outstanding
        
        acc_type = acc.get("account_type", "").lower()
        if "auto" in acc_type or "vehicle" in acc_type or "car" in acc_type:
            credit_profile["existing_auto_loans"].append({
                "lender": acc.get("subscriber_name"),
                "amount": acc.get("sanctioned_amount"),
                "emi": acc.get("emi_amount"),
                "status": acc.get("account_status")
            })
        elif "personal" in acc_type:
            credit_profile["existing_personal_loans"].append({
                "lender": acc.get("subscriber_name"),
                "amount": acc.get("sanctioned_amount"),
                "emi": acc.get("emi_amount"),
                "status": acc.get("account_status")
            })
        elif "credit card" in acc_type or "card" in acc_type:
            credit_profile["credit_cards"].append({
                "bank": acc.get("subscriber_name"),
                "limit": acc.get("credit_limit"),
                "utilization": (outstanding / acc.get("credit_limit", 1) * 100) if acc.get("credit_limit") else None
            })
    
    credit_profile["total_accounts"] = credit_profile["active_accounts"] + credit_profile["closed_accounts"]
    
    # Ensure profile exists
    profile = await db.customer_profiles.find_one({"loan_lead_id": lead_id})
    if not profile:
        await create_initial_profile(lead_id, lead)
    
    # Update profile
    now = datetime.now(timezone.utc)
    await db.customer_profiles.update_one(
        {"loan_lead_id": lead_id},
        {
            "$set": {
                "credit_profile": credit_profile,
                "updated_at": now.isoformat()
            }
        }
    )
    
    # Recalculate profile score
    updated_profile = await db.customer_profiles.find_one({"loan_lead_id": lead_id}, {"_id": 0})
    new_score = calculate_profile_score(updated_profile)
    new_status = get_profile_status(new_score)
    
    await db.customer_profiles.update_one(
        {"loan_lead_id": lead_id},
        {"$set": {"profile_score": new_score, "profile_status": new_status}}
    )
    
    return {
        "success": True,
        "message": "Credit report synced to profile",
        "credit_profile": credit_profile
    }


def get_score_rating(score: int) -> str:
    """Get rating for credit score"""
    if not score:
        return None
    if score >= 750:
        return "EXCELLENT"
    elif score >= 700:
        return "GOOD"
    elif score >= 650:
        return "FAIR"
    elif score >= 550:
        return "POOR"
    return "VERY_POOR"


@router.post("/loan-leads/{lead_id}/profile/calculate-eligibility")
async def calculate_eligibility(
    lead_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Calculate overall eligibility based on profile data"""
    profile = await db.customer_profiles.find_one({"loan_lead_id": lead_id}, {"_id": 0})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found. Please fetch profile first.")
    
    # Get all active banks
    banks = await db.bank_master.find({"is_active": True}, {"_id": 0}).to_list(50)
    
    # Calculate eligibility factors
    factors = []
    total_weight = 0
    weighted_score = 0
    
    # 1. Credit Score (30% weight)
    credit_profile = profile.get("credit_profile", {})
    credit_score = credit_profile.get("credit_score") if credit_profile else None
    if credit_score:
        credit_factor = min(100, (credit_score - 300) / 5.5)  # Normalize 300-850 to 0-100
        factors.append({
            "factor": "Credit Score",
            "value": credit_score,
            "score": int(credit_factor),
            "weight": 30,
            "notes": f"Score: {credit_score} ({credit_profile.get('score_rating', 'N/A')})"
        })
        weighted_score += credit_factor * 30
        total_weight += 30
    else:
        factors.append({
            "factor": "Credit Score",
            "value": None,
            "score": 0,
            "weight": 30,
            "notes": "Not checked - Please check credit score"
        })
    
    # 2. Bank Statement / ABB (25% weight)
    bank_analysis = profile.get("bank_statement_analysis", {})
    if bank_analysis:
        abb = bank_analysis.get("average_bank_balance", 0)
        bounce_count = bank_analysis.get("bounce_count", 0)
        
        # Higher ABB is better (normalize to 0-100 based on 50k-5L range)
        abb_score = min(100, max(0, (abb - 10000) / 4000)) if abb else 0
        
        # Deduct for bounces
        abb_score = max(0, abb_score - (bounce_count * 10))
        
        factors.append({
            "factor": "Bank Statement (ABB)",
            "value": abb,
            "score": int(abb_score),
            "weight": 25,
            "notes": f"ABB: ₹{abb:,.0f}, Bounces: {bounce_count}" if abb else "Not analyzed"
        })
        weighted_score += abb_score * 25
        total_weight += 25
    else:
        factors.append({
            "factor": "Bank Statement (ABB)",
            "value": None,
            "score": 0,
            "weight": 25,
            "notes": "Not analyzed - Please analyze bank statement"
        })
    
    # 3. Location (10% weight)
    location_type = profile.get("location_type")
    location_scores = {"METRO": 100, "URBAN": 80, "SEMI_URBAN": 60, "RURAL": 40}
    location_score = location_scores.get(location_type, 50)
    factors.append({
        "factor": "Location",
        "value": location_type,
        "score": location_score,
        "weight": 10,
        "notes": f"{location_type or 'Unknown'} - {profile.get('location_city', 'N/A')}"
    })
    weighted_score += location_score * 10
    total_weight += 10
    
    # 4. Vehicle Analysis (25% weight)
    vehicle_analyses = profile.get("vehicle_analyses", [])
    if vehicle_analyses:
        vehicle_scores = []
        for v in vehicle_analyses:
            v_score = 0
            if v.get("vehicle_valuation"):
                v_score += 40  # Has valuation
            if v.get("is_within_10_years"):
                v_score += 40  # Good age
            elif v.get("is_within_15_years"):
                v_score += 20  # Acceptable age
            if not v.get("is_excluded_make"):
                v_score += 20  # Not excluded make
            vehicle_scores.append(v_score)
        
        avg_vehicle_score = sum(vehicle_scores) / len(vehicle_scores) if vehicle_scores else 0
        factors.append({
            "factor": "Vehicle Analysis",
            "value": len(vehicle_analyses),
            "score": int(avg_vehicle_score),
            "weight": 25,
            "notes": f"{len(vehicle_analyses)} vehicle(s) analyzed"
        })
        weighted_score += avg_vehicle_score * 25
        total_weight += 25
    else:
        factors.append({
            "factor": "Vehicle Analysis",
            "value": 0,
            "score": 0,
            "weight": 25,
            "notes": "No vehicles added"
        })
    
    # 5. KYC Completeness (10% weight)
    kyc = profile.get("kyc", {})
    kyc_fields = ["full_name", "mobile_primary", "pan_number", "current_address", "employment_type", "monthly_income"]
    kyc_filled = sum(1 for f in kyc_fields if kyc.get(f))
    kyc_score = (kyc_filled / len(kyc_fields)) * 100
    factors.append({
        "factor": "KYC Completeness",
        "value": f"{kyc_filled}/{len(kyc_fields)}",
        "score": int(kyc_score),
        "weight": 10,
        "notes": f"{kyc_filled} of {len(kyc_fields)} fields complete"
    })
    weighted_score += kyc_score * 10
    total_weight += 10
    
    # Calculate overall score
    overall_score = int(weighted_score / total_weight) if total_weight > 0 else 0
    
    # Determine recommended banks based on eligibility
    recommended_banks = []
    for bank in banks:
        rules = bank.get("eligibility_rules", {})
        
        # Check credit score requirement
        min_credit = rules.get("min_credit_score", 0)
        if credit_score and credit_score >= min_credit:
            recommended_banks.append({
                "bank_id": bank["id"],
                "bank_name": bank["bank_name"],
                "reason": "Meets credit score requirement"
            })
    
    # Sort by bank name
    recommended_banks.sort(key=lambda x: x["bank_name"])
    
    # Update profile
    now = datetime.now(timezone.utc)
    await db.customer_profiles.update_one(
        {"loan_lead_id": lead_id},
        {
            "$set": {
                "overall_eligibility_score": overall_score,
                "eligibility_factors": factors,
                "recommended_banks": [b["bank_id"] for b in recommended_banks],
                "updated_at": now.isoformat()
            }
        }
    )
    
    return {
        "success": True,
        "overall_eligibility_score": overall_score,
        "eligibility_factors": factors,
        "recommended_banks": recommended_banks,
        "profile_status": profile.get("profile_status")
    }


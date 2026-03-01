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
    ChargeType, ChargeTypeCreate
)
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
# LOAN LEADS ENDPOINTS
# ========================

@router.get("/loan-leads")
async def get_loan_leads(
    status: Optional[str] = None,
    city_id: Optional[str] = None,
    search: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
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
    if date_from:
        query["created_at"] = {"$gte": date_from}
    if date_to:
        if "created_at" in query:
            query["created_at"]["$lte"] = date_to
        else:
            query["created_at"] = {"$lte": date_to}
    
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
        {"customer_id": 1, "customer_name": 1, "customer_phone": 1, "customer_email": 1, "city_id": 1, "city_name": 1, "car_number": 1, "car_make": 1, "car_model": 1, "car_year": 1}
    ).to_list(1000)
    
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
        
        loan_lead = {
            "id": str(uuid.uuid4()),
            "customer_id": customer_id,
            "customer_name": inspection.get("customer_name", "Unknown"),
            "customer_phone": inspection.get("customer_phone", ""),
            "customer_email": inspection.get("customer_email"),
            "city_id": inspection.get("city_id"),
            "city_name": inspection.get("city_name"),
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
    """Generate a signed URL for document upload to Firebase"""
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
        signed_url = await storage_service.get_signed_upload_url(
            storage_path,
            content_type=request_data.content_type,
            expires_in=3600
        )
        
        # Get public URL
        public_url = f"https://firebasestorage.googleapis.com/v0/b/{storage_service.bucket_name}/o/{storage_path.replace('/', '%2F')}?alt=media"
        
        return {
            "upload_url": signed_url,
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
    
    result = await db.loan_leads.update_one(
        {"id": lead_id, "vehicles.vehicle_id": vehicle_id},
        {
            "$set": {
                "vehicles.$.car_number": vehicle_data.car_number.upper().replace(" ", ""),
                "vehicles.$.car_make": vehicle_data.car_make,
                "vehicles.$.car_model": vehicle_data.car_model,
                "vehicles.$.car_year": vehicle_data.car_year,
                "vehicles.$.car_variant": vehicle_data.car_variant,
                "vehicles.$.vehicle_valuation": vehicle_data.vehicle_valuation,
                "vehicles.$.required_loan_amount": vehicle_data.required_loan_amount,
                "updated_at": now.isoformat()
            }
        }
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


@router.post("/loan-leads/{lead_id}/offers/{offer_id}/add-charge")
async def add_charge_to_offer(
    lead_id: str,
    offer_id: str,
    charge_type: str,
    charge_name: str,
    amount: float,
    is_negotiable: bool = True,
    notes: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Add a new charge to an existing offer"""
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
    
    new_charge = {
        "charge_type": charge_type,
        "charge_name": charge_name,
        "amount": amount,
        "is_percentage": False,
        "is_waived": False,
        "is_negotiable": is_negotiable,
        "notes": notes
    }
    
    # Calculate new totals
    current_charges = offer.get("charges", [])
    current_charges.append(new_charge)
    
    new_total_charges = sum(c.get("amount", 0) for c in current_charges if not c.get("is_waived"))
    new_net_disbursal = offer.get("total_loan_amount", 0) - new_total_charges
    
    await db.loan_leads.update_one(
        {"id": lead_id},
        {
            "$push": {f"loan_offers.{offer_index}.charges": new_charge},
            "$set": {
                f"loan_offers.{offer_index}.total_charges": new_total_charges,
                f"loan_offers.{offer_index}.net_disbursal_amount": new_net_disbursal,
                f"loan_offers.{offer_index}.updated_at": now.isoformat(),
                "updated_at": now.isoformat()
            }
        }
    )
    
    updated_lead = await db.loan_leads.find_one({"id": lead_id}, {"_id": 0})
    return {"message": "Charge added", "offer": updated_lead["loan_offers"][offer_index]}


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
                f"loan_offers.$.charges": charges,
                f"loan_offers.$.total_charges": total_charges,
                f"loan_offers.$.net_disbursal_amount": net_disbursal,
                f"loan_offers.$.updated_at": now.isoformat()
            },
            "$push": {
                f"loan_offers.$.negotiation_history": {
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
                f"loan_offers.$.charges": charges,
                f"loan_offers.$.total_charges": total_charges,
                f"loan_offers.$.net_disbursal_amount": net_disbursal,
                f"loan_offers.$.updated_at": now.isoformat()
            },
            "$push": {
                f"loan_offers.$.negotiation_history": {
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

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
    LoanOffer, LoanOfferCreate, LoanOfferUpdate, LoanOfferCharge, LoanOfferChargeUpdate
)
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Create router
router = APIRouter(tags=["Loans"])

# These will be set by init_loans_routes
db = None
get_current_user = None
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
    global db, get_current_user, storage_service
    db = _db
    get_current_user = _get_current_user
    storage_service = _storage_service


# ========================
# BANK MASTER ENDPOINTS
# ========================

@router.get("/banks")
async def get_banks(
    is_active: Optional[bool] = None,
    current_user: dict = Depends(lambda: get_current_user)
):
    """Get all banks from master data"""
    query = {}
    if is_active is not None:
        query["is_active"] = is_active
    
    banks = await db.bank_master.find(query, {"_id": 0}).sort("bank_name", 1).to_list(100)
    return banks


@router.get("/banks/{bank_id}")
async def get_bank(bank_id: str, current_user: dict = Depends(lambda: get_current_user)):
    """Get a specific bank"""
    bank = await db.bank_master.find_one({"id": bank_id}, {"_id": 0})
    if not bank:
        raise HTTPException(status_code=404, detail="Bank not found")
    return bank


@router.post("/banks")
async def create_bank(
    bank_data: BankMasterCreate,
    current_user: dict = Depends(lambda: get_current_user)
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
    current_user: dict = Depends(lambda: get_current_user)
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
async def delete_bank(bank_id: str, current_user: dict = Depends(lambda: get_current_user)):
    """Delete a bank from master data"""
    result = await db.bank_master.delete_one({"id": bank_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bank not found")
    return {"message": "Bank deleted successfully"}


@router.post("/banks/{bank_id}/poc")
async def add_bank_poc(
    bank_id: str,
    poc_data: BankPOC,
    current_user: dict = Depends(lambda: get_current_user)
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
    current_user: dict = Depends(lambda: get_current_user)
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
    current_user: dict = Depends(lambda: get_current_user)
):
    """Sync loan leads from customers who have paid inspections"""
    now = datetime.now(timezone.utc)
    synced_count = 0
    
    # Find customers with paid inspections
    paid_inspections = await db.inspections.find(
        {"payment_status": "paid"},
        {"customer_id": 1, "customer_name": 1, "customer_phone": 1, "customer_email": 1, "city_id": 1, "city_name": 1}
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
            "vehicles": [],
            "applications": [],
            "eligibility_results": [],
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
async def get_loan_lead_stats(current_user: dict = Depends(lambda: get_current_user)):
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
async def get_loan_lead(lead_id: str, current_user: dict = Depends(lambda: get_current_user)):
    """Get a specific loan lead with all details"""
    lead = await db.loan_leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Loan lead not found")
    return lead


@router.put("/loan-leads/{lead_id}")
async def update_loan_lead(
    lead_id: str,
    update_data: LoanLeadUpdate,
    current_user: dict = Depends(lambda: get_current_user)
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
    current_user: dict = Depends(lambda: get_current_user)
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
    current_user: dict = Depends(lambda: get_current_user)
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
    current_user: dict = Depends(lambda: get_current_user)
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
    current_user: dict = Depends(lambda: get_current_user)
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
    current_user: dict = Depends(lambda: get_current_user)
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
    current_user: dict = Depends(lambda: get_current_user)
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
    current_user: dict = Depends(lambda: get_current_user)
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
    current_user: dict = Depends(lambda: get_current_user)
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
    current_user: dict = Depends(lambda: get_current_user)
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
    current_user: dict = Depends(lambda: get_current_user)
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
    current_user: dict = Depends(lambda: get_current_user)
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
    current_user: dict = Depends(lambda: get_current_user)
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
    current_user: dict = Depends(lambda: get_current_user)
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
    current_user: dict = Depends(lambda: get_current_user)
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

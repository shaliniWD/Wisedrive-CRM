"""
Credit Report API Routes
Integrates with Surepass API for CIBIL, Equifax, and Experian reports
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
import uuid
import logging

from services.surepass_service import get_surepass_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/credit-report", tags=["Credit Reports"])

# Security
security = HTTPBearer()

# Module-level variables for dependency injection
_db = None
_auth_validator = None


def init_credit_report_routes(_database, _get_current_user):
    """Initialize routes with database and auth dependencies"""
    global _db, _auth_validator
    _db = _database
    _auth_validator = _get_current_user


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Wrapper for auth validation"""
    if _auth_validator is None:
        raise HTTPException(status_code=500, detail="Auth not initialized")
    return await _auth_validator(credentials)


# Pydantic models
class CreditReportRequest(BaseModel):
    """Request model for fetching CIBIL credit report"""
    mobile: str = Field(..., description="Customer mobile number")
    pan: str = Field(..., description="Customer PAN number")
    name: str = Field(..., description="Customer full name")
    gender: str = Field(default="male", description="Gender: male or female")
    consent: str = Field(default="Y", description="Customer consent")
    
    # Optional: Link to existing records
    customer_id: Optional[str] = None
    lead_id: Optional[str] = None
    loan_lead_id: Optional[str] = None


class EquifaxReportRequest(BaseModel):
    """Request model for fetching Equifax credit report"""
    name: str = Field(..., description="Customer full name")
    id_number: str = Field(..., description="ID number (Aadhaar, PAN, etc.)")
    id_type: str = Field(default="aadhaar", description="ID type: aadhaar, pan, voter, passport, driving_license")
    mobile: str = Field(default="", description="Customer mobile number (optional)")
    consent: str = Field(default="Y", description="Customer consent")
    
    # Optional: Link to existing records
    customer_id: Optional[str] = None
    lead_id: Optional[str] = None
    loan_lead_id: Optional[str] = None


class ExperianReportRequest(BaseModel):
    """Request model for fetching Experian credit report"""
    name: str = Field(..., description="Customer full name")
    pan: str = Field(..., description="Customer PAN number")
    mobile: str = Field(..., description="Customer mobile number")
    consent: str = Field(default="Y", description="Customer consent")
    
    # Optional: Link to existing records
    customer_id: Optional[str] = None
    lead_id: Optional[str] = None
    loan_lead_id: Optional[str] = None


class CreditReportResponse(BaseModel):
    """Response model for credit report"""
    success: bool
    credit_score: Optional[str] = None
    provider: Optional[str] = None
    report_id: Optional[str] = None
    error: Optional[str] = None


# API Endpoints

@router.post("/cibil")
async def fetch_cibil_report(
    request: CreditReportRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Fetch CIBIL credit report (JSON format) with PDF link
    Soft pull - no OTP required
    """
    surepass = get_surepass_service()
    
    if not surepass.is_configured():
        raise HTTPException(status_code=503, detail="Credit report service not configured")
    
    # Validate PAN format
    pan = request.pan.upper().strip()
    if len(pan) != 10:
        raise HTTPException(status_code=400, detail="Invalid PAN format. Must be 10 characters.")
    
    # Fetch JSON report from Surepass
    result = await surepass.fetch_cibil_report(
        mobile=request.mobile,
        pan=pan,
        name=request.name,
        gender=request.gender,
        consent=request.consent
    )
    
    if not result.get("success"):
        return {
            "success": False,
            "error": result.get("error"),
            "error_code": result.get("error_code")
        }
    
    # Also fetch PDF link
    pdf_link = None
    try:
        pdf_result = await surepass.fetch_cibil_pdf(
            mobile=request.mobile,
            pan=pan,
            name=request.name,
            gender=request.gender,
            consent=request.consent
        )
        if pdf_result.get("success"):
            pdf_link = pdf_result.get("pdf_link")
    except Exception as e:
        logger.warning(f"Failed to fetch CIBIL PDF: {e}")
    
    # Parse the report for better UI display
    parsed_report = surepass.parse_credit_report(result.get("credit_report", []))
    
    # Store report in database
    report_id = str(uuid.uuid4())
    report_record = {
        "id": report_id,
        "provider": "CIBIL",
        "type": "json",
        "pan": pan,
        "mobile": request.mobile,
        "name": request.name,
        "credit_score": result.get("credit_score"),
        "client_id": result.get("client_id"),
        "parsed_report": parsed_report,
        "raw_report": result.get("credit_report"),
        "pdf_link": pdf_link,
        "customer_id": request.customer_id,
        "lead_id": request.lead_id,
        "loan_lead_id": request.loan_lead_id,
        "fetched_by": current_user.get("id"),
        "fetched_by_name": current_user.get("name"),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await _db.credit_reports.insert_one(report_record)
    logger.info(f"Stored CIBIL report {report_id} for PAN {pan[:4]}****")
    
    # Update loan_lead with credit score if loan_lead_id provided
    if request.loan_lead_id:
        await _db.loan_leads.update_one(
            {"id": request.loan_lead_id},
            {"$set": {
                "credit_score": result.get("credit_score"),
                "credit_report_id": report_id,
                "credit_report_provider": "CIBIL",
                "credit_report_fetched_at": datetime.now(timezone.utc).isoformat(),
                "cibil_credit_score": result.get("credit_score"),
                "cibil_report_id": report_id,
                "cibil_report_fetched_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    return {
        "success": True,
        "report_id": report_id,
        "provider": "CIBIL",
        "credit_score": result.get("credit_score"),
        "parsed_report": parsed_report,
        "pdf_link": pdf_link,
        "fetched_at": result.get("fetched_at")
    }


@router.post("/cibil/pdf")
async def fetch_cibil_pdf_report(
    request: CreditReportRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Fetch CIBIL credit report (PDF format)
    Returns a downloadable PDF link
    """
    surepass = get_surepass_service()
    
    if not surepass.is_configured():
        raise HTTPException(status_code=503, detail="Credit report service not configured")
    
    # Validate PAN format
    pan = request.pan.upper().strip()
    if len(pan) != 10:
        raise HTTPException(status_code=400, detail="Invalid PAN format. Must be 10 characters.")
    
    # Fetch PDF report from Surepass
    result = await surepass.fetch_cibil_pdf(
        mobile=request.mobile,
        pan=pan,
        name=request.name,
        gender=request.gender,
        consent=request.consent
    )
    
    if not result.get("success"):
        return {
            "success": False,
            "error": result.get("error"),
            "error_code": result.get("error_code")
        }
    
    # Store PDF report record
    report_id = str(uuid.uuid4())
    report_record = {
        "id": report_id,
        "provider": "CIBIL",
        "type": "pdf",
        "pan": pan,
        "mobile": request.mobile,
        "name": request.name,
        "credit_score": result.get("credit_score"),
        "client_id": result.get("client_id"),
        "pdf_link": result.get("pdf_link"),
        "customer_id": request.customer_id,
        "lead_id": request.lead_id,
        "loan_lead_id": request.loan_lead_id,
        "fetched_by": current_user.get("id"),
        "fetched_by_name": current_user.get("name"),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await _db.credit_reports.insert_one(report_record)
    logger.info(f"Stored CIBIL PDF report {report_id} for PAN {pan[:4]}****")
    
    return {
        "success": True,
        "report_id": report_id,
        "provider": "CIBIL",
        "credit_score": result.get("credit_score"),
        "pdf_link": result.get("pdf_link"),
        "fetched_at": result.get("fetched_at")
    }


@router.post("/equifax")
async def fetch_equifax_report(
    request: EquifaxReportRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Fetch Equifax credit report (JSON format)
    Supports Aadhaar, PAN, Voter ID, Passport, Driving License
    """
    surepass = get_surepass_service()
    
    if not surepass.is_configured():
        raise HTTPException(status_code=503, detail="Credit report service not configured")
    
    # Validate ID type
    valid_id_types = ["aadhaar", "pan", "voter", "passport", "driving_license"]
    if request.id_type.lower() not in valid_id_types:
        raise HTTPException(status_code=400, detail=f"Invalid id_type. Must be one of: {', '.join(valid_id_types)}")
    
    # Fetch report from Surepass
    result = await surepass.fetch_equifax_report(
        name=request.name,
        id_number=request.id_number,
        id_type=request.id_type,
        mobile=request.mobile,
        consent=request.consent
    )
    
    if not result.get("success"):
        return {
            "success": False,
            "error": result.get("error"),
            "error_code": result.get("error_code")
        }
    
    # Also fetch PDF link
    pdf_link = None
    try:
        pdf_result = await surepass.fetch_equifax_pdf(
            name=request.name,
            id_number=request.id_number,
            id_type=request.id_type,
            mobile=request.mobile,
            consent=request.consent
        )
        if pdf_result.get("success"):
            pdf_link = pdf_result.get("pdf_link")
    except Exception as e:
        logger.warning(f"Failed to fetch Equifax PDF: {e}")
    
    # Parse the report for better UI display
    parsed_report = surepass.parse_equifax_report(result.get("credit_report", {}))
    
    # Store report in database
    report_id = str(uuid.uuid4())
    report_record = {
        "id": report_id,
        "provider": "Equifax",
        "type": "json",
        "pan": request.id_number.upper().strip() if request.id_type.lower() == "pan" else None,
        "id_number": request.id_number,
        "id_type": request.id_type,
        "mobile": request.mobile,
        "name": request.name,
        "credit_score": result.get("credit_score"),
        "client_id": result.get("client_id"),
        "parsed_report": parsed_report,
        "raw_report": result.get("credit_report"),
        "pdf_link": pdf_link,
        "customer_id": request.customer_id,
        "lead_id": request.lead_id,
        "loan_lead_id": request.loan_lead_id,
        "fetched_by": current_user.get("id"),
        "fetched_by_name": current_user.get("name"),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await _db.credit_reports.insert_one(report_record)
    logger.info(f"Stored Equifax report {report_id} for {request.id_type}: {request.id_number[:4]}****")
    
    # Update loan_lead with credit score if loan_lead_id provided
    # Only update credit_score if CIBIL score doesn't exist (CIBIL is preferred)
    if request.loan_lead_id:
        # Check if CIBIL score exists
        existing_lead = await _db.loan_leads.find_one({"id": request.loan_lead_id})
        cibil_exists = existing_lead and existing_lead.get("credit_report_provider") == "CIBIL"
        
        update_data = {
            "equifax_credit_score": result.get("credit_score"),
            "equifax_report_id": report_id,
            "equifax_report_fetched_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Only update main credit_score if no CIBIL score exists
        if not cibil_exists:
            update_data["credit_score"] = result.get("credit_score")
            update_data["credit_report_id"] = report_id
            update_data["credit_report_provider"] = "Equifax"
            update_data["credit_report_fetched_at"] = datetime.now(timezone.utc).isoformat()
        
        await _db.loan_leads.update_one(
            {"id": request.loan_lead_id},
            {"$set": update_data}
        )
    
    return {
        "success": True,
        "report_id": report_id,
        "provider": "Equifax",
        "credit_score": result.get("credit_score"),
        "parsed_report": parsed_report,
        "pdf_link": pdf_link,
        "fetched_at": result.get("fetched_at")
    }


@router.post("/equifax/pdf")
async def fetch_equifax_pdf_report(
    request: EquifaxReportRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Fetch Equifax credit report (PDF format)
    Returns a downloadable PDF link
    """
    surepass = get_surepass_service()
    
    if not surepass.is_configured():
        raise HTTPException(status_code=503, detail="Credit report service not configured")
    
    # Validate ID type
    valid_id_types = ["aadhaar", "pan", "voter", "passport", "driving_license"]
    if request.id_type.lower() not in valid_id_types:
        raise HTTPException(status_code=400, detail=f"Invalid id_type. Must be one of: {', '.join(valid_id_types)}")
    
    # Fetch PDF report from Surepass
    result = await surepass.fetch_equifax_pdf(
        name=request.name,
        id_number=request.id_number,
        id_type=request.id_type,
        mobile=request.mobile,
        consent=request.consent
    )
    
    if not result.get("success"):
        return {
            "success": False,
            "error": result.get("error"),
            "error_code": result.get("error_code")
        }
    
    # Store PDF report record
    report_id = str(uuid.uuid4())
    report_record = {
        "id": report_id,
        "provider": "Equifax",
        "type": "pdf",
        "id_number": request.id_number,
        "id_type": request.id_type,
        "mobile": request.mobile,
        "name": request.name,
        "credit_score": result.get("credit_score"),
        "client_id": result.get("client_id"),
        "pdf_link": result.get("pdf_link"),
        "customer_id": request.customer_id,
        "lead_id": request.lead_id,
        "loan_lead_id": request.loan_lead_id,
        "fetched_by": current_user.get("id"),
        "fetched_by_name": current_user.get("name"),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await _db.credit_reports.insert_one(report_record)
    logger.info(f"Stored Equifax PDF report {report_id} for {request.id_type}: {request.id_number[:4]}****")
    
    return {
        "success": True,
        "report_id": report_id,
        "provider": "Equifax",
        "credit_score": result.get("credit_score"),
        "pdf_link": result.get("pdf_link"),
        "fetched_at": result.get("fetched_at")
    }


@router.post("/experian")
async def fetch_experian_report(
    request: ExperianReportRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Fetch Experian credit report (JSON format)
    Requires PAN and mobile number
    """
    surepass = get_surepass_service()
    
    if not surepass.is_configured():
        raise HTTPException(status_code=503, detail="Credit report service not configured")
    
    # Validate PAN format
    pan = request.pan.upper().strip()
    if len(pan) != 10:
        raise HTTPException(status_code=400, detail="Invalid PAN format. Must be 10 characters.")
    
    # Fetch report from Surepass
    result = await surepass.fetch_experian_report(
        name=request.name,
        pan=pan,
        mobile=request.mobile,
        consent=request.consent
    )
    
    if not result.get("success"):
        return {
            "success": False,
            "error": result.get("error"),
            "error_code": result.get("error_code")
        }
    
    # Also fetch PDF link
    pdf_link = None
    try:
        pdf_result = await surepass.fetch_experian_pdf(
            name=request.name,
            pan=pan,
            mobile=request.mobile,
            consent=request.consent
        )
        if pdf_result.get("success"):
            pdf_link = pdf_result.get("pdf_link")
    except Exception as e:
        logger.warning(f"Failed to fetch Experian PDF: {e}")
    
    # Parse the report for better UI display
    parsed_report = surepass.parse_experian_report(result.get("credit_report", {}))
    
    # Store report in database
    report_id = str(uuid.uuid4())
    report_record = {
        "id": report_id,
        "provider": "Experian",
        "type": "json",
        "pan": pan,
        "mobile": request.mobile,
        "name": request.name,
        "credit_score": result.get("credit_score"),
        "client_id": result.get("client_id"),
        "parsed_report": parsed_report,
        "raw_report": result.get("credit_report"),
        "pdf_link": pdf_link,
        "customer_id": request.customer_id,
        "lead_id": request.lead_id,
        "loan_lead_id": request.loan_lead_id,
        "fetched_by": current_user.get("id"),
        "fetched_by_name": current_user.get("name"),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await _db.credit_reports.insert_one(report_record)
    logger.info(f"Stored Experian report {report_id} for PAN {pan[:4]}****")
    
    # Update loan_lead with credit score if loan_lead_id provided
    # Only update credit_score if CIBIL score doesn't exist (CIBIL is preferred)
    if request.loan_lead_id:
        # Check if CIBIL score exists
        existing_lead = await _db.loan_leads.find_one({"id": request.loan_lead_id})
        cibil_exists = existing_lead and existing_lead.get("credit_report_provider") == "CIBIL"
        
        update_data = {
            "experian_credit_score": result.get("credit_score"),
            "experian_report_id": report_id,
            "experian_report_fetched_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Only update main credit_score if no CIBIL score exists
        if not cibil_exists:
            update_data["credit_score"] = result.get("credit_score")
            update_data["credit_report_id"] = report_id
            update_data["credit_report_provider"] = "Experian"
            update_data["credit_report_fetched_at"] = datetime.now(timezone.utc).isoformat()
        
        await _db.loan_leads.update_one(
            {"id": request.loan_lead_id},
            {"$set": update_data}
        )
    
    return {
        "success": True,
        "report_id": report_id,
        "provider": "Experian",
        "credit_score": result.get("credit_score"),
        "parsed_report": parsed_report,
        "pdf_link": pdf_link,
        "fetched_at": result.get("fetched_at")
    }


@router.post("/experian/pdf")
async def fetch_experian_pdf_report(
    request: ExperianReportRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Fetch Experian credit report (PDF format)
    Returns a downloadable PDF link
    """
    surepass = get_surepass_service()
    
    if not surepass.is_configured():
        raise HTTPException(status_code=503, detail="Credit report service not configured")
    
    # Validate PAN format
    pan = request.pan.upper().strip()
    if len(pan) != 10:
        raise HTTPException(status_code=400, detail="Invalid PAN format. Must be 10 characters.")
    
    # Fetch PDF report from Surepass
    result = await surepass.fetch_experian_pdf(
        name=request.name,
        pan=pan,
        mobile=request.mobile,
        consent=request.consent
    )
    
    if not result.get("success"):
        return {
            "success": False,
            "error": result.get("error"),
            "error_code": result.get("error_code")
        }
    
    # Store PDF report record
    report_id = str(uuid.uuid4())
    report_record = {
        "id": report_id,
        "provider": "Experian",
        "type": "pdf",
        "pan": pan,
        "mobile": request.mobile,
        "name": request.name,
        "credit_score": result.get("credit_score"),
        "client_id": result.get("client_id"),
        "pdf_link": result.get("pdf_link"),
        "customer_id": request.customer_id,
        "lead_id": request.lead_id,
        "loan_lead_id": request.loan_lead_id,
        "fetched_by": current_user.get("id"),
        "fetched_by_name": current_user.get("name"),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await _db.credit_reports.insert_one(report_record)
    logger.info(f"Stored Experian PDF report {report_id} for PAN {pan[:4]}****")
    
    return {
        "success": True,
        "report_id": report_id,
        "provider": "Experian",
        "credit_score": result.get("credit_score"),
        "pdf_link": result.get("pdf_link"),
        "fetched_at": result.get("fetched_at")
    }


@router.get("/check-status")
async def check_credit_service_status(
    current_user: dict = Depends(get_current_user)
):
    """
    Check if credit report service is configured and available
    """
    surepass = get_surepass_service()
    
    return {
        "configured": surepass.is_configured(),
        "providers": ["CIBIL", "Equifax", "Experian"],
        "active_providers": ["CIBIL", "Equifax", "Experian"] if surepass.is_configured() else []
    }


@router.get("/history/{pan}")
async def get_credit_report_history(
    pan: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get credit report history for a PAN number
    """
    pan = pan.upper().strip()
    
    reports = await _db.credit_reports.find(
        {"pan": pan},
        {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    
    return {
        "pan": pan,
        "total_reports": len(reports),
        "reports": reports
    }


@router.get("/latest/{pan}")
async def get_latest_credit_reports(
    pan: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get the latest credit report for each bureau for a PAN number
    Returns one report per bureau (CIBIL, Equifax, Experian)
    """
    pan = pan.upper().strip()
    
    # Get latest report for each provider
    bureaus = ["CIBIL", "Equifax", "Experian"]
    latest_reports = {}
    
    for bureau in bureaus:
        report = await _db.credit_reports.find_one(
            {"pan": pan, "provider": bureau, "type": "json"},
            {"_id": 0},
            sort=[("created_at", -1)]
        )
        if report:
            latest_reports[bureau.lower()] = {
                "report_id": report.get("id"),
                "credit_score": report.get("credit_score"),
                "parsed_report": report.get("parsed_report"),
                "pdf_link": report.get("pdf_link"),
                "fetched_at": report.get("fetched_at"),
                "created_at": report.get("created_at")
            }
    
    return {
        "pan": pan,
        "reports": latest_reports,
        "has_cibil": "cibil" in latest_reports,
        "cibil_score": latest_reports.get("cibil", {}).get("credit_score")
    }


@router.get("/by-loan-lead/{loan_lead_id}")
async def get_credit_report_by_loan_lead(
    loan_lead_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get credit report for a loan lead
    """
    # First check if loan lead has a credit report
    loan_lead = await _db.loan_leads.find_one(
        {"id": loan_lead_id},
        {"_id": 0, "credit_report_id": 1, "pan_number": 1}
    )
    
    if not loan_lead:
        raise HTTPException(status_code=404, detail="Loan lead not found")
    
    # If credit report ID exists, fetch it
    if loan_lead.get("credit_report_id"):
        report = await _db.credit_reports.find_one(
            {"id": loan_lead["credit_report_id"]},
            {"_id": 0}
        )
        if report:
            return {"found": True, "report": report}
    
    # Otherwise, check if there's any report for this PAN
    if loan_lead.get("pan_number"):
        report = await _db.credit_reports.find_one(
            {"pan": loan_lead["pan_number"]},
            {"_id": 0}
        )
        if report:
            return {"found": True, "report": report}
    
    return {"found": False, "report": None}


@router.get("/{report_id}")
async def get_credit_report(
    report_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get a specific credit report by ID
    """
    report = await _db.credit_reports.find_one(
        {"id": report_id},
        {"_id": 0}
    )
    
    if not report:
        raise HTTPException(status_code=404, detail="Credit report not found")
    
    return report

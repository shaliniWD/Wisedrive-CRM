"""
Mechanic Module Routes - Mechanic App & Dashboard
Handles all mechanic-related endpoints including:
- Mechanic authentication
- Inspection assignment and completion
- Report management
- Performance tracking
"""
from fastapi import APIRouter, HTTPException, Depends, Request, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
import uuid
import logging

logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/mechanic", tags=["Mechanic"])

# Security scheme
security = HTTPBearer()

# Dependencies - set via init_mechanic_routes
db = None
_auth_validator = None
storage_service = None


class MechanicLogin(BaseModel):
    mobile: str
    otp: str


class InspectionUpdate(BaseModel):
    inspection_status: Optional[str] = None
    notes: Optional[str] = None
    video_url: Optional[str] = None


class ReportSection(BaseModel):
    section_name: str
    items: List[dict]


def init_mechanic_routes(_db, _get_current_user, _storage_service=None):
    """Initialize mechanic routes with dependencies"""
    global db, _auth_validator, storage_service
    db = _db
    _auth_validator = _get_current_user
    storage_service = _storage_service


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Authenticate user using the injected validator"""
    if _auth_validator is None:
        raise HTTPException(status_code=500, detail="Auth not initialized")
    return await _auth_validator(credentials)


# ==================== MECHANIC AUTHENTICATION ====================

@router.post("/login/request-otp")
async def mechanic_request_otp(mobile: str):
    """Request OTP for mechanic login"""
    # Find mechanic by mobile
    mechanic = await db.users.find_one({
        "mobile": mobile,
        "role_code": "MECHANIC",
        "is_active": True
    }, {"_id": 0})
    
    if not mechanic:
        raise HTTPException(status_code=404, detail="Mechanic not found")
    
    # Generate OTP (in production, send via SMS)
    otp = "123456"  # For development
    
    # Store OTP
    await db.otp_verifications.update_one(
        {"mobile": mobile, "purpose": "mechanic_login"},
        {
            "$set": {
                "otp": otp,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
            }
        },
        upsert=True
    )
    
    return {"message": "OTP sent successfully", "mobile": mobile}


@router.post("/login/verify-otp")
async def mechanic_verify_otp(data: MechanicLogin):
    """Verify OTP and login mechanic"""
    import jwt
    import os
    
    # Verify OTP
    otp_record = await db.otp_verifications.find_one({
        "mobile": data.mobile,
        "purpose": "mechanic_login",
        "otp": data.otp
    })
    
    if not otp_record:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    # Check expiry
    if otp_record.get("expires_at"):
        expires_at = datetime.fromisoformat(otp_record["expires_at"].replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > expires_at:
            raise HTTPException(status_code=400, detail="OTP expired")
    
    # Find mechanic
    mechanic = await db.users.find_one({
        "mobile": data.mobile,
        "role_code": "MECHANIC",
        "is_active": True
    }, {"_id": 0, "hashed_password": 0})
    
    if not mechanic:
        raise HTTPException(status_code=404, detail="Mechanic not found")
    
    # Generate JWT token
    token_data = {
        "sub": mechanic["id"],
        "role": "MECHANIC",
        "exp": datetime.now(timezone.utc) + timedelta(days=30)
    }
    
    secret_key = os.environ.get("JWT_SECRET_KEY", "wisedrive-secret-key-change-in-production")
    access_token = jwt.encode(token_data, secret_key, algorithm="HS256")
    
    # Delete used OTP
    await db.otp_verifications.delete_one({"_id": otp_record.get("_id")})
    
    # Build mechanic profile
    mechanic_profile = {
        "id": mechanic["id"],
        "name": mechanic.get("name", ""),
        "mobile": mechanic.get("mobile", ""),
        "email": mechanic.get("email", ""),
        "inspection_cities": mechanic.get("inspection_cities", []),
        "profile_photo": mechanic.get("profile_photo"),
        "country_id": mechanic.get("country_id")
    }
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "mechanicProfile": mechanic_profile
    }


# ==================== MECHANIC INSPECTIONS ====================

@router.get("/inspections")
async def get_mechanic_inspections(
    date_filter: Optional[str] = None,
    city: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get inspections for mechanic - assigned to or available in their cities"""
    mechanic_id = current_user["id"]
    mechanic_cities = current_user.get("inspection_cities", [])
    mechanic_name = current_user.get("name", "")
    
    # Build city variants for case-insensitive matching
    all_city_variants = []
    for mc in mechanic_cities:
        all_city_variants.extend([mc, mc.lower(), mc.upper(), mc.title()])
    all_city_variants = list(set(all_city_variants))
    
    # Query: assigned to mechanic OR available in their cities
    query = {
        "$or": [
            {"mechanic_id": mechanic_id},
            {"mechanic_name": {"$regex": f"^{mechanic_name}$", "$options": "i"}} if mechanic_name else {"mechanic_id": mechanic_id},
            {
                "mechanic_id": {"$in": [None, ""]},
                "city": {"$in": all_city_variants} if all_city_variants else {"$exists": True},
                "inspection_status": {"$in": ["NEW_INSPECTION", "ASSIGNED_TO_MECHANIC"]}
            }
        ]
    }
    
    # Date filter
    if date_filter:
        today = datetime.now(timezone.utc).date()
        if date_filter == 'today':
            query["scheduled_date"] = {"$regex": f"^{today.isoformat()}"}
        elif date_filter == 'week':
            week_start = today - timedelta(days=today.weekday())
            week_end = week_start + timedelta(days=6)
            query["scheduled_date"] = {
                "$gte": week_start.isoformat(),
                "$lte": (week_end + timedelta(days=1)).isoformat()
            }
    
    # Status filter
    if status:
        query["inspection_status"] = status
    
    # City filter
    if city:
        query["city"] = {"$regex": f"^{city}$", "$options": "i"}
    
    inspections = await db.inspections.find(
        query,
        {"_id": 0}
    ).sort("scheduled_date", -1).to_list(100)
    
    return inspections


@router.get("/inspections/{inspection_id}")
async def get_mechanic_inspection(
    inspection_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get specific inspection details for mechanic"""
    inspection = await db.inspections.find_one(
        {"id": inspection_id},
        {"_id": 0}
    )
    
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    
    return inspection


@router.patch("/inspections/{inspection_id}/accept")
async def accept_inspection(
    inspection_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Accept/claim an inspection"""
    mechanic_id = current_user["id"]
    mechanic_name = current_user.get("name", "")
    
    inspection = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    
    # Check if already assigned
    if inspection.get("mechanic_id") and inspection["mechanic_id"] != mechanic_id:
        raise HTTPException(status_code=400, detail="Inspection already assigned to another mechanic")
    
    update_data = {
        "mechanic_id": mechanic_id,
        "mechanic_name": mechanic_name,
        "inspection_status": "ASSIGNED_TO_MECHANIC",
        "assigned_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.inspections.update_one({"id": inspection_id}, {"$set": update_data})
    
    updated = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
    return updated


@router.patch("/inspections/{inspection_id}/start")
async def start_inspection(
    inspection_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Start an inspection"""
    mechanic_id = current_user["id"]
    
    inspection = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    
    if inspection.get("mechanic_id") != mechanic_id:
        raise HTTPException(status_code=403, detail="Not assigned to this mechanic")
    
    update_data = {
        "inspection_status": "INSPECTION_IN_PROGRESS",
        "started_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.inspections.update_one({"id": inspection_id}, {"$set": update_data})
    
    updated = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
    return updated


@router.patch("/inspections/{inspection_id}/complete")
async def complete_inspection(
    inspection_id: str,
    data: InspectionUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Complete an inspection"""
    mechanic_id = current_user["id"]
    
    inspection = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    
    if inspection.get("mechanic_id") != mechanic_id:
        raise HTTPException(status_code=403, detail="Not assigned to this mechanic")
    
    update_data = {
        "inspection_status": "INSPECTION_COMPLETED",
        "completed_at": datetime.now(timezone.utc).isoformat()
    }
    
    if data.notes:
        update_data["mechanic_notes"] = data.notes
    if data.video_url:
        update_data["video_url"] = data.video_url
    
    await db.inspections.update_one({"id": inspection_id}, {"$set": update_data})
    
    updated = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
    return updated


# ==================== MECHANIC PROFILE ====================

@router.get("/profile")
async def get_mechanic_profile(current_user: dict = Depends(get_current_user)):
    """Get mechanic profile"""
    return {
        "id": current_user["id"],
        "name": current_user.get("name", ""),
        "mobile": current_user.get("mobile", ""),
        "email": current_user.get("email", ""),
        "inspection_cities": current_user.get("inspection_cities", []),
        "profile_photo": current_user.get("profile_photo"),
        "country_id": current_user.get("country_id")
    }


@router.get("/stats")
async def get_mechanic_stats(
    month: Optional[int] = None,
    year: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get mechanic performance statistics"""
    mechanic_id = current_user["id"]
    
    if not month:
        month = datetime.now().month
    if not year:
        year = datetime.now().year
    
    # Build date range
    from calendar import monthrange
    days_in_month = monthrange(year, month)[1]
    start_date = f"{year}-{month:02d}-01"
    end_date = f"{year}-{month:02d}-{days_in_month}"
    
    # Count completed inspections
    completed = await db.inspections.count_documents({
        "mechanic_id": mechanic_id,
        "inspection_status": "INSPECTION_COMPLETED",
        "completed_at": {"$gte": start_date, "$lte": end_date + "T23:59:59"}
    })
    
    # Count assigned but not completed
    assigned = await db.inspections.count_documents({
        "mechanic_id": mechanic_id,
        "inspection_status": {"$in": ["ASSIGNED_TO_MECHANIC", "INSPECTION_IN_PROGRESS"]},
        "scheduled_date": {"$gte": start_date, "$lte": end_date}
    })
    
    return {
        "month": month,
        "year": year,
        "completed_inspections": completed,
        "pending_inspections": assigned,
        "total_assigned": completed + assigned
    }


# ==================== MECHANIC REPORT ====================

@router.get("/inspections/{inspection_id}/report")
async def get_inspection_report(
    inspection_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get inspection report data"""
    report = await db.inspection_reports.find_one(
        {"inspection_id": inspection_id},
        {"_id": 0}
    )
    
    if not report:
        # Return empty template if no report exists
        return {
            "inspection_id": inspection_id,
            "sections": [],
            "overall_score": None,
            "recommendation": None
        }
    
    return report


@router.post("/inspections/{inspection_id}/report")
async def save_inspection_report(
    inspection_id: str,
    sections: List[ReportSection],
    current_user: dict = Depends(get_current_user)
):
    """Save inspection report"""
    mechanic_id = current_user["id"]
    
    # Verify mechanic has access
    inspection = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    
    if inspection.get("mechanic_id") != mechanic_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    report_data = {
        "inspection_id": inspection_id,
        "sections": [s.model_dump() for s in sections],
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": mechanic_id
    }
    
    # Upsert report
    existing = await db.inspection_reports.find_one({"inspection_id": inspection_id})
    if existing:
        await db.inspection_reports.update_one(
            {"inspection_id": inspection_id},
            {"$set": report_data}
        )
    else:
        report_data["id"] = str(uuid.uuid4())
        report_data["created_at"] = datetime.now(timezone.utc).isoformat()
        report_data["created_by"] = mechanic_id
        await db.inspection_reports.insert_one(report_data)
    
    report = await db.inspection_reports.find_one({"inspection_id": inspection_id}, {"_id": 0})
    return report

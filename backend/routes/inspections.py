"""
Inspections Routes
Handles vehicle inspection management
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone

router = APIRouter(prefix="/inspections", tags=["Inspections"])

# These will be injected from main server
db = None
get_current_user = None


def init_inspections_routes(database, auth_dependency):
    """Initialize inspections routes with dependencies"""
    global db, get_current_user
    db = database
    get_current_user = auth_dependency


class InspectionCreate(BaseModel):
    customer_id: str
    vehicle_number: Optional[str] = None
    vehicle_brand: Optional[str] = None
    vehicle_model: Optional[str] = None
    vehicle_year: Optional[int] = None
    inspection_template_id: Optional[str] = None
    report_template_id: Optional[str] = None
    scheduled_date: Optional[str] = None
    notes: Optional[str] = None


class InspectionUpdate(BaseModel):
    status: Optional[str] = None
    mechanic_id: Optional[str] = None
    scheduled_date: Optional[str] = None
    notes: Optional[str] = None
    results: Optional[dict] = None


# Note: The actual route implementations remain in server.py for now
# This file serves as a template for future migration

"""
@router.get("")
async def get_inspections(
    status: Optional[str] = None,
    mechanic_id: Optional[str] = None,
    customer_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    '''Get all inspections with filters'''
    query = {"country_id": current_user.get("country_id")}
    
    if status:
        query["status"] = status
    if mechanic_id:
        query["mechanic_id"] = mechanic_id
    if customer_id:
        query["customer_id"] = customer_id
    
    inspections = await db.inspections.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return inspections


@router.post("")
async def create_inspection(data: InspectionCreate, current_user: dict = Depends(get_current_user)):
    '''Create a new inspection'''
    import uuid
    
    inspection = {
        "id": str(uuid.uuid4()),
        "customer_id": data.customer_id,
        "vehicle_number": data.vehicle_number,
        "vehicle_brand": data.vehicle_brand,
        "vehicle_model": data.vehicle_model,
        "vehicle_year": data.vehicle_year,
        "inspection_template_id": data.inspection_template_id,
        "report_template_id": data.report_template_id,
        "scheduled_date": data.scheduled_date,
        "notes": data.notes,
        "status": "PENDING",
        "country_id": current_user.get("country_id"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"]
    }
    
    await db.inspections.insert_one(inspection)
    inspection.pop("_id", None)
    return inspection


@router.get("/{inspection_id}")
async def get_inspection(inspection_id: str, current_user: dict = Depends(get_current_user)):
    '''Get a single inspection'''
    inspection = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    return inspection


@router.put("/{inspection_id}")
async def update_inspection(
    inspection_id: str, 
    data: InspectionUpdate, 
    current_user: dict = Depends(get_current_user)
):
    '''Update an inspection'''
    existing = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Inspection not found")
    
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = current_user["id"]
    
    await db.inspections.update_one({"id": inspection_id}, {"$set": update_data})
    updated = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
    return updated


@router.get("/{inspection_id}/report-config")
async def get_inspection_report_config(inspection_id: str, current_user: dict = Depends(get_current_user)):
    '''Get the report configuration for an inspection'''
    inspection = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    
    report_template_id = inspection.get("report_template_id")
    report_template = None
    
    if report_template_id:
        report_template = await db.report_templates.find_one(
            {"id": report_template_id},
            {"_id": 0}
        )
    
    # Fallback to partner's default template
    if not report_template and inspection.get("partner_id"):
        partner = await db.partners.find_one({"id": inspection["partner_id"]}, {"_id": 0})
        if partner and partner.get("default_report_template_id"):
            report_template = await db.report_templates.find_one(
                {"id": partner["default_report_template_id"]},
                {"_id": 0}
            )
    
    return {
        "inspection_id": inspection_id,
        "report_template": report_template
    }
"""

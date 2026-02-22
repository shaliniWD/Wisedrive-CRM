"""
Partners Routes
Handles partner/client management
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/partners", tags=["Partners"])

# These will be injected from main server
db = None
get_current_user = None


def init_partners_routes(database, auth_dependency):
    """Initialize partners routes with database and auth"""
    global db, get_current_user
    db = database
    get_current_user = auth_dependency


class PartnerCreate(BaseModel):
    name: str
    type: str  # b2c, bank, insurance, b2b
    contact_person: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = True
    default_report_template_id: Optional[str] = None


# Note: The actual route implementations remain in server.py for now
# This file serves as a template for future migration

"""
@router.get("")
async def get_partners(
    type: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: dict = Depends(get_current_user)
):
    '''Get all partners'''
    query = {}
    if type:
        query["type"] = type
    if is_active is not None:
        query["is_active"] = is_active
    
    partners = await db.partners.find(query, {"_id": 0}).to_list(100)
    return partners


@router.post("")
async def create_partner(data: PartnerCreate, current_user: dict = Depends(get_current_user)):
    '''Create a new partner'''
    partner = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "type": data.type,
        "contact_person": data.contact_person,
        "contact_email": data.contact_email,
        "contact_phone": data.contact_phone,
        "address": data.address,
        "notes": data.notes,
        "is_active": data.is_active if data.is_active is not None else True,
        "default_report_template_id": data.default_report_template_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"],
        "created_by_name": current_user.get("name", "")
    }
    
    await db.partners.insert_one(partner)
    partner.pop("_id", None)
    return partner


@router.put("/{partner_id}")
async def update_partner(partner_id: str, data: PartnerCreate, current_user: dict = Depends(get_current_user)):
    '''Update a partner'''
    existing = await db.partners.find_one({"id": partner_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Partner not found")
    
    update_data = {
        "name": data.name,
        "type": data.type,
        "contact_person": data.contact_person,
        "contact_email": data.contact_email,
        "contact_phone": data.contact_phone,
        "address": data.address,
        "notes": data.notes,
        "is_active": data.is_active if data.is_active is not None else True,
        "default_report_template_id": data.default_report_template_id,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user["id"],
        "updated_by_name": current_user.get("name", "")
    }
    
    await db.partners.update_one({"id": partner_id}, {"$set": update_data})
    updated = await db.partners.find_one({"id": partner_id}, {"_id": 0})
    return updated


@router.delete("/{partner_id}")
async def delete_partner(partner_id: str, current_user: dict = Depends(get_current_user)):
    '''Delete a partner'''
    result = await db.partners.delete_one({"id": partner_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Partner not found")
    return {"message": "Partner deleted"}


@router.patch("/{partner_id}/toggle")
async def toggle_partner(partner_id: str, current_user: dict = Depends(get_current_user)):
    '''Toggle partner active status'''
    partner = await db.partners.find_one({"id": partner_id}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    
    new_status = not partner.get("is_active", True)
    await db.partners.update_one(
        {"id": partner_id}, 
        {"$set": {"is_active": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"is_active": new_status}
"""

"""
Leads Routes
Handles all lead management operations
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone

router = APIRouter(prefix="/leads", tags=["Leads"])

# These will be injected from main server
db = None
get_current_user = None


def init_leads_routes(database, auth_dependency):
    """Initialize leads routes with database and auth"""
    global db, get_current_user
    db = database
    get_current_user = auth_dependency


class LeadCreate(BaseModel):
    name: str
    mobile: str
    city: Optional[str] = None
    city_id: Optional[str] = None
    source: Optional[str] = None
    partner_id: Optional[str] = None
    notes: Optional[str] = None


class LeadUpdate(BaseModel):
    name: Optional[str] = None
    mobile: Optional[str] = None
    city: Optional[str] = None
    city_id: Optional[str] = None
    source: Optional[str] = None
    partner_id: Optional[str] = None
    status: Optional[str] = None
    assigned_to: Optional[str] = None


class NoteCreate(BaseModel):
    content: str


class ReminderCreate(BaseModel):
    reminder_date: str
    reminder_time: str
    notes: Optional[str] = None


# Note: The actual route implementations remain in server.py for now
# This file serves as a template for future migration

# Example of how routes will look after migration:
"""
@router.get("")
async def get_leads(
    status: Optional[str] = None,
    city: Optional[str] = None,
    assigned_to: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    '''Get all leads with filters'''
    query = {"country_id": current_user.get("country_id")}
    
    if status:
        query["status"] = status
    if city:
        query["city"] = city
    if assigned_to:
        query["assigned_to"] = assigned_to
    
    leads = await db.leads.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return leads


@router.post("")
async def create_lead(data: LeadCreate, current_user: dict = Depends(get_current_user)):
    '''Create a new lead'''
    import uuid
    
    lead = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "mobile": data.mobile,
        "city": data.city,
        "city_id": data.city_id,
        "source": data.source or "MANUAL",
        "partner_id": data.partner_id,
        "status": "NEW LEAD",
        "country_id": current_user.get("country_id"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"],
        "created_by_name": current_user.get("name", "")
    }
    
    await db.leads.insert_one(lead)
    lead.pop("_id", None)
    return lead


@router.get("/statuses")
async def get_lead_statuses(current_user: dict = Depends(get_current_user)):
    '''Get all available lead statuses'''
    statuses = [
        {"value": "NEW LEAD", "label": "New Lead"},
        {"value": "RNR", "label": "RNR"},
        {"value": "RNR1", "label": "RNR1"},
        {"value": "RNR2", "label": "RNR2"},
        {"value": "RNR3", "label": "RNR3"},
        {"value": "FOLLOW UP", "label": "Follow Up"},
        {"value": "WHATSAPP FOLLOW UP", "label": "WhatsApp Follow Up"},
        {"value": "Repeat follow up", "label": "Repeat Follow Up"},
        {"value": "HOT LEADS", "label": "Hot Leads"},
        {"value": "NOT INTERESTED", "label": "Not Interested"},
        {"value": "DEAD LEAD", "label": "Dead Lead"},
        {"value": "ESCALATION", "label": "Escalation"},
        {"value": "STOP", "label": "Stop"},
        {"value": "OUT OF SERVICE AREA", "label": "Out of Service Area"},
        {"value": "WRONG NUMBER", "label": "Wrong Number"},
        {"value": "PURCHASED FROM COMPETITOR", "label": "Purchased from Competitor"},
        {"value": "PAYMENT LINK SENT", "label": "Payment Link Sent"},
        {"value": "PAID", "label": "Paid"},
        {"value": "CAR FINALIZED", "label": "Car Finalized"},
        {"value": "Car purchased", "label": "Car Purchased"},
        {"value": "CC GENERATED", "label": "CC Generated"},
        {"value": "RCB WHATSAPP", "label": "RCB WhatsApp"},
    ]
    return statuses
"""

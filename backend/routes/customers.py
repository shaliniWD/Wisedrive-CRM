"""
Customers Module Routes - Customer Management
Handles all customer-related endpoints including:
- Customer CRUD operations
- Payment history
- Customer notes and activities
- Sales rep assignment
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
import uuid
import logging

logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/customers", tags=["Customers"])

# These will be set by init_customers_routes
db = None
get_current_user = None
rbac_service = None


class CustomerCreate(BaseModel):
    name: str
    mobile: str
    email: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    country_id: Optional[str] = None


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    payment_status: Optional[str] = None


class CustomerNote(BaseModel):
    note: str


def init_customers_routes(_db, _get_current_user, _rbac_service=None):
    """Initialize customers routes with dependencies"""
    global db, get_current_user, rbac_service
    db = _db
    get_current_user = _get_current_user
    rbac_service = _rbac_service


async def get_sales_role_ids():
    """Get role IDs for sales-related roles"""
    sales_roles = await db.roles.find(
        {"code": {"$in": ["SALES_REP", "SALES_MANAGER", "SALES_HEAD", "COUNTRY_HEAD", "ADMIN"]}},
        {"_id": 0, "id": 1}
    ).to_list(10)
    return [r["id"] for r in sales_roles]


@router.get("")
async def get_customers(
    search: Optional[str] = None,
    city: Optional[str] = None,
    payment_status: Optional[str] = None,
    country_id: Optional[str] = None,
    sales_rep_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(lambda: get_current_user)
):
    """Get customers - filtered by RBAC, enriched with sales rep and payment info"""
    rbac_filter = await rbac_service.get_data_filter(current_user["id"], "customers.view") if rbac_service else {}
    query = {**rbac_filter}
    
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"mobile": {"$regex": search, "$options": "i"}}
        ]
    if city:
        query["city"] = city
    if payment_status:
        query["payment_status"] = payment_status
    if country_id:
        query["country_id"] = country_id
    
    # Date range filter
    if date_from or date_to:
        date_query = {}
        if date_from:
            date_query["$gte"] = date_from
        if date_to:
            date_query["$lte"] = date_to + "T23:59:59"
        query["created_at"] = date_query
    
    # Sales rep filter
    if sales_rep_id:
        query["created_by"] = sales_rep_id
    
    customers = await db.customers.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # Enrich with payment data
    for customer in customers:
        # Get all inspections for this customer
        inspections = await db.inspections.find(
            {"customer_id": customer["id"]},
            {"_id": 0, "id": 1, "total_amount": 1, "amount_paid": 1, "balance_due": 1, "payment_status": 1}
        ).to_list(100)
        
        total_amount = sum(i.get("total_amount", 0) or 0 for i in inspections)
        total_paid = sum(i.get("amount_paid", 0) or 0 for i in inspections)
        total_pending = sum(i.get("balance_due", 0) or 0 for i in inspections)
        
        customer["total_inspections"] = len(inspections)
        customer["total_amount"] = total_amount
        customer["total_paid"] = total_paid
        customer["total_pending"] = total_pending
        
        # Determine payment status
        if total_pending > 0:
            customer["payment_status"] = "Pending"
        elif total_paid > 0:
            customer["payment_status"] = "Completed"
        else:
            customer["payment_status"] = "No Payments"
        
        # Get sales rep info
        if customer.get("created_by"):
            sales_rep = await db.users.find_one(
                {"id": customer["created_by"]},
                {"_id": 0, "id": 1, "name": 1, "email": 1}
            )
            customer["sales_rep"] = sales_rep
    
    return customers


@router.get("/sales-reps-with-counts")
async def get_sales_reps_with_customer_counts(
    country_id: Optional[str] = None,
    current_user: dict = Depends(lambda: get_current_user)
):
    """Get sales reps with their customer counts"""
    sales_role_ids = await get_sales_role_ids()
    
    query = {"role_id": {"$in": sales_role_ids}, "is_active": True}
    if country_id:
        query["country_id"] = country_id
    
    sales_reps = await db.users.find(query, {"_id": 0, "id": 1, "name": 1, "email": 1}).to_list(100)
    
    for rep in sales_reps:
        customer_count = await db.customers.count_documents({"created_by": rep["id"]})
        rep["customer_count"] = customer_count
        
        # Get recent activity
        recent_customer = await db.customers.find_one(
            {"created_by": rep["id"]},
            {"_id": 0, "created_at": 1}
        )
        rep["last_customer_added"] = recent_customer.get("created_at") if recent_customer else None
    
    return sales_reps


@router.get("/{customer_id}")
async def get_customer(customer_id: str, current_user: dict = Depends(lambda: get_current_user)):
    """Get a specific customer with all details"""
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@router.post("")
async def create_customer(
    customer_data: CustomerCreate,
    current_user: dict = Depends(lambda: get_current_user)
):
    """Create a new customer"""
    now = datetime.now(timezone.utc)
    
    customer = {
        "id": str(uuid.uuid4()),
        "name": customer_data.name,
        "mobile": customer_data.mobile,
        "email": customer_data.email,
        "city": customer_data.city,
        "address": customer_data.address,
        "country_id": customer_data.country_id,
        "payment_status": "No Payments",
        "created_at": now.isoformat(),
        "created_by": current_user.get("id"),
        "updated_at": now.isoformat()
    }
    
    await db.customers.insert_one(customer)
    customer.pop("_id", None)
    return customer


@router.put("/{customer_id}")
async def update_customer(
    customer_id: str,
    customer_data: CustomerUpdate,
    current_user: dict = Depends(lambda: get_current_user)
):
    """Update a customer"""
    update_dict = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    for field, value in customer_data.model_dump(exclude_unset=True).items():
        if value is not None:
            update_dict[field] = value
    
    result = await db.customers.update_one({"id": customer_id}, {"$set": update_dict})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    updated = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    return updated


@router.delete("/{customer_id}")
async def delete_customer(customer_id: str, current_user: dict = Depends(lambda: get_current_user)):
    """Delete a customer"""
    result = await db.customers.delete_one({"id": customer_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"message": "Customer deleted successfully"}


@router.get("/{customer_id}/payment-history")
async def get_customer_payment_history(
    customer_id: str,
    current_user: dict = Depends(lambda: get_current_user)
):
    """Get payment history for a customer across all inspections"""
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Get all inspections for this customer
    inspections = await db.inspections.find(
        {"customer_id": customer_id},
        {"_id": 0, "id": 1, "car_number": 1, "car_make": 1, "car_model": 1,
         "package_name": 1, "total_amount": 1, "amount_paid": 1, "balance_due": 1,
         "payment_status": 1, "payment_transactions": 1, "created_at": 1}
    ).sort("created_at", -1).to_list(100)
    
    # Calculate totals
    total_amount = sum(i.get("total_amount", 0) or 0 for i in inspections)
    total_paid = sum(i.get("amount_paid", 0) or 0 for i in inspections)
    total_pending = sum(i.get("balance_due", 0) or 0 for i in inspections)
    
    # Flatten all transactions
    all_transactions = []
    for inspection in inspections:
        for tx in inspection.get("payment_transactions", []):
            tx["inspection_id"] = inspection["id"]
            tx["car_number"] = inspection.get("car_number")
            tx["package_name"] = inspection.get("package_name")
            all_transactions.append(tx)
    
    # Sort by date
    all_transactions.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    
    return {
        "customer": customer,
        "summary": {
            "total_inspections": len(inspections),
            "total_amount": total_amount,
            "total_paid": total_paid,
            "total_pending": total_pending
        },
        "inspections": inspections,
        "transactions": all_transactions
    }


@router.get("/{customer_id}/detailed-payments")
async def get_customer_detailed_payments(
    customer_id: str,
    current_user: dict = Depends(lambda: get_current_user)
):
    """Get detailed payment breakdown for a customer"""
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Get all inspections with full payment details
    inspections = await db.inspections.find(
        {"customer_id": customer_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    payment_breakdown = []
    
    for inspection in inspections:
        inspection_data = {
            "inspection_id": inspection["id"],
            "car_number": inspection.get("car_number"),
            "car_make": inspection.get("car_make"),
            "car_model": inspection.get("car_model"),
            "car_year": inspection.get("car_year"),
            "package_name": inspection.get("package_name"),
            "package_type": inspection.get("package_type"),
            "inspection_status": inspection.get("inspection_status"),
            "created_at": inspection.get("created_at"),
            "pricing": {
                "total_amount": inspection.get("total_amount", 0),
                "amount_paid": inspection.get("amount_paid", 0),
                "balance_due": inspection.get("balance_due", 0),
                "payment_status": inspection.get("payment_status", "PENDING")
            },
            "transactions": inspection.get("payment_transactions", [])
        }
        payment_breakdown.append(inspection_data)
    
    # Calculate summary
    total_amount = sum(p["pricing"]["total_amount"] or 0 for p in payment_breakdown)
    total_paid = sum(p["pricing"]["amount_paid"] or 0 for p in payment_breakdown)
    total_pending = sum(p["pricing"]["balance_due"] or 0 for p in payment_breakdown)
    
    return {
        "customer": {
            "id": customer["id"],
            "name": customer.get("name"),
            "mobile": customer.get("mobile"),
            "email": customer.get("email")
        },
        "summary": {
            "total_inspections": len(payment_breakdown),
            "total_amount": total_amount,
            "total_paid": total_paid,
            "total_pending": total_pending,
            "payment_completion": round((total_paid / total_amount * 100) if total_amount > 0 else 0, 1)
        },
        "inspections": payment_breakdown
    }


@router.post("/{customer_id}/notes")
async def add_customer_note(
    customer_id: str,
    note_data: CustomerNote,
    current_user: dict = Depends(lambda: get_current_user)
):
    """Add a note to a customer"""
    customer = await db.customers.find_one({"id": customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    now = datetime.now(timezone.utc)
    
    note = {
        "id": str(uuid.uuid4()),
        "customer_id": customer_id,
        "user_id": current_user.get("id"),
        "user_name": current_user.get("name", "Unknown"),
        "note": note_data.note,
        "created_at": now.isoformat()
    }
    
    await db.customer_notes.insert_one(note)
    
    # Create activity
    activity = {
        "id": str(uuid.uuid4()),
        "customer_id": customer_id,
        "user_id": current_user.get("id"),
        "user_name": current_user.get("name", "Unknown"),
        "action": "note_added",
        "details": f"Added a note",
        "new_value": note_data.note,
        "created_at": now.isoformat()
    }
    await db.customer_activities.insert_one(activity)
    
    note.pop("_id", None)
    return note


@router.get("/{customer_id}/notes")
async def get_customer_notes(customer_id: str, current_user: dict = Depends(lambda: get_current_user)):
    """Get all notes for a customer"""
    notes = await db.customer_notes.find({"customer_id": customer_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return notes


@router.put("/{customer_id}/notes/{note_id}")
async def update_customer_note(
    customer_id: str,
    note_id: str,
    note_data: CustomerNote,
    current_user: dict = Depends(lambda: get_current_user)
):
    """Update a customer note"""
    result = await db.customer_notes.update_one(
        {"id": note_id, "customer_id": customer_id},
        {"$set": {"note": note_data.note, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")
    
    updated = await db.customer_notes.find_one({"id": note_id}, {"_id": 0})
    return updated


@router.delete("/{customer_id}/notes/{note_id}")
async def delete_customer_note(
    customer_id: str,
    note_id: str,
    current_user: dict = Depends(lambda: get_current_user)
):
    """Delete a customer note"""
    result = await db.customer_notes.delete_one({"id": note_id, "customer_id": customer_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")
    
    return {"success": True, "message": "Note deleted"}


@router.get("/{customer_id}/activities")
async def get_customer_activities(customer_id: str, current_user: dict = Depends(lambda: get_current_user)):
    """Get all activities for a customer"""
    activities = await db.customer_activities.find({"customer_id": customer_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return activities

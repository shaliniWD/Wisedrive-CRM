"""
Customers Module Routes - Customer Management
Handles all customer-related endpoints including:
- Customer CRUD operations
- Payment history
- Customer notes and activities
- Sales rep assignment
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
import uuid
import logging

logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/customers", tags=["Customers"])

# Security scheme
security = HTTPBearer()

# These will be set by init_customers_routes
db = None
_auth_validator = None
rbac_service = None


def convert_local_date_to_utc_range_customers(local_date: str, timezone_offset_minutes: int = 330) -> tuple:
    """Convert a local date string to UTC datetime range."""
    local_date_obj = datetime.strptime(local_date, "%Y-%m-%d")
    offset = timedelta(minutes=timezone_offset_minutes)
    local_tz = timezone(offset)
    
    local_start = local_date_obj.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=local_tz)
    utc_start = local_start.astimezone(timezone.utc)
    
    local_end = local_date_obj.replace(hour=23, minute=59, second=59, microsecond=999999, tzinfo=local_tz)
    utc_end = local_end.astimezone(timezone.utc)
    
    return utc_start.isoformat().replace('+00:00', 'Z'), utc_end.isoformat().replace('+00:00', 'Z')


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
    global db, _auth_validator, rbac_service
    db = _db
    _auth_validator = _get_current_user
    rbac_service = _rbac_service


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Authenticate user using the injected validator"""
    if _auth_validator is None:
        raise HTTPException(status_code=500, detail="Auth not initialized")
    return await _auth_validator(credentials)


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
    current_user: dict = Depends(get_current_user)
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
    
    customers = await db.customers.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Collect customer IDs and lead IDs for enrichment
    customer_ids = [c["id"] for c in customers]
    lead_ids = [c.get("lead_id") for c in customers if c.get("lead_id")]
    
    # Get inspections count and payment summary per customer using aggregation
    if customer_ids:
        pipeline = [
            {"$match": {"customer_id": {"$in": customer_ids}}},
            {"$group": {
                "_id": "$customer_id",
                "total_packages": {"$sum": 1},
                "total_paid": {"$sum": "$amount_paid"},
                "total_pending": {"$sum": "$balance_due"}
            }}
        ]
        payment_stats = await db.inspections.aggregate(pipeline).to_list(1000)
        payment_map = {p["_id"]: p for p in payment_stats}
    else:
        payment_map = {}
    
    # Get sales rep info from leads
    lead_map = {}
    if lead_ids:
        leads = await db.leads.find(
            {"id": {"$in": lead_ids}},
            {"_id": 0, "id": 1, "assigned_to": 1, "assigned_to_name": 1, "created_by": 1}
        ).to_list(500)
        lead_map = {lead["id"]: lead for lead in leads}
    
    # Get user names for created_by lookups
    user_ids = set()
    for c in customers:
        if c.get("created_by"):
            user_ids.add(c["created_by"])
    for lead_item in lead_map.values():
        if lead_item.get("created_by"):
            user_ids.add(lead_item["created_by"])
        if lead_item.get("assigned_to"):
            user_ids.add(lead_item["assigned_to"])
    
    user_map = {}
    if user_ids:
        users = await db.users.find({"id": {"$in": list(user_ids)}}, {"_id": 0, "id": 1, "name": 1}).to_list(100)
        user_map = {u["id"]: u["name"] for u in users}
    
    # Get notes count per customer
    notes_pipeline = [
        {"$match": {"customer_id": {"$in": customer_ids}}},
        {"$group": {"_id": "$customer_id", "count": {"$sum": 1}}}
    ]
    notes_counts = await db.customer_notes.aggregate(notes_pipeline).to_list(1000)
    notes_map = {n["_id"]: n["count"] for n in notes_counts}
    
    # Enrich customers
    for customer in customers:
        cid = customer["id"]
        
        # Payment summary
        stats = payment_map.get(cid, {})
        customer["total_packages"] = stats.get("total_packages", 0)
        customer["total_paid"] = stats.get("total_paid", 0)
        customer["total_pending"] = stats.get("total_pending", 0)
        
        # Sales rep from lead
        lead_id = customer.get("lead_id")
        if lead_id and lead_id in lead_map:
            lead = lead_map[lead_id]
            rep_id = lead.get("assigned_to") or lead.get("created_by")
            customer["sales_rep_id"] = rep_id
            customer["sales_rep_name"] = lead.get("assigned_to_name") or user_map.get(rep_id, "N/A")
        elif customer.get("created_by"):
            customer["sales_rep_id"] = customer["created_by"]
            customer["sales_rep_name"] = user_map.get(customer["created_by"], "N/A")
        else:
            customer["sales_rep_id"] = None
            customer["sales_rep_name"] = "N/A"
        
        # Notes count
        customer["notes_count"] = notes_map.get(cid, 0)
    
    # Filter by sales_rep_id if specified (post-enrichment filter)
    if sales_rep_id:
        customers = [c for c in customers if c.get("sales_rep_id") == sales_rep_id]
    
    return customers


@router.get("/sales-reps-with-counts")
async def get_sales_reps_with_customer_counts(
    current_user: dict = Depends(get_current_user)
):
    """Get all sales reps with their customer counts"""
    # Get all sales role IDs
    sales_role_ids = await get_sales_role_ids()
    
    # Get all sales reps
    sales_reps = await db.users.find(
        {"role_id": {"$in": sales_role_ids}, "is_active": True},
        {"_id": 0, "id": 1, "name": 1, "email": 1}
    ).to_list(100)
    
    # Get customer counts per sales rep from leads
    lead_counts = await db.leads.aggregate([
        {"$match": {"assigned_to": {"$ne": None}, "payment_status": "paid"}},
        {"$group": {"_id": "$assigned_to", "count": {"$sum": 1}}}
    ]).to_list(100)
    
    lead_count_map = {lc["_id"]: lc["count"] for lc in lead_counts}
    
    # Also count customers created by each user
    customer_counts = await db.customers.aggregate([
        {"$match": {"created_by": {"$ne": None}}},
        {"$group": {"_id": "$created_by", "count": {"$sum": 1}}}
    ]).to_list(100)
    
    customer_count_map = {cc["_id"]: cc["count"] for cc in customer_counts}
    
    # Combine counts and return
    result = []
    for rep in sales_reps:
        rep_id = rep["id"]
        count = lead_count_map.get(rep_id, 0) + customer_count_map.get(rep_id, 0)
        result.append({
            "id": rep_id,
            "name": rep["name"],
            "email": rep.get("email"),
            "customer_count": count
        })
    
    # Sort by customer count descending
    result.sort(key=lambda x: x["customer_count"], reverse=True)
    
    return result


@router.get("/{customer_id}")
async def get_customer(customer_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific customer with all details"""
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@router.post("")
async def create_customer(
    customer_data: CustomerCreate,
    current_user: dict = Depends(get_current_user)
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
    current_user: dict = Depends(get_current_user)
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
async def delete_customer(customer_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a customer"""
    result = await db.customers.delete_one({"id": customer_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"message": "Customer deleted successfully"}


@router.get("/{customer_id}/payment-history")
async def get_customer_payment_history(
    customer_id: str,
    current_user: dict = Depends(get_current_user)
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
    current_user: dict = Depends(get_current_user)
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
    current_user: dict = Depends(get_current_user)
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
        "details": "Added a note",
        "new_value": note_data.note,
        "created_at": now.isoformat()
    }
    await db.customer_activities.insert_one(activity)
    
    note.pop("_id", None)
    return note


@router.get("/{customer_id}/notes")
async def get_customer_notes(customer_id: str, current_user: dict = Depends(get_current_user)):
    """Get all notes for a customer"""
    notes = await db.customer_notes.find({"customer_id": customer_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return notes


@router.put("/{customer_id}/notes/{note_id}")
async def update_customer_note(
    customer_id: str,
    note_id: str,
    note_data: CustomerNote,
    current_user: dict = Depends(get_current_user)
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
    current_user: dict = Depends(get_current_user)
):
    """Delete a customer note"""
    result = await db.customer_notes.delete_one({"id": note_id, "customer_id": customer_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")
    
    return {"success": True, "message": "Note deleted"}


@router.get("/{customer_id}/activities")
async def get_customer_activities(customer_id: str, current_user: dict = Depends(get_current_user)):
    """Get all activities for a customer"""
    activities = await db.customer_activities.find({"customer_id": customer_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return activities



@router.post("/seed-sample-data")
async def seed_sample_customer_data(current_user: dict = Depends(get_current_user)):
    """Create a sample customer with multiple packages and payment transactions for demo purposes"""
    
    # Get country and a sales rep
    country = await db.countries.find_one({"code": "IN"}, {"_id": 0, "id": 1})
    country_id = country["id"] if country else "c49e1dc6-1450-40c2-9846-56b73369b2b1"
    
    sales_role_ids = await get_sales_role_ids()
    sales_rep = await db.users.find_one({"role_id": {"$in": sales_role_ids}, "is_active": True}, {"_id": 0, "id": 1, "name": 1})
    
    # Create sample customer
    customer_id = str(uuid.uuid4())
    customer = {
        "id": customer_id,
        "country_id": country_id,
        "name": "Rahul Sharma (Demo)",
        "mobile": "9876543210",
        "email": "rahul.sharma.demo@example.com",
        "city": "Bangalore",
        "address": "123 MG Road, Indiranagar, Bangalore 560038",
        "payment_status": "Completed",
        "total_amount_paid": 4500,
        "created_at": (datetime.now(timezone.utc) - timedelta(days=45)).isoformat(),
        "created_by": sales_rep["id"] if sales_rep else current_user["id"]
    }
    await db.customers.insert_one(customer)
    
    # Create 3 inspections with different payment scenarios
    inspections_data = [
        {
            "package_name": "Premium Inspection",
            "package_type": "PREMIUM",
            "car_number": "KA01AB1234",
            "car_make": "Toyota",
            "car_model": "Fortuner",
            "car_year": "2022",
            "total_amount": 2499,
            "amount_paid": 2499,
            "balance_due": 0,
            "payment_status": "FULLY_PAID",
            "inspection_status": "INSPECTION_COMPLETED",
            "days_ago": 45,
            "payment_transactions": [
                {"amount": 2499, "status": "completed", "payment_type": "full", "payment_method": "Razorpay", "razorpay_payment_id": "pay_demo123456789"}
            ]
        },
        {
            "package_name": "Standard Inspection",
            "package_type": "STANDARD",
            "car_number": "KA02CD5678",
            "car_make": "Honda",
            "car_model": "City",
            "car_year": "2021",
            "total_amount": 1499,
            "amount_paid": 1499,
            "balance_due": 0,
            "payment_status": "FULLY_PAID",
            "inspection_status": "INSPECTION_COMPLETED",
            "days_ago": 20,
            "payment_transactions": [
                {"amount": 500, "status": "completed", "payment_type": "partial", "payment_method": "Razorpay", "razorpay_payment_id": "pay_demo987654321"},
                {"amount": 999, "status": "completed", "payment_type": "balance", "payment_method": "Razorpay", "razorpay_payment_id": "pay_demo111222333"}
            ]
        },
        {
            "package_name": "Basic Inspection",
            "package_type": "BASIC",
            "car_number": "KA03EF9012",
            "car_make": "Maruti Suzuki",
            "car_model": "Swift",
            "car_year": "2023",
            "total_amount": 999,
            "amount_paid": 500,
            "balance_due": 499,
            "payment_status": "PARTIAL_PAID",
            "inspection_status": "NEW_INSPECTION",
            "days_ago": 3,
            "payment_transactions": [
                {"amount": 500, "status": "completed", "payment_type": "partial", "payment_method": "Razorpay", "razorpay_payment_id": "pay_demo444555666"}
            ]
        }
    ]
    
    created_inspections = []
    for insp_data in inspections_data:
        inspection_id = str(uuid.uuid4())
        created_date = datetime.now(timezone.utc) - timedelta(days=insp_data["days_ago"])
        
        # Build payment transactions
        txns = []
        for i, txn in enumerate(insp_data["payment_transactions"]):
            txn_date = created_date + timedelta(hours=i*2)
            txns.append({
                "id": str(uuid.uuid4()),
                "amount": txn["amount"],
                "payment_type": txn["payment_type"],
                "payment_method": txn["payment_method"],
                "razorpay_payment_id": txn.get("razorpay_payment_id"),
                "status": txn["status"],
                "created_at": txn_date.isoformat(),
                "completed_at": txn_date.isoformat() if txn["status"] == "completed" else None,
                "payment_link_url": f"https://rzp.io/demo_{inspection_id[:8]}"
            })
        
        inspection = {
            "id": inspection_id,
            "country_id": country_id,
            "customer_id": customer_id,
            "customer_name": customer["name"],
            "customer_mobile": customer["mobile"],
            "car_number": insp_data["car_number"],
            "car_make": insp_data["car_make"],
            "car_model": insp_data["car_model"],
            "car_year": insp_data["car_year"],
            "city": customer["city"],
            "address": customer["address"],
            "package_name": insp_data["package_name"],
            "package_type": insp_data["package_type"],
            "total_amount": insp_data["total_amount"],
            "final_amount": insp_data["total_amount"],
            "amount_paid": insp_data["amount_paid"],
            "balance_due": insp_data["balance_due"],
            "payment_status": insp_data["payment_status"],
            "payment_type": "partial" if len(insp_data["payment_transactions"]) > 1 else "full",
            "payment_link_id": f"plink_demo_{inspection_id[:8]}",
            "payment_link_url": f"https://rzp.io/demo_{inspection_id[:8]}",
            "payment_transactions": txns,
            "inspection_status": insp_data["inspection_status"],
            "inspections_available": 1,
            "created_at": created_date.isoformat(),
            "created_by": sales_rep["id"] if sales_rep else current_user["id"]
        }
        await db.inspections.insert_one(inspection)
        created_inspections.append(inspection_id)
    
    # Create sample notes
    notes_data = [
        {"note": "Customer referred by existing client. Very interested in premium package.", "days_ago": 45},
        {"note": "Completed first inspection. Customer very satisfied with the report.", "days_ago": 44},
        {"note": "Customer called back for second car inspection. Offered loyalty discount.", "days_ago": 21},
        {"note": "Balance payment pending for third inspection. Will follow up tomorrow.", "days_ago": 2},
    ]
    
    for note_info in notes_data:
        note_date = datetime.now(timezone.utc) - timedelta(days=note_info["days_ago"])
        note = {
            "id": str(uuid.uuid4()),
            "customer_id": customer_id,
            "user_id": sales_rep["id"] if sales_rep else current_user["id"],
            "user_name": sales_rep["name"] if sales_rep else current_user.get("name", "System"),
            "note": note_info["note"],
            "created_at": note_date.isoformat()
        }
        await db.customer_notes.insert_one(note)
        
        # Also create activity
        activity = {
            "id": str(uuid.uuid4()),
            "customer_id": customer_id,
            "user_id": note["user_id"],
            "user_name": note["user_name"],
            "action": "note_added",
            "details": f"Added a note ({len(note_info['note'])} chars)",
            "new_value": note_info["note"],
            "created_at": note_date.isoformat()
        }
        await db.customer_activities.insert_one(activity)
    
    return {
        "message": "Sample customer data created successfully",
        "customer_id": customer_id,
        "customer_name": customer["name"],
        "inspections_created": len(created_inspections),
        "notes_created": len(notes_data),
        "total_paid": 4498,
        "total_pending": 499
    }

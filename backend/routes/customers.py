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
    timezone_offset: Optional[int] = 330,  # User's timezone offset in minutes (default IST)
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
    
    # Timezone-aware date range filter
    if date_from or date_to:
        date_query = {}
        if date_from:
            utc_from, _ = convert_local_date_to_utc_range_customers(date_from, timezone_offset)
            date_query["$gte"] = utc_from
        if date_to:
            _, utc_to = convert_local_date_to_utc_range_customers(date_to, timezone_offset)
            date_query["$lte"] = utc_to
        if date_query:
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



# ==================== CUSTOMER DATA REPAIR ====================

class CustomerRepairRequest(BaseModel):
    """Request model for customer repair"""
    create_missing_inspections: bool = True
    link_orphaned_inspections: bool = True

@router.post("/{customer_id}/repair")
async def repair_customer_data(
    customer_id: str,
    request: CustomerRepairRequest = CustomerRepairRequest(),
    current_user: dict = Depends(get_current_user)
):
    """
    Repair customer data issues:
    - Link orphaned inspections (by lead_id or mobile) to customer
    - Create missing inspections for payments that don't have them
    
    Returns a summary of what was fixed.
    """
    import uuid
    
    # Only CEO/HR_MANAGER can repair data
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "HR_MANAGER", "COUNTRY_HEAD", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Not authorized to repair customer data")
    
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    return await _repair_customer(db, customer, current_user)


@router.get("/diagnose/{mobile}")
async def diagnose_customer_data(
    mobile: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Comprehensive diagnostic endpoint to find ALL data related to a mobile number.
    Searches across: customers, leads, inspections to identify data linkage issues.
    """
    import re
    
    # Normalize mobile - extract just digits
    digits = re.sub(r'\D', '', mobile)
    if len(digits) == 12 and digits.startswith('91'):
        normalized = digits[2:]
    else:
        normalized = digits
    
    # Build all possible mobile patterns
    mobile_patterns = [
        mobile,  # Original
        normalized,  # Just digits
        f"+91{normalized}",
        f"91{normalized}",
        f"+91-{normalized}",
        f"+91 {normalized}",
    ]
    
    result = {
        "search_mobile": mobile,
        "normalized_mobile": normalized,
        "patterns_searched": mobile_patterns,
        "customers": [],
        "leads": [],
        "inspections": [],
        "summary": {}
    }
    
    # Search customers
    customers = await db.customers.find(
        {"mobile": {"$in": mobile_patterns}},
        {"_id": 0}
    ).to_list(10)
    result["customers"] = [{
        "id": c.get("id"),
        "name": c.get("name"),
        "mobile": c.get("mobile"),
        "lead_id": c.get("lead_id"),
        "razorpay_payment_id": c.get("razorpay_payment_id"),
        "package_name": c.get("package_name"),
        "no_of_inspections": c.get("no_of_inspections"),
        "additional_purchases": len(c.get("additional_purchases", [])),
        "created_at": c.get("created_at")
    } for c in customers]
    
    # Search leads
    leads = await db.leads.find(
        {"mobile": {"$in": mobile_patterns}},
        {"_id": 0}
    ).to_list(20)
    result["leads"] = [{
        "id": l.get("id"),
        "name": l.get("name"),
        "mobile": l.get("mobile"),
        "status": l.get("status"),
        "payment_status": l.get("payment_status"),
        "razorpay_payment_id": l.get("razorpay_payment_id"),
        "customer_id": l.get("customer_id"),
        "package_name": l.get("package_name"),
        "no_of_inspections": l.get("no_of_inspections"),
        "created_at": l.get("created_at")
    } for l in leads]
    
    # Search inspections by mobile
    inspections = await db.inspections.find(
        {"customer_mobile": {"$in": mobile_patterns}},
        {"_id": 0, "id": 1, "customer_id": 1, "lead_id": 1, "customer_name": 1, 
         "customer_mobile": 1, "inspection_status": 1, "razorpay_payment_id": 1,
         "package_type": 1, "created_at": 1}
    ).to_list(30)
    result["inspections"] = inspections
    
    # Also search inspections by lead_ids found
    if leads:
        lead_ids = [l.get("id") for l in leads if l.get("id")]
        if lead_ids:
            insp_by_lead = await db.inspections.find(
                {"lead_id": {"$in": lead_ids}},
                {"_id": 0, "id": 1, "customer_id": 1, "lead_id": 1, "customer_name": 1,
                 "customer_mobile": 1, "inspection_status": 1, "razorpay_payment_id": 1,
                 "package_type": 1, "created_at": 1}
            ).to_list(30)
            # Add any new inspections not already found
            existing_ids = {i["id"] for i in result["inspections"]}
            for insp in insp_by_lead:
                if insp["id"] not in existing_ids:
                    result["inspections"].append(insp)
    
    # Also search by customer_id if customers found
    if customers:
        customer_ids = [c.get("id") for c in customers if c.get("id")]
        if customer_ids:
            insp_by_customer = await db.inspections.find(
                {"customer_id": {"$in": customer_ids}},
                {"_id": 0, "id": 1, "customer_id": 1, "lead_id": 1, "customer_name": 1,
                 "customer_mobile": 1, "inspection_status": 1, "razorpay_payment_id": 1,
                 "package_type": 1, "created_at": 1}
            ).to_list(30)
            existing_ids = {i["id"] for i in result["inspections"]}
            for insp in insp_by_customer:
                if insp["id"] not in existing_ids:
                    result["inspections"].append(insp)
    
    # Summary
    result["summary"] = {
        "total_customers": len(result["customers"]),
        "total_leads": len(result["leads"]),
        "total_inspections": len(result["inspections"]),
        "paid_leads": len([l for l in leads if l.get("payment_status") == "paid"]),
        "leads_with_payment_id": len([l for l in leads if l.get("razorpay_payment_id")]),
        "customers_with_payment_id": len([c for c in customers if c.get("razorpay_payment_id")]),
        "orphaned_inspections": len([i for i in result["inspections"] if not i.get("customer_id")]),
        "linked_inspections": len([i for i in result["inspections"] if i.get("customer_id")]),
    }
    
    # Issues detected
    issues = []
    if len(leads) > 0 and len(customers) == 0:
        issues.append("Lead(s) exist but no customer record - payment may not have been completed")
    if any(l.get("razorpay_payment_id") for l in leads) and not any(c.get("razorpay_payment_id") for c in customers):
        issues.append("Lead has payment but customer doesn't have payment data - repair needed")
    if len(result["inspections"]) == 0 and any(l.get("payment_status") == "paid" for l in leads):
        issues.append("Paid lead exists but no inspections created - repair needed")
    if result["summary"]["orphaned_inspections"] > 0:
        issues.append(f"{result['summary']['orphaned_inspections']} orphaned inspection(s) need linking")
    
    result["issues"] = issues
    result["recommendation"] = "Run repair-by-mobile endpoint to fix issues" if issues else "No issues detected"
    
    return result


@router.post("/repair-by-mobile/{mobile}")
async def repair_customer_by_mobile(
    mobile: str,
    request: CustomerRepairRequest = CustomerRepairRequest(),
    current_user: dict = Depends(get_current_user)
):
    """
    Repair customer data by mobile number.
    Finds the customer and repairs inspection linkage issues.
    """
    import uuid
    
    # Only CEO/HR_MANAGER can repair data
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "HR_MANAGER", "COUNTRY_HEAD", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Not authorized to repair customer data")
    
    customer = await db.customers.find_one({"mobile": mobile}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail=f"Customer not found with mobile {mobile}")
    
    return await _repair_customer(db, customer, current_user)


async def _repair_customer(db, customer: dict, current_user: dict):
    """Internal function to repair customer data"""
    import uuid
    import re
    
    customer_id = customer.get("id")
    lead_id = customer.get("lead_id")
    mobile = customer.get("mobile")
    
    # Normalize mobile number - extract just digits, handle +91 prefix
    def normalize_mobile(m):
        if not m:
            return None
        # Remove all non-digits
        digits = re.sub(r'\D', '', m)
        # If starts with 91 and has 12 digits, remove the 91 prefix
        if len(digits) == 12 and digits.startswith('91'):
            return digits[2:]
        return digits
    
    normalized_mobile = normalize_mobile(mobile)
    
    repairs = {
        "customer_id": customer_id,
        "customer_name": customer.get("name"),
        "mobile": mobile,
        "normalized_mobile": normalized_mobile,
        "inspections_linked": 0,
        "inspections_created": 0,
        "payment_data_recovered": False,
        "details": []
    }
    
    # 0. NEW: Try to find the lead and recover payment data if missing from customer
    lead = None
    if lead_id:
        lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    
    # If no lead found by lead_id, try by mobile
    if not lead and normalized_mobile:
        mobile_patterns = [
            normalized_mobile,
            f"+91{normalized_mobile}",
            f"91{normalized_mobile}",
        ]
        lead = await db.leads.find_one(
            {"mobile": {"$in": mobile_patterns}, "payment_status": "paid"},
            {"_id": 0}
        )
        if lead:
            repairs["details"].append(f"Found lead by mobile match: {lead.get('id')}")
            # Update customer with lead_id if missing
            if not lead_id:
                await db.customers.update_one(
                    {"id": customer_id},
                    {"$set": {"lead_id": lead.get("id")}}
                )
                lead_id = lead.get("id")
                repairs["details"].append(f"Linked customer to lead {lead_id}")
    
    # Check if customer has payment data, if not try to recover from lead
    if lead and not customer.get("razorpay_payment_id"):
        lead_payment_id = lead.get("razorpay_payment_id")
        if lead_payment_id:
            update_data = {
                "razorpay_payment_id": lead_payment_id,
                "payment_amount": lead.get("package_price") or lead.get("amount", 0),
                "package_name": lead.get("package_name"),
                "package_id": lead.get("package_id"),
                "no_of_inspections": lead.get("no_of_inspections", 1),
            }
            await db.customers.update_one(
                {"id": customer_id},
                {"$set": update_data}
            )
            # Update local customer dict for further processing
            customer.update(update_data)
            repairs["payment_data_recovered"] = True
            repairs["details"].append(f"Recovered payment data from lead: payment_id={lead_payment_id[-8:]}")
    
    # 1. Link orphaned inspections by lead_id
    if lead_id:
        result = await db.inspections.update_many(
            {"lead_id": lead_id, "customer_id": {"$ne": customer_id}},
            {"$set": {
                "customer_id": customer_id,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        if result.modified_count > 0:
            repairs["inspections_linked"] += result.modified_count
            repairs["details"].append(f"Linked {result.modified_count} orphaned inspection(s) by lead_id")
    
    # 2. Link orphaned inspections by mobile (with normalization)
    # We need to find inspections where the normalized mobile matches
    if normalized_mobile:
        # Build a regex to match various phone formats:
        # - 7411891010
        # - +917411891010
        # - 917411891010
        # - +91-7411891010
        # - +91 7411891010
        mobile_patterns = [
            normalized_mobile,  # Just the digits
            f"+91{normalized_mobile}",  # With +91
            f"91{normalized_mobile}",  # With 91
            f"+91-{normalized_mobile}",  # With +91-
            f"+91 {normalized_mobile}",  # With +91 space
        ]
        
        result = await db.inspections.update_many(
            {
                "customer_mobile": {"$in": mobile_patterns},
                "$or": [
                    {"customer_id": {"$exists": False}},
                    {"customer_id": None},
                    {"customer_id": ""},
                    {"customer_id": {"$ne": customer_id}}
                ]
            },
            {"$set": {
                "customer_id": customer_id,
                "lead_id": lead_id,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        if result.modified_count > 0:
            repairs["inspections_linked"] += result.modified_count
            repairs["details"].append(f"Linked {result.modified_count} orphaned inspection(s) by mobile (normalized)")
    
    # 3. Create missing inspections for payments
    # Collect all payment IDs for this customer
    all_payment_ids = set()
    if customer.get('razorpay_payment_id'):
        all_payment_ids.add(customer.get('razorpay_payment_id'))
    for p in customer.get('additional_purchases', []):
        if p.get('razorpay_payment_id'):
            all_payment_ids.add(p.get('razorpay_payment_id'))
    
    if all_payment_ids:
        # Find which payment IDs already have inspections
        existing = await db.inspections.find(
            {"razorpay_payment_id": {"$in": list(all_payment_ids)}},
            {"razorpay_payment_id": 1}
        ).to_list(100)
        existing_payment_ids = set(i.get('razorpay_payment_id') for i in existing)
        
        missing_payment_ids = all_payment_ids - existing_payment_ids
        
        # Build payment info map
        payment_info = {}
        if customer.get('razorpay_payment_id'):
            payment_info[customer['razorpay_payment_id']] = {
                'package_name': customer.get('package_name', 'Standard Inspection'),
                'no_of_inspections': customer.get('no_of_inspections', 1),
                'amount': customer.get('payment_amount', 0)
            }
        for p in customer.get('additional_purchases', []):
            if p.get('razorpay_payment_id'):
                payment_info[p['razorpay_payment_id']] = {
                    'package_name': p.get('package_name', 'Standard Inspection'),
                    'no_of_inspections': p.get('no_of_inspections', 1),
                    'amount': p.get('payment_amount', 0)
                }
        
        # Create missing inspections
        for payment_id in missing_payment_ids:
            pkg = payment_info.get(payment_id, {})
            no_of_inspections = pkg.get('no_of_inspections', 1)
            package_name = pkg.get('package_name', 'Standard Inspection')
            amount = pkg.get('amount', 0)
            
            for i in range(no_of_inspections):
                inspection_id = str(uuid.uuid4())
                inspection = {
                    "id": inspection_id,
                    "customer_id": customer_id,
                    "lead_id": lead_id,
                    "order_id": f"ORD-{payment_id[-8:].upper()}",
                    "customer_name": customer.get("name"),
                    "customer_mobile": mobile,
                    "customer_email": customer.get("email"),
                    "city": customer.get("city"),
                    "city_id": customer.get("city_id"),
                    "car_number": "",
                    "package_type": package_name,
                    "total_amount": amount / no_of_inspections if no_of_inspections > 0 else amount,
                    "amount_paid": amount / no_of_inspections if no_of_inspections > 0 else amount,
                    "balance_due": 0,
                    "payment_status": "FULLY_PAID",
                    "payment_date": datetime.now(timezone.utc).isoformat(),
                    "razorpay_payment_id": payment_id,
                    "inspection_status": "NEW_INSPECTION",
                    "scheduled_date": None,
                    "scheduled_time": None,
                    "slot_number": i + 1,
                    "inspections_available": 1,
                    "report_status": "pending",
                    "notes": f"Inspection {i+1}/{no_of_inspections} - Created by repair tool",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "created_by": current_user.get("id", "system")
                }
                await db.inspections.insert_one(inspection)
                repairs["inspections_created"] += 1
            
            repairs["details"].append(f"Created {no_of_inspections} inspection(s) for payment {payment_id[-8:]}")
    
    # Refresh customer inspection stats
    pipeline = [
        {"$match": {"customer_id": customer_id}},
        {"$group": {
            "_id": None,
            "total_packages": {"$sum": 1},
            "total_paid": {"$sum": "$amount_paid"},
            "total_pending": {"$sum": "$balance_due"}
        }}
    ]
    stats = await db.inspections.aggregate(pipeline).to_list(1)
    if stats:
        repairs["updated_stats"] = {
            "total_packages": stats[0].get("total_packages", 0),
            "total_paid": stats[0].get("total_paid", 0),
            "total_pending": stats[0].get("total_pending", 0)
        }
    
    # 4. NEW: Additional search strategies if still no inspections found
    if repairs["inspections_linked"] == 0 and repairs["inspections_created"] == 0:
        # 4a. Search by customer name (exact match) and city
        customer_name = customer.get("name")
        customer_city = customer.get("city")
        customer_email = customer.get("email")
        
        if customer_name:
            # Try to find inspections by name match
            orphan_by_name = await db.inspections.find(
                {
                    "customer_name": {"$regex": f"^{re.escape(customer_name)}$", "$options": "i"},
                    "$or": [
                        {"customer_id": {"$exists": False}},
                        {"customer_id": None},
                        {"customer_id": ""}
                    ]
                },
                {"_id": 0, "id": 1, "customer_name": 1, "customer_mobile": 1}
            ).to_list(20)
            
            if orphan_by_name:
                for insp in orphan_by_name:
                    await db.inspections.update_one(
                        {"id": insp["id"]},
                        {"$set": {
                            "customer_id": customer_id,
                            "lead_id": lead_id,
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }}
                    )
                repairs["inspections_linked"] += len(orphan_by_name)
                repairs["details"].append(f"Linked {len(orphan_by_name)} orphaned inspection(s) by customer name match")
        
        # 4b. Search by email if available
        if customer_email and repairs["inspections_linked"] == 0:
            orphan_by_email = await db.inspections.find(
                {
                    "customer_email": {"$regex": f"^{re.escape(customer_email)}$", "$options": "i"},
                    "$or": [
                        {"customer_id": {"$exists": False}},
                        {"customer_id": None},
                        {"customer_id": ""}
                    ]
                },
                {"_id": 0, "id": 1}
            ).to_list(20)
            
            if orphan_by_email:
                for insp in orphan_by_email:
                    await db.inspections.update_one(
                        {"id": insp["id"]},
                        {"$set": {
                            "customer_id": customer_id,
                            "lead_id": lead_id,
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }}
                    )
                repairs["inspections_linked"] += len(orphan_by_email)
                repairs["details"].append(f"Linked {len(orphan_by_email)} orphaned inspection(s) by email match")
    
    # 5. Diagnostic info - show what was searched
    repairs["diagnostic"] = {
        "customer_has_payment_id": bool(customer.get("razorpay_payment_id")),
        "customer_has_lead_id": bool(lead_id),
        "lead_found": bool(lead) if 'lead' in dir() else False,
        "lead_has_payment": bool(lead.get("razorpay_payment_id")) if lead else False,
        "search_criteria_used": [
            "lead_id" if lead_id else None,
            "mobile_normalized" if normalized_mobile else None,
            "customer_name" if customer.get("name") else None,
            "customer_email" if customer.get("email") else None
        ]
    }
    
    # Final message if nothing was repaired
    if repairs["inspections_linked"] == 0 and repairs["inspections_created"] == 0 and not repairs.get("payment_data_recovered"):
        repairs["message"] = "No issues found to repair. This could mean: (1) Customer data is correct, (2) No matching inspections/payments exist in the system, or (3) Data was created outside the normal flow."
        repairs["suggestions"] = [
            "Check if a payment was actually made for this customer",
            "Verify the mobile number format matches across leads and customers",
            f"Search inspections manually by name: {customer.get('name')}",
            f"Search leads by mobile: {mobile}"
        ]
    
    return repairs

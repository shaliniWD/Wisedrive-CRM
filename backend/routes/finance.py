"""
Finance Module Routes - Payment Management
Handles all finance-related endpoints including:
- Payment tracking
- Payment approvals
- Payslips
- Finance summary
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List
from datetime import datetime, timezone
from pydantic import BaseModel
import uuid
import logging

logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/finance", tags=["Finance"])

# These will be set by init_finance_routes
db = None
get_current_user = None

# Payment status constants
PAYMENT_STATUS_PENDING = "pending"
PAYMENT_STATUS_SUBMITTED = "submitted"
PAYMENT_STATUS_APPROVED = "approved"
PAYMENT_STATUS_REJECTED = "rejected"
PAYMENT_STATUS_PAID = "paid"


class PaymentCreate(BaseModel):
    employee_id: str
    payment_type: str  # salary, reimbursement, bonus, advance
    amount: float
    description: Optional[str] = None
    month: Optional[int] = None
    year: Optional[int] = None


class PaymentUpdate(BaseModel):
    amount: Optional[float] = None
    description: Optional[str] = None
    payment_mode: Optional[str] = None
    reference_number: Optional[str] = None
    remarks: Optional[str] = None


class PaymentApproval(BaseModel):
    remarks: Optional[str] = None


def init_finance_routes(_db, _get_current_user):
    """Initialize finance routes with dependencies"""
    global db, get_current_user
    db = _db
    get_current_user = _get_current_user


@router.get("/payments")
async def get_finance_payments(
    country_id: Optional[str] = None,
    employee_id: Optional[str] = None,
    payment_type: Optional[str] = None,
    payment_status: Optional[str] = None,
    month: Optional[int] = None,
    year: Optional[int] = None,
    current_user: dict = Depends(lambda: get_current_user)
):
    """Get all payments - filtered by role access"""
    role_code = current_user.get("role_code", "")
    user_country = current_user.get("country_id")
    
    # Check permission
    if role_code not in ["CEO", "COUNTRY_HEAD", "FINANCE_MANAGER", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Not authorized to view finance data")
    
    query = {}
    
    # Apply country filter based on role
    if role_code == "CEO" or role_code == "ADMIN":
        if country_id:
            query["country_id"] = country_id
    else:
        # Finance Manager and Country Head can only see their country
        query["country_id"] = user_country
    
    if employee_id:
        query["employee_id"] = employee_id
    if payment_type:
        query["payment_type"] = payment_type
    if payment_status:
        query["status"] = payment_status
    if month:
        query["month"] = month
    if year:
        query["year"] = year
    
    payments = await db.finance_payments.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # Enrich with employee info
    for payment in payments:
        employee = await db.users.find_one(
            {"id": payment.get("employee_id")},
            {"_id": 0, "id": 1, "name": 1, "email": 1, "role_code": 1}
        )
        payment["employee"] = employee
    
    return payments


@router.get("/payments/{payment_id}")
async def get_finance_payment(
    payment_id: str,
    current_user: dict = Depends(lambda: get_current_user)
):
    """Get a specific payment"""
    payment = await db.finance_payments.find_one({"id": payment_id}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    # Enrich with employee info
    employee = await db.users.find_one(
        {"id": payment.get("employee_id")},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "role_code": 1}
    )
    payment["employee"] = employee
    
    return payment


@router.post("/payments")
async def create_finance_payment(
    payment_data: PaymentCreate,
    current_user: dict = Depends(lambda: get_current_user)
):
    """Create a new payment entry"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "COUNTRY_HEAD", "FINANCE_MANAGER", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Not authorized to create payments")
    
    # Get employee details
    employee = await db.users.find_one({"id": payment_data.employee_id}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    now = datetime.now(timezone.utc)
    
    payment = {
        "id": str(uuid.uuid4()),
        "employee_id": payment_data.employee_id,
        "employee_name": employee.get("name"),
        "country_id": employee.get("country_id"),
        "payment_type": payment_data.payment_type,
        "amount": payment_data.amount,
        "description": payment_data.description,
        "month": payment_data.month or now.month,
        "year": payment_data.year or now.year,
        "status": PAYMENT_STATUS_PENDING,
        "status_history": [{
            "status": PAYMENT_STATUS_PENDING,
            "changed_by": current_user.get("id"),
            "changed_at": now.isoformat()
        }],
        "created_by": current_user.get("id"),
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.finance_payments.insert_one(payment)
    payment.pop("_id", None)
    return payment


@router.put("/payments/{payment_id}")
async def update_finance_payment(
    payment_id: str,
    update_data: PaymentUpdate,
    current_user: dict = Depends(lambda: get_current_user)
):
    """Update a payment"""
    payment = await db.finance_payments.find_one({"id": payment_id})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    update_dict = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    for field, value in update_data.model_dump(exclude_unset=True).items():
        if value is not None:
            update_dict[field] = value
    
    await db.finance_payments.update_one({"id": payment_id}, {"$set": update_dict})
    updated = await db.finance_payments.find_one({"id": payment_id}, {"_id": 0})
    return updated


@router.patch("/payments/{payment_id}/submit")
async def submit_payment(
    payment_id: str,
    current_user: dict = Depends(lambda: get_current_user)
):
    """Submit payment for approval"""
    payment = await db.finance_payments.find_one({"id": payment_id})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    if payment["status"] != PAYMENT_STATUS_PENDING:
        raise HTTPException(status_code=400, detail="Payment is not in pending status")
    
    now = datetime.now(timezone.utc)
    
    await db.finance_payments.update_one(
        {"id": payment_id},
        {
            "$set": {"status": PAYMENT_STATUS_SUBMITTED, "updated_at": now.isoformat()},
            "$push": {"status_history": {
                "status": PAYMENT_STATUS_SUBMITTED,
                "changed_by": current_user.get("id"),
                "changed_at": now.isoformat()
            }}
        }
    )
    
    updated = await db.finance_payments.find_one({"id": payment_id}, {"_id": 0})
    return updated


@router.patch("/payments/{payment_id}/approve")
async def approve_payment(
    payment_id: str,
    approval_data: PaymentApproval,
    current_user: dict = Depends(lambda: get_current_user)
):
    """Approve a payment"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "COUNTRY_HEAD", "FINANCE_MANAGER", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Not authorized to approve payments")
    
    payment = await db.finance_payments.find_one({"id": payment_id})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    if payment["status"] != PAYMENT_STATUS_SUBMITTED:
        raise HTTPException(status_code=400, detail="Payment is not in submitted status")
    
    now = datetime.now(timezone.utc)
    
    await db.finance_payments.update_one(
        {"id": payment_id},
        {
            "$set": {
                "status": PAYMENT_STATUS_APPROVED,
                "approved_by": current_user.get("id"),
                "approved_at": now.isoformat(),
                "approval_remarks": approval_data.remarks,
                "updated_at": now.isoformat()
            },
            "$push": {"status_history": {
                "status": PAYMENT_STATUS_APPROVED,
                "changed_by": current_user.get("id"),
                "changed_at": now.isoformat(),
                "remarks": approval_data.remarks
            }}
        }
    )
    
    updated = await db.finance_payments.find_one({"id": payment_id}, {"_id": 0})
    return updated


@router.patch("/payments/{payment_id}/mark-paid")
async def mark_payment_paid(
    payment_id: str,
    payment_details: PaymentUpdate,
    current_user: dict = Depends(lambda: get_current_user)
):
    """Mark payment as paid"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "FINANCE_MANAGER", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Not authorized to mark payments as paid")
    
    payment = await db.finance_payments.find_one({"id": payment_id})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    if payment["status"] != PAYMENT_STATUS_APPROVED:
        raise HTTPException(status_code=400, detail="Payment is not in approved status")
    
    now = datetime.now(timezone.utc)
    
    update_data = {
        "status": PAYMENT_STATUS_PAID,
        "paid_at": now.isoformat(),
        "paid_by": current_user.get("id"),
        "updated_at": now.isoformat()
    }
    
    if payment_details.payment_mode:
        update_data["payment_mode"] = payment_details.payment_mode
    if payment_details.reference_number:
        update_data["reference_number"] = payment_details.reference_number
    
    await db.finance_payments.update_one(
        {"id": payment_id},
        {
            "$set": update_data,
            "$push": {"status_history": {
                "status": PAYMENT_STATUS_PAID,
                "changed_by": current_user.get("id"),
                "changed_at": now.isoformat()
            }}
        }
    )
    
    updated = await db.finance_payments.find_one({"id": payment_id}, {"_id": 0})
    return updated


@router.delete("/payments/{payment_id}")
async def delete_finance_payment(
    payment_id: str,
    current_user: dict = Depends(lambda: get_current_user)
):
    """Delete a payment (only if pending)"""
    payment = await db.finance_payments.find_one({"id": payment_id})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    if payment["status"] != PAYMENT_STATUS_PENDING:
        raise HTTPException(status_code=400, detail="Can only delete pending payments")
    
    await db.finance_payments.delete_one({"id": payment_id})
    return {"message": "Payment deleted successfully"}


@router.get("/payments/{payment_id}/proofs")
async def get_payment_proofs(
    payment_id: str,
    current_user: dict = Depends(lambda: get_current_user)
):
    """Get payment proofs"""
    payment = await db.finance_payments.find_one({"id": payment_id}, {"_id": 0, "proofs": 1})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment.get("proofs", [])


@router.post("/payments/{payment_id}/proofs")
async def add_payment_proof(
    payment_id: str,
    proof_url: str,
    proof_type: str = "receipt",
    current_user: dict = Depends(lambda: get_current_user)
):
    """Add a proof document to a payment"""
    payment = await db.finance_payments.find_one({"id": payment_id})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    now = datetime.now(timezone.utc)
    
    proof = {
        "id": str(uuid.uuid4()),
        "url": proof_url,
        "type": proof_type,
        "uploaded_by": current_user.get("id"),
        "uploaded_at": now.isoformat()
    }
    
    await db.finance_payments.update_one(
        {"id": payment_id},
        {"$push": {"proofs": proof}, "$set": {"updated_at": now.isoformat()}}
    )
    
    return proof


@router.delete("/payments/{payment_id}/proofs/{proof_id}")
async def delete_payment_proof(
    payment_id: str,
    proof_id: str,
    current_user: dict = Depends(lambda: get_current_user)
):
    """Delete a payment proof"""
    result = await db.finance_payments.update_one(
        {"id": payment_id},
        {"$pull": {"proofs": {"id": proof_id}}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Proof not found")
    
    return {"message": "Proof deleted successfully"}


@router.get("/summary")
async def get_finance_summary(
    country_id: Optional[str] = None,
    month: Optional[int] = None,
    year: Optional[int] = None,
    current_user: dict = Depends(lambda: get_current_user)
):
    """Get finance summary statistics"""
    role_code = current_user.get("role_code", "")
    user_country = current_user.get("country_id")
    
    if role_code not in ["CEO", "COUNTRY_HEAD", "FINANCE_MANAGER", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Not authorized to view finance summary")
    
    now = datetime.now(timezone.utc)
    query_month = month or now.month
    query_year = year or now.year
    
    query = {"month": query_month, "year": query_year}
    
    if role_code == "CEO" or role_code == "ADMIN":
        if country_id:
            query["country_id"] = country_id
    else:
        query["country_id"] = user_country
    
    # Get payment stats
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
            "total_amount": {"$sum": "$amount"}
        }}
    ]
    
    status_stats = {}
    async for doc in db.finance_payments.aggregate(pipeline):
        status_stats[doc["_id"]] = {
            "count": doc["count"],
            "amount": doc["total_amount"]
        }
    
    # Get by payment type
    type_pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$payment_type",
            "count": {"$sum": 1},
            "total_amount": {"$sum": "$amount"}
        }}
    ]
    
    type_stats = {}
    async for doc in db.finance_payments.aggregate(type_pipeline):
        type_stats[doc["_id"]] = {
            "count": doc["count"],
            "amount": doc["total_amount"]
        }
    
    total_payments = await db.finance_payments.count_documents(query)
    
    return {
        "month": query_month,
        "year": query_year,
        "total_payments": total_payments,
        "by_status": status_stats,
        "by_type": type_stats
    }


@router.get("/employees")
async def get_finance_employees(
    country_id: Optional[str] = None,
    current_user: dict = Depends(lambda: get_current_user)
):
    """Get employees with payment summary"""
    role_code = current_user.get("role_code", "")
    user_country = current_user.get("country_id")
    
    if role_code not in ["CEO", "COUNTRY_HEAD", "FINANCE_MANAGER", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    employee_query = {"is_active": True}
    
    if role_code == "CEO" or role_code == "ADMIN":
        if country_id:
            employee_query["country_id"] = country_id
    else:
        employee_query["country_id"] = user_country
    
    employees = await db.users.find(
        employee_query,
        {"_id": 0, "id": 1, "name": 1, "email": 1, "role_code": 1, "country_id": 1}
    ).to_list(500)
    
    for employee in employees:
        # Get payment stats for this employee
        payment_count = await db.finance_payments.count_documents({"employee_id": employee["id"]})
        
        # Get total paid amount
        pipeline = [
            {"$match": {"employee_id": employee["id"], "status": PAYMENT_STATUS_PAID}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]
        
        total_paid = 0
        async for doc in db.finance_payments.aggregate(pipeline):
            total_paid = doc["total"]
        
        employee["payment_count"] = payment_count
        employee["total_paid"] = total_paid
    
    return employees


@router.get("/payment-modes")
async def get_payment_modes():
    """Get available payment modes"""
    return [
        {"code": "bank_transfer", "name": "Bank Transfer"},
        {"code": "neft", "name": "NEFT"},
        {"code": "rtgs", "name": "RTGS"},
        {"code": "imps", "name": "IMPS"},
        {"code": "upi", "name": "UPI"},
        {"code": "cheque", "name": "Cheque"},
        {"code": "cash", "name": "Cash"},
        {"code": "other", "name": "Other"},
    ]



@router.get("/payments/{payment_id}/payslip")
async def generate_payslip(payment_id: str, current_user: dict = Depends(lambda: get_current_user)):
    """Generate payslip data for PDF generation"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "COUNTRY_HEAD", "FINANCE_MANAGER", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    payment = await db.finance_payments.find_one({"id": payment_id}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    # B2B payment types
    b2b_types = ["vendor", "statutory", "legal"]
    is_b2b = payment.get("payment_type") in b2b_types
    
    # Get country currency
    currency = "INR"
    currency_symbol = "₹"
    if payment.get("country_id"):
        country = await db.countries.find_one({"id": payment["country_id"]}, {"_id": 0, "currency": 1, "currency_symbol": 1})
        if country:
            currency = country.get("currency", "INR")
            currency_symbol = country.get("currency_symbol", "₹")
    
    if is_b2b:
        # B2B Payment payslip
        payslip_data = {
            # Company info
            "company_name": "WiseDrive Technologies Private Limited",
            "company_address": "Bangalore, India",
            
            # Vendor info
            "vendor_name": payment.get("vendor_name", ""),
            "employee_name": payment.get("vendor_name", ""),  # For compatibility
            "gstin": payment.get("gstin"),
            "pan_number": payment.get("pan_number"),
            "invoice_number": payment.get("invoice_number"),
            "invoice_date": payment.get("invoice_date"),
            "due_date": payment.get("due_date"),
            
            # Payment period
            "month": payment["month"],
            "year": payment["year"],
            "payment_date": payment.get("payment_date"),
            "payment_type": payment.get("payment_type"),
            
            # B2B amounts
            "is_b2b": True,
            "is_mechanic": False,
            "actual_amount": payment.get("actual_amount", payment.get("gross_amount", 0)),
            "gst_percentage": payment.get("gst_percentage", 18),
            "gst_amount": payment.get("gst_amount", 0),
            "tds_percentage": payment.get("tds_percentage", 10),
            "tds_amount": payment.get("tds_amount", payment.get("deductions", 0)),
            "gross_amount": payment.get("gross_amount", 0),
            "total_deductions": payment.get("deductions", 0),
            "net_salary": payment.get("net_amount", 0),
            
            # Payment info
            "payment_mode": payment.get("payment_mode"),
            "transaction_reference": payment.get("transaction_reference"),
            
            # Currency
            "currency": currency,
            "currency_symbol": currency_symbol,
            
            # Status
            "status": payment.get("status")
        }
        return payslip_data
    
    # Non-B2B payments - need employee details
    emp = await db.users.find_one({"id": payment.get("employee_id")}, {"_id": 0})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Get role
    role_name = "Employee"
    role_code_emp = ""
    if emp.get("role_id"):
        role = await db.roles.find_one({"id": emp["role_id"]}, {"_id": 0, "name": 1, "code": 1})
        if role:
            role_name = role.get("name", "Employee")
            role_code_emp = role.get("code", "")
    
    # Get department
    dept_name = ""
    if emp.get("department_id"):
        dept = await db.departments.find_one({"id": emp["department_id"]}, {"_id": 0, "name": 1})
        if dept:
            dept_name = dept.get("name", "")
    
    # Get salary structure for detailed breakdown
    salary_structure = await db.salary_structures.find_one(
        {"user_id": payment.get("employee_id"), "effective_to": None},
        {"_id": 0}
    )
    
    is_mechanic = role_code_emp == "MECHANIC" or payment.get("payment_type") == "mechanic_payout"
    
    payslip_data = {
        # Company info
        "company_name": "WiseDrive Technologies Private Limited",
        "company_address": "Bangalore, India",
        
        # Employee info
        "employee_name": emp.get("name", ""),
        "employee_code": emp.get("employee_code", ""),
        "employee_email": emp.get("email", ""),
        "department": dept_name,
        "designation": role_name,
        
        # Bank details
        "bank_name": emp.get("bank_name"),
        "account_number": emp.get("bank_account_number"),
        "ifsc_code": emp.get("ifsc_code"),
        "pan_number": emp.get("pan_number"),
        
        # Payment period
        "month": payment["month"],
        "year": payment["year"],
        "payment_date": payment.get("payment_date"),
        "payment_type": payment.get("payment_type"),
        
        # For salary payments
        "is_b2b": False,
        "is_mechanic": is_mechanic,
        "basic_salary": salary_structure.get("basic_salary", 0) if salary_structure else 0,
        "hra": salary_structure.get("hra", 0) if salary_structure else 0,
        "conveyance_allowance": salary_structure.get("conveyance_allowance", 0) if salary_structure else 0,
        "medical_allowance": salary_structure.get("medical_allowance", 0) if salary_structure else 0,
        "special_allowance": salary_structure.get("special_allowance", 0) if salary_structure else 0,
        "variable_pay": salary_structure.get("variable_pay", 0) if salary_structure else 0,
        "gross_salary": payment.get("gross_amount", 0),
        "gross_amount": payment.get("gross_amount", 0),
        
        # Deductions
        "pf_employee": salary_structure.get("pf_employee", 0) if salary_structure else 0,
        "professional_tax": salary_structure.get("professional_tax", 0) if salary_structure else 0,
        "income_tax": salary_structure.get("income_tax", 0) if salary_structure else 0,
        "other_deductions": salary_structure.get("other_deductions", 0) if salary_structure else 0,
        "total_deductions": payment.get("deductions", 0),
        
        # Net
        "net_salary": payment.get("net_amount", 0),
        
        # For mechanic payouts
        "inspections_count": payment.get("inspections_count", 0),
        "rate_per_inspection": payment.get("rate_per_inspection", 0),
        "total_inspection_pay": payment.get("inspections_count", 0) * payment.get("rate_per_inspection", 0),
        "bonus_amount": payment.get("bonus_amount", 0),
        
        # Payment info
        "payment_mode": payment.get("payment_mode"),
        "transaction_reference": payment.get("transaction_reference"),
        
        # Currency
        "currency": currency,
        "currency_symbol": currency_symbol,
        
        # Status
        "status": payment.get("status")
    }
    
    return payslip_data

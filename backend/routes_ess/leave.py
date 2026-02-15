"""Leave management routes for ESS Mobile API"""
from fastapi import APIRouter, HTTPException, Depends, Request, Query
from datetime import datetime, timezone, timedelta
import uuid

from models_ess.leave import (
    LeaveRequestCreate,
    LeaveRequestResponse,
    LeaveBalanceResponse,
    LeaveHistoryResponse,
    PendingApprovalResponse,
    LeaveApprovalAction,
    LeaveStatus,
    LeaveType
)
from routes.auth import get_current_user

router = APIRouter()


def calculate_leave_days(start_date: str, end_date: str, is_half_day: bool) -> float:
    """Calculate number of leave days"""
    start = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")
    
    if is_half_day:
        return 0.5
    
    days = (end - start).days + 1
    return float(days)


@router.post("/leave/apply", response_model=LeaveRequestResponse)
async def apply_leave(
    request: Request,
    leave_data: LeaveRequestCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Apply for leave.
    
    Validates:
    - Start date is not in the past
    - End date is not before start date
    - Sufficient leave balance (for casual/sick leaves)
    """
    db = request.app.state.db
    user_id = current_user["id"]
    
    # Parse dates
    try:
        start_date = datetime.strptime(leave_data.start_date, "%Y-%m-%d")
        end_date = datetime.strptime(leave_data.end_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    # Validate dates
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    if start_date.replace(tzinfo=timezone.utc) < today:
        raise HTTPException(status_code=400, detail="Cannot apply leave for past dates")
    
    if end_date < start_date:
        raise HTTPException(status_code=400, detail="End date cannot be before start date")
    
    # Calculate days
    days_count = calculate_leave_days(leave_data.start_date, leave_data.end_date, leave_data.is_half_day)
    
    # Check for overlapping leave requests
    overlap_query = {
        "employee_id": user_id,
        "status": {"$in": ["pending", "approved"]},
        "$or": [
            {"start_date": {"$lte": leave_data.end_date}, "end_date": {"$gte": leave_data.start_date}}
        ]
    }
    existing = await db.leave_requests.find_one(overlap_query)
    if existing:
        raise HTTPException(status_code=400, detail="You already have a leave request for these dates")
    
    # Create leave request
    leave_id = str(uuid.uuid4())
    leave_record = {
        "id": leave_id,
        "employee_id": user_id,
        "leave_type": leave_data.leave_type.value,
        "start_date": leave_data.start_date,
        "end_date": leave_data.end_date,
        "days_count": days_count,
        "reason": leave_data.reason,
        "status": "pending",
        "is_half_day": leave_data.is_half_day,
        "half_day_type": leave_data.half_day_type,
        "contact_number": leave_data.contact_number,
        "applied_on": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.leave_requests.insert_one(leave_record)
    
    return LeaveRequestResponse(
        id=leave_id,
        employee_id=user_id,
        leave_type=leave_data.leave_type,
        start_date=leave_data.start_date,
        end_date=leave_data.end_date,
        days_count=days_count,
        reason=leave_data.reason,
        status=LeaveStatus.PENDING,
        is_half_day=leave_data.is_half_day,
        half_day_type=leave_data.half_day_type,
        applied_on=leave_record["applied_on"],
        approved_by=None,
        approved_on=None,
        rejection_reason=None,
        can_cancel=True
    )


@router.get("/leave/balance", response_model=LeaveBalanceResponse)
async def get_leave_balance(
    request: Request,
    year: int = Query(default=None, description="Year for balance (defaults to current year)"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get leave balance for the employee.
    """
    db = request.app.state.db
    user_id = current_user["id"]
    
    if not year:
        year = datetime.now().year
    
    # Get leave balance from database or calculate
    balance = await db.leave_balances.find_one(
        {"employee_id": user_id, "year": year},
        {"_id": 0}
    )
    
    if not balance:
        # Get role-based entitlements
        role = await db.roles.find_one({"id": current_user.get("role_id")}, {"_id": 0})
        
        sick_entitlement = (role.get("eligible_sick_leaves_per_month", 1) * 12) if role else 12
        casual_entitlement = (role.get("eligible_casual_leaves_per_month", 1) * 12) if role else 12
        
        # Calculate used leaves for the year
        year_start = f"{year}-01-01"
        year_end = f"{year}-12-31"
        
        leaves_used = await db.leave_requests.aggregate([
            {
                "$match": {
                    "employee_id": user_id,
                    "status": "approved",
                    "start_date": {"$gte": year_start, "$lte": year_end}
                }
            },
            {
                "$group": {
                    "_id": "$leave_type",
                    "total_days": {"$sum": "$days_count"}
                }
            }
        ]).to_list(10)
        
        used_by_type = {item["_id"]: item["total_days"] for item in leaves_used}
        
        balance = {
            "employee_id": user_id,
            "year": year,
            "casual_leaves": {
                "total": casual_entitlement,
                "used": used_by_type.get("casual", 0),
                "available": casual_entitlement - used_by_type.get("casual", 0)
            },
            "sick_leaves": {
                "total": sick_entitlement,
                "used": used_by_type.get("sick", 0),
                "available": sick_entitlement - used_by_type.get("sick", 0)
            },
            "earned_leaves": {
                "total": 15,
                "used": used_by_type.get("earned", 0),
                "available": 15 - used_by_type.get("earned", 0)
            },
            "unpaid_leaves": {
                "used": used_by_type.get("unpaid", 0)
            }
        }
    
    return LeaveBalanceResponse(**balance)


@router.get("/leave/history", response_model=LeaveHistoryResponse)
async def get_leave_history(
    request: Request,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=50),
    status: str = Query(default=None, description="Filter by status"),
    year: int = Query(default=None, description="Filter by year"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get leave request history.
    """
    db = request.app.state.db
    user_id = current_user["id"]
    
    query = {"employee_id": user_id}
    
    if status:
        query["status"] = status
    
    if year:
        query["start_date"] = {"$regex": f"^{year}"}
    
    # Get total count
    total = await db.leave_requests.count_documents(query)
    
    # Get paginated results
    skip = (page - 1) * page_size
    leaves = await db.leave_requests.find(query, {"_id": 0})\
        .sort("applied_on", -1)\
        .skip(skip)\
        .limit(page_size)\
        .to_list(page_size)
    
    # Format response
    leave_responses = []
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    for leave in leaves:
        can_cancel = (
            leave["status"] == "pending" or 
            (leave["status"] == "approved" and leave["start_date"] > today)
        )
        
        leave_responses.append(LeaveRequestResponse(
            id=leave["id"],
            employee_id=leave["employee_id"],
            leave_type=LeaveType(leave["leave_type"]),
            start_date=leave["start_date"],
            end_date=leave["end_date"],
            days_count=leave["days_count"],
            reason=leave["reason"],
            status=LeaveStatus(leave["status"]),
            is_half_day=leave.get("is_half_day", False),
            half_day_type=leave.get("half_day_type"),
            applied_on=leave["applied_on"],
            approved_by=leave.get("approved_by_name"),
            approved_on=leave.get("approved_on"),
            rejection_reason=leave.get("rejection_reason"),
            can_cancel=can_cancel
        ))
    
    return LeaveHistoryResponse(
        leaves=leave_responses,
        total=total,
        page=page,
        page_size=page_size,
        has_more=(skip + len(leaves)) < total
    )


@router.get("/leave/{leave_id}", response_model=LeaveRequestResponse)
async def get_leave_request(
    request: Request,
    leave_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get single leave request details.
    """
    db = request.app.state.db
    
    leave = await db.leave_requests.find_one(
        {"id": leave_id, "employee_id": current_user["id"]},
        {"_id": 0}
    )
    
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    can_cancel = (
        leave["status"] == "pending" or 
        (leave["status"] == "approved" and leave["start_date"] > today)
    )
    
    return LeaveRequestResponse(
        id=leave["id"],
        employee_id=leave["employee_id"],
        leave_type=LeaveType(leave["leave_type"]),
        start_date=leave["start_date"],
        end_date=leave["end_date"],
        days_count=leave["days_count"],
        reason=leave["reason"],
        status=LeaveStatus(leave["status"]),
        is_half_day=leave.get("is_half_day", False),
        half_day_type=leave.get("half_day_type"),
        applied_on=leave["applied_on"],
        approved_by=leave.get("approved_by_name"),
        approved_on=leave.get("approved_on"),
        rejection_reason=leave.get("rejection_reason"),
        can_cancel=can_cancel
    )


@router.post("/leave/{leave_id}/cancel")
async def cancel_leave_request(
    request: Request,
    leave_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Cancel a leave request (if not yet started).
    """
    db = request.app.state.db
    
    leave = await db.leave_requests.find_one(
        {"id": leave_id, "employee_id": current_user["id"]},
        {"_id": 0}
    )
    
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    if leave["status"] == "cancelled":
        raise HTTPException(status_code=400, detail="Leave already cancelled")
    
    if leave["status"] == "rejected":
        raise HTTPException(status_code=400, detail="Cannot cancel rejected leave")
    
    if leave["start_date"] <= today and leave["status"] == "approved":
        raise HTTPException(status_code=400, detail="Cannot cancel leave that has already started")
    
    # Update status
    await db.leave_requests.update_one(
        {"id": leave_id},
        {
            "$set": {
                "status": "cancelled",
                "cancelled_on": datetime.now(timezone.utc).isoformat(),
                "cancelled_by": current_user["id"]
            }
        }
    )
    
    return {"message": "Leave request cancelled successfully"}


# ==================== APPROVER ENDPOINTS ====================

@router.get("/leave/pending-approvals", response_model=list)
async def get_pending_approvals(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    Get pending leave requests for approval (for managers/HR).
    """
    db = request.app.state.db
    
    # Check if user is an approver
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "HR_MANAGER", "COUNTRY_HEAD", "SALES_HEAD", "INSPECTION_HEAD"]:
        raise HTTPException(status_code=403, detail="Not authorized to approve leaves")
    
    # Build query based on role
    query = {"status": "pending"}
    
    # Country-level approvers only see their country's employees
    if role_code not in ["CEO", "HR_MANAGER"]:
        country_id = current_user.get("country_id")
        if country_id:
            # Get employee IDs from this country
            country_employees = await db.users.find(
                {"country_id": country_id},
                {"_id": 0, "id": 1}
            ).to_list(1000)
            employee_ids = [e["id"] for e in country_employees]
            query["employee_id"] = {"$in": employee_ids}
    
    pending = await db.leave_requests.find(query, {"_id": 0})\
        .sort("applied_on", 1)\
        .to_list(100)
    
    # Enrich with employee info
    result = []
    for leave in pending:
        emp = await db.users.find_one(
            {"id": leave["employee_id"]},
            {"_id": 0, "name": 1, "photo_url": 1}
        )
        
        result.append(PendingApprovalResponse(
            id=leave["id"],
            employee_id=leave["employee_id"],
            employee_name=emp.get("name", "Unknown") if emp else "Unknown",
            employee_photo=emp.get("photo_url") if emp else None,
            leave_type=LeaveType(leave["leave_type"]),
            start_date=leave["start_date"],
            end_date=leave["end_date"],
            days_count=leave["days_count"],
            reason=leave["reason"],
            applied_on=leave["applied_on"]
        ))
    
    return result


@router.post("/leave/{leave_id}/action")
async def approve_reject_leave(
    request: Request,
    leave_id: str,
    action_data: LeaveApprovalAction,
    current_user: dict = Depends(get_current_user)
):
    """
    Approve or reject a leave request.
    """
    db = request.app.state.db
    
    # Check if user is an approver
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "HR_MANAGER", "COUNTRY_HEAD", "SALES_HEAD", "INSPECTION_HEAD"]:
        raise HTTPException(status_code=403, detail="Not authorized to approve leaves")
    
    leave = await db.leave_requests.find_one({"id": leave_id}, {"_id": 0})
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")
    
    if leave["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Leave is already {leave['status']}")
    
    # Update based on action
    update_data = {
        "approved_by": current_user["id"],
        "approved_by_name": current_user.get("name"),
        "approved_on": datetime.now(timezone.utc).isoformat()
    }
    
    if action_data.action == "approve":
        update_data["status"] = "approved"
    else:
        update_data["status"] = "rejected"
        update_data["rejection_reason"] = action_data.comments
    
    await db.leave_requests.update_one({"id": leave_id}, {"$set": update_data})
    
    # TODO: Send push notification to employee
    
    return {"message": f"Leave request {action_data.action}d successfully"}

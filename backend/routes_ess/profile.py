"""Profile routes for ESS Mobile API"""
from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime, timezone

from models_ess.profile import (
    EmployeeProfile,
    EmployeeProfileUpdate,
    BankDetailsResponse,
    SalarySummary,
    AttendanceSummary
)
from routes_ess.auth import get_current_user

router = APIRouter()


def get_base_url_from_request(request: Request) -> str:
    """
    Extract base URL from the incoming request.
    Handles both direct requests and requests behind a proxy.
    """
    # Check for forwarded headers (when behind a proxy like nginx/cloudflare)
    forwarded_proto = request.headers.get("x-forwarded-proto", "https")
    forwarded_host = request.headers.get("x-forwarded-host") or request.headers.get("host")
    
    if forwarded_host:
        return f"{forwarded_proto}://{forwarded_host}"
    
    # Fallback to request's base URL
    return str(request.base_url).rstrip("/")


def make_url_absolute(url: str, base_url: str) -> str:
    """
    Convert a relative URL to absolute URL if needed.
    """
    if not url:
        return url
    
    # Already absolute
    if url.startswith("http://") or url.startswith("https://"):
        return url
    
    # Data URLs (base64 encoded) - leave as is
    if url.startswith("data:"):
        return url
    
    # Relative URL - make absolute
    if url.startswith("/"):
        return f"{base_url}{url}"
    
    return url


@router.get("/profile", response_model=EmployeeProfile)
async def get_profile(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    Get current employee profile.
    """
    db = request.app.state.db
    user_id = current_user["id"]
    
    # Get full user details
    user = await db.users.find_one(
        {"id": user_id},
        {"_id": 0, "hashed_password": 0, "bank_account_number_encrypted": 0}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    # Get role name
    role_name = None
    if user.get("role_id"):
        role = await db.roles.find_one({"id": user["role_id"]}, {"_id": 0, "name": 1})
        if role:
            role_name = role.get("name")
    
    # Get country name
    country_name = None
    if user.get("country_id"):
        country = await db.countries.find_one({"id": user["country_id"]}, {"_id": 0, "name": 1})
        if country:
            country_name = country.get("name")
    
    # Get department name
    department_name = None
    if user.get("department_id"):
        dept = await db.departments.find_one({"id": user["department_id"]}, {"_id": 0, "name": 1})
        if dept:
            department_name = dept.get("name")
    
    # Get team name
    team_name = None
    if user.get("team_id"):
        team = await db.teams.find_one({"id": user["team_id"]}, {"_id": 0, "name": 1})
        if team:
            team_name = team.get("name")
    
    # Get reporting manager name - support both field names
    reporting_manager_id = user.get("reporting_manager_id") or user.get("reports_to")
    manager_name = None
    if reporting_manager_id:
        manager = await db.users.find_one({"id": reporting_manager_id}, {"_id": 0, "name": 1})
        if manager:
            manager_name = manager.get("name")
    
    # Determine employment status
    employment_status = "active"
    if user.get("employment_status") == "exited":
        employment_status = "exited"
    else:
        # Check if on leave today
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        on_leave = await db.leave_requests.find_one({
            "employee_id": user_id,
            "status": "approved",
            "start_date": {"$lte": today},
            "end_date": {"$gte": today}
        })
        if on_leave:
            employment_status = "on_leave"
    
    # Handle multiple field name variations for joining date
    date_of_joining = user.get("date_of_joining") or user.get("joining_date")
    
    # Handle photo URL - support multiple field names and ensure absolute URL
    import os
    base_url = os.environ.get("API_BASE_URL", "")
    photo_url = user.get("photo_url") or user.get("profile_photo") or user.get("avatar_url")
    
    # If photo_url is a relative path, prepend base URL
    if photo_url and photo_url.startswith("/"):
        photo_url = f"{base_url}{photo_url}" if base_url else photo_url
    
    # Get location info
    location = user.get("location") or user.get("city")
    
    return EmployeeProfile(
        id=user["id"],
        employee_code=user.get("employee_code", ""),
        name=user.get("name", ""),
        email=user.get("email", ""),
        phone=user.get("phone"),
        photo_url=photo_url,
        department_name=department_name,
        role_name=role_name,
        country_name=country_name,
        team_name=team_name,
        location=location,
        date_of_joining=date_of_joining,
        join_date=date_of_joining,  # Alias for frontend compatibility
        employment_type=user.get("employment_type", "permanent"),
        employment_status=employment_status,
        reporting_manager_id=reporting_manager_id,
        reporting_manager_name=manager_name,
        date_of_birth=user.get("date_of_birth"),
        gender=user.get("gender"),
        blood_group=user.get("blood_group"),
        emergency_contact_name=user.get("emergency_contact_name"),
        emergency_contact_phone=user.get("emergency_contact_phone")
    )


@router.patch("/profile", response_model=EmployeeProfile)
async def update_profile(
    request: Request,
    update_data: EmployeeProfileUpdate,
    current_user: dict = Depends(get_current_user)
):
    """
    Update employee profile (limited fields).
    
    Employees can only update:
    - Phone number
    - Emergency contact
    - Blood group
    - Address
    """
    db = request.app.state.db
    user_id = current_user["id"]
    
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    
    if update_dict:
        update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.users.update_one({"id": user_id}, {"$set": update_dict})
    
    # Return updated profile
    return await get_profile(request, current_user)


@router.get("/profile/bank-details", response_model=BankDetailsResponse)
async def get_bank_details(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    Get employee bank details (masked).
    """
    db = request.app.state.db
    user_id = current_user["id"]
    
    # Get user with all bank-related fields
    user = await db.users.find_one(
        {"id": user_id},
        {"_id": 0}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    # Handle multiple field name variations for bank details
    bank_name = user.get("bank_name") or user.get("bank")
    
    # Account number - try masked first, then generate mask from full number
    account_number_masked = user.get("bank_account_number_masked")
    if not account_number_masked:
        # Try to mask from full account number if available
        full_account = user.get("bank_account_number") or user.get("account_number")
        if full_account:
            # Mask all but last 4 digits
            account_number_masked = "X" * (len(str(full_account)) - 4) + str(full_account)[-4:]
    
    ifsc_code = user.get("ifsc_code") or user.get("ifsc") or user.get("bank_ifsc")
    
    # Branch name - support multiple field names
    branch_name = user.get("branch_name") or user.get("bank_branch") or user.get("branch")
    
    account_holder_name = (
        user.get("bank_account_holder_name") or 
        user.get("account_holder_name") or 
        user.get("beneficiary_name") or
        user.get("name")  # Fall back to employee name
    )
    
    return BankDetailsResponse(
        bank_name=bank_name,
        account_number_masked=account_number_masked,
        account_number=account_number_masked,  # Alias for frontend compatibility
        ifsc_code=ifsc_code,
        account_holder_name=account_holder_name,
        branch_name=branch_name
    )


@router.get("/profile/salary", response_model=SalarySummary)
async def get_salary_summary(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    Get employee salary summary.
    """
    db = request.app.state.db
    user_id = current_user["id"]
    
    # Get salary structure
    salary = await db.salary_structures.find_one(
        {"user_id": user_id, "effective_to": None},
        {"_id": 0}
    )
    
    if not salary:
        raise HTTPException(status_code=404, detail="Salary structure not found")
    
    # Get currency info
    currency = "INR"
    currency_symbol = "₹"
    if current_user.get("country_id"):
        country = await db.countries.find_one(
            {"id": current_user["country_id"]},
            {"_id": 0, "currency": 1, "currency_symbol": 1}
        )
        if country:
            currency = country.get("currency", "INR")
            currency_symbol = country.get("currency_symbol", "₹")
    
    # Calculate earnings totals - support multiple field name variations
    basic = salary.get("basic_salary") or 0
    hra_val = salary.get("hra") or 0
    variable = salary.get("variable_pay") or salary.get("incentives") or 0
    conveyance = salary.get("conveyance_allowance") or salary.get("conveyance") or 0
    medical = salary.get("medical_allowance") or salary.get("medical") or 0
    special = salary.get("special_allowance") or 0
    
    # Calculate deductions totals
    pf = salary.get("pf_employee") or 0
    pt = salary.get("professional_tax") or 0
    tds = salary.get("income_tax") or salary.get("tds") or 0  # Support both field names
    other_ded = salary.get("other_deductions") or 0
    
    # Calculate gross and net if not stored
    gross = salary.get("gross_salary") or (basic + hra_val + variable + conveyance + medical + special)
    total_ded = pf + pt + tds + other_ded
    net = salary.get("net_salary") or (gross - total_ded)
    
    return SalarySummary(
        gross_salary=gross,
        net_salary=net,
        currency=currency,
        currency_symbol=currency_symbol,
        # Earnings (matching CRM structure)
        basic_salary=basic,
        hra=hra_val,
        variable_pay=variable,
        conveyance=conveyance,
        medical=medical,
        special_allowance=special,
        # Deductions (matching CRM structure)
        pf_employee=pf,
        professional_tax=pt,
        income_tax=tds,
        other_deductions=other_ded
    )


@router.get("/profile/attendance", response_model=AttendanceSummary)
async def get_attendance_summary(
    request: Request,
    month: int = None,
    year: int = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Get attendance summary for a month.
    """
    db = request.app.state.db
    user_id = current_user["id"]
    
    now = datetime.now(timezone.utc)
    if not month:
        month = now.month
    if not year:
        year = now.year
    
    # Get attendance records for the month
    month_str = f"{year}-{str(month).zfill(2)}"
    
    attendance = await db.employee_attendance.find(
        {"user_id": user_id, "date": {"$regex": f"^{month_str}"}},
        {"_id": 0}
    ).to_list(31)
    
    # Count by status
    present_days = 0
    absent_days = 0
    half_days = 0
    leave_days = 0
    overtime_days = 0
    
    for record in attendance:
        status = record.get("status", "").lower()
        if status in ["present", "working"]:
            present_days += 1
        elif status in ["absent", "lop"]:
            absent_days += 1
        elif status == "half_day":
            half_days += 1
        elif status in ["leave", "leave_approved"]:
            leave_days += 1
        elif status == "overtime":
            overtime_days += 1
            present_days += 1  # OT day is also a working day
    
    # Get working days for the month
    # This would ideally come from the organization's configuration
    import calendar
    _, days_in_month = calendar.monthrange(year, month)
    
    # Get holidays for the month
    holidays = await db.organization_holidays.count_documents({
        "date": {"$regex": f"^{month_str}"},
        "country_id": current_user.get("country_id")
    })
    
    working_days = days_in_month - holidays  # Simplified, should subtract weekends based on org settings
    
    month_names = ["", "January", "February", "March", "April", "May", "June",
                   "July", "August", "September", "October", "November", "December"]
    
    return AttendanceSummary(
        month=month_names[month],
        year=year,
        working_days=working_days,
        present_days=present_days,
        absent_days=absent_days,
        leaves_taken=leave_days,
        half_days=half_days,
        overtime_days=overtime_days
    )



@router.get("/holidays")
async def get_holidays(
    request: Request,
    year: int = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Get holidays for the user's country.
    """
    db = request.app.state.db
    country_id = current_user.get("country_id")
    
    now = datetime.now(timezone.utc)
    if not year:
        year = now.year
    
    # Build query
    query = {}
    if country_id:
        query["$or"] = [
            {"country_id": country_id},
            {"country_id": None},  # Global holidays
            {"country_id": "all"}
        ]
    
    # Filter by year
    query["date"] = {"$regex": f"^{year}"}
    
    # Try both holiday collections
    holidays = await db.holidays.find(query, {"_id": 0}).sort("date", 1).to_list(100)
    
    if not holidays:
        # Try organization_holidays collection
        holidays = await db.organization_holidays.find(query, {"_id": 0}).sort("date", 1).to_list(100)
    
    # Format holidays
    result = []
    for h in holidays:
        result.append({
            "id": h.get("id"),
            "name": h.get("name") or h.get("title"),
            "date": h.get("date"),
            "type": h.get("type", "public"),
            "description": h.get("description", ""),
            "is_optional": h.get("is_optional", False)
        })
    
    # Return just the array for mobile app compatibility
    return result

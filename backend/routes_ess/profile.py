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
from routes.auth import get_current_user

router = APIRouter()


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
    
    # Get reporting manager name
    manager_name = None
    if user.get("reporting_manager_id"):
        manager = await db.users.find_one({"id": user["reporting_manager_id"]}, {"_id": 0, "name": 1})
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
    
    return EmployeeProfile(
        id=user["id"],
        employee_code=user.get("employee_code", ""),
        name=user.get("name", ""),
        email=user.get("email", ""),
        phone=user.get("phone"),
        photo_url=user.get("photo_url"),
        department_name=department_name,
        role_name=role_name,
        country_name=country_name,
        team_name=team_name,
        date_of_joining=user.get("date_of_joining"),
        employment_type=user.get("employment_type", "permanent"),
        employment_status=employment_status,
        reporting_manager_id=user.get("reporting_manager_id"),
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
    
    user = await db.users.find_one(
        {"id": user_id},
        {"_id": 0, "bank_name": 1, "bank_account_number_masked": 1, "ifsc_code": 1, "bank_account_holder_name": 1}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    return BankDetailsResponse(
        bank_name=user.get("bank_name"),
        account_number_masked=user.get("bank_account_number_masked"),
        ifsc_code=user.get("ifsc_code"),
        account_holder_name=user.get("bank_account_holder_name")
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
    
    return SalarySummary(
        gross_salary=salary.get("gross_salary", 0),
        net_salary=salary.get("net_salary", 0),
        currency=currency,
        currency_symbol=currency_symbol,
        basic_salary=salary.get("basic_salary"),
        hra=salary.get("hra"),
        other_allowances=(
            (salary.get("conveyance_allowance") or 0) +
            (salary.get("medical_allowance") or 0) +
            (salary.get("special_allowance") or 0) +
            (salary.get("variable_pay") or 0)
        ),
        total_deductions=(
            (salary.get("pf_employee") or 0) +
            (salary.get("professional_tax") or 0) +
            (salary.get("tds") or 0) +
            (salary.get("esi") or 0) +
            (salary.get("other_deductions") or 0)
        )
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

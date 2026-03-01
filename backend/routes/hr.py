"""
HR Module Routes - Human Resources Management
Handles all HR-related endpoints including:
- Employee management (CRUD, salary, documents)
- Attendance tracking (sessions, heartbeats)
- Payroll management
- Leave management
- Holidays
- Countries management
"""
from fastapi import APIRouter, HTTPException, Depends, Request, UploadFile, File, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import FileResponse
from typing import Optional, List
from datetime import datetime, timezone
from pydantic import BaseModel
import uuid
import logging
import os

logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/hr", tags=["HR"])

# Security scheme
security = HTTPBearer()

# Dependencies - set via init_hr_routes
db = None
_auth_validator = None
attendance_service = None
payroll_service = None
leave_service = None
storage_service = None


# ==================== PYDANTIC MODELS ====================

class EmployeeCreate(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    role_id: str
    department_id: Optional[str] = None
    country_id: Optional[str] = None
    employee_code: Optional[str] = None
    joining_date: Optional[str] = None
    is_active: bool = True


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role_id: Optional[str] = None
    department_id: Optional[str] = None
    employee_code: Optional[str] = None
    joining_date: Optional[str] = None
    is_active: Optional[bool] = None
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    pan_number: Optional[str] = None


class SalaryStructure(BaseModel):
    basic_salary: float
    hra: float = 0
    conveyance_allowance: float = 0
    medical_allowance: float = 0
    special_allowance: float = 0
    variable_pay: float = 0
    pf_employee: float = 0
    pf_employer: float = 0
    professional_tax: float = 0
    income_tax: float = 0
    other_deductions: float = 0


class AttendanceOverride(BaseModel):
    login_time: Optional[str] = None
    logout_time: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class HolidayCreate(BaseModel):
    name: str
    date: str
    country_id: str
    is_optional: bool = False
    description: Optional[str] = None


class CountryCreate(BaseModel):
    name: str
    code: str
    currency: str = "INR"
    currency_symbol: str = "₹"
    timezone: str = "Asia/Kolkata"


class DocumentCreate(BaseModel):
    document_type: str
    document_name: str
    file_url: Optional[str] = None
    notes: Optional[str] = None


# ==================== INITIALIZATION ====================

def init_hr_routes(_db, _get_current_user, _attendance_service=None, _payroll_service=None, _leave_service=None, _storage_service=None):
    """Initialize HR routes with dependencies"""
    global db, _auth_validator, attendance_service, payroll_service, leave_service, storage_service
    db = _db
    _auth_validator = _get_current_user
    attendance_service = _attendance_service
    payroll_service = _payroll_service
    leave_service = _leave_service
    storage_service = _storage_service


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Authenticate user using the injected validator"""
    if _auth_validator is None:
        raise HTTPException(status_code=500, detail="Auth not initialized")
    return await _auth_validator(credentials)


# ==================== SESSION MANAGEMENT ====================

@router.post("/session/start")
async def start_session(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Start a session on login - called after successful authentication"""
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.replace("Bearer ", "") if auth_header.startswith("Bearer ") else ""
    
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("User-Agent")
    
    session = await attendance_service.create_session(
        user_id=current_user["id"],
        token=token,
        ip_address=ip_address,
        user_agent=user_agent
    )
    
    return session


@router.post("/session/heartbeat")
async def session_heartbeat(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Update session activity - client should call every 2 minutes"""
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.replace("Bearer ", "") if auth_header.startswith("Bearer ") else ""
    
    if await attendance_service.is_token_blacklisted(token):
        raise HTTPException(status_code=401, detail="Session expired due to inactivity")
    
    success = await attendance_service.update_heartbeat(current_user["id"], token)
    
    return {"success": success, "timestamp": datetime.now(timezone.utc).isoformat()}


@router.post("/session/end")
async def end_session(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """End session on logout"""
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.replace("Bearer ", "") if auth_header.startswith("Bearer ") else ""
    
    session = await attendance_service.end_session(
        user_id=current_user["id"],
        token=token,
        reason="manual"
    )
    
    return {"success": True, "session": session}


@router.get("/sessions/active")
async def get_active_sessions(
    country_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all active sessions - HR/CEO only"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER", "COUNTRY_HEAD"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if role_code == "COUNTRY_HEAD":
        country_id = current_user.get("country_id")
    
    sessions = await attendance_service.get_active_sessions(country_id)
    
    return sessions


@router.post("/sessions/{session_id}/force-logout")
async def force_logout_session(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Force logout a session - HR/CEO only"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER", "COUNTRY_HEAD"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    session = await db.sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    result = await attendance_service.end_session(
        user_id=session["user_id"],
        token=session.get("token", ""),
        reason="forced",
        forced_by=current_user["id"]
    )
    
    return {"success": True, "session": result}


# ==================== ATTENDANCE MANAGEMENT ====================

@router.get("/attendance")
async def get_attendance(
    country_id: Optional[str] = None,
    employee_id: Optional[str] = None,
    month: Optional[int] = None,
    year: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get attendance records"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER", "COUNTRY_HEAD", "FINANCE_MANAGER"]:
        employee_id = current_user["id"]
    
    if role_code == "COUNTRY_HEAD":
        country_id = current_user.get("country_id")
    
    if employee_id:
        records = await attendance_service.get_employee_attendance(employee_id, month, year)
    else:
        query = {}
        if country_id:
            query["country_id"] = country_id
        if month:
            query["month"] = month
        if year:
            query["year"] = year
        records = await db.attendance.find(query, {"_id": 0}).sort("date", -1).to_list(500)
    
    return records


@router.get("/attendance/summary/{employee_id}")
async def get_attendance_summary(
    employee_id: str,
    month: Optional[int] = None,
    year: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get attendance summary for an employee"""
    summary = await attendance_service.get_attendance_summary(employee_id, month, year)
    return summary


@router.get("/attendance/pending-approvals")
async def get_pending_approvals(
    country_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get attendance records pending approval"""
    records = await attendance_service.get_pending_approvals(country_id)
    return records


@router.post("/attendance/{record_id}/override")
async def override_attendance(
    record_id: str,
    data: AttendanceOverride,
    current_user: dict = Depends(get_current_user)
):
    """Override an attendance record - HR/CEO only"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER", "COUNTRY_HEAD"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    record = await attendance_service.override_attendance(
        record_id=record_id,
        login_time=data.login_time,
        logout_time=data.logout_time,
        status=data.status,
        notes=data.notes,
        overridden_by=current_user["id"]
    )
    
    return record


@router.post("/attendance/calculate-daily")
async def calculate_daily_attendance(
    date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Calculate attendance for a specific date (end of day processing)"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await attendance_service.calculate_daily_attendance(date)
    
    return result


@router.get("/attendance/calendar")
async def get_attendance_calendar(
    employee_id: str,
    month: int,
    year: int,
    current_user: dict = Depends(get_current_user)
):
    """Get calendar view of attendance for an employee"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER", "COUNTRY_HEAD", "FINANCE_MANAGER"]:
        if employee_id != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    records = await attendance_service.get_employee_attendance(employee_id, month, year)
    
    holidays = await db.holidays.find(
        {"$expr": {"$and": [
            {"$eq": [{"$month": {"$dateFromString": {"dateString": "$date"}}}, month]},
            {"$eq": [{"$year": {"$dateFromString": {"dateString": "$date"}}}, year]}
        ]}},
        {"_id": 0}
    ).to_list(50)
    
    return {
        "records": records,
        "holidays": holidays,
        "month": month,
        "year": year
    }


# ==================== HOLIDAYS ====================

@router.get("/holidays")
async def get_holidays(
    country_id: Optional[str] = None,
    year: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get holidays list"""
    query = {}
    if country_id:
        query["country_id"] = country_id
    if year:
        query["$expr"] = {"$eq": [{"$year": {"$dateFromString": {"dateString": "$date"}}}, year]}
    
    holidays = await db.holidays.find(query, {"_id": 0}).sort("date", 1).to_list(100)
    return holidays


@router.post("/holidays")
async def create_holiday(
    data: HolidayCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new holiday"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    holiday = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "date": data.date,
        "country_id": data.country_id,
        "is_optional": data.is_optional,
        "description": data.description,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"]
    }
    
    await db.holidays.insert_one(holiday)
    holiday.pop("_id", None)
    return holiday


@router.put("/holidays/{holiday_id}")
async def update_holiday(
    holiday_id: str,
    data: HolidayCreate,
    current_user: dict = Depends(get_current_user)
):
    """Update a holiday"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = data.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.holidays.update_one({"id": holiday_id}, {"$set": update_data})
    holiday = await db.holidays.find_one({"id": holiday_id}, {"_id": 0})
    return holiday


@router.delete("/holidays/{holiday_id}")
async def delete_holiday(
    holiday_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a holiday"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.holidays.delete_one({"id": holiday_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Holiday not found")
    
    return {"message": "Holiday deleted"}


# ==================== COUNTRIES ====================

@router.get("/countries")
async def get_countries(current_user: dict = Depends(get_current_user)):
    """Get countries list (active only)"""
    countries = await db.countries.find({"is_active": True}, {"_id": 0}).to_list(50)
    return countries


@router.get("/countries/all")
async def get_all_countries(current_user: dict = Depends(get_current_user)):
    """Get all countries including inactive"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    countries = await db.countries.find({}, {"_id": 0}).to_list(50)
    return countries


@router.post("/countries")
async def create_country(
    data: CountryCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new country"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    country = {
        "id": str(uuid.uuid4()),
        **data.model_dump(),
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"]
    }
    
    await db.countries.insert_one(country)
    country.pop("_id", None)
    return country


@router.put("/countries/{country_id}")
async def update_country(
    country_id: str,
    data: CountryCreate,
    current_user: dict = Depends(get_current_user)
):
    """Update a country"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = data.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.countries.update_one({"id": country_id}, {"$set": update_data})
    country = await db.countries.find_one({"id": country_id}, {"_id": 0})
    return country


@router.delete("/countries/{country_id}")
async def delete_country(
    country_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Soft delete a country"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.countries.update_one(
        {"id": country_id},
        {"$set": {"is_active": False, "deleted_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Country deactivated"}


# ==================== EMPLOYEE MANAGEMENT ====================

@router.get("/employees/on-leave-today")
async def get_employees_on_leave_today(
    country_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get employees on leave today"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    query = {
        "start_date": {"$lte": today},
        "end_date": {"$gte": today},
        "status": "approved"
    }
    
    if country_id:
        query["country_id"] = country_id
    
    leaves = await db.leaves.find(query, {"_id": 0}).to_list(100)
    
    employee_ids = [l["employee_id"] for l in leaves]
    employees = await db.users.find(
        {"id": {"$in": employee_ids}},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "role_id": 1}
    ).to_list(100)
    
    employee_map = {e["id"]: e for e in employees}
    
    result = []
    for leave in leaves:
        emp = employee_map.get(leave["employee_id"], {})
        result.append({
            "employee_id": leave["employee_id"],
            "employee_name": emp.get("name", "Unknown"),
            "leave_type": leave.get("leave_type"),
            "start_date": leave.get("start_date"),
            "end_date": leave.get("end_date"),
            "reason": leave.get("reason")
        })
    
    return result


@router.get("/dashboard-stats")
async def get_hr_dashboard_stats(
    country_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get HR dashboard statistics"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER", "COUNTRY_HEAD"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if role_code == "COUNTRY_HEAD":
        country_id = current_user.get("country_id")
    
    query = {}
    if country_id:
        query["country_id"] = country_id
    
    total_employees = await db.users.count_documents({**query, "is_active": True})
    active_sessions = await db.sessions.count_documents({**query, "is_active": True})
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    leaves_today = await db.leaves.count_documents({
        **query,
        "start_date": {"$lte": today},
        "end_date": {"$gte": today},
        "status": "approved"
    })
    
    pending_leaves = await db.leaves.count_documents({**query, "status": "pending"})
    
    return {
        "total_employees": total_employees,
        "active_sessions": active_sessions,
        "employees_on_leave_today": leaves_today,
        "pending_leave_requests": pending_leaves
    }


@router.get("/employees")
async def get_employees(
    country_id: Optional[str] = None,
    role_id: Optional[str] = None,
    department_id: Optional[str] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all employees"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER", "COUNTRY_HEAD", "FINANCE_MANAGER", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if role_code == "COUNTRY_HEAD":
        country_id = current_user.get("country_id")
    
    query = {}
    if country_id:
        query["country_id"] = country_id
    if role_id:
        query["role_id"] = role_id
    if department_id:
        query["department_id"] = department_id
    if is_active is not None:
        query["is_active"] = is_active
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"employee_code": {"$regex": search, "$options": "i"}}
        ]
    
    employees = await db.users.find(
        query,
        {"_id": 0, "hashed_password": 0}
    ).sort("name", 1).to_list(500)
    
    # Enrich with role and department names
    role_ids = list(set(e.get("role_id") for e in employees if e.get("role_id")))
    dept_ids = list(set(e.get("department_id") for e in employees if e.get("department_id")))
    
    roles = await db.roles.find({"id": {"$in": role_ids}}, {"_id": 0}).to_list(50)
    role_map = {r["id"]: r.get("name") for r in roles}
    
    depts = await db.departments.find({"id": {"$in": dept_ids}}, {"_id": 0}).to_list(50)
    dept_map = {d["id"]: d.get("name") for d in depts}
    
    for emp in employees:
        emp["role_name"] = role_map.get(emp.get("role_id"), "Unknown")
        emp["department_name"] = dept_map.get(emp.get("department_id"), "N/A")
    
    return employees


@router.get("/employees/{employee_id}")
async def get_employee(
    employee_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific employee"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER", "COUNTRY_HEAD", "FINANCE_MANAGER", "ADMIN"]:
        if employee_id != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    employee = await db.users.find_one(
        {"id": employee_id},
        {"_id": 0, "hashed_password": 0}
    )
    
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Get role info
    if employee.get("role_id"):
        role = await db.roles.find_one({"id": employee["role_id"]}, {"_id": 0})
        employee["role"] = role
    
    # Get department info
    if employee.get("department_id"):
        dept = await db.departments.find_one({"id": employee["department_id"]}, {"_id": 0})
        employee["department"] = dept
    
    return employee


@router.post("/employees")
async def create_employee(
    data: EmployeeCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new employee"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check if email already exists
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    employee = {
        "id": str(uuid.uuid4()),
        **data.model_dump(),
        "hashed_password": pwd_context.hash("changeme123"),
        "must_change_password": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"]
    }
    
    await db.users.insert_one(employee)
    employee.pop("_id", None)
    employee.pop("hashed_password", None)
    
    return employee


@router.put("/employees/{employee_id}")
async def update_employee(
    employee_id: str,
    data: EmployeeUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update an employee"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER", "COUNTRY_HEAD"]:
        if employee_id != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    existing = await db.users.find_one({"id": employee_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = current_user["id"]
    
    await db.users.update_one({"id": employee_id}, {"$set": update_data})
    
    employee = await db.users.find_one({"id": employee_id}, {"_id": 0, "hashed_password": 0})
    return employee


@router.delete("/employees/{employee_id}")
async def delete_employee(
    employee_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Soft delete an employee"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.users.update_one(
        {"id": employee_id},
        {"$set": {
            "is_active": False,
            "deleted_at": datetime.now(timezone.utc).isoformat(),
            "deleted_by": current_user["id"]
        }}
    )
    
    return {"message": "Employee deactivated"}


@router.post("/employees/{employee_id}/reset-password")
async def reset_employee_password(
    employee_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Reset employee password to default"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    await db.users.update_one(
        {"id": employee_id},
        {"$set": {
            "hashed_password": pwd_context.hash("changeme123"),
            "must_change_password": True,
            "password_reset_at": datetime.now(timezone.utc).isoformat(),
            "password_reset_by": current_user["id"]
        }}
    )
    
    return {"message": "Password reset to default (changeme123)"}


# ==================== SALARY MANAGEMENT ====================

@router.get("/employees/{employee_id}/salary")
async def get_employee_salary(
    employee_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get employee salary structure"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER", "FINANCE_MANAGER"]:
        if employee_id != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    salary = await db.salary_structures.find_one(
        {"user_id": employee_id, "effective_to": None},
        {"_id": 0}
    )
    
    return salary or {}


@router.post("/employees/{employee_id}/salary")
async def set_employee_salary(
    employee_id: str,
    data: SalaryStructure,
    current_user: dict = Depends(get_current_user)
):
    """Set employee salary structure"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER", "FINANCE_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # End current salary structure
    await db.salary_structures.update_many(
        {"user_id": employee_id, "effective_to": None},
        {"$set": {"effective_to": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Create new salary structure
    salary_struct = {
        "id": str(uuid.uuid4()),
        "user_id": employee_id,
        **data.model_dump(),
        "gross_salary": sum([
            data.basic_salary,
            data.hra,
            data.conveyance_allowance,
            data.medical_allowance,
            data.special_allowance,
            data.variable_pay
        ]),
        "total_deductions": sum([
            data.pf_employee,
            data.professional_tax,
            data.income_tax,
            data.other_deductions
        ]),
        "effective_from": datetime.now(timezone.utc).isoformat(),
        "effective_to": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"]
    }
    
    salary_struct["net_salary"] = salary_struct["gross_salary"] - salary_struct["total_deductions"]
    
    await db.salary_structures.insert_one(salary_struct)
    salary_struct.pop("_id", None)
    
    return salary_struct


# ==================== EMPLOYEE ATTENDANCE ====================

@router.get("/employees/{employee_id}/attendance")
async def get_employee_attendance(
    employee_id: str,
    month: Optional[int] = None,
    year: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get attendance records for an employee"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER", "COUNTRY_HEAD", "FINANCE_MANAGER"]:
        if employee_id != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    records = await attendance_service.get_employee_attendance(employee_id, month, year)
    return records


@router.post("/employees/{employee_id}/attendance")
async def add_employee_attendance(
    employee_id: str,
    data: AttendanceOverride,
    current_user: dict = Depends(get_current_user)
):
    """Manually add attendance record"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER", "COUNTRY_HEAD"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    record = {
        "id": str(uuid.uuid4()),
        "user_id": employee_id,
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "login_time": data.login_time,
        "logout_time": data.logout_time,
        "status": data.status or "present",
        "notes": data.notes,
        "is_manual": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"]
    }
    
    await db.attendance.insert_one(record)
    record.pop("_id", None)
    
    return record


# ==================== EMPLOYEE DOCUMENTS ====================

@router.get("/employees/{employee_id}/documents")
async def get_employee_documents(
    employee_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get employee documents"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER", "COUNTRY_HEAD"]:
        if employee_id != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    documents = await db.employee_documents.find(
        {"employee_id": employee_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return documents


@router.post("/employees/{employee_id}/documents")
async def create_employee_document(
    employee_id: str,
    data: DocumentCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new document record"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER", "COUNTRY_HEAD"]:
        if employee_id != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    document = {
        "id": str(uuid.uuid4()),
        "employee_id": employee_id,
        **data.model_dump(),
        "status": "pending_verification",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"]
    }
    
    await db.employee_documents.insert_one(document)
    document.pop("_id", None)
    
    return document


@router.put("/employees/{employee_id}/documents/{document_id}")
async def update_employee_document(
    employee_id: str,
    document_id: str,
    data: DocumentCreate,
    current_user: dict = Depends(get_current_user)
):
    """Update a document"""
    update_data = data.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.employee_documents.update_one(
        {"id": document_id, "employee_id": employee_id},
        {"$set": update_data}
    )
    
    document = await db.employee_documents.find_one(
        {"id": document_id},
        {"_id": 0}
    )
    
    return document


@router.put("/employees/{employee_id}/documents/{document_id}/verify")
async def verify_employee_document(
    employee_id: str,
    document_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Verify a document - HR only"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.employee_documents.update_one(
        {"id": document_id, "employee_id": employee_id},
        {"$set": {
            "status": "verified",
            "verified_at": datetime.now(timezone.utc).isoformat(),
            "verified_by": current_user["id"]
        }}
    )
    
    return {"message": "Document verified"}


@router.delete("/employees/{employee_id}/documents/{document_id}")
async def delete_employee_document(
    employee_id: str,
    document_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a document"""
    result = await db.employee_documents.delete_one(
        {"id": document_id, "employee_id": employee_id}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return {"message": "Document deleted"}


# ==================== EMPLOYEE AUDIT / MISC ====================

@router.get("/employees/{employee_id}/audit")
async def get_employee_audit(
    employee_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get audit trail for an employee"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    audits = await db.audit_logs.find(
        {"entity_type": "user", "entity_id": employee_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return audits


@router.get("/employees/{employee_id}/salary-payments")
async def get_employee_salary_payments(
    employee_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get salary payment history for an employee"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER", "FINANCE_MANAGER"]:
        if employee_id != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    payments = await db.finance_payments.find(
        {"employee_id": employee_id, "payment_type": "salary"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return payments


@router.post("/employees/{employee_id}/salary-payments")
async def create_salary_payment(
    employee_id: str,
    month: int,
    year: int,
    current_user: dict = Depends(get_current_user)
):
    """Create salary payment record"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER", "FINANCE_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get current salary structure
    salary = await db.salary_structures.find_one(
        {"user_id": employee_id, "effective_to": None},
        {"_id": 0}
    )
    
    if not salary:
        raise HTTPException(status_code=400, detail="No salary structure found")
    
    payment = {
        "id": str(uuid.uuid4()),
        "employee_id": employee_id,
        "payment_type": "salary",
        "month": month,
        "year": year,
        "gross_amount": salary.get("gross_salary", 0),
        "deductions": salary.get("total_deductions", 0),
        "net_amount": salary.get("net_salary", 0),
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"]
    }
    
    await db.finance_payments.insert_one(payment)
    payment.pop("_id", None)
    
    return payment


@router.get("/employees/{employee_id}/leave-summary")
async def get_employee_leave_summary(
    employee_id: str,
    year: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get leave summary for an employee"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER", "COUNTRY_HEAD"]:
        if employee_id != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    if not year:
        year = datetime.now().year
    
    # Get leave balance
    balance = await db.leave_balances.find_one(
        {"employee_id": employee_id, "year": year},
        {"_id": 0}
    )
    
    # Get approved leaves for the year
    leaves = await db.leaves.find(
        {
            "employee_id": employee_id,
            "status": "approved",
            "$expr": {"$eq": [{"$year": {"$dateFromString": {"dateString": "$start_date"}}}, year]}
        },
        {"_id": 0}
    ).to_list(100)
    
    # Calculate used leaves by type
    used_by_type = {}
    for leave in leaves:
        leave_type = leave.get("leave_type", "other")
        days = leave.get("days", 1)
        used_by_type[leave_type] = used_by_type.get(leave_type, 0) + days
    
    return {
        "year": year,
        "balance": balance,
        "used_by_type": used_by_type,
        "total_used": sum(used_by_type.values()),
        "leaves": leaves
    }


@router.patch("/employees/{employee_id}/lead-assignment")
async def update_employee_lead_assignment(
    employee_id: str,
    can_receive_leads: bool,
    current_user: dict = Depends(get_current_user)
):
    """Update employee lead assignment setting"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER", "COUNTRY_HEAD"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.users.update_one(
        {"id": employee_id},
        {"$set": {
            "can_receive_leads": can_receive_leads,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Lead assignment updated"}


@router.patch("/employees/{employee_id}/weekly-off")
async def update_employee_weekly_off(
    employee_id: str,
    weekly_off_day: int,
    current_user: dict = Depends(get_current_user)
):
    """Update employee weekly off day (0=Sunday, 6=Saturday)"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if weekly_off_day < 0 or weekly_off_day > 6:
        raise HTTPException(status_code=400, detail="Invalid day (0-6)")
    
    await db.users.update_one(
        {"id": employee_id},
        {"$set": {
            "weekly_off_day": weekly_off_day,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Weekly off updated"}


# ==================== ASSIGNED CITIES ====================

@router.put("/employees/{employee_id}/assigned-cities")
async def update_assigned_cities(
    employee_id: str,
    cities: List[str],
    current_user: dict = Depends(get_current_user)
):
    """Update assigned cities for an employee"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER", "COUNTRY_HEAD"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.users.update_one(
        {"id": employee_id},
        {"$set": {
            "assigned_cities": cities,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"cities": cities}


@router.get("/employees/{employee_id}/assigned-cities")
async def get_assigned_cities(
    employee_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get assigned cities for an employee"""
    employee = await db.users.find_one(
        {"id": employee_id},
        {"_id": 0, "assigned_cities": 1}
    )
    
    return {"cities": employee.get("assigned_cities", []) if employee else []}


@router.put("/employees/{employee_id}/inspection-cities")
async def update_inspection_cities(
    employee_id: str,
    cities: List[str],
    current_user: dict = Depends(get_current_user)
):
    """Update inspection cities for a mechanic"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER", "COUNTRY_HEAD", "INSPECTION_COORDINATOR"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.users.update_one(
        {"id": employee_id},
        {"$set": {
            "inspection_cities": cities,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"cities": cities}


@router.get("/employees/{employee_id}/inspection-cities")
async def get_inspection_cities(
    employee_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get inspection cities for a mechanic"""
    employee = await db.users.find_one(
        {"id": employee_id},
        {"_id": 0, "inspection_cities": 1}
    )
    
    return {"cities": employee.get("inspection_cities", []) if employee else []}

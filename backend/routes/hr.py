"""
HR Module Routes - Human Resources Management
Handles all HR-related endpoints including:
- Employee management (CRUD, salary, documents)
- Attendance tracking (sessions, heartbeats)
- Payroll management (generation, batches, payslips)
- Leave management (requests, approvals, balances)
- Holidays
- Countries management
"""
from fastapi import APIRouter, HTTPException, Depends, Request, UploadFile, File, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import FileResponse
from typing import Optional, List
from datetime import datetime, timezone
from pydantic import BaseModel, Field
import uuid
import logging
import os

# Import payroll and leave models
from models.payroll import (
    PayrollRecordCreate, PayrollBulkGenerateRequest, PaymentMarkRequest,
    PayrollAdjustmentCreate, BulkPaymentMarkRequest,
    PayrollPreviewRequest, PayrollRecordUpdate, BatchRecordsUpdateRequest,
    BatchConfirmRequest, BatchMarkPaidRequest, PayrollBatchCreate
)
from models.leave import (
    LeaveRequestCreate, LeaveApprovalRequest, LeaveBalanceCreate
)

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
audit_service = None


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

def init_hr_routes(_db, _get_current_user, _attendance_service=None, _payroll_service=None, _leave_service=None, _storage_service=None, _audit_service=None):
    """Initialize HR routes with dependencies"""
    global db, _auth_validator, attendance_service, payroll_service, leave_service, storage_service, audit_service
    db = _db
    _auth_validator = _get_current_user
    attendance_service = _attendance_service
    payroll_service = _payroll_service
    leave_service = _leave_service
    storage_service = _storage_service
    audit_service = _audit_service


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
    
    employee_ids = [leave_record["employee_id"] for leave_record in leaves]
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


class LeadAssignmentRequest(BaseModel):
    """Request model for updating lead assignment"""
    is_available_for_leads: Optional[bool] = None
    can_receive_leads: Optional[bool] = None  # Alias
    assigned_cities: Optional[List[str]] = None


@router.patch("/employees/{employee_id}/lead-assignment")
async def update_employee_lead_assignment(
    employee_id: str,
    request: LeadAssignmentRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update employee lead assignment setting and assigned cities"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER", "COUNTRY_HEAD"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    # Handle both field names (is_available_for_leads and can_receive_leads)
    if request.is_available_for_leads is not None:
        update_data["can_receive_leads"] = request.is_available_for_leads
    if request.can_receive_leads is not None:
        update_data["can_receive_leads"] = request.can_receive_leads
    
    # Update assigned cities if provided
    if request.assigned_cities is not None:
        update_data["assigned_cities"] = request.assigned_cities
    
    await db.users.update_one(
        {"id": employee_id},
        {"$set": update_data}
    )
    
    return {"message": "Lead assignment updated", "updated": update_data}


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

class AssignedCitiesRequest(BaseModel):
    """Request model for updating assigned cities"""
    cities: List[str]

@router.put("/employees/{employee_id}/assigned-cities")
async def update_assigned_cities(
    employee_id: str,
    request: AssignedCitiesRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update assigned cities for an employee"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER", "COUNTRY_HEAD"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.users.update_one(
        {"id": employee_id},
        {"$set": {
            "assigned_cities": request.cities,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"cities": request.cities}


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


class InspectionCitiesRequest(BaseModel):
    """Request model for updating inspection cities"""
    cities: List[str]

@router.put("/employees/{employee_id}/inspection-cities")
async def update_inspection_cities(
    employee_id: str,
    request: InspectionCitiesRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update inspection cities for a mechanic"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER", "COUNTRY_HEAD", "INSPECTION_COORDINATOR"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.users.update_one(
        {"id": employee_id},
        {"$set": {
            "inspection_cities": request.cities,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"cities": request.cities}


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


# ==================== LEAVE RULES ====================

class LeaveRulesUpdate(BaseModel):
    period: str = Field(default="monthly", description="Leave accrual period")
    sick_leaves_per_period: int = Field(default=2, ge=0, le=10)
    casual_leaves_per_period: int = Field(default=1, ge=0, le=10)


@router.get("/leave-rules")
async def get_leave_rules(current_user: dict = Depends(get_current_user)):
    """Get leave rules configuration"""
    rules = await db.leave_rules.find_one({}, {"_id": 0})
    
    if not rules:
        # Return defaults
        return {
            "period": "monthly",
            "sick_leaves_per_period": 2,
            "casual_leaves_per_period": 1
        }
    return rules


@router.put("/leave-rules")
async def update_leave_rules(
    rules_data: LeaveRulesUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update leave rules - HR/CEO only"""
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized to update leave rules")
    
    rules_dict = {
        "period": rules_data.period,
        "sick_leaves_per_period": rules_data.sick_leaves_per_period,
        "casual_leaves_per_period": rules_data.casual_leaves_per_period,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user["id"]
    }
    
    await db.leave_rules.update_one(
        {},
        {"$set": rules_dict},
        upsert=True
    )
    
    return rules_dict


# ==================== PAYROLL MANAGEMENT ====================

@router.post("/payroll/generate")
async def generate_payroll(
    data: PayrollRecordCreate,
    current_user: dict = Depends(get_current_user)
):
    """Generate payroll for a single employee - HR only"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    try:
        payroll = await payroll_service.generate_payroll(
            employee_id=data.employee_id,
            month=data.month,
            year=data.year,
            generated_by=current_user["id"],
            generated_by_name=current_user.get("name", "")
        )
        
        return payroll
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/payroll/generate-bulk")
async def generate_bulk_payroll(
    data: PayrollBulkGenerateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Generate payroll for multiple employees - HR only"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await payroll_service.bulk_generate_payroll(
        month=data.month,
        year=data.year,
        generated_by=current_user["id"],
        generated_by_name=current_user.get("name", ""),
        employee_ids=data.employee_ids,
        country_id=data.country_id
    )
    
    return result


@router.get("/payroll")
async def get_payroll_records(
    month: Optional[int] = None,
    year: Optional[int] = None,
    employee_id: Optional[str] = None,
    payment_status: Optional[str] = None,
    country_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get payroll records - filtered by RBAC"""
    role_code = current_user.get("role_code", "")
    
    # RBAC check
    if role_code not in ["CEO", "HR_MANAGER", "FINANCE_MANAGER", "COUNTRY_HEAD"]:
        # Regular employees can only see their own
        employee_id = current_user["id"]
    elif role_code in ["COUNTRY_HEAD", "FINANCE_MANAGER"]:
        country_id = current_user.get("country_id")
    
    if employee_id:
        records = await payroll_service.get_employee_payroll_history(employee_id, year)
    elif month and year:
        records = await payroll_service.get_monthly_payroll(month, year, country_id, payment_status)
    else:
        # Default to current month
        now = datetime.now(timezone.utc)
        records = await payroll_service.get_monthly_payroll(now.month, now.year, country_id, payment_status)
    
    return records


# ==================== PAYROLL BATCH GOVERNANCE ====================

@router.get("/payroll/batches")
async def get_payroll_batches(
    country_id: Optional[str] = None,
    batch_status: Optional[str] = None,
    year: Optional[int] = None,
    month: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get payroll batches - HR/Finance"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER", "FINANCE_MANAGER", "COUNTRY_HEAD"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    batches = await payroll_service.get_batches(country_id, batch_status, year, month)
    return batches


@router.get("/payroll/batch/{batch_id}")
async def get_payroll_batch(
    batch_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a single batch with records"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER", "FINANCE_MANAGER", "COUNTRY_HEAD"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    batch = await payroll_service.get_batch(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    records = await payroll_service.get_batch_records(batch_id)
    
    return {
        "batch": batch,
        "records": records
    }


@router.get("/payroll/{payroll_id}")
async def get_payroll_by_id(
    payroll_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get single payroll record"""
    payroll = await payroll_service.get_payroll_by_id(payroll_id)
    
    if not payroll:
        raise HTTPException(status_code=404, detail="Payroll not found")
    
    role_code = current_user.get("role_code", "")
    
    # RBAC check - employees can only see their own
    if role_code not in ["CEO", "HR_MANAGER", "FINANCE_MANAGER", "COUNTRY_HEAD"]:
        if payroll["employee_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    return payroll


@router.get("/payroll/summary/{month}/{year}")
async def get_payroll_summary(
    month: int,
    year: int,
    country_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get monthly payroll summary"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER", "FINANCE_MANAGER", "COUNTRY_HEAD"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if role_code in ["COUNTRY_HEAD", "FINANCE_MANAGER"]:
        country_id = current_user.get("country_id")
    
    summary = await payroll_service.get_payroll_summary(month, year, country_id)
    
    return summary


@router.get("/payroll/employee/{employee_id}/payslips")
async def get_employee_payslips(
    employee_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all payslips for an employee (for employee modal)
    
    Returns list of confirmed payroll records with payslip info.
    """
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER", "FINANCE_MANAGER", "COUNTRY_HEAD"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get all payroll records for the employee that have been confirmed or paid
    payslips = await db.payroll_records.find(
        {
            "employee_id": employee_id,
            "status": {"$in": ["CONFIRMED", "PAID", "GENERATED"]}
        },
        {"_id": 0}
    ).sort([("year", -1), ("month", -1)]).to_list(100)
    
    # Format for frontend
    formatted = []
    for p in payslips:
        formatted.append({
            "id": p.get("id"),
            "month": p.get("month"),
            "year": p.get("year"),
            "gross_salary": p.get("gross_salary", 0),
            "total_deductions": (p.get("total_statutory_deductions", 0) + 
                               p.get("attendance_deduction", 0) + 
                               p.get("other_deductions", 0)),
            "net_salary": p.get("net_salary", 0),
            "currency_symbol": p.get("currency_symbol", "₹"),
            "payment_status": p.get("payment_status", "GENERATED"),
            "generated_at": p.get("generated_at"),
            "batch_id": p.get("batch_id")
        })
    
    return formatted


@router.post("/payroll/{payroll_id}/mark-paid")
async def mark_payroll_paid(
    payroll_id: str,
    data: PaymentMarkRequest,
    current_user: dict = Depends(get_current_user)
):
    """Mark payroll as paid - Finance Manager only"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "FINANCE_MANAGER"]:
        raise HTTPException(status_code=403, detail="Only Finance Manager can mark payments")
    
    try:
        payroll = await payroll_service.mark_as_paid(
            payroll_id=payroll_id,
            transaction_reference=data.transaction_reference,
            payment_date=data.payment_date,
            payment_mode=data.payment_mode,
            paid_by=current_user["id"],
            paid_by_name=current_user.get("name", ""),
            notes=data.notes
        )
        
        return payroll
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/payroll/{payroll_id}/adjustment")
async def create_payroll_adjustment(
    payroll_id: str,
    data: PayrollAdjustmentCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create payroll adjustment - HR/Finance only"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER", "FINANCE_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    try:
        adjustment = await payroll_service.create_adjustment(
            payroll_id=payroll_id,
            adjustment_type=data.adjustment_type,
            amount=data.amount,
            reason=data.reason,
            created_by=current_user["id"],
            created_by_name=current_user.get("name", ""),
            notes=data.notes
        )
        
        return adjustment
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/payroll/{payroll_id}/adjustments")
async def get_payroll_adjustments(
    payroll_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get adjustments for a payroll record"""
    adjustments = await payroll_service.get_adjustments(payroll_id)
    
    return adjustments


# ==================== PAYSLIP GENERATION ====================

@router.post("/payroll/{payroll_id}/generate-payslip")
async def generate_hr_payslip(
    payroll_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Generate PDF payslip - HR/Finance only"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER", "FINANCE_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    try:
        result = await payroll_service.generate_payslip(payroll_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Payslip generation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate payslip")


@router.get("/payroll/{payroll_id}/payslip")
async def download_payslip(
    payroll_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get payslip download URL"""
    payroll = await payroll_service.get_payroll_by_id(payroll_id)
    
    if not payroll:
        raise HTTPException(status_code=404, detail="Payroll not found")
    
    role_code = current_user.get("role_code", "")
    
    # RBAC check - employees can only see their own
    if role_code not in ["CEO", "HR_MANAGER", "FINANCE_MANAGER", "COUNTRY_HEAD"]:
        if payroll["employee_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    if not payroll.get("payslip_path"):
        raise HTTPException(status_code=404, detail="Payslip not generated yet")
    
    # Get download URL
    download_url = await storage_service.get_download_url(payroll["payslip_path"])
    
    return {
        "payroll_id": payroll_id,
        "employee_name": payroll.get("employee_name"),
        "month": payroll.get("month"),
        "year": payroll.get("year"),
        "download_url": download_url
    }


# ==================== PAYROLL BATCH OPERATIONS ====================

@router.post("/payroll/preview")
async def preview_payroll(
    data: PayrollPreviewRequest,
    current_user: dict = Depends(get_current_user)
):
    """Preview payroll for a month/year/country - HR only (no DB save)"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Only HR can preview payroll")
    
    try:
        preview = await payroll_service.preview_payroll(
            month=data.month,
            year=data.year,
            country_id=data.country_id,
            user_id=current_user["id"]
        )
        return preview
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/payroll/batch")
async def create_payroll_batch(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Create a DRAFT payroll batch with records - HR only"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Only HR can create payroll batches")
    
    try:
        batch = await payroll_service.create_batch(
            month=data.get("month"),
            year=data.get("year"),
            country_id=data.get("country_id"),
            records=data.get("records", []),
            created_by=current_user["id"],
            created_by_name=current_user.get("name", "")
        )
        return batch
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/payroll/batch/{batch_id}/record/{record_id}")
async def update_batch_record(
    batch_id: str,
    record_id: str,
    data: PayrollRecordUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a record in a DRAFT batch - HR only"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Only HR can edit payroll records")
    
    try:
        record = await payroll_service.update_batch_record(
            batch_id=batch_id,
            record_id=record_id,
            updates=data.model_dump(exclude_none=True),
            updated_by=current_user["id"],
            updated_by_name=current_user.get("name", "")
        )
        return record
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/payroll/batch/{batch_id}/confirm")
async def confirm_payroll_batch(
    batch_id: str,
    data: BatchConfirmRequest = None,
    current_user: dict = Depends(get_current_user)
):
    """Confirm a batch (DRAFT → CONFIRMED) - HR only"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Only HR can confirm payroll batches")
    
    try:
        batch = await payroll_service.confirm_batch(
            batch_id=batch_id,
            confirmed_by=current_user["id"],
            confirmed_by_name=current_user.get("name", ""),
            notes=data.notes if data else None
        )
        return batch
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/payroll/batch/{batch_id}/mark-paid")
async def mark_batch_paid(
    batch_id: str,
    data: BatchMarkPaidRequest,
    current_user: dict = Depends(get_current_user)
):
    """Mark batch as paid (CONFIRMED → CLOSED) - HR only"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Only HR can mark batches as paid")
    
    try:
        batch = await payroll_service.mark_batch_paid(
            batch_id=batch_id,
            payment_date=data.payment_date,
            payment_mode=data.payment_mode,
            transaction_reference=data.transaction_reference,
            paid_by=current_user["id"],
            paid_by_name=current_user.get("name", ""),
            notes=data.notes
        )
        return batch
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/payroll/batch/{batch_id}")
async def delete_draft_batch(
    batch_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a DRAFT batch - HR only"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Only HR can delete batches")
    
    try:
        await payroll_service.delete_draft_batch(batch_id, current_user["id"])
        return {"message": "Batch deleted successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== LEAVE MANAGEMENT ====================

@router.post("/leave/apply")
async def apply_for_leave(
    data: LeaveRequestCreate,
    current_user: dict = Depends(get_current_user)
):
    """Apply for leave - employees apply for self, Country Head/CEO can apply on behalf"""
    try:
        role_code = current_user.get("role_code", "")
        
        # Determine target employee
        target_employee_id = current_user["id"]
        applied_by_id = None
        
        # Country Head or CEO can apply on behalf of others
        if data.employee_id and data.employee_id != current_user["id"]:
            if role_code not in ["CEO", "COUNTRY_HEAD"]:
                raise HTTPException(status_code=403, detail="Only Country Head or CEO can apply leave on behalf of others")
            target_employee_id = data.employee_id
            applied_by_id = current_user["id"]
        
        request = await leave_service.create_leave_request(
            employee_id=target_employee_id,
            leave_type=data.leave_type,
            start_date=data.start_date,
            end_date=data.end_date,
            duration_type=data.duration_type,
            reason=data.reason,
            applied_by_id=applied_by_id
        )
        
        return request
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/leave/my-requests")
async def get_my_leave_requests(
    year: Optional[int] = None,
    leave_status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get current user's leave requests"""
    requests = await leave_service.get_employee_leaves(
        employee_id=current_user["id"],
        year=year,
        status=leave_status
    )
    
    return requests


@router.get("/leave/my-balance")
async def get_my_leave_balance(
    year: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get current user's leave balance"""
    if not year:
        year = datetime.now(timezone.utc).year
    
    summary = await leave_service.get_leave_summary(current_user["id"], year)
    
    return summary


@router.get("/leave/pending-approvals")
async def get_pending_leave_approvals(
    country_id: Optional[str] = None,
    team_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get pending leave approvals - HR/Manager only"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER", "COUNTRY_HEAD", "SALES_HEAD", "INSPECTION_HEAD"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if role_code == "COUNTRY_HEAD":
        country_id = current_user.get("country_id")
    elif role_code in ["SALES_HEAD", "INSPECTION_HEAD"]:
        team_id = current_user.get("team_id")
    
    requests = await leave_service.get_pending_approvals(country_id, team_id)
    
    return requests


@router.post("/leave/{request_id}/approve")
async def approve_leave_request(
    request_id: str,
    data: LeaveApprovalRequest,
    current_user: dict = Depends(get_current_user)
):
    """Approve or reject leave request - HR/Manager only"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER", "COUNTRY_HEAD", "SALES_HEAD", "INSPECTION_HEAD"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    try:
        if data.action == "APPROVED":
            request = await leave_service.approve_leave(
                request_id=request_id,
                approved_by=current_user["id"],
                approved_by_name=current_user.get("name", "")
            )
        elif data.action == "REJECTED":
            if not data.rejection_reason:
                raise HTTPException(status_code=400, detail="Rejection reason required")
            request = await leave_service.reject_leave(
                request_id=request_id,
                rejected_by=current_user["id"],
                rejected_by_name=current_user.get("name", ""),
                rejection_reason=data.rejection_reason
            )
        else:
            raise HTTPException(status_code=400, detail="Invalid action")
        
        # Log audit if audit_service is available
        if audit_service:
            await audit_service.log(
                entity_type="leave_request",
                entity_id=request_id,
                action=data.action.lower(),
                user_id=current_user["id"],
                new_values={"action": data.action}
            )
        
        return request
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/leave/{request_id}/cancel")
async def cancel_leave_request(
    request_id: str,
    reason: str = "",
    current_user: dict = Depends(get_current_user)
):
    """Cancel leave request - by employee or HR"""
    # Get the request to check ownership
    leave_req = await db.leave_requests.find_one({"id": request_id}, {"_id": 0})
    if not leave_req:
        raise HTTPException(status_code=404, detail="Leave request not found")
    
    role_code = current_user.get("role_code", "")
    
    # Only owner or HR can cancel
    if leave_req["employee_id"] != current_user["id"] and role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    try:
        request = await leave_service.cancel_leave(
            request_id=request_id,
            cancelled_by=current_user["id"],
            cancellation_reason=reason
        )
        
        return request
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/leave/employee/{employee_id}")
async def get_employee_leaves(
    employee_id: str,
    year: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get leave requests for an employee - HR only"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER", "COUNTRY_HEAD"]:
        if current_user["id"] != employee_id:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    requests = await leave_service.get_employee_leaves(employee_id, year)
    
    return requests


@router.get("/leave/employee/{employee_id}/balance")
async def get_employee_leave_balance(
    employee_id: str,
    year: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get leave balance for an employee"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER", "COUNTRY_HEAD"]:
        if current_user["id"] != employee_id:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    if not year:
        year = datetime.now(timezone.utc).year
    
    summary = await leave_service.get_leave_summary(employee_id, year)
    
    return summary


@router.get("/leave/team-summary")
async def get_team_leave_summary(
    team_id: Optional[str] = None,
    country_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get team leave summary"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER", "COUNTRY_HEAD", "SALES_HEAD", "INSPECTION_HEAD"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if role_code == "COUNTRY_HEAD":
        country_id = current_user.get("country_id")
    elif role_code in ["SALES_HEAD", "INSPECTION_HEAD"]:
        team_id = current_user.get("team_id")
    
    summary = await leave_service.get_team_leave_summary(team_id, country_id)
    
    return summary

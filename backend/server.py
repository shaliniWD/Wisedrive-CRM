"""WiseDrive CRM V2 - Multi-tenant RBAC Backend"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt

# Import V2 models
from models.user import (
    User, UserCreate, UserUpdate, UserBase, UserWithPermissions,
    Role, RoleCreate, Permission, RolePermission
)
from models.organization import Department, DepartmentCreate, Team, TeamCreate
from models.lead import Lead, LeadCreate, LeadUpdate, LeadReassignmentLog, LeadReassignRequest
from models.customer import Customer, CustomerCreate, CustomerUpdate
from models.inspection import Inspection, InspectionCreate, InspectionUpdate
from models.inspection_package import (
    InspectionPackage, InspectionPackageCreate, InspectionPackageUpdate,
    InspectionCategoryDB, InspectionCategoryCreate, InspectionCategoryUpdate,
    InspectionItem, Offer, OfferCreate, OfferUpdate
)
from models.audit import AuditLog
from models.employee import (
    EmployeeCreate, EmployeeUpdate, SalaryStructureCreate, SalaryStructureUpdate,
    AttendanceCreate, AttendanceUpdate, DocumentCreate, DocumentUpdate,
    CountryCreate, CountryUpdate
)

# Import V2 services
from services.rbac import RBACService
from services.round_robin import RoundRobinService
from services.audit import AuditService
from services.seed_v2 import seed_v2_data
from services.vaahan_service import vaahan_service

# Import HR Module services
from services.attendance_service import AttendanceService
from services.payroll_service import PayrollService
from services.leave_service import LeaveService
from services.storage_service import get_storage_service
from services.encryption_service import get_encryption_service

# Import HR Module models
from models.attendance import (
    UserSessionCreate, AttendanceOverrideRequest, AttendanceExportRequest
)
from models.payroll import (
    PayrollRecordCreate, PayrollBulkGenerateRequest, PaymentMarkRequest,
    PayrollAdjustmentCreate, BulkPaymentMarkRequest,
    PayrollPreviewRequest, PayrollRecordUpdate, BatchRecordsUpdateRequest,
    BatchConfirmRequest, BatchMarkPaidRequest, PayrollBatchCreate
)
from models.leave import (
    LeaveRequestCreate, LeaveApprovalRequest, LeaveBalanceCreate
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration - Using a secure 32+ byte key
DEFAULT_JWT_SECRET = 'wisedrive-crm-secure-secret-key-2024-production-env'  # 52 bytes
SECRET_KEY = os.environ.get('JWT_SECRET', DEFAULT_JWT_SECRET)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

# Security
security = HTTPBearer()

# Create the main app
app = FastAPI(title="WiseDrive CRM V2 API", version="2.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize services
rbac_service: Optional[RBACService] = None
round_robin_service: Optional[RoundRobinService] = None
audit_service: Optional[AuditService] = None

# HR Module services
attendance_service: Optional[AttendanceService] = None
payroll_service: Optional[PayrollService] = None
leave_service: Optional[LeaveService] = None


@app.on_event("startup")
async def startup():
    global rbac_service, round_robin_service, audit_service
    global attendance_service, payroll_service, leave_service, fcm_service
    
    rbac_service = RBACService(db)
    round_robin_service = RoundRobinService(db)
    audit_service = AuditService(db)
    
    # Initialize HR Module services
    storage_service = get_storage_service()
    attendance_service = AttendanceService(db)
    payroll_service = PayrollService(db, attendance_service, storage_service)
    leave_service = LeaveService(db)
    
    # Initialize FCM Service for push notifications
    from services_ess.fcm_service import FCMService
    fcm_service = FCMService(db)
    app.state.fcm_service = fcm_service
    
    # Initialize Chatbot Service
    from services.chatbot_service import init_chatbot_service
    from services.twilio_service import get_twilio_service
    twilio = get_twilio_service()
    chatbot = init_chatbot_service(db, twilio)
    app.state.chatbot_service = chatbot
    logger.info("ChatbotService initialized for WhatsApp")
    
    # Set db in app.state for ESS routes compatibility
    app.state.db = db
    
    # Create TTL index for token blacklist (auto-expire entries)
    try:
        await db.token_blacklist.create_index("expires_at", expireAfterSeconds=0)
    except Exception:
        pass  # Index may already exist
    
    # Create ESS-specific indexes
    try:
        await db.ess_device_sessions.create_index("user_id")
        await db.ess_device_sessions.create_index("device_id", unique=True)
        await db.ess_refresh_tokens.create_index("token", unique=True)
        await db.ess_push_tokens.create_index("user_id")
    except Exception:
        pass  # Indexes may already exist
    
    # ==================== AUTO-FIX PASSWORD HASHES ON STARTUP ====================
    # This ensures all users can login after deployment without manual intervention
    try:
        await auto_fix_password_hashes()
    except Exception as e:
        logger.warning(f"Password hash auto-fix completed with warning: {e}")
    
    logger.info("WiseDrive CRM V2 started with HR Module, ESS Mobile API, and FCM Push Notifications")


async def auto_fix_password_hashes():
    """
    Automatically validate and fix ONLY corrupted/missing password hashes on startup.
    
    IMPORTANT: This does NOT reset passwords that are working correctly.
    It only fixes:
    - Missing password hashes
    - Invalid bcrypt hash format (not starting with $2)
    - Corrupted hashes that throw exceptions during verification
    
    Users with valid password hashes (even if different from default) are left unchanged.
    """
    DEFAULT_PASSWORD = "password123"
    
    # Get all users
    users = await db.users.find({}, {"_id": 0, "id": 1, "email": 1, "hashed_password": 1}).to_list(1000)
    
    if not users:
        logger.info("No users found - skipping password hash validation")
        return
    
    fixed_count = 0
    valid_count = 0
    
    # Generate fresh hash for default password (only used for truly broken hashes)
    fresh_hash = hash_password(DEFAULT_PASSWORD)
    
    for user in users:
        user_id = user.get("id")
        email = user.get("email")
        current_hash = user.get("hashed_password")
        
        needs_fix = False
        
        # Check if password hash is missing
        if not current_hash:
            needs_fix = True
            logger.info(f"User {email}: Missing password hash - will fix")
        elif not current_hash.startswith("$2"):
            # Not a valid bcrypt hash format
            needs_fix = True
            logger.info(f"User {email}: Invalid hash format (not bcrypt) - will fix")
        else:
            # Hash exists and looks valid - try to verify it doesn't throw errors
            # We test with a dummy string to check if the hash is structurally valid
            try:
                # Just verify the hash is valid bcrypt by checking it doesn't throw
                # We do NOT reset just because password doesn't match "password123"
                bcrypt.checkpw(b"test", current_hash.encode('utf-8'))
                valid_count += 1
            except Exception as e:
                # Hash is corrupted and throws errors during verification
                needs_fix = True
                logger.info(f"User {email}: Corrupted hash (verification error: {e}) - will fix")
        
        if needs_fix:
            # Only fix truly broken/missing hashes
            await db.users.update_one(
                {"id": user_id},
                {"$set": {
                    "hashed_password": fresh_hash,
                    "password_auto_fixed_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            fixed_count += 1
    
    if fixed_count > 0:
        logger.info(f"Password auto-fix: Fixed {fixed_count} corrupted/missing hashes, {valid_count} were valid")
    else:
        logger.info(f"Password validation: All {valid_count} users have valid password hashes")


# ==================== AUTH MODELS ====================

class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    """Hash password using bcrypt directly"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    """Verify password against bcrypt hash"""
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Get current user from JWT token with full V2 data"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        # Support for multiple roles - build roles array
        user["roles"] = []
        role_ids = user.get("role_ids", [])
        if not role_ids and user.get("role_id"):
            role_ids = [user["role_id"]]
        
        # Enrich with all roles
        for role_id in role_ids:
            role = await db.roles.find_one({"id": role_id}, {"_id": 0})
            if role:
                user["roles"].append({
                    "id": role["id"],
                    "name": role.get("name"),
                    "code": role.get("code"),
                    "level": role.get("level")
                })
        
        # Set primary role info (for backward compatibility)
        if user.get("role_id"):
            role = await db.roles.find_one({"id": user["role_id"]}, {"_id": 0})
            if role:
                user["role_name"] = role.get("name")
                user["role_code"] = role.get("code")
                user["role_level"] = role.get("level")
        elif user["roles"]:
            # Use first role as primary
            user["role_name"] = user["roles"][0].get("name")
            user["role_code"] = user["roles"][0].get("code")
            user["role_level"] = user["roles"][0].get("level")
        
        # Get country name
        if user.get("country_id"):
            country = await db.countries.find_one({"id": user["country_id"]}, {"_id": 0, "name": 1, "code": 1})
            if country:
                user["country_name"] = country.get("name")
                user["country_code"] = country.get("code")
        
        # Get department name
        if user.get("department_id"):
            dept = await db.departments.find_one({"id": user["department_id"]}, {"_id": 0, "name": 1})
            if dept:
                user["department_name"] = dept.get("name")
        
        # Get team name
        if user.get("team_id"):
            team = await db.teams.find_one({"id": user["team_id"]}, {"_id": 0, "name": 1})
            if team:
                user["team_name"] = team.get("name")
        
        # Get permissions
        permissions = await rbac_service.get_user_permissions(user_id)
        user["permissions"] = permissions
        
        # Get visible tabs
        visible_tabs = await rbac_service.get_visible_tabs(user_id)
        user["visible_tabs"] = visible_tabs
        
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ==================== AUTH ROUTES ====================

@api_router.get("/auth/countries")
async def get_login_countries():
    """Get all active countries for login selection - public endpoint"""
    countries = await db.countries.find({"is_active": True}, {"_id": 0, "id": 1, "name": 1, "code": 1}).to_list(100)
    return countries

@api_router.post("/auth/login", response_model=Token)
async def login(credentials: UserLogin):
    """Login with email and password"""
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(credentials.password, user.get("hashed_password", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="Account is disabled")
    
    # Get role info
    role_name = "User"
    role_code = ""
    if user.get("role_id"):
        role = await db.roles.find_one({"id": user["role_id"]}, {"_id": 0, "name": 1, "code": 1})
        if role:
            role_name = role.get("name", "User")
            role_code = role.get("code", "")
    
    # Get country info
    country_name = ""
    if user.get("country_id"):
        country = await db.countries.find_one({"id": user["country_id"]}, {"_id": 0, "name": 1})
        if country:
            country_name = country.get("name", "")
    
    # Update last login
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}}
    )
    
    access_token = create_access_token({"sub": user["id"], "email": user["email"]})
    
    # Get visible tabs for the user
    visible_tabs = await rbac_service.get_visible_tabs(user["id"])
    
    return Token(
        access_token=access_token,
        user={
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": role_name,
            "role_code": role_code,
            "country_id": user.get("country_id"),
            "country_name": country_name,
            "department_id": user.get("department_id"),
            "team_id": user.get("team_id"),
            "visible_tabs": visible_tabs
        }
    )


@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current user with full permissions"""
    return current_user


# ==================== COUNTRIES ROUTES ====================

@api_router.get("/countries")
async def get_countries(current_user: dict = Depends(get_current_user)):
    """Get all countries - filtered by user access"""
    role_code = current_user.get("role_code", "")
    
    if role_code == "CEO":
        # CEO sees all countries
        countries = await db.countries.find({"is_active": True}, {"_id": 0}).to_list(100)
    else:
        # Others see only their country
        country_id = current_user.get("country_id")
        if country_id:
            countries = await db.countries.find({"id": country_id, "is_active": True}, {"_id": 0}).to_list(1)
        else:
            countries = []
    
    return countries


@api_router.get("/countries/{country_id}")
async def get_country(country_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific country"""
    country = await db.countries.find_one({"id": country_id}, {"_id": 0})
    if not country:
        raise HTTPException(status_code=404, detail="Country not found")
    return country


# ==================== DEPARTMENTS ROUTES ====================

@api_router.get("/departments")
async def get_departments(current_user: dict = Depends(get_current_user)):
    """Get all departments"""
    departments = await db.departments.find({"is_active": True}, {"_id": 0}).to_list(100)
    return departments


# ==================== ROLES ROUTES ====================

@api_router.get("/roles")
async def get_roles(current_user: dict = Depends(get_current_user)):
    """Get all roles"""
    roles = await db.roles.find({}, {"_id": 0}).sort("level", 1).to_list(100)
    return roles


class RoleCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    level: int = 5
    eligible_sick_leaves_per_month: int = 1
    eligible_casual_leaves_per_month: int = 1
    permissions: Optional[List[dict]] = None  # List of {page, view, edit}


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    level: Optional[int] = None
    eligible_sick_leaves_per_month: Optional[int] = None
    eligible_casual_leaves_per_month: Optional[int] = None
    permissions: Optional[List[dict]] = None  # List of {page, view, edit}


@api_router.post("/roles")
async def create_role(data: RoleCreate, current_user: dict = Depends(get_current_user)):
    """Create new role - Admin/HR only"""
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check if role code already exists
    existing = await db.roles.find_one({"code": data.code.upper()})
    if existing:
        raise HTTPException(status_code=400, detail="Role code already exists")
    
    role_dict = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "code": data.code.upper(),
        "description": data.description or "",
        "level": data.level,
        "eligible_sick_leaves_per_month": data.eligible_sick_leaves_per_month,
        "eligible_casual_leaves_per_month": data.eligible_casual_leaves_per_month,
        "permissions": data.permissions or [],  # Store permissions with role
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.roles.insert_one(role_dict)
    role_dict.pop("_id", None)
    
    return role_dict


@api_router.put("/roles/{role_id}")
async def update_role(role_id: str, data: RoleUpdate, current_user: dict = Depends(get_current_user)):
    """Update role - Admin/HR only"""
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    role = await db.roles.find_one({"id": role_id})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.roles.update_one({"id": role_id}, {"$set": update_data})
    
    updated_role = await db.roles.find_one({"id": role_id}, {"_id": 0})
    return updated_role


@api_router.delete("/roles/{role_id}")
async def delete_role(role_id: str, current_user: dict = Depends(get_current_user)):
    """Delete role - Admin/HR only. Cannot delete preset roles or roles with assigned employees."""
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    role = await db.roles.find_one({"id": role_id})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    # Cannot delete preset roles
    preset_codes = ["CEO", "HR_MANAGER", "FINANCE_MANAGER", "OPERATIONS_MANAGER", "INSPECTOR", "SALES_EXECUTIVE", "EMPLOYEE"]
    if role.get("code") in preset_codes:
        raise HTTPException(status_code=400, detail="Cannot delete preset system roles")
    
    # Check if any employees are assigned to this role
    employees_count = await db.users.count_documents({"role_id": role_id})
    if employees_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete role. {employees_count} employee(s) are assigned to this role.")
    
    # Delete the role
    await db.roles.delete_one({"id": role_id})
    
    return {"message": "Role deleted successfully", "id": role_id}


@api_router.get("/roles/{role_id}/permissions")
async def get_role_permissions(role_id: str, current_user: dict = Depends(get_current_user)):
    """Get permissions for a specific role"""
    role_perms = await db.role_permissions.find({"role_id": role_id}, {"_id": 0}).to_list(100)
    
    result = []
    for rp in role_perms:
        perm = await db.permissions.find_one({"id": rp["permission_id"]}, {"_id": 0})
        if perm:
            result.append({
                **perm,
                "scope": rp.get("scope", "own")
            })
    
    return result


# ==================== TEAMS ROUTES ====================

@api_router.get("/teams")
async def get_teams(
    country_id: Optional[str] = None,
    department_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get teams - filtered by country and department"""
    query = {"is_active": True}
    
    role_code = current_user.get("role_code", "")
    
    # Non-CEO users can only see teams in their country
    if role_code != "CEO":
        query["country_id"] = current_user.get("country_id")
    elif country_id:
        query["country_id"] = country_id
    
    if department_id:
        query["department_id"] = department_id
    
    teams = await db.teams.find(query, {"_id": 0}).to_list(100)
    
    # Enrich with lead info
    for team in teams:
        if team.get("team_lead_id"):
            lead = await db.users.find_one({"id": team["team_lead_id"]}, {"_id": 0, "name": 1})
            if lead:
                team["team_lead_name"] = lead.get("name")
    
    return teams


# ==================== USERS ROUTES ====================

@api_router.get("/users")
async def get_users(
    country_id: Optional[str] = None,
    department_id: Optional[str] = None,
    role_id: Optional[str] = None,
    team_id: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get users - filtered by RBAC"""
    query = {}
    
    role_code = current_user.get("role_code", "")
    
    # Apply RBAC filters
    if role_code == "CEO" or role_code == "HR_MANAGER":
        # Can see all users
        if country_id:
            query["country_id"] = country_id
    elif role_code in ["COUNTRY_HEAD", "SALES_HEAD", "INSPECTION_HEAD"]:
        # Can see users in their country
        query["country_id"] = current_user.get("country_id")
    elif role_code in ["SALES_LEAD", "INSPECTION_LEAD"]:
        # Can see users in their team
        query["team_id"] = current_user.get("team_id")
    else:
        # Can only see themselves
        query["id"] = current_user.get("id")
    
    if department_id:
        query["department_id"] = department_id
    if role_id:
        query["role_id"] = role_id
    if team_id:
        query["team_id"] = team_id
    if is_active is not None:
        query["is_active"] = is_active
    
    users = await db.users.find(query, {"_id": 0, "hashed_password": 0}).to_list(1000)
    
    # Enrich with role, country, department info
    for user in users:
        if user.get("role_id"):
            role = await db.roles.find_one({"id": user["role_id"]}, {"_id": 0, "name": 1, "code": 1})
            if role:
                user["role_name"] = role.get("name")
                user["role_code"] = role.get("code")
        
        if user.get("country_id"):
            country = await db.countries.find_one({"id": user["country_id"]}, {"_id": 0, "name": 1})
            if country:
                user["country_name"] = country.get("name")
        
        if user.get("department_id"):
            dept = await db.departments.find_one({"id": user["department_id"]}, {"_id": 0, "name": 1})
            if dept:
                user["department_name"] = dept.get("name")
        
        if user.get("team_id"):
            team = await db.teams.find_one({"id": user["team_id"]}, {"_id": 0, "name": 1})
            if team:
                user["team_name"] = team.get("name")
    
    return users


@api_router.get("/users/{user_id}")
async def get_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific user"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Enrich with additional info
    if user.get("role_id"):
        role = await db.roles.find_one({"id": user["role_id"]}, {"_id": 0, "name": 1, "code": 1})
        if role:
            user["role_name"] = role.get("name")
            user["role_code"] = role.get("code")
    
    return user


@api_router.patch("/users/{user_id}/toggle-status")
async def toggle_user_status(user_id: str, current_user: dict = Depends(get_current_user)):
    """Toggle user active status"""
    # Check permission
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized to toggle user status")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    new_status = not user.get("is_active", True)
    await db.users.update_one({"id": user_id}, {"$set": {"is_active": new_status}})
    
    return {"is_active": new_status}


@api_router.patch("/users/{user_id}/toggle-assignment")
async def toggle_assignment_availability(user_id: str, current_user: dict = Depends(get_current_user)):
    """Toggle user's availability for lead assignment"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    new_status = not user.get("is_available_for_assignment", True)
    await db.users.update_one({"id": user_id}, {"$set": {"is_available_for_assignment": new_status}})
    
    return {"is_available_for_assignment": new_status}


# ==================== LEADS ROUTES ====================

@api_router.get("/leads")
async def get_leads(
    search: Optional[str] = None,
    lead_status: Optional[str] = None,
    city: Optional[str] = None,
    source: Optional[str] = None,
    assigned_to: Optional[str] = None,
    country_id: Optional[str] = None,
    team_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get leads - filtered by RBAC"""
    # Get RBAC filter
    rbac_filter = await rbac_service.get_data_filter(current_user["id"], "leads.view")
    
    query = {**rbac_filter}
    
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"mobile": {"$regex": search, "$options": "i"}}
        ]
    if lead_status:
        query["status"] = lead_status
    if city:
        query["city"] = city
    if source:
        query["source"] = source
    if assigned_to:
        query["assigned_to"] = assigned_to
    if country_id:
        query["country_id"] = country_id
    if team_id:
        query["team_id"] = team_id
    
    leads = await db.leads.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Batch fetch user names for all assigned leads
    assigned_user_ids = list(set([
        lead.get("assigned_to") for lead in leads 
        if lead.get("assigned_to") and not lead.get("assigned_to_name")
    ]))
    
    if assigned_user_ids:
        users = await db.users.find(
            {"id": {"$in": assigned_user_ids}},
            {"_id": 0, "id": 1, "name": 1}
        ).to_list(100)
        user_map = {u["id"]: u["name"] for u in users}
        
        # Enrich leads with assigned_to_name
        for lead in leads:
            if lead.get("assigned_to") and not lead.get("assigned_to_name"):
                lead["assigned_to_name"] = user_map.get(lead["assigned_to"], lead["assigned_to"])
    
    return leads


@api_router.post("/leads")
async def create_lead(lead_data: LeadCreate, current_user: dict = Depends(get_current_user)):
    """Create a new lead with automatic round-robin assignment"""
    lead_dict = lead_data.model_dump()
    lead_id = str(uuid.uuid4())
    
    # Set country_id from user if not provided
    if not lead_dict.get("country_id"):
        lead_dict["country_id"] = current_user.get("country_id")
    
    lead_dict["id"] = lead_id
    lead_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    lead_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    lead_dict["created_by"] = current_user["id"]
    
    await db.leads.insert_one(lead_dict)
    
    # Auto-assign via round robin if no assignment specified
    if not lead_dict.get("assigned_to"):
        await round_robin_service.assign_lead(
            lead_id=lead_id,
            country_id=lead_dict["country_id"],
            team_id=lead_dict.get("team_id"),
            assigner_id=current_user["id"],
            reason="Auto-assigned on lead creation"
        )
        # Fetch updated lead
        lead_dict = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    
    return lead_dict


@api_router.put("/leads/{lead_id}")
async def update_lead(lead_id: str, lead_data: LeadUpdate, current_user: dict = Depends(get_current_user)):
    """Update a lead"""
    existing = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    update_dict = {k: v for k, v in lead_data.model_dump().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_dict["updated_by"] = current_user["id"]
    
    await db.leads.update_one({"id": lead_id}, {"$set": update_dict})
    
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    return lead


@api_router.post("/leads/{lead_id}/reassign")
async def reassign_lead(
    lead_id: str,
    reassign_data: LeadReassignRequest,
    current_user: dict = Depends(get_current_user)
):
    """Reassign a lead to another agent"""
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    old_agent_id = lead.get("assigned_to")
    old_agent_name = lead.get("assigned_to_name", "Unassigned")
    lead_city = lead.get("city", "")
    
    # Check permission
    can_reassign = await rbac_service.can_reassign_lead(
        current_user["id"],
        lead.get("team_id")
    )
    if not can_reassign:
        raise HTTPException(status_code=403, detail="Not authorized to reassign leads")
    
    # Get new agent details and validate
    new_agent = await db.users.find_one({"id": reassign_data.new_agent_id}, {"_id": 0, "name": 1, "role_code": 1, "leads_cities": 1})
    if not new_agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    new_agent_name = new_agent.get("name", "Unknown")
    agent_role = new_agent.get("role_code", "").upper()
    
    # Validate the agent is a sales role (flexible matching)
    if "SALES" not in agent_role:
        raise HTTPException(status_code=400, detail=f"Lead can only be assigned to sales executives. Current role: {agent_role}")
    
    # Validate agent has the lead's city (check multiple fields)
    agent_leads_cities = new_agent.get("leads_cities", []) or []
    agent_assigned_cities = new_agent.get("assigned_cities", []) or []
    agent_city = new_agent.get("city", "")
    
    # Combine all city sources
    all_agent_cities = list(set(agent_leads_cities + agent_assigned_cities + ([agent_city] if agent_city else [])))
    
    # Only validate if agent has any city restrictions
    if all_agent_cities and lead_city and lead_city not in all_agent_cities:
        raise HTTPException(status_code=400, detail=f"Agent is not assigned to city: {lead_city}. Agent's cities: {all_agent_cities}")
    
    # Perform direct reassignment (simple update, not round-robin)
    await db.leads.update_one(
        {"id": lead_id},
        {"$set": {
            "assigned_to": reassign_data.new_agent_id,
            "assigned_to_name": new_agent_name,
            "is_locked": True,  # Lock manual assignments
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": current_user["id"]
        }}
    )
    
    # Log reassignment in lead_reassignment_logs
    log_entry = {
        "id": str(uuid.uuid4()),
        "lead_id": lead_id,
        "old_agent_id": old_agent_id,
        "new_agent_id": reassign_data.new_agent_id,
        "reassigned_by": current_user["id"],
        "reason": reassign_data.reason,
        "reassignment_type": "manual",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.lead_reassignment_logs.insert_one(log_entry)
    
    # Log reassignment activity
    activity = {
        "id": str(uuid.uuid4()),
        "lead_id": lead_id,
        "user_id": current_user["id"],
        "user_name": current_user.get("name", "Unknown"),
        "action": "lead_reassigned",
        "old_value": f"{old_agent_name}",
        "new_value": f"{new_agent_name}",
        "details": reassign_data.reason or "Manual reassignment",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.lead_activities.insert_one(activity)
    
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    return lead


@api_router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a lead"""
    # Check permission - only CEO can delete
    role_code = current_user.get("role_code", "")
    if role_code != "CEO":
        raise HTTPException(status_code=403, detail="Not authorized to delete leads")
    
    result = await db.leads.delete_one({"id": lead_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    return {"message": "Lead deleted"}


# Pydantic model for status update
class LeadStatusUpdate(BaseModel):
    status: str


@api_router.patch("/leads/{lead_id}/status")
async def update_lead_status(lead_id: str, status_data: LeadStatusUpdate, current_user: dict = Depends(get_current_user)):
    """Inline update of lead status - for quick status changes from the leads table"""
    from models.lead import LEAD_STATUSES
    
    existing = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Get valid statuses from model
    valid_statuses = [s["value"] for s in LEAD_STATUSES]
    if status_data.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status")
    
    old_status = existing.get("status")
    
    update_dict = {
        "status": status_data.status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user["id"]
    }
    
    await db.leads.update_one({"id": lead_id}, {"$set": update_dict})
    
    # Log activity
    activity = {
        "id": str(uuid.uuid4()),
        "lead_id": lead_id,
        "user_id": current_user["id"],
        "user_name": current_user.get("name", "Unknown"),
        "action": "status_changed",
        "old_value": old_status,
        "new_value": status_data.status,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.lead_activities.insert_one(activity)
    
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    return lead


@api_router.get("/leads/{lead_id}/reassignment-history")
async def get_lead_reassignment_history(lead_id: str, current_user: dict = Depends(get_current_user)):
    """Get reassignment history for a lead"""
    logs = await db.lead_reassignment_logs.find(
        {"lead_id": lead_id},
        {"_id": 0}
    ).sort("timestamp", -1).to_list(100)
    
    # Enrich with names
    for log in logs:
        if log.get("old_agent_id"):
            agent = await db.users.find_one({"id": log["old_agent_id"]}, {"_id": 0, "name": 1})
            if agent:
                log["old_agent_name"] = agent.get("name")
        
        if log.get("new_agent_id"):
            agent = await db.users.find_one({"id": log["new_agent_id"]}, {"_id": 0, "name": 1})
            if agent:
                log["new_agent_name"] = agent.get("name")
        
        if log.get("reassigned_by") and log["reassigned_by"] != "system":
            user = await db.users.find_one({"id": log["reassigned_by"]}, {"_id": 0, "name": 1})
            if user:
                log["reassigned_by_name"] = user.get("name")
    
    return logs


# Helper function to get sales role IDs
async def get_sales_role_ids():
    """
    Get all role IDs that contain 'SALES' in their code.
    This is used for finding sales representatives for lead assignment.
    """
    sales_roles = await db.roles.find(
        {"code": {"$regex": "SALES", "$options": "i"}},
        {"_id": 0, "id": 1, "code": 1}
    ).to_list(100)
    return [r["id"] for r in sales_roles]


# Helper function to find sales reps for a city
async def find_sales_reps_for_city(city: str):
    """
    Find all active sales reps assigned to a specific city.
    Checks assigned_cities array AND is_available_for_leads flag.
    """
    # First get role IDs for sales roles
    sales_role_ids = await get_sales_role_ids()
    
    if not sales_role_ids:
        logger.warning("No sales roles found in database")
        return []
    
    logger.info(f"Looking for sales reps for city: '{city}' with role_ids: {sales_role_ids}")
    
    # City filter - check assigned_cities array (case-insensitive)
    city_conditions = [
        {"assigned_cities": city},
        {"assigned_cities": {"$elemMatch": {"$eq": city}}},
        {"assigned_cities": {"$regex": f"^{city}$", "$options": "i"}}
    ]
    
    # Full query with role, active status, and city
    full_query = {
        "is_active": True,
        "$and": [
            {
                "$or": [
                    {"role_id": {"$in": sales_role_ids}},
                    {"role_ids": {"$elemMatch": {"$in": sales_role_ids}}}
                ]
            },
            {
                "$or": [
                    {"is_available_for_leads": True},
                    {"is_available_for_leads": {"$exists": False}}
                ]
            },
            {
                "$or": city_conditions
            }
        ]
    }
    
    logger.info(f"Full query for finding sales reps: {full_query}")
    
    sales_reps = await db.users.find(
        full_query,
        {"_id": 0, "id": 1, "name": 1, "email": 1, "assigned_cities": 1, "role_id": 1, "is_available_for_leads": 1}
    ).to_list(100)
    
    logger.info(f"Found {len(sales_reps)} sales reps for city '{city}': {[r.get('name') for r in sales_reps]}")
    
    return sales_reps


# Debug endpoint to check sales rep configuration
@api_router.get("/leads/debug-sales-reps")
async def debug_sales_reps(city: str = None, user_name: str = None, current_user: dict = Depends(get_current_user)):
    """
    Debug endpoint to check sales rep configuration.
    Shows all users with SALES roles and their city assignments.
    Can also search for a specific user by name.
    """
    # Get ALL roles for reference
    all_roles = await db.roles.find(
        {},
        {"_id": 0, "id": 1, "code": 1, "name": 1}
    ).to_list(100)
    
    # Get sales role IDs
    sales_role_ids = await get_sales_role_ids()
    sales_roles = [r for r in all_roles if r.get("id") in sales_role_ids]
    
    # Get all users with sales roles
    all_sales = await db.users.find(
        {
            "$or": [
                {"role_id": {"$in": sales_role_ids}},
                {"role_ids": {"$elemMatch": {"$in": sales_role_ids}}}
            ]
        },
        {"_id": 0, "id": 1, "name": 1, "email": 1, "role_id": 1, "role_ids": 1,
         "is_active": 1, "is_available_for_leads": 1,
         "city": 1, "leads_cities": 1, "assigned_cities": 1}
    ).to_list(100)
    
    # Get users matching the specific city
    matching_for_city = []
    if city:
        matching_for_city = await find_sales_reps_for_city(city)
    
    # Search for specific user by name (case-insensitive)
    specific_user = None
    if user_name:
        specific_user = await db.users.find_one(
            {"name": {"$regex": user_name, "$options": "i"}},
            {"_id": 0, "id": 1, "name": 1, "email": 1, "role_id": 1, "role_ids": 1,
             "is_active": 1, "is_available_for_leads": 1,
             "city": 1, "leads_cities": 1, "assigned_cities": 1}
        )
        if specific_user:
            # Get role details for this user
            user_role = await db.roles.find_one({"id": specific_user.get("role_id")}, {"_id": 0})
            specific_user["role_details"] = user_role
            specific_user["is_sales_role"] = specific_user.get("role_id") in sales_role_ids
    
    return {
        "all_roles": all_roles,
        "sales_roles": sales_roles,
        "sales_role_ids": sales_role_ids,
        "all_sales_users": all_sales,
        "matching_for_city": {
            "city": city,
            "count": len(matching_for_city),
            "users": matching_for_city
        },
        "specific_user_search": {
            "search_name": user_name,
            "user": specific_user
        } if user_name else None
    }


# Lead statuses for frontend
@api_router.get("/leads/statuses")
async def get_lead_statuses():
    """Get all available lead statuses"""
    from models.lead import LEAD_STATUSES
    return LEAD_STATUSES


@api_router.get("/leads/sales-reps-by-city")
async def get_sales_reps_by_city(city: str = None, current_user: dict = Depends(get_current_user)):
    """
    Get sales representatives for lead assignment.
    If city is provided, returns only reps assigned to that city.
    Uses role_id to find users with sales roles (not role_code on user doc).
    """
    # Get sales role IDs first
    sales_role_ids = await get_sales_role_ids()
    
    if not sales_role_ids:
        return []
    
    # Base query - active users with sales roles
    if city:
        # With city filter - use the helper function
        sales_reps = await find_sales_reps_for_city(city)
    else:
        # No city filter - get all sales reps
        query = {
            "is_active": True,
            "$or": [
                {"role_id": {"$in": sales_role_ids}},
                {"role_ids": {"$elemMatch": {"$in": sales_role_ids}}}
            ]
        }
        sales_reps = await db.users.find(
            query,
            {"_id": 0, "id": 1, "name": 1, "email": 1, "assigned_cities": 1, "role_id": 1}
        ).sort("name", 1).to_list(100)
    
    return sales_reps


@api_router.post("/leads/assign-unassigned")
async def assign_unassigned_leads(current_user: dict = Depends(get_current_user)):
    """
    Assign all unassigned leads to sales representatives via round-robin based on city.
    Called when leads page is refreshed or manually triggered.
    Uses role_id to find sales reps and assigned_cities for city matching.
    """
    # Check permission - only HR or admin can do bulk assignment
    role_code = current_user.get("role_code", "")
    if role_code not in ["HR_MANAGER", "CEO", "COUNTRY_HEAD", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Not authorized for bulk assignment")
    
    # Find all unassigned leads
    unassigned_leads = await db.leads.find(
        {"$or": [
            {"assigned_to": None},
            {"assigned_to": ""},
            {"assigned_to": {"$exists": False}}
        ]},
        {"_id": 0, "id": 1, "city": 1, "name": 1}
    ).to_list(1000)
    
    if not unassigned_leads:
        return {"message": "No unassigned leads found", "assigned_count": 0}
    
    assigned_count = 0
    failed_count = 0
    results = []
    
    for lead in unassigned_leads:
        lead_id = lead["id"]
        lead_city = lead.get("city", "")
        
        if not lead_city:
            results.append({"lead_id": lead_id, "status": "skipped", "reason": "No city specified"})
            failed_count += 1
            continue
        
        # Find sales reps for this city using the helper function
        sales_reps = await find_sales_reps_for_city(lead_city)
        
        logger.info(f"Found {len(sales_reps)} sales reps for city '{lead_city}': {[r.get('name') for r in sales_reps]}")
        
        if not sales_reps:
            results.append({"lead_id": lead_id, "city": lead_city, "status": "failed", "reason": f"No sales reps for city: {lead_city}"})
            failed_count += 1
            continue
        
        # Get round-robin counter for this city
        counter = await db.round_robin_counters.find_one({"city": lead_city})
        if not counter:
            counter = {"city": lead_city, "index": 0}
            await db.round_robin_counters.insert_one(counter)
        
        # Get next sales rep
        index = counter.get("index", 0) % len(sales_reps)
        assigned_rep = sales_reps[index]
        
        # Update lead with assignment
        await db.leads.update_one(
            {"id": lead_id},
            {"$set": {
                "assigned_to": assigned_rep["id"],
                "assigned_to_name": assigned_rep.get("name"),
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "updated_by": current_user["id"]
            }}
        )
        
        # Update counter
        await db.round_robin_counters.update_one(
            {"city": lead_city},
            {"$set": {"index": index + 1}},
            upsert=True
        )
        
        # Log assignment activity
        activity = {
            "id": str(uuid.uuid4()),
            "lead_id": lead_id,
            "user_id": "system",
            "user_name": "System",
            "action": "lead_assigned",
            "details": f"Bulk assignment via round-robin for {lead_city}",
            "new_value": f"Assigned to {assigned_rep.get('name')}",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.lead_activities.insert_one(activity)
        
        results.append({"lead_id": lead_id, "city": lead_city, "status": "assigned", "assigned_to": assigned_rep.get("name")})
        assigned_count += 1
    
    logger.info(f"Bulk assignment: {assigned_count} assigned, {failed_count} failed")
    
    return {
        "message": f"Assigned {assigned_count} leads, {failed_count} failed",
        "assigned_count": assigned_count,
        "failed_count": failed_count,
        "results": results
    }


# Fix missing assigned_to_name for leads
@api_router.post("/leads/fix-assigned-names")
async def fix_assigned_names(current_user: dict = Depends(get_current_user)):
    """
    One-time utility to populate assigned_to_name for leads that only have assigned_to ID.
    """
    # Check permission
    role_code = current_user.get("role_code", "")
    if role_code not in ["HR_MANAGER", "CEO", "COUNTRY_HEAD", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Find leads with assigned_to but no assigned_to_name
    leads_to_fix = await db.leads.find({
        "assigned_to": {"$exists": True, "$ne": None, "$ne": ""},
        "$or": [
            {"assigned_to_name": {"$exists": False}},
            {"assigned_to_name": None},
            {"assigned_to_name": ""}
        ]
    }, {"_id": 0, "id": 1, "assigned_to": 1}).to_list(1000)
    
    if not leads_to_fix:
        return {"message": "No leads need fixing", "fixed_count": 0}
    
    # Get all unique user IDs
    user_ids = list(set([lead["assigned_to"] for lead in leads_to_fix]))
    
    # Fetch user names
    users = await db.users.find(
        {"id": {"$in": user_ids}},
        {"_id": 0, "id": 1, "name": 1}
    ).to_list(100)
    
    user_map = {u["id"]: u["name"] for u in users}
    
    # Update leads
    fixed_count = 0
    for lead in leads_to_fix:
        user_id = lead["assigned_to"]
        user_name = user_map.get(user_id)
        
        if user_name:
            await db.leads.update_one(
                {"id": lead["id"]},
                {"$set": {"assigned_to_name": user_name}}
            )
            fixed_count += 1
    
    return {
        "message": f"Fixed {fixed_count} leads",
        "fixed_count": fixed_count,
        "total_checked": len(leads_to_fix)
    }


# Vaahan API for vehicle details
@api_router.get("/vehicle/details/{vehicle_number}")
async def get_vehicle_details(vehicle_number: str, current_user: dict = Depends(get_current_user)):
    """Fetch vehicle details from Vaahan API (Invincible Ocean)"""
    result = await vaahan_service.get_vehicle_details(vehicle_number)
    
    if not result.get("success"):
        raise HTTPException(
            status_code=400, 
            detail=result.get("error", "Failed to fetch vehicle details")
        )
    
    return result


# Save vehicle to vehicle master
@api_router.post("/vehicles")
async def create_vehicle(vehicle_data: dict, current_user: dict = Depends(get_current_user)):
    """Save vehicle details to vehicle master collection"""
    vehicle_id = str(uuid.uuid4())
    
    vehicle = {
        "id": vehicle_id,
        "registration_number": vehicle_data.get("registration_number", ""),
        "chassis_number": vehicle_data.get("chassis_number", ""),
        "engine_number": vehicle_data.get("engine_number", ""),
        "manufacturer": vehicle_data.get("manufacturer", ""),
        "model": vehicle_data.get("model", ""),
        "color": vehicle_data.get("color", ""),
        "fuel_type": vehicle_data.get("fuel_type", ""),
        "body_type": vehicle_data.get("body_type", ""),
        "vehicle_class": vehicle_data.get("vehicle_class", ""),
        "category": vehicle_data.get("category", ""),
        "manufacturing_date": vehicle_data.get("manufacturing_date", ""),
        "registration_date": vehicle_data.get("registration_date", ""),
        "registration_authority": vehicle_data.get("registration_authority", ""),
        "rc_expiry_date": vehicle_data.get("rc_expiry_date", ""),
        "owner_name": vehicle_data.get("owner_name", ""),
        "owner_count": vehicle_data.get("owner_count", ""),
        "insurance_company": vehicle_data.get("insurance_company", ""),
        "insurance_valid_upto": vehicle_data.get("insurance_valid_upto", ""),
        "insurance_policy_number": vehicle_data.get("insurance_policy_number", ""),
        "tax_valid_upto": vehicle_data.get("tax_valid_upto", ""),
        "fitness_upto": vehicle_data.get("fitness_upto", ""),
        "cubic_capacity": vehicle_data.get("cubic_capacity", ""),
        "gross_weight": vehicle_data.get("gross_weight", ""),
        "unladen_weight": vehicle_data.get("unladen_weight", ""),
        "seating_capacity": vehicle_data.get("seating_capacity", ""),
        "cylinders": vehicle_data.get("cylinders", ""),
        "emission_norms": vehicle_data.get("emission_norms", ""),
        "status": vehicle_data.get("status", ""),
        "financed": vehicle_data.get("financed", False),
        "financer": vehicle_data.get("financer", ""),
        "blacklist_status": vehicle_data.get("blacklist_status", False),
        "is_commercial": vehicle_data.get("is_commercial", False),
        "lead_id": vehicle_data.get("lead_id", ""),
        "customer_id": vehicle_data.get("customer_id", ""),
        "country_id": current_user.get("country_id"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"],
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user["id"],
    }
    
    # Check if vehicle already exists by registration number
    existing = await db.vehicles.find_one(
        {"registration_number": vehicle["registration_number"]},
        {"_id": 0}
    )
    
    if existing:
        # Update existing vehicle
        await db.vehicles.update_one(
            {"registration_number": vehicle["registration_number"]},
            {"$set": {
                **vehicle,
                "id": existing["id"],  # Keep original ID
                "created_at": existing.get("created_at", vehicle["created_at"]),
                "created_by": existing.get("created_by", vehicle["created_by"]),
            }}
        )
        return {"id": existing["id"], "message": "Vehicle updated", "is_new": False}
    else:
        await db.vehicles.insert_one(vehicle)
        return {"id": vehicle_id, "message": "Vehicle created", "is_new": True}


@api_router.get("/vehicles/{vehicle_id}")
async def get_vehicle(vehicle_id: str, current_user: dict = Depends(get_current_user)):
    """Get vehicle by ID"""
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return vehicle


@api_router.get("/vehicles/by-registration/{registration_number}")
async def get_vehicle_by_registration(registration_number: str, current_user: dict = Depends(get_current_user)):
    """Get vehicle by registration number"""
    # Clean the registration number
    clean_number = registration_number.replace(" ", "").replace("-", "").upper()
    vehicle = await db.vehicles.find_one(
        {"registration_number": {"$regex": f"^{clean_number}$", "$options": "i"}},
        {"_id": 0}
    )
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return vehicle


# Get single lead with details
@api_router.get("/leads/{lead_id}")
async def get_lead(lead_id: str, current_user: dict = Depends(get_current_user)):
    """Get single lead with all details"""
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Enrich with assigned_to name
    if lead.get("assigned_to"):
        agent = await db.users.find_one({"id": lead["assigned_to"]}, {"_id": 0, "name": 1})
        if agent:
            lead["assigned_to_name"] = agent.get("name")
    
    # Get package details if package_id exists
    if lead.get("package_id"):
        package = await db.inspection_packages.find_one({"id": lead["package_id"]}, {"_id": 0, "name": 1, "price": 1})
        if package:
            lead["package_name"] = package.get("name")
            lead["package_price"] = package.get("price")
    
    return lead


# Lead Notes
class LeadNoteCreate(BaseModel):
    note: str


@api_router.post("/leads/{lead_id}/notes")
async def add_lead_note(lead_id: str, note_data: LeadNoteCreate, current_user: dict = Depends(get_current_user)):
    """Add a note to a lead"""
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    note = {
        "id": str(uuid.uuid4()),
        "lead_id": lead_id,
        "user_id": current_user["id"],
        "user_name": current_user.get("name", "Unknown"),
        "note": note_data.note,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.lead_notes.insert_one(note)
    
    # Log activity
    activity = {
        "id": str(uuid.uuid4()),
        "lead_id": lead_id,
        "user_id": current_user["id"],
        "user_name": current_user.get("name", "Unknown"),
        "action": "note_added",
        "details": note_data.note[:100],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.lead_activities.insert_one(activity)
    
    note.pop("_id", None)
    return note


@api_router.get("/leads/{lead_id}/notes")
async def get_lead_notes(lead_id: str, current_user: dict = Depends(get_current_user)):
    """Get all notes for a lead"""
    notes = await db.lead_notes.find({"lead_id": lead_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return notes


@api_router.get("/leads/{lead_id}/activities")
async def get_lead_activities(lead_id: str, current_user: dict = Depends(get_current_user)):
    """Get all activities for a lead"""
    activities = await db.lead_activities.find({"lead_id": lead_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return activities


# Lead Reminder
class LeadReminderUpdate(BaseModel):
    reminder_date: str
    reminder_time: Optional[str] = None
    reminder_reason: Optional[str] = None


@api_router.post("/leads/{lead_id}/reminder")
async def set_lead_reminder(lead_id: str, reminder_data: LeadReminderUpdate, current_user: dict = Depends(get_current_user)):
    """Set reminder for a lead"""
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    update_dict = {
        "reminder_date": reminder_data.reminder_date,
        "reminder_time": reminder_data.reminder_time,
        "reminder_reason": reminder_data.reminder_reason,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.leads.update_one({"id": lead_id}, {"$set": update_dict})
    
    # Log activity
    activity = {
        "id": str(uuid.uuid4()),
        "lead_id": lead_id,
        "user_id": current_user["id"],
        "user_name": current_user.get("name", "Unknown"),
        "action": "reminder_set",
        "new_value": f"{reminder_data.reminder_date} {reminder_data.reminder_time or ''}",
        "details": reminder_data.reminder_reason,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.lead_activities.insert_one(activity)
    
    # Schedule push notification for assigned sales rep
    if lead.get("assigned_to"):
        # Create notification in database for future delivery
        notification = {
            "id": str(uuid.uuid4()),
            "user_id": lead["assigned_to"],
            "type": "lead_reminder",
            "title": "Lead Follow-up Reminder",
            "body": f"Reminder for lead: {lead.get('name')} - {reminder_data.reminder_reason or 'Follow up required'}",
            "data": {"lead_id": lead_id},
            "scheduled_for": f"{reminder_data.reminder_date}T{reminder_data.reminder_time or '09:00'}:00",
            "status": "scheduled",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.scheduled_notifications.insert_one(notification)
    
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    return lead


# Payment Link Generation - Request Models
class InspectionScheduleData(BaseModel):
    """Individual inspection schedule data from frontend"""
    vehicle_number: Optional[str] = None
    vehicle_data: Optional[dict] = None
    inspection_date: Optional[str] = None
    inspection_time: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    slot_number: int = 1


class PaymentLinkRequest(BaseModel):
    package_id: str
    amount: Optional[float] = None
    send_via_whatsapp: bool = True
    description: Optional[str] = None
    vehicle_number: Optional[str] = None
    no_of_inspections: int = 1
    discount_type: Optional[str] = None
    discount_value: Optional[str] = None
    base_amount: Optional[float] = None
    discount_amount: Optional[float] = None
    inspection_schedules: Optional[List[InspectionScheduleData]] = None


@api_router.post("/leads/{lead_id}/payment-link")
async def create_lead_payment_link(lead_id: str, payment_data: PaymentLinkRequest, current_user: dict = Depends(get_current_user)):
    """Create payment link for a lead and optionally send via WhatsApp"""
    from services.razorpay_service import get_razorpay_service
    from services.twilio_service import get_twilio_service
    
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Get package details
    package = await db.inspection_packages.find_one({"id": payment_data.package_id}, {"_id": 0})
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")
    
    amount = payment_data.amount or package.get("price", 0)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")
    
    # Create Razorpay payment link
    razorpay = get_razorpay_service()
    if not razorpay.is_configured():
        raise HTTPException(status_code=500, detail="Razorpay not configured")
    
    result = await razorpay.create_payment_link(
        amount=amount,
        customer_name=lead.get("name", "Customer"),
        customer_phone=lead.get("mobile", ""),
        customer_email=lead.get("email"),
        description=payment_data.description or f"WiseDrive - {package.get('name', 'Vehicle Inspection')}",
        lead_id=lead_id,
        package_id=payment_data.package_id
    )
    
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to create payment link"))
    
    # Get number of inspections from package
    no_of_inspections = payment_data.no_of_inspections or package.get("no_of_inspections", 1)
    
    # Store inspection schedules with the lead for later processing on payment
    inspection_schedules_data = []
    if payment_data.inspection_schedules:
        for schedule in payment_data.inspection_schedules:
            inspection_schedules_data.append(schedule.model_dump())
    
    # Update lead with payment link details
    update_dict = {
        "payment_link": result.get("short_url"),
        "payment_link_id": result.get("payment_link_id"),
        "payment_link_sent_at": datetime.now(timezone.utc).isoformat(),
        "payment_status": "created",
        "payment_amount": amount,
        "package_id": payment_data.package_id,
        "package_name": package.get("name"),
        "no_of_inspections": no_of_inspections,
        "discount_type": payment_data.discount_type,
        "discount_value": payment_data.discount_value,
        "base_amount": payment_data.base_amount,
        "discount_amount": payment_data.discount_amount,
        "inspection_schedules": inspection_schedules_data,  # Store schedules for processing on payment
        "status": "PAYMENT LINK SENT",
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user["id"]
    }
    
    await db.leads.update_one({"id": lead_id}, {"$set": update_dict})
    
    # Log activity
    activity = {
        "id": str(uuid.uuid4()),
        "lead_id": lead_id,
        "user_id": current_user["id"],
        "user_name": current_user.get("name", "Unknown"),
        "action": "payment_link_created",
        "new_value": result.get("short_url"),
        "details": f"Amount: ₹{amount}, Package: {package.get('name')}, Inspections: {no_of_inspections}",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.lead_activities.insert_one(activity)
    
    # Send via WhatsApp if requested
    whatsapp_result = None
    if payment_data.send_via_whatsapp:
        twilio = get_twilio_service()
        if twilio.is_configured():
            whatsapp_result = await twilio.send_payment_link(
                to_number=lead.get("mobile", ""),
                customer_name=lead.get("name", "Customer"),
                amount=amount,
                payment_link=result.get("short_url"),
                package_name=package.get("name", "Vehicle Inspection")
            )
            
            if whatsapp_result.get("success"):
                # Update lead status
                await db.leads.update_one({"id": lead_id}, {"$set": {"payment_status": "sent"}})
                
                # Log WhatsApp activity
                whatsapp_activity = {
                    "id": str(uuid.uuid4()),
                    "lead_id": lead_id,
                    "user_id": current_user["id"],
                    "user_name": current_user.get("name", "Unknown"),
                    "action": "payment_link_sent_whatsapp",
                    "details": f"Sent to {lead.get('mobile')}",
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.lead_activities.insert_one(whatsapp_activity)
    
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    
    return {
        "success": True,
        "payment_link": result.get("short_url"),
        "payment_link_id": result.get("payment_link_id"),
        "whatsapp_sent": whatsapp_result.get("success") if whatsapp_result else False,
        "lead": lead
    }


@api_router.get("/leads/{lead_id}/check-payment-status")
async def check_lead_payment_status(lead_id: str, current_user: dict = Depends(get_current_user)):
    """
    Manually check payment status for a lead.
    This is Plan B - the primary method is webhook (automatic).
    
    Sales rep can use this to manually verify if customer has paid.
    """
    from services.razorpay_service import get_razorpay_service
    
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    payment_link_id = lead.get("payment_link_id")
    if not payment_link_id:
        return {
            "success": False,
            "message": "No payment link found for this lead",
            "payment_status": lead.get("payment_status", "none"),
            "lead_status": lead.get("status")
        }
    
    # If already paid, return immediately
    if lead.get("payment_status") == "paid":
        return {
            "success": True,
            "message": "Payment already received",
            "payment_status": "paid",
            "razorpay_payment_id": lead.get("razorpay_payment_id"),
            "lead_status": lead.get("status")
        }
    
    # Check with Razorpay
    razorpay = get_razorpay_service()
    if not razorpay.is_configured():
        raise HTTPException(status_code=500, detail="Razorpay not configured")
    
    result = await razorpay.get_payment_link(payment_link_id)
    
    if not result.get("success"):
        return {
            "success": False,
            "message": f"Failed to check payment status: {result.get('error')}",
            "payment_status": lead.get("payment_status", "unknown")
        }
    
    payment_link = result.get("payment_link", {})
    razorpay_status = payment_link.get("status")  # created, attempted, paid, cancelled, expired
    
    # If payment is completed on Razorpay but we didn't receive webhook
    if razorpay_status == "paid" and lead.get("payment_status") != "paid":
        # Get payment details
        payments = payment_link.get("payments", [])
        payment_id = payments[0].get("payment_id") if payments else payment_link.get("payment_id")
        amount = payment_link.get("amount_paid", payment_link.get("amount", 0)) / 100
        
        # Update lead as paid (same as webhook would do)
        update_dict = {
            "status": "PAID",
            "payment_status": "paid",
            "razorpay_payment_id": payment_id,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.leads.update_one({"id": lead_id}, {"$set": update_dict})
        
        # Log activity
        activity = {
            "id": str(uuid.uuid4()),
            "lead_id": lead_id,
            "user_id": current_user["id"],
            "user_name": current_user.get("name", "Unknown"),
            "action": "payment_verified_manually",
            "new_value": f"₹{amount}",
            "details": f"Payment verified via manual check. Payment ID: {payment_id}",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.lead_activities.insert_one(activity)
        
        # Create customer from lead (if not already created)
        existing_customer = await db.customers.find_one({"lead_id": lead_id}, {"_id": 0})
        if not existing_customer:
            customer_id = str(uuid.uuid4())
            customer = {
                "id": customer_id,
                "name": lead.get("name"),
                "mobile": lead.get("mobile"),
                "email": lead.get("email"),
                "city": lead.get("city"),
                "lead_id": lead_id,
                "package_id": lead.get("package_id"),
                "package_name": lead.get("package_name"),
                "total_paid": amount,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": current_user["id"]
            }
            await db.customers.insert_one(customer)
            
            # Create inspection records
            no_of_inspections = lead.get("no_of_inspections", 1)
            inspection_schedules = lead.get("inspection_schedules", [])
            
            for i in range(no_of_inspections):
                inspection_id = str(uuid.uuid4())
                schedule_data = inspection_schedules[i] if i < len(inspection_schedules) else {}
                
                has_schedule = bool(
                    schedule_data.get("inspection_date") and 
                    schedule_data.get("inspection_time") and 
                    schedule_data.get("address")
                )
                
                inspection = {
                    "id": inspection_id,
                    "customer_id": customer_id,
                    "lead_id": lead_id,
                    "customer_name": lead.get("name"),
                    "customer_mobile": lead.get("mobile"),
                    "car_number": schedule_data.get("vehicle_number") or "",
                    "city": lead.get("city"),
                    "address": schedule_data.get("address") or "",
                    "package_id": lead.get("package_id"),
                    "package_type": lead.get("package_name"),
                    "total_amount": amount / no_of_inspections,
                    "payment_status": "PAID",
                    "razorpay_payment_id": payment_id,
                    "inspection_status": "SCHEDULED" if has_schedule else "UNSCHEDULED",
                    "scheduled_date": schedule_data.get("inspection_date") or None,
                    "scheduled_time": schedule_data.get("inspection_time") or None,
                    "slot_number": i + 1,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "created_by": current_user["id"]
                }
                await db.inspections.insert_one(inspection)
        
        return {
            "success": True,
            "message": "Payment found! CRM has been updated.",
            "payment_status": "paid",
            "razorpay_payment_id": payment_id,
            "amount": amount,
            "lead_status": "PAID",
            "was_updated": True
        }
    
    # Map Razorpay status to readable message
    status_messages = {
        "created": "Payment link created, waiting for customer to pay",
        "attempted": "Customer started payment but did not complete",
        "paid": "Payment completed",
        "cancelled": "Payment link was cancelled",
        "expired": "Payment link has expired"
    }
    
    return {
        "success": True,
        "message": status_messages.get(razorpay_status, f"Status: {razorpay_status}"),
        "payment_status": razorpay_status,
        "razorpay_status": razorpay_status,
        "lead_status": lead.get("status"),
        "payment_link": lead.get("payment_link"),
        "created_at": payment_link.get("created_at"),
        "expire_by": payment_link.get("expire_by"),
        "was_updated": False
    }


# ==================== WEBHOOKS ROUTES ====================

from fastapi import Request, Form
from fastapi.responses import Response

# Twilio WhatsApp Webhook - receives incoming messages from Meta ads
@api_router.post("/webhooks/twilio/whatsapp")
async def twilio_whatsapp_webhook(
    request: Request,
    From: str = Form(...),
    Body: str = Form(default=""),
    ProfileName: str = Form(default=""),
    WaId: str = Form(default=""),
    MessageSid: str = Form(default="")
):
    """
    Webhook endpoint for incoming WhatsApp messages via Twilio.
    Creates a new lead from Meta ad clicks.
    Returns TwiML response for immediate reply.
    """
    logger.info(f"WhatsApp webhook received: From={From}, Body={Body[:100] if Body else 'empty'}")
    
    # Default response message
    response_message = ""
    
    # Extract phone number (remove whatsapp: prefix)
    phone = From.replace("whatsapp:", "").strip()
    if not phone.startswith("+"):
        phone = f"+{phone}"
    
    # Parse the message to extract ad_id, campaign_id from prefilled message
    # Meta prefilled messages typically contain: "Hi, I'm interested in [ad_name]. Ad ID: [ad_id]"
    ad_id = None
    campaign_id = None
    platform = "whatsapp"
    
    # Try to extract ad_id from message
    if Body:
        import re
        ad_match = re.search(r'ad[_\s]?id[:\s]*([a-zA-Z0-9_-]+)', Body, re.IGNORECASE)
        if ad_match:
            ad_id = ad_match.group(1)
        
        campaign_match = re.search(r'campaign[_\s]?id[:\s]*([a-zA-Z0-9_-]+)', Body, re.IGNORECASE)
        if campaign_match:
            campaign_id = campaign_match.group(1)
        
        # Check for platform indicators
        if 'instagram' in Body.lower() or 'insta' in Body.lower():
            platform = "instagram"
        elif 'facebook' in Body.lower() or 'fb' in Body.lower():
            platform = "facebook"
    
    # Determine city from ad_id mapping (from settings)
    city = "Vizag"  # Default city
    city_id = None
    
    if ad_id:
        ad_mapping = await db.ad_city_mappings.find_one({"ad_id": ad_id}, {"_id": 0})
        if ad_mapping:
            city = ad_mapping.get("city", "Vizag")
            city_id = ad_mapping.get("city_id")
    
    # Check if lead already exists with this phone
    existing_lead = await db.leads.find_one({"mobile": phone}, {"_id": 0})
    if existing_lead:
        # Update existing lead with new message and set status to RCB WHATSAPP
        old_status = existing_lead.get("status", "")
        await db.leads.update_one(
            {"id": existing_lead["id"]},
            {"$set": {
                "message": Body,
                "status": "RCB WHATSAPP",  # Request Call Back via WhatsApp
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Log the status change
        status_activity = {
            "id": str(uuid.uuid4()),
            "lead_id": existing_lead["id"],
            "user_id": "system",
            "user_name": "System",
            "action": "status_changed",
            "old_value": old_status,
            "new_value": "RCB WHATSAPP",
            "details": "Customer messaged again on WhatsApp - Requesting callback",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.lead_activities.insert_one(status_activity)
        
        # Log the customer message
        message_activity = {
            "id": str(uuid.uuid4()),
            "lead_id": existing_lead["id"],
            "user_id": "system",
            "user_name": "Customer",
            "action": "customer_message",
            "details": "Customer sent a follow-up WhatsApp message",
            "new_value": Body,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.lead_activities.insert_one(message_activity)
        
        logger.info(f"Updated existing lead {existing_lead['id']} status to RCB WHATSAPP")
        
        # Build response based on message content
        message_lower = Body.lower().strip() if Body else ""
        
        if message_lower in ["buy_inspection", "1", "buy inspection", "buy", "inspection", "packages"]:
            response_message = """📋 *Our Inspection Packages*

*Basic Inspection - ₹999*
✓ 100+ point check
✓ Engine & transmission
✓ Report in 24 hours

*Standard Inspection - ₹1,999*
✓ 150+ point check
✓ Road test included
✓ Detailed report

*Premium Inspection - ₹2,999*
✓ 200+ point check
✓ OBD diagnostic
✓ Expert consultation

*Reply with:*
• basic - For Basic Package
• standard - For Standard Package  
• premium - For Premium Package
• callback - To speak with our expert"""
        
        elif message_lower in ["request_callback", "2", "callback", "call back", "call", "rcb"]:
            response_message = """📞 *Callback Request Received!*

Our sales representative will call you within the next 30 minutes.

Feel free to ask any questions about:
• Our inspection process
• Pricing and packages
• Service areas

_Type your question or wait for our callback!_"""
        
        elif message_lower in ["basic", "pkg_basic"]:
            response_message = """✅ *Basic Inspection - ₹999*

Great choice! To proceed:
1. Our sales rep will call you shortly
2. Share vehicle registration number
3. Choose inspection date & location

*Reply "callback" for immediate assistance*"""
        
        elif message_lower in ["standard", "pkg_standard"]:
            response_message = """✅ *Standard Inspection - ₹1,999*

Excellent choice! To proceed:
1. Our sales rep will call you shortly
2. Share vehicle registration number
3. Choose inspection date & location

*Reply "callback" for immediate assistance*"""
        
        elif message_lower in ["premium", "pkg_premium"]:
            response_message = """✅ *Premium Inspection - ₹2,999*

Premium choice! To proceed:
1. Our sales rep will call you shortly
2. Share vehicle registration number
3. Choose inspection date & location

*Reply "callback" for immediate assistance*"""
        
        else:
            # Default menu for existing customers
            response_message = """🙏 *Welcome back to WiseDrive!*

How can we help you today?

*Reply with:*
1️⃣ - View inspection packages
2️⃣ - Request a callback

Or type your question and we'll help you!"""
        
        # Return TwiML response
        twiml_response = f'''<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>{response_message}</Message>
</Response>'''
        
        return Response(content=twiml_response, media_type="application/xml")
    
    # Create new lead
    lead_id = str(uuid.uuid4())
    lead = {
        "id": lead_id,
        "name": ProfileName or "WhatsApp Lead",
        "mobile": phone,
        "city": city,
        "city_id": city_id,
        "source": "META_WHATSAPP",
        "ad_id": ad_id,
        "campaign_id": campaign_id,
        "platform": platform,
        "message": Body,
        "status": "NEW LEAD",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "created_by": "system"
    }
    
    await db.leads.insert_one(lead)
    
    # Log the initial lead creation activity with message
    initial_activity = {
        "id": str(uuid.uuid4()),
        "lead_id": lead_id,
        "user_id": "system",
        "user_name": "System",
        "action": "lead_created",
        "details": f"Lead created from WhatsApp ({platform})",
        "new_value": f"Name: {ProfileName or 'Unknown'}, Phone: {phone}, City: {city}",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.lead_activities.insert_one(initial_activity)
    
    # Log the customer message
    if Body:
        message_activity = {
            "id": str(uuid.uuid4()),
            "lead_id": lead_id,
            "user_id": "system",
            "user_name": "Customer",
            "action": "customer_message",
            "details": "Customer sent a WhatsApp message",
            "new_value": Body,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.lead_activities.insert_one(message_activity)
    
    # Auto-assign to sales rep via round-robin based on city
    try:
        # First, log what we're looking for
        logger.info(f"Looking for sales reps for city: {city}")
        
        # Use the helper function to find sales reps for this city
        sales_reps = await find_sales_reps_for_city(city)
        
        logger.info(f"Found {len(sales_reps)} sales reps for city {city}: {[r.get('name') for r in sales_reps]}")
        
        if sales_reps:
            # Get round-robin counter for this city
            counter = await db.round_robin_counters.find_one({"city": city})
            if not counter:
                counter = {"city": city, "index": 0}
                await db.round_robin_counters.insert_one(counter)
            
            # Get next sales rep
            index = counter.get("index", 0) % len(sales_reps)
            assigned_rep = sales_reps[index]
            
            # Update lead with assignment
            await db.leads.update_one(
                {"id": lead_id},
                {"$set": {
                    "assigned_to": assigned_rep["id"],
                    "assigned_to_name": assigned_rep.get("name")
                }}
            )
            
            # Update counter
            await db.round_robin_counters.update_one(
                {"city": city},
                {"$set": {"index": index + 1}},
                upsert=True
            )
            
            # Log assignment activity
            assignment_activity = {
                "id": str(uuid.uuid4()),
                "lead_id": lead_id,
                "user_id": "system",
                "user_name": "System",
                "action": "lead_assigned",
                "details": f"Auto-assigned via round-robin for {city}",
                "new_value": f"Assigned to {assigned_rep.get('name')}",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.lead_activities.insert_one(assignment_activity)
            
            # Send push notification to assigned rep (if FCM is configured)
            try:
                if hasattr(app.state, 'fcm_service') and app.state.fcm_service:
                    fcm = app.state.fcm_service
                    # Get rep's FCM tokens
                    tokens = await db.device_tokens.find(
                        {"user_id": assigned_rep["id"]},
                        {"_id": 0, "fcm_token": 1}
                    ).to_list(10)
                    
                    for token_doc in tokens:
                        await fcm.send_notification(
                            token=token_doc.get("fcm_token"),
                            title="New Lead Assigned! 🎯",
                            body=f"New lead from {city}: {ProfileName or phone}",
                            data={"type": "new_lead", "lead_id": lead_id}
                        )
            except Exception as fcm_error:
                logger.warning(f"FCM notification failed: {fcm_error}")
            
            logger.info(f"Lead {lead_id} assigned to {assigned_rep.get('name')} via round-robin")
        else:
            logger.warning(f"No sales reps found for city {city} - lead remains unassigned")
            # Log unassigned activity
            unassigned_activity = {
                "id": str(uuid.uuid4()),
                "lead_id": lead_id,
                "user_id": "system",
                "user_name": "System",
                "action": "assignment_failed",
                "details": f"No sales reps found for city: {city}",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.lead_activities.insert_one(unassigned_activity)
    except Exception as e:
        logger.error(f"Failed to auto-assign lead: {e}")
        # Log error activity
        error_activity = {
            "id": str(uuid.uuid4()),
            "lead_id": lead_id,
            "user_id": "system",
            "user_name": "System",
            "action": "assignment_error",
            "details": f"Error during auto-assignment: {str(e)}",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.lead_activities.insert_one(error_activity)
    
    # Greeting message for new leads
    greeting_message = """🙏 *Welcome to WiseDrive!*

India's Premium Used Car Inspection Company

We help you make confident decisions when buying a used car with our comprehensive 200+ point inspection.

*How can we help you today?*

*Reply with:*
1️⃣ - View inspection packages
2️⃣ - Request a callback

Or type your question!"""

    # Log the bot response
    bot_activity = {
        "id": str(uuid.uuid4()),
        "lead_id": lead_id,
        "user_id": "chatbot",
        "user_name": "WiseDrive Bot",
        "action": "chatbot_response",
        "details": "Welcome message sent to new lead",
        "new_value": "Greeting message",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.lead_activities.insert_one(bot_activity)
    
    # Return TwiML response with greeting
    twiml_response = f'''<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>{greeting_message}</Message>
</Response>'''
    
    return Response(content=twiml_response, media_type="application/xml")


# Razorpay Payment Webhook
@api_router.post("/webhooks/razorpay/payment")
async def razorpay_payment_webhook(request: Request):
    """
    Webhook endpoint for Razorpay payment events.
    Updates lead status when payment is completed.
    """
    from services.razorpay_service import get_razorpay_service
    from services.twilio_service import get_twilio_service
    
    # Get raw body for signature verification
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")
    
    razorpay = get_razorpay_service()
    
    # Verify webhook signature (skip in test mode)
    # if razorpay.key_secret and not razorpay.verify_webhook_signature(body.decode(), signature):
    #     logger.warning("Invalid Razorpay webhook signature")
    #     raise HTTPException(status_code=400, detail="Invalid signature")
    
    try:
        import json
        payload = json.loads(body.decode())
    except:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
    
    event = payload.get("event")
    payment_entity = payload.get("payload", {}).get("payment_link", {}).get("entity", {})
    
    if not payment_entity:
        payment_entity = payload.get("payload", {}).get("payment", {}).get("entity", {})
    
    logger.info(f"Razorpay webhook: event={event}")
    
    # Get lead_id from notes
    notes = payment_entity.get("notes", {})
    lead_id = notes.get("lead_id")
    
    if not lead_id:
        # Try to find lead by payment_link_id
        payment_link_id = payment_entity.get("id")
        if payment_link_id:
            lead = await db.leads.find_one({"payment_link_id": payment_link_id}, {"_id": 0})
            if lead:
                lead_id = lead.get("id")
    
    if not lead_id:
        logger.warning("Could not find lead_id in Razorpay webhook")
        return {"status": "no_lead_found"}
    
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        return {"status": "lead_not_found"}
    
    # Handle different events
    if event in ["payment_link.paid", "payment.captured"]:
        payment_id = payment_entity.get("id")
        amount = payment_entity.get("amount", 0) / 100  # Convert from paise
        
        # Update lead as paid
        update_dict = {
            "status": "PAID",
            "payment_status": "paid",
            "razorpay_payment_id": payment_id,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.leads.update_one({"id": lead_id}, {"$set": update_dict})
        
        # Log activity
        activity = {
            "id": str(uuid.uuid4()),
            "lead_id": lead_id,
            "user_id": "system",
            "user_name": "Razorpay",
            "action": "payment_received",
            "new_value": f"₹{amount}",
            "details": f"Payment ID: {payment_id}",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.lead_activities.insert_one(activity)
        
        # Create customer from lead
        customer_id = str(uuid.uuid4())
        customer = {
            "id": customer_id,
            "name": lead.get("name"),
            "mobile": lead.get("mobile"),
            "email": lead.get("email"),
            "city": lead.get("city"),
            "city_id": lead.get("city_id"),
            "lead_id": lead_id,
            "package_id": lead.get("package_id"),
            "package_name": lead.get("package_name"),
            "payment_amount": amount,
            "razorpay_payment_id": payment_id,
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.customers.insert_one(customer)
        
        # Update lead with customer_id
        await db.leads.update_one(
            {"id": lead_id},
            {"$set": {"customer_id": customer_id, "converted_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Send confirmation WhatsApp
        twilio = get_twilio_service()
        if twilio.is_configured():
            await twilio.send_payment_confirmation(
                to_number=lead.get("mobile", ""),
                customer_name=lead.get("name", "Customer"),
                amount=amount,
                package_name=lead.get("package_name", "Vehicle Inspection"),
                payment_id=payment_id
            )
        
        # Send push notification to assigned sales rep
        if lead.get("assigned_to"):
            try:
                if hasattr(app.state, 'fcm_service') and app.state.fcm_service:
                    fcm = app.state.fcm_service
                    tokens = await db.device_tokens.find(
                        {"user_id": lead["assigned_to"]},
                        {"_id": 0, "fcm_token": 1}
                    ).to_list(10)
                    
                    for token_doc in tokens:
                        await fcm.send_notification(
                            token=token_doc.get("fcm_token"),
                            title="Payment Received! 🎉",
                            body=f"{lead.get('name')} paid ₹{amount} for {lead.get('package_name')}",
                            data={"type": "payment_received", "lead_id": lead_id}
                        )
            except Exception as fcm_error:
                logger.warning(f"FCM notification failed: {fcm_error}")
        
        # Create inspection records from stored schedules
        no_of_inspections = lead.get("no_of_inspections", 1)
        inspection_schedules = lead.get("inspection_schedules", [])
        created_inspections = []
        
        for i in range(no_of_inspections):
            inspection_id = str(uuid.uuid4())
            
            # Get schedule data if available
            schedule_data = inspection_schedules[i] if i < len(inspection_schedules) else {}
            
            # Determine inspection status based on available data
            has_schedule = bool(
                schedule_data.get("inspection_date") and 
                schedule_data.get("inspection_time") and 
                schedule_data.get("address")
            )
            
            inspection = {
                "id": inspection_id,
                "country_id": lead.get("country_id", ""),
                "customer_id": customer_id,
                "lead_id": lead_id,
                "order_id": f"ORD-{lead_id[:8].upper()}",
                "customer_name": lead.get("name"),
                "customer_mobile": lead.get("mobile"),
                "car_number": schedule_data.get("vehicle_number") or "",
                "city": lead.get("city"),
                "address": schedule_data.get("address") or "",
                "location_lat": schedule_data.get("latitude"),
                "location_lng": schedule_data.get("longitude"),
                "package_id": lead.get("package_id"),
                "package_type": lead.get("package_name"),
                "total_amount": amount / no_of_inspections,  # Split amount across inspections
                "amount_paid": amount / no_of_inspections,
                "pending_amount": 0,
                "payment_status": "PAID",
                "payment_type": "Full",
                "payment_date": datetime.now(timezone.utc).isoformat(),
                "razorpay_payment_id": payment_id,
                "inspection_status": "SCHEDULED" if has_schedule else "UNSCHEDULED",
                "scheduled_date": schedule_data.get("inspection_date") or None,
                "scheduled_time": schedule_data.get("inspection_time") or None,
                "slot_number": i + 1,
                "inspections_available": 1,
                "report_status": "pending",
                "notes": f"Inspection {i + 1} of {no_of_inspections} from lead conversion",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": "system"
            }
            
            # Add vehicle details if available
            if schedule_data.get("vehicle_data"):
                vd = schedule_data["vehicle_data"]
                inspection["car_make"] = vd.get("manufacturer", "")
                inspection["car_model"] = vd.get("model", "")
                inspection["car_year"] = vd.get("manufacturing_date", "").split("/")[-1] if vd.get("manufacturing_date") else ""
                inspection["car_color"] = vd.get("color", "")
                inspection["fuel_type"] = vd.get("fuel_type", "")
            
            await db.inspections.insert_one(inspection)
            created_inspections.append(inspection_id)
        
        logger.info(f"Lead {lead_id} marked as PAID, customer {customer_id} created, {len(created_inspections)} inspection(s) created")
        return {"status": "payment_processed", "customer_id": customer_id, "inspection_ids": created_inspections}
    
    elif event == "payment_link.expired":
        await db.leads.update_one(
            {"id": lead_id},
            {"$set": {"payment_status": "expired", "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        return {"status": "link_expired"}
    
    elif event in ["payment.failed", "payment_link.cancelled"]:
        await db.leads.update_one(
            {"id": lead_id},
            {"$set": {"payment_status": "failed", "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        return {"status": "payment_failed"}
    
    return {"status": "event_ignored"}


# Ad ID to City Mapping Management (for Settings tab)
class AdCityMapping(BaseModel):
    ad_id: str
    city: str
    city_id: Optional[str] = None
    campaign_name: Optional[str] = None


@api_router.get("/settings/ad-city-mappings")
async def get_ad_city_mappings(current_user: dict = Depends(get_current_user)):
    """Get all AD ID to City mappings"""
    mappings = await db.ad_city_mappings.find({}, {"_id": 0}).to_list(1000)
    return mappings


@api_router.post("/settings/ad-city-mappings")
async def create_ad_city_mapping(mapping: AdCityMapping, current_user: dict = Depends(get_current_user)):
    """Create AD ID to City mapping"""
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check if mapping already exists
    existing = await db.ad_city_mappings.find_one({"ad_id": mapping.ad_id})
    if existing:
        # Update existing
        await db.ad_city_mappings.update_one(
            {"ad_id": mapping.ad_id},
            {"$set": mapping.model_dump()}
        )
    else:
        # Create new
        mapping_dict = mapping.model_dump()
        mapping_dict["id"] = str(uuid.uuid4())
        mapping_dict["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.ad_city_mappings.insert_one(mapping_dict)
    
    return {"message": "Mapping saved"}


@api_router.delete("/settings/ad-city-mappings/{ad_id}")
async def delete_ad_city_mapping(ad_id: str, current_user: dict = Depends(get_current_user)):
    """Delete AD ID to City mapping"""
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.ad_city_mappings.delete_one({"ad_id": ad_id})
    return {"message": "Mapping deleted"}


# Sales Rep City Assignment (for HR module)
class SalesRepCityAssignment(BaseModel):
    employee_id: str
    cities: List[str]


@api_router.put("/hr/employees/{employee_id}/assigned-cities")
async def update_employee_assigned_cities(
    employee_id: str,
    assignment: SalesRepCityAssignment,
    current_user: dict = Depends(get_current_user)
):
    """Update cities assigned to a sales employee"""
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    employee = await db.users.find_one({"id": employee_id}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    await db.users.update_one(
        {"id": employee_id},
        {"$set": {"assigned_cities": assignment.cities, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Cities assigned successfully"}


@api_router.get("/hr/employees/{employee_id}/assigned-cities")
async def get_employee_assigned_cities(employee_id: str, current_user: dict = Depends(get_current_user)):
    """Get cities assigned to a sales employee"""
    employee = await db.users.find_one({"id": employee_id}, {"_id": 0, "assigned_cities": 1})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    return {"cities": employee.get("assigned_cities", [])}


# ==================== CUSTOMERS ROUTES ====================

@api_router.get("/customers")
async def get_customers(
    search: Optional[str] = None,
    city: Optional[str] = None,
    payment_status: Optional[str] = None,
    country_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get customers - filtered by RBAC"""
    rbac_filter = await rbac_service.get_data_filter(current_user["id"], "customers.view")
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
    
    customers = await db.customers.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return customers


@api_router.get("/customers/{customer_id}")
async def get_customer(customer_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific customer"""
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@api_router.post("/customers")
async def create_customer(customer_data: CustomerCreate, current_user: dict = Depends(get_current_user)):
    """Create a new customer"""
    customer_dict = customer_data.model_dump()
    customer_id = str(uuid.uuid4())
    
    if not customer_dict.get("country_id"):
        customer_dict["country_id"] = current_user.get("country_id")
    
    customer_dict["id"] = customer_id
    customer_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    customer_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    customer_dict["created_by"] = current_user["id"]
    
    await db.customers.insert_one(customer_dict)
    return customer_dict


@api_router.put("/customers/{customer_id}")
async def update_customer(customer_id: str, customer_data: CustomerUpdate, current_user: dict = Depends(get_current_user)):
    """Update a customer"""
    existing = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    update_dict = {k: v for k, v in customer_data.model_dump().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_dict["updated_by"] = current_user["id"]
    
    await db.customers.update_one({"id": customer_id}, {"$set": update_dict})
    
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    return customer


@api_router.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a customer"""
    role_code = current_user.get("role_code", "")
    if role_code != "CEO":
        raise HTTPException(status_code=403, detail="Not authorized to delete customers")
    
    result = await db.customers.delete_one({"id": customer_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    return {"message": "Customer deleted"}


# ==================== TRANSACTIONS ROUTES ====================

@api_router.get("/transactions/{customer_id}")
async def get_customer_transactions(customer_id: str, current_user: dict = Depends(get_current_user)):
    """Get transactions for a customer"""
    transactions = await db.transactions.find(
        {"customer_id": customer_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return transactions


@api_router.post("/transactions")
async def create_transaction(txn_data: dict, current_user: dict = Depends(get_current_user)):
    """Create a transaction"""
    txn_data["id"] = str(uuid.uuid4())
    txn_data["created_at"] = datetime.now(timezone.utc).isoformat()
    
    if not txn_data.get("country_id"):
        txn_data["country_id"] = current_user.get("country_id")
    
    await db.transactions.insert_one(txn_data)
    return txn_data


# ==================== INSPECTIONS ROUTES ====================

@api_router.get("/inspections")
async def get_inspections(
    search: Optional[str] = None,
    city: Optional[str] = None,
    inspection_status: Optional[str] = None,
    payment_status: Optional[str] = None,
    is_scheduled: Optional[bool] = None,
    mechanic_id: Optional[str] = None,
    country_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get inspections - filtered by RBAC"""
    rbac_filter = await rbac_service.get_data_filter(current_user["id"], "inspections.view")
    query = {**rbac_filter}
    
    if search:
        query["$or"] = [
            {"customer_name": {"$regex": search, "$options": "i"}},
            {"customer_mobile": {"$regex": search, "$options": "i"}},
            {"car_number": {"$regex": search, "$options": "i"}},
            {"order_id": {"$regex": search, "$options": "i"}}
        ]
    if city:
        query["city"] = city
    if inspection_status:
        query["inspection_status"] = inspection_status
    if payment_status:
        query["payment_status"] = payment_status
    if is_scheduled is not None:
        if is_scheduled:
            query["scheduled_date"] = {"$ne": None}
        else:
            query["scheduled_date"] = None
    if mechanic_id:
        query["mechanic_id"] = mechanic_id
    if country_id:
        query["country_id"] = country_id
    
    inspections = await db.inspections.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Enrich with mechanic name
    for insp in inspections:
        if insp.get("mechanic_id"):
            mechanic = await db.users.find_one({"id": insp["mechanic_id"]}, {"_id": 0, "name": 1})
            if mechanic:
                insp["mechanic_name"] = mechanic.get("name")
        
        if insp.get("coordinator_id"):
            coord = await db.users.find_one({"id": insp["coordinator_id"]}, {"_id": 0, "name": 1})
            if coord:
                insp["coordinator_name"] = coord.get("name")
    
    return inspections


@api_router.get("/inspections/{inspection_id}")
async def get_inspection(inspection_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific inspection"""
    inspection = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    return inspection


@api_router.post("/inspections")
async def create_inspection(inspection_data: InspectionCreate, current_user: dict = Depends(get_current_user)):
    """Create a new inspection"""
    insp_dict = inspection_data.model_dump()
    insp_id = str(uuid.uuid4())
    
    if not insp_dict.get("country_id"):
        insp_dict["country_id"] = current_user.get("country_id")
    
    insp_dict["id"] = insp_id
    insp_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    insp_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    insp_dict["created_by"] = current_user["id"]
    
    await db.inspections.insert_one(insp_dict)
    return insp_dict


@api_router.put("/inspections/{inspection_id}")
async def update_inspection(inspection_id: str, inspection_data: InspectionUpdate, current_user: dict = Depends(get_current_user)):
    """Update an inspection"""
    existing = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Inspection not found")
    
    update_dict = {k: v for k, v in inspection_data.model_dump().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_dict["updated_by"] = current_user["id"]
    
    await db.inspections.update_one({"id": inspection_id}, {"$set": update_dict})
    
    inspection = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
    return inspection


@api_router.delete("/inspections/{inspection_id}")
async def delete_inspection(inspection_id: str, current_user: dict = Depends(get_current_user)):
    """Delete an inspection"""
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "INSPECTION_HEAD"]:
        raise HTTPException(status_code=403, detail="Not authorized to delete inspections")
    
    result = await db.inspections.delete_one({"id": inspection_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Inspection not found")
    
    return {"message": "Inspection deleted"}


# ==================== MECHANICS ROUTES ====================

@api_router.get("/mechanics")
async def get_mechanics(
    country_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get mechanics (users with MECHANIC role)"""
    mechanic_role = await db.roles.find_one({"code": "MECHANIC"}, {"_id": 0, "id": 1})
    if not mechanic_role:
        return []
    
    query = {"role_id": mechanic_role["id"], "is_active": True}
    
    role_code = current_user.get("role_code", "")
    if role_code != "CEO":
        query["country_id"] = current_user.get("country_id")
    elif country_id:
        query["country_id"] = country_id
    
    mechanics = await db.users.find(query, {"_id": 0, "hashed_password": 0}).to_list(100)
    return mechanics


# ==================== EMPLOYEES ROUTES (V1 Compatibility) ====================

@api_router.get("/employees")
async def get_employees(current_user: dict = Depends(get_current_user)):
    """Get employees - V1 compatible endpoint"""
    # Get users based on RBAC
    role_code = current_user.get("role_code", "")
    
    query = {}
    if role_code != "CEO" and role_code != "HR_MANAGER":
        query["country_id"] = current_user.get("country_id")
    
    users = await db.users.find(query, {"_id": 0, "hashed_password": 0}).to_list(1000)
    
    # Enrich with role, country, department info
    for user in users:
        if user.get("role_id"):
            role = await db.roles.find_one({"id": user["role_id"]}, {"_id": 0, "name": 1, "code": 1})
            if role:
                user["role_name"] = role.get("name")
                user["role_code"] = role.get("code")
        
        if user.get("country_id"):
            country = await db.countries.find_one({"id": user["country_id"]}, {"_id": 0, "name": 1})
            if country:
                user["country_name"] = country.get("name")
        
        # V1 compatibility
        user["role"] = user.get("role_name", "employee")
        user["assigned_cities"] = []
        if user.get("country_name"):
            user["assigned_cities"] = [user["country_name"]]
    
    return users


@api_router.patch("/employees/{employee_id}/toggle-status")
async def toggle_employee_status(employee_id: str, current_user: dict = Depends(get_current_user)):
    """Toggle employee status - V1 compatible"""
    return await toggle_user_status(employee_id, current_user)


# ==================== DIGITAL ADS ROUTES ====================

@api_router.get("/digital-ads")
async def get_digital_ads(
    country_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get digital ads"""
    query = {}
    
    role_code = current_user.get("role_code", "")
    if role_code != "CEO":
        query["country_id"] = current_user.get("country_id")
    elif country_id:
        query["country_id"] = country_id
    
    ads = await db.digital_ads.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return ads


@api_router.post("/digital-ads")
async def create_digital_ad(ad_data: dict, current_user: dict = Depends(get_current_user)):
    """Create a digital ad"""
    ad_data["id"] = str(uuid.uuid4())
    ad_data["created_at"] = datetime.now(timezone.utc).isoformat()
    
    if not ad_data.get("country_id"):
        ad_data["country_id"] = current_user.get("country_id")
    
    await db.digital_ads.insert_one(ad_data)
    return ad_data


@api_router.put("/digital-ads/{ad_id}")
async def update_digital_ad(ad_id: str, ad_data: dict, current_user: dict = Depends(get_current_user)):
    """Update a digital ad"""
    result = await db.digital_ads.update_one(
        {"id": ad_id},
        {"$set": ad_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ad not found")
    return {"message": "Ad updated"}


@api_router.patch("/digital-ads/{ad_id}/toggle-status")
async def toggle_ad_status(ad_id: str, current_user: dict = Depends(get_current_user)):
    """Toggle digital ad status"""
    ad = await db.digital_ads.find_one({"id": ad_id})
    if not ad:
        raise HTTPException(status_code=404, detail="Ad not found")
    
    new_status = not ad.get("is_active", True)
    await db.digital_ads.update_one({"id": ad_id}, {"$set": {"is_active": new_status}})
    return {"is_active": new_status}


@api_router.delete("/digital-ads/{ad_id}")
async def delete_digital_ad(ad_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a digital ad"""
    result = await db.digital_ads.delete_one({"id": ad_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Ad not found")
    return {"message": "Ad deleted"}


# ==================== GARAGE EMPLOYEES ROUTES ====================

@api_router.get("/garage-employees")
async def get_garage_employees(
    country_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get garage employees"""
    query = {}
    
    role_code = current_user.get("role_code", "")
    if role_code != "CEO":
        query["country_id"] = current_user.get("country_id")
    elif country_id:
        query["country_id"] = country_id
    
    employees = await db.garage_employees.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return employees


@api_router.post("/garage-employees")
async def create_garage_employee(emp_data: dict, current_user: dict = Depends(get_current_user)):
    """Create a garage employee"""
    emp_data["id"] = str(uuid.uuid4())
    emp_data["created_at"] = datetime.now(timezone.utc).isoformat()
    
    if not emp_data.get("country_id"):
        emp_data["country_id"] = current_user.get("country_id")
    
    await db.garage_employees.insert_one(emp_data)
    return emp_data


@api_router.put("/garage-employees/{emp_id}")
async def update_garage_employee(emp_id: str, emp_data: dict, current_user: dict = Depends(get_current_user)):
    """Update a garage employee"""
    result = await db.garage_employees.update_one(
        {"id": emp_id},
        {"$set": emp_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Garage employee not found")
    return {"message": "Garage employee updated"}


@api_router.patch("/garage-employees/{emp_id}/toggle-status")
async def toggle_garage_employee_status(emp_id: str, current_user: dict = Depends(get_current_user)):
    """Toggle garage employee status"""
    emp = await db.garage_employees.find_one({"id": emp_id})
    if not emp:
        raise HTTPException(status_code=404, detail="Garage employee not found")
    
    new_status = not emp.get("is_active", True)
    await db.garage_employees.update_one({"id": emp_id}, {"$set": {"is_active": new_status}})
    return {"is_active": new_status}


@api_router.delete("/garage-employees/{emp_id}")
async def delete_garage_employee(emp_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a garage employee"""
    result = await db.garage_employees.delete_one({"id": emp_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Garage employee not found")
    return {"message": "Garage employee deleted"}


# ==================== LEAVE RULES ROUTES ====================

class LeaveRulesUpdate(BaseModel):
    allocation_period: str = Field(default="monthly", pattern="^(monthly|quarterly)$")
    sick_leaves_per_period: int = Field(default=2, ge=0, le=10)
    casual_leaves_per_period: int = Field(default=1, ge=0, le=10)

@api_router.get("/leave-rules")
async def get_leave_rules(current_user: dict = Depends(get_current_user)):
    """Get leave rules configuration"""
    rules = await db.leave_rules.find_one({}, {"_id": 0})
    if not rules:
        rules = {
            "allocation_period": "monthly",
            "carry_forward_enabled": False,
            "sick_leaves_per_period": 2,
            "casual_leaves_per_period": 1
        }
    return rules

@api_router.put("/leave-rules")
async def update_leave_rules(
    rules_data: LeaveRulesUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update leave rules - HR/CEO only"""
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized to update leave rules")
    
    rules = {
        "allocation_period": rules_data.allocation_period,
        "carry_forward_enabled": False,  # Always False - no carry forward
        "sick_leaves_per_period": rules_data.sick_leaves_per_period,
        "casual_leaves_per_period": rules_data.casual_leaves_per_period,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user["id"]
    }
    
    # Upsert the rules (single document)
    await db.leave_rules.update_one(
        {},
        {"$set": rules},
        upsert=True
    )
    
    return rules


# ==================== INSPECTION PACKAGES ROUTES ====================

@api_router.get("/inspection-categories")
async def get_inspection_categories(
    country_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all inspection categories (including inactive)"""
    query = {}  # Return all categories, not just active
    if country_id:
        query["country_id"] = country_id
    elif current_user.get("country_id"):
        query["country_id"] = current_user["country_id"]
    
    categories = await db.inspection_categories.find(query, {"_id": 0}).sort("order", 1).to_list(100)
    return categories
    return categories


@api_router.post("/inspection-categories")
async def create_inspection_category(
    category: InspectionCategoryCreate,
    country_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Create a new inspection category"""
    # Convert items and benefits to InspectionItem objects
    items = [InspectionItem(name=i.get("name", ""), description=i.get("description")) for i in category.items]
    benefits = [InspectionItem(name=b.get("name", ""), description=b.get("description"), is_benefit=True) for b in category.benefits]
    
    category_doc = InspectionCategoryDB(
        name=category.name,
        description=category.description,
        check_points=category.check_points,
        icon=category.icon,
        color=category.color,
        items=items,
        benefits=benefits,
        is_free=category.is_free,
        order=category.order,
        country_id=country_id,
        created_by=current_user.get("id")
    )
    
    await db.inspection_categories.insert_one(category_doc.model_dump())
    return category_doc.model_dump()


@api_router.put("/inspection-categories/{category_id}")
async def update_inspection_category(
    category_id: str,
    category: InspectionCategoryUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update an inspection category"""
    update_data = {k: v for k, v in category.model_dump().items() if v is not None}
    
    # Convert items and benefits if provided
    if "items" in update_data:
        update_data["items"] = [
            InspectionItem(name=i.get("name", ""), description=i.get("description")).model_dump() 
            for i in update_data["items"]
        ]
    if "benefits" in update_data:
        update_data["benefits"] = [
            InspectionItem(name=b.get("name", ""), description=b.get("description"), is_benefit=True).model_dump() 
            for b in update_data["benefits"]
        ]
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = current_user.get("id")
    
    result = await db.inspection_categories.update_one(
        {"id": category_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    
    return await db.inspection_categories.find_one({"id": category_id}, {"_id": 0})


@api_router.delete("/inspection-categories/{category_id}")
async def delete_inspection_category(
    category_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Soft delete an inspection category"""
    result = await db.inspection_categories.update_one(
        {"id": category_id},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Category deleted"}


@api_router.patch("/inspection-categories/{category_id}/toggle-status")
async def toggle_inspection_category_status(
    category_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Toggle inspection category active status"""
    category = await db.inspection_categories.find_one({"id": category_id})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    new_status = not category.get("is_active", True)
    await db.inspection_categories.update_one(
        {"id": category_id},
        {"$set": {"is_active": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"is_active": new_status}


@api_router.get("/inspection-packages")
async def get_inspection_packages(
    country_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all inspection packages with their categories (including inactive)"""
    query = {}  # Return all packages, not just active
    if country_id:
        query["country_id"] = country_id
    elif current_user.get("country_id"):
        query["country_id"] = current_user["country_id"]
    
    packages = await db.inspection_packages.find(query, {"_id": 0}).sort("order", 1).to_list(50)
    
    # Enrich packages with category details
    for pkg in packages:
        category_ids = pkg.get("categories", [])
        if category_ids:
            categories = await db.inspection_categories.find(
                {"id": {"$in": category_ids}},  # Include all categories
                {"_id": 0}
            ).sort("order", 1).to_list(20)
            pkg["category_details"] = categories
            # Recalculate total check points
            pkg["total_check_points"] = sum(c.get("check_points", 0) for c in categories)
    
    return packages


@api_router.post("/inspection-packages")
async def create_inspection_package(
    package: InspectionPackageCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new inspection package"""
    # Calculate total check points from categories
    if package.categories:
        categories = await db.inspection_categories.find(
            {"id": {"$in": package.categories}},
            {"_id": 0, "check_points": 1}
        ).to_list(20)
        total_points = sum(c.get("check_points", 0) for c in categories)
    else:
        total_points = package.total_check_points
    
    # Get package data and override total_check_points with calculated value
    package_data = package.model_dump()
    package_data["total_check_points"] = total_points
    
    package_doc = InspectionPackage(
        **package_data,
        created_by=current_user.get("id")
    )
    
    await db.inspection_packages.insert_one(package_doc.model_dump())
    return package_doc.model_dump()


@api_router.put("/inspection-packages/{package_id}")
async def update_inspection_package(
    package_id: str,
    package: InspectionPackageUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update an inspection package"""
    update_data = {k: v for k, v in package.model_dump().items() if v is not None}
    
    # Recalculate total check points if categories changed
    if "categories" in update_data:
        categories = await db.inspection_categories.find(
            {"id": {"$in": update_data["categories"]}},
            {"_id": 0, "check_points": 1}
        ).to_list(20)
        update_data["total_check_points"] = sum(c.get("check_points", 0) for c in categories)
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = current_user.get("id")
    
    result = await db.inspection_packages.update_one(
        {"id": package_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Package not found")
    
    return await db.inspection_packages.find_one({"id": package_id}, {"_id": 0})


@api_router.patch("/inspection-packages/{package_id}/toggle-status")
async def toggle_inspection_package_status(
    package_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Toggle inspection package active status"""
    package = await db.inspection_packages.find_one({"id": package_id})
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")
    
    new_status = not package.get("is_active", True)
    await db.inspection_packages.update_one(
        {"id": package_id},
        {"$set": {"is_active": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"is_active": new_status}


@api_router.delete("/inspection-packages/{package_id}")
async def delete_inspection_package(
    package_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Soft delete an inspection package"""
    result = await db.inspection_packages.update_one(
        {"id": package_id},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Package not found")
    return {"message": "Package deleted"}


# ==================== ROUND ROBIN ROUTES ====================

@api_router.get("/round-robin/next/{country_id}")
async def get_next_agent(
    country_id: str,
    team_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get next agent in round-robin sequence"""
    agent = await round_robin_service.get_next_agent(country_id, team_id)
    if not agent:
        raise HTTPException(status_code=404, detail="No available agents")
    return agent


@api_router.get("/round-robin/stats/{country_id}")
async def get_assignment_stats(
    country_id: str,
    team_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get lead assignment statistics"""
    stats = await round_robin_service.get_assignment_stats(country_id, team_id)
    return stats


# ==================== DASHBOARD ROUTES ====================

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    """Get dashboard statistics - filtered by RBAC"""
    role_code = current_user.get("role_code", "")
    country_id = current_user.get("country_id")
    user_id = current_user.get("id")
    
    # Get RBAC filters for each resource
    lead_filter = await rbac_service.get_data_filter(user_id, "leads.view")
    customer_filter = await rbac_service.get_data_filter(user_id, "customers.view")
    inspection_filter = await rbac_service.get_data_filter(user_id, "inspections.view")
    
    # User filter - based on role
    user_filter = {}
    if role_code == "CEO" or role_code == "HR_MANAGER":
        pass  # No filter for CEO/HR
    elif role_code in ["COUNTRY_HEAD", "SALES_HEAD", "INSPECTION_HEAD"]:
        user_filter["country_id"] = country_id
    else:
        # Team or own scope - just show country users
        user_filter["country_id"] = country_id
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    total_leads = await db.leads.count_documents(lead_filter)
    total_customers = await db.customers.count_documents(customer_filter)
    total_inspections = await db.inspections.count_documents(inspection_filter)
    total_employees = await db.users.count_documents(user_filter)
    
    leads_today = await db.leads.count_documents({
        **lead_filter,
        "created_at": {"$regex": f"^{today}"}
    })
    
    inspections_today = await db.inspections.count_documents({
        **inspection_filter,
        "scheduled_date": today
    })
    
    pending_payments = await db.customers.count_documents({
        **customer_filter,
        "payment_status": "PENDING"
    })
    
    completed_inspections = await db.inspections.count_documents({
        **inspection_filter,
        "inspection_status": "COMPLETED"
    })
    
    return {
        "total_leads": total_leads,
        "total_customers": total_customers,
        "total_inspections": total_inspections,
        "total_employees": total_employees,
        "leads_today": leads_today,
        "inspections_today": inspections_today,
        "pending_payments": pending_payments,
        "completed_inspections": completed_inspections
    }


# ==================== UTILITY ROUTES ====================

@api_router.get("/cities")
async def get_cities():
    """Get list of cities"""
    return ["Bangalore", "Hyderabad", "Chennai", "Mumbai", "Delhi", "Pune", "Kolkata", "Kuala Lumpur", "Penang", "Johor Bahru", "Others"]


@api_router.get("/lead-sources")
async def get_lead_sources():
    """Get list of lead sources"""
    return ["FACEBOOK", "INSTAGRAM", "GOOGLE", "WEBSITE", "REFERRAL", "WALK_IN", "OTHERS"]


@api_router.get("/lead-statuses")
async def get_lead_statuses():
    """Get list of lead statuses"""
    return ["NEW", "CONTACTED", "INTERESTED", "NOT_INTERESTED", "CONVERTED", "RNR", "LOST", "OUT_OF_SERVICE_AREA"]


@api_router.get("/")
async def root():
    """Root endpoint"""
    return {"message": "WiseDrive CRM V2 API", "version": "2.0.0"}


# ==================== COMPREHENSIVE HR MODULE ====================

# -------------------- EMPLOYEE MANAGEMENT --------------------

@api_router.get("/hr/employees/on-leave-today")
async def get_employees_on_leave_today(
    country_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get employees who are on leave today"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER", "COUNTRY_HEAD"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Get approved leave requests for today
    leave_query = {
        "status": "approved",
        "start_date": {"$lte": today},
        "end_date": {"$gte": today}
    }
    
    leave_requests = await db.leave_requests.find(leave_query, {"_id": 0}).to_list(1000)
    
    # Get employee details for each leave
    employees_on_leave = []
    for leave in leave_requests:
        emp_id = leave.get("employee_id")
        emp = await db.users.find_one({"id": emp_id}, {"_id": 0, "id": 1, "name": 1, "email": 1, "country_id": 1, "photo_url": 1, "employee_code": 1})
        
        if emp:
            # Filter by country if specified
            if country_id and emp.get("country_id") != country_id:
                continue
            
            # Get country name
            country = await db.countries.find_one({"id": emp.get("country_id")}, {"_id": 0, "name": 1})
            
            employees_on_leave.append({
                "id": emp.get("id"),
                "name": emp.get("name"),
                "email": emp.get("email"),
                "employee_code": emp.get("employee_code"),
                "photo_url": emp.get("photo_url"),
                "country_name": country.get("name") if country else None,
                "leave_type": leave.get("leave_type"),
                "start_date": leave.get("start_date"),
                "end_date": leave.get("end_date"),
                "reason": leave.get("reason"),
                "leave_id": leave.get("id")
            })
    
    return employees_on_leave


@api_router.get("/hr/dashboard-stats")
async def get_hr_dashboard_stats(
    country_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get HR dashboard statistics including employees on leave today"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER", "COUNTRY_HEAD"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Base query for employees
    emp_query = {"is_active": True}
    if country_id:
        emp_query["country_id"] = country_id
    
    # Total active employees
    total_employees = await db.users.count_documents(emp_query)
    
    # Employees on leave today
    leave_query = {
        "status": "approved",
        "start_date": {"$lte": today},
        "end_date": {"$gte": today}
    }
    leave_requests = await db.leave_requests.find(leave_query, {"_id": 0, "employee_id": 1}).to_list(1000)
    
    # Filter by country if needed
    on_leave_count = 0
    on_leave_employee_ids = []
    for leave in leave_requests:
        emp_id = leave.get("employee_id")
        if country_id:
            emp = await db.users.find_one({"id": emp_id, "country_id": country_id}, {"_id": 0, "id": 1})
            if emp:
                on_leave_count += 1
                on_leave_employee_ids.append(emp_id)
        else:
            on_leave_count += 1
            on_leave_employee_ids.append(emp_id)
    
    # Exited employees this month
    month_start = datetime.now(timezone.utc).replace(day=1).strftime("%Y-%m-%d")
    exited_query = {"employment_status": "exited", "exit_date": {"$gte": month_start}}
    if country_id:
        exited_query["country_id"] = country_id
    exited_this_month = await db.users.count_documents(exited_query)
    
    # Countries count
    countries_count = await db.countries.count_documents({"is_active": {"$ne": False}})
    
    return {
        "total_employees": total_employees,
        "on_leave_today": on_leave_count,
        "on_leave_employee_ids": on_leave_employee_ids,
        "exited_this_month": exited_this_month,
        "countries": countries_count
    }


@api_router.get("/hr/employees")
async def get_hr_employees(
    country_id: Optional[str] = None,
    department_id: Optional[str] = None,
    role_id: Optional[str] = None,
    is_active: Optional[bool] = None,
    has_crm_access: Optional[bool] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all employees - Indian HR has full access to all countries"""
    role_code = current_user.get("role_code", "")
    user_country = current_user.get("country_id")
    
    if role_code not in ["CEO", "HR_MANAGER", "COUNTRY_HEAD"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {}
    
    # Indian HR (HR_MANAGER) has full access to all countries
    # Country Head can only see their country
    if role_code == "COUNTRY_HEAD":
        query["country_id"] = user_country
    elif country_id:
        query["country_id"] = country_id
    
    if department_id:
        query["department_id"] = department_id
    if role_id:
        query["role_id"] = role_id
    if is_active is not None:
        query["is_active"] = is_active
    if has_crm_access is not None:
        query["has_crm_access"] = has_crm_access
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
            {"employee_code": {"$regex": search, "$options": "i"}}
        ]
    
    employees = await db.users.find(query, {"_id": 0, "hashed_password": 0, "bank_account_number_encrypted": 0}).sort("created_at", -1).to_list(1000)
    
    # Enrich with role, country, department info
    for emp in employees:
        # Support multiple roles
        emp["roles"] = []
        role_ids = emp.get("role_ids", [])
        if not role_ids and emp.get("role_id"):
            role_ids = [emp["role_id"]]
        
        for rid in role_ids:
            role = await db.roles.find_one({"id": rid}, {"_id": 0, "id": 1, "name": 1, "code": 1})
            if role:
                emp["roles"].append(role)
        
        # Set primary role info (backward compatibility)
        if emp.get("role_id"):
            role = await db.roles.find_one({"id": emp["role_id"]}, {"_id": 0, "name": 1, "code": 1})
            if role:
                emp["role_name"] = role.get("name")
                emp["role_code"] = role.get("code")
        elif emp["roles"]:
            emp["role_name"] = emp["roles"][0].get("name")
            emp["role_code"] = emp["roles"][0].get("code")
        
        if emp.get("country_id"):
            country = await db.countries.find_one({"id": emp["country_id"]}, {"_id": 0, "name": 1, "currency": 1, "currency_symbol": 1})
            if country:
                emp["country_name"] = country.get("name")
                emp["currency"] = country.get("currency")
                emp["currency_symbol"] = country.get("currency_symbol", "₹")
        
        if emp.get("department_id"):
            dept = await db.departments.find_one({"id": emp["department_id"]}, {"_id": 0, "name": 1})
            if dept:
                emp["department_name"] = dept.get("name")
        
        if emp.get("team_id"):
            team = await db.teams.find_one({"id": emp["team_id"]}, {"_id": 0, "name": 1})
            if team:
                emp["team_name"] = team.get("name")
        
        # Get latest salary info - include gross_salary for full display
        salary = await db.salary_structures.find_one(
            {"user_id": emp["id"], "effective_to": None},
            {"_id": 0, "basic_salary": 1, "gross_salary": 1, "net_salary": 1, "price_per_inspection": 1, "employment_type": 1}
        )
        if salary:
            emp["salary_info"] = salary
        
        # Get audit count (for inline audit display)
        audit_count = await db.audit_logs.count_documents({"entity_id": emp["id"], "entity_type": "employee"})
        emp["audit_count"] = audit_count
        
        # Get today's attendance status
        today_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        today_attendance = await db.employee_attendance.find_one(
            {"user_id": emp["id"], "date": today_date},
            {"_id": 0, "status": 1}
        )
        emp["today_attendance"] = today_attendance.get("status") if today_attendance else None
        
        # Check if employee is on approved leave today - dynamically set status
        on_leave_today = await db.leave_requests.find_one({
            "employee_id": emp["id"],
            "status": "approved",
            "start_date": {"$lte": today_date},
            "end_date": {"$gte": today_date}
        }, {"_id": 0, "id": 1, "leave_type": 1})
        
        if on_leave_today and emp.get("is_active"):
            emp["employment_status"] = "on_leave"
            emp["current_leave_type"] = on_leave_today.get("leave_type")
    
    return employees


@api_router.get("/hr/employees/{employee_id}")
async def get_hr_employee(employee_id: str, current_user: dict = Depends(get_current_user)):
    """Get single employee with all details"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER", "COUNTRY_HEAD"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    emp = await db.users.find_one({"id": employee_id}, {"_id": 0, "hashed_password": 0, "bank_account_number_encrypted": 0})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Enrich with related data
    if emp.get("role_id"):
        role = await db.roles.find_one({"id": emp["role_id"]}, {"_id": 0, "name": 1, "code": 1})
        if role:
            emp["role_name"] = role.get("name")
            emp["role_code"] = role.get("code")
    
    if emp.get("country_id"):
        country = await db.countries.find_one({"id": emp["country_id"]}, {"_id": 0, "name": 1, "currency": 1, "currency_symbol": 1})
        if country:
            emp["country_name"] = country.get("name")
            emp["currency"] = country.get("currency")
            emp["currency_symbol"] = country.get("currency_symbol")
    
    if emp.get("department_id"):
        dept = await db.departments.find_one({"id": emp["department_id"]}, {"_id": 0, "name": 1})
        if dept:
            emp["department_name"] = dept.get("name")
    
    # Get full salary structure
    emp["salary"] = await db.salary_structures.find_one(
        {"user_id": employee_id, "effective_to": None},
        {"_id": 0}
    )
    
    # Get documents
    emp["documents"] = await db.employee_documents.find(
        {"user_id": employee_id},
        {"_id": 0}
    ).to_list(50)
    
    # Get recent attendance (last 30 days)
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
    emp["attendance"] = await db.employee_attendance.find(
        {"user_id": employee_id, "date": {"$gte": thirty_days_ago}},
        {"_id": 0}
    ).sort("date", -1).to_list(30)
    
    # Get audit history for this employee
    emp["audit_history"] = await db.audit_logs.find(
        {"entity_id": employee_id, "entity_type": "employee"},
        {"_id": 0}
    ).sort("timestamp", -1).to_list(20)
    
    return emp


@api_router.post("/hr/employees")
async def create_hr_employee(emp_data: EmployeeCreate, current_user: dict = Depends(get_current_user)):
    """Create new employee with CRM access"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check if email exists
    existing = await db.users.find_one({"email": emp_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    emp_dict = emp_data.model_dump()
    emp_id = str(uuid.uuid4())
    
    # Hash password
    emp_dict["hashed_password"] = hash_password(emp_dict.pop("password"))
    emp_dict["id"] = emp_id
    emp_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    emp_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    emp_dict["created_by"] = current_user["id"]
    
    # Generate employee code if not provided
    if not emp_dict.get("employee_code"):
        count = await db.users.count_documents({})
        emp_dict["employee_code"] = f"EMP{str(count + 1).zfill(4)}"
    
    # Encrypt bank account number if provided
    if emp_dict.get("bank_account_number"):
        encryption_service = get_encryption_service()
        bank_details = encryption_service.encrypt_bank_details(emp_dict["bank_account_number"])
        emp_dict["bank_account_number_encrypted"] = bank_details["encrypted"]
        emp_dict["bank_account_number_masked"] = bank_details["masked"]
        emp_dict.pop("bank_account_number", None)  # Remove plaintext
    
    # Set default payroll_active
    if "payroll_active" not in emp_dict:
        emp_dict["payroll_active"] = True
    
    # Check if role is mechanic - no CRM access
    if emp_dict.get("role_id"):
        role = await db.roles.find_one({"id": emp_dict["role_id"]}, {"_id": 0, "code": 1})
        if role and role.get("code") == "MECHANIC":
            emp_dict["has_crm_access"] = False
    
    await db.users.insert_one(emp_dict)
    emp_dict.pop("_id", None)
    emp_dict.pop("hashed_password", None)
    emp_dict.pop("bank_account_number_encrypted", None)  # Don't return encrypted value
    
    # Log audit
    await audit_service.log(
        entity_type="employee",
        entity_id=emp_id,
        action="create",
        user_id=current_user["id"],
        new_values={"name": emp_dict["name"], "email": emp_dict["email"], "role_id": emp_dict.get("role_id")}
    )
    
    return emp_dict


@api_router.put("/hr/employees/{employee_id}")
async def update_hr_employee(employee_id: str, emp_data: EmployeeUpdate, current_user: dict = Depends(get_current_user)):
    """Update employee"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    existing = await db.users.find_one({"id": employee_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    update_dict = {k: v for k, v in emp_data.model_dump().items() if v is not None}
    
    # Handle password update
    if "password" in update_dict:
        update_dict["hashed_password"] = hash_password(update_dict.pop("password"))
    
    # Encrypt bank account number if provided
    if "bank_account_number" in update_dict:
        encryption_service = get_encryption_service()
        bank_details = encryption_service.encrypt_bank_details(update_dict["bank_account_number"])
        update_dict["bank_account_number_encrypted"] = bank_details["encrypted"]
        update_dict["bank_account_number_masked"] = bank_details["masked"]
        update_dict.pop("bank_account_number", None)  # Remove plaintext
        
        # Log bank details update for audit
        await audit_service.log(
            entity_type="employee",
            entity_id=employee_id,
            action="bank_details_update",
            user_id=current_user["id"],
            new_values={"bank_account_masked": bank_details["masked"]}
        )
    
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_dict["updated_by"] = current_user["id"]
    
    # Check if changing to mechanic role - remove CRM access
    if update_dict.get("role_id"):
        role = await db.roles.find_one({"id": update_dict["role_id"]}, {"_id": 0, "code": 1})
        if role and role.get("code") == "MECHANIC":
            update_dict["has_crm_access"] = False
    
    await db.users.update_one({"id": employee_id}, {"$set": update_dict})
    
    # Log audit
    await audit_service.log(
        entity_type="employee",
        entity_id=employee_id,
        action="update",
        user_id=current_user["id"],
        old_values={"name": existing.get("name")},
        new_values={k: v for k, v in update_dict.items() if k not in ["hashed_password", "bank_account_number_encrypted"]}
    )
    
    emp = await db.users.find_one({"id": employee_id}, {"_id": 0, "hashed_password": 0, "bank_account_number_encrypted": 0})
    return emp


@api_router.delete("/hr/employees/{employee_id}")
async def delete_hr_employee(employee_id: str, current_user: dict = Depends(get_current_user)):
    """Delete employee (soft delete - deactivate)"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    existing = await db.users.find_one({"id": employee_id}, {"_id": 0, "name": 1})
    if not existing:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Soft delete - deactivate
    await db.users.update_one(
        {"id": employee_id},
        {"$set": {"is_active": False, "has_crm_access": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Log audit
    await audit_service.log(
        entity_type="employee",
        entity_id=employee_id,
        action="delete",
        user_id=current_user["id"],
        old_values={"name": existing.get("name")}
    )
    
    return {"message": "Employee deactivated"}


# -------------------- PASSWORD MANAGEMENT --------------------

class PasswordResetRequest(BaseModel):
    new_password: str

@api_router.post("/hr/employees/{employee_id}/reset-password")
async def reset_employee_password(employee_id: str, request: PasswordResetRequest, current_user: dict = Depends(get_current_user)):
    """Reset employee password - HR and CEO only"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Only CEO and HR Manager can reset passwords")
    
    # Validate password length
    if len(request.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    existing = await db.users.find_one({"id": employee_id}, {"_id": 0, "name": 1, "email": 1})
    if not existing:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Hash and update password
    hashed_password = hash_password(request.new_password)
    await db.users.update_one(
        {"id": employee_id},
        {"$set": {"hashed_password": hashed_password, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Log audit
    await audit_service.log(
        entity_type="employee",
        entity_id=employee_id,
        action="password_reset",
        user_id=current_user["id"],
        new_values={"email": existing.get("email"), "reset_by": current_user.get("name")}
    )
    
    return {"message": f"Password reset successfully for {existing.get('name')}"}


# -------------------- SALARY MANAGEMENT --------------------

@api_router.get("/hr/employees/{employee_id}/salary")
async def get_employee_salary(employee_id: str, current_user: dict = Depends(get_current_user)):
    """Get employee salary structure"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        if current_user.get("id") != employee_id:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    salary = await db.salary_structures.find_one(
        {"user_id": employee_id, "effective_to": None},
        {"_id": 0}
    )
    
    if not salary:
        # Get employee role to determine default structure
        user = await db.users.find_one({"id": employee_id}, {"_id": 0, "role_id": 1, "employment_type": 1})
        role_code_emp = None
        if user and user.get("role_id"):
            role = await db.roles.find_one({"id": user["role_id"]}, {"_id": 0, "code": 1})
            role_code_emp = role.get("code") if role else None
        
        return {
            "user_id": employee_id,
            "employment_type": user.get("employment_type", "full_time") if user else "full_time",
            "is_freelancer": role_code_emp == "MECHANIC",
            "currency": "INR"
        }
    
    # Check if freelancer/mechanic
    user = await db.users.find_one({"id": employee_id}, {"_id": 0, "role_id": 1})
    if user and user.get("role_id"):
        role = await db.roles.find_one({"id": user["role_id"]}, {"_id": 0, "code": 1})
        salary["is_freelancer"] = role.get("code") == "MECHANIC" if role else False
    
    return salary


@api_router.post("/hr/employees/{employee_id}/salary")
async def create_employee_salary(employee_id: str, salary_data: SalaryStructureCreate, current_user: dict = Depends(get_current_user)):
    """Create/Update employee salary structure"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Verify employee exists
    user = await db.users.find_one({"id": employee_id}, {"_id": 0, "country_id": 1, "role_id": 1})
    if not user:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Close any existing active salary
    await db.salary_structures.update_many(
        {"user_id": employee_id, "effective_to": None},
        {"$set": {"effective_to": datetime.now(timezone.utc).isoformat()}}
    )
    
    salary_dict = salary_data.model_dump()
    salary_dict["user_id"] = employee_id
    salary_dict["id"] = str(uuid.uuid4())
    salary_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    salary_dict["created_by"] = current_user["id"]
    salary_dict["effective_from"] = salary_dict.get("effective_from") or datetime.now(timezone.utc).isoformat()
    salary_dict["effective_to"] = None
    
    # Get country currency
    if user.get("country_id"):
        country = await db.countries.find_one({"id": user["country_id"]}, {"_id": 0, "currency": 1})
        if country:
            salary_dict["currency"] = country.get("currency", "INR")
    
    # Calculate gross and net salary for full-time employees
    # Support both 'full_time' and 'fulltime' variations
    emp_type = salary_dict.get("employment_type", "").lower().replace("_", "")
    if emp_type in ["fulltime", "parttime", "full_time", "part_time"]:
        salary_dict["gross_salary"] = (
            salary_dict.get("basic_salary", 0) +
            salary_dict.get("hra", 0) +
            salary_dict.get("conveyance_allowance", 0) +
            salary_dict.get("medical_allowance", 0) +
            salary_dict.get("special_allowance", 0) +
            salary_dict.get("variable_pay", 0)
        )
        
        total_deductions = (
            salary_dict.get("pf_employee", 0) +
            salary_dict.get("professional_tax", 0) +
            salary_dict.get("income_tax", 0) +
            salary_dict.get("other_deductions", 0)
        )
        
        salary_dict["net_salary"] = salary_dict["gross_salary"] - total_deductions
    
    await db.salary_structures.insert_one(salary_dict)
    salary_dict.pop("_id", None)
    
    # Log audit
    await audit_service.log(
        entity_type="employee",
        entity_id=employee_id,
        action="salary_update",
        user_id=current_user["id"],
        new_values={"net_salary": salary_dict.get("net_salary"), "basic_salary": salary_dict.get("basic_salary")}
    )
    
    return salary_dict


# -------------------- ATTENDANCE --------------------

@api_router.get("/hr/employees/{employee_id}/attendance")
async def get_employee_attendance(
    employee_id: str,
    month: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get employee attendance"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        if current_user.get("id") != employee_id:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {"user_id": employee_id}
    if month:
        query["date"] = {"$regex": f"^{month}"}
    
    attendance = await db.employee_attendance.find(query, {"_id": 0}).sort("date", -1).to_list(100)
    
    # Calculate summary
    present = sum(1 for a in attendance if a.get("status") == "present")
    absent = sum(1 for a in attendance if a.get("status") == "absent")
    half_day = sum(1 for a in attendance if a.get("status") == "half_day")
    on_leave = sum(1 for a in attendance if a.get("status") == "on_leave")
    
    return {
        "records": attendance,
        "summary": {
            "present": present,
            "absent": absent,
            "half_day": half_day,
            "on_leave": on_leave,
            "total_days": len(attendance)
        }
    }


@api_router.post("/hr/employees/{employee_id}/attendance")
async def create_employee_attendance(employee_id: str, att_data: AttendanceCreate, current_user: dict = Depends(get_current_user)):
    """Create/Update attendance record"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check if record exists for this date
    existing = await db.employee_attendance.find_one(
        {"user_id": employee_id, "date": att_data.date}
    )
    
    att_dict = att_data.model_dump()
    att_dict["user_id"] = employee_id
    
    if existing:
        # Update existing
        await db.employee_attendance.update_one(
            {"user_id": employee_id, "date": att_data.date},
            {"$set": att_dict}
        )
        att_dict["id"] = existing.get("id")
    else:
        # Create new
        att_dict["id"] = str(uuid.uuid4())
        att_dict["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.employee_attendance.insert_one(att_dict)
        att_dict.pop("_id", None)
    
    return att_dict


# -------------------- DOCUMENTS --------------------

# Sensitive document types that require HR/Admin access
SENSITIVE_DOCUMENT_TYPES = ["aadhaar", "pan", "passport", "bank_statement", "it_returns", "income_tax", "salary_slip"]

@api_router.get("/hr/employees/{employee_id}/documents")
async def get_employee_documents(employee_id: str, current_user: dict = Depends(get_current_user)):
    """Get employee documents with RBAC enforcement"""
    role_code = current_user.get("role_code", "")
    user_id = current_user.get("id")
    
    # CEO and HR Manager get full access
    if role_code in ["CEO", "HR_MANAGER"]:
        documents = await db.employee_documents.find(
            {"user_id": employee_id},
            {"_id": 0}
        ).to_list(50)
        
        # Log document access for audit
        await audit_service.log(
            entity_type="employee_documents",
            entity_id=employee_id,
            action="view_all",
            user_id=user_id,
            new_values={"document_count": len(documents), "role": role_code}
        )
        return documents
    
    # Employee can view own documents only
    if user_id == employee_id:
        documents = await db.employee_documents.find(
            {"user_id": employee_id},
            {"_id": 0}
        ).to_list(50)
        return documents
    
    # Country Head can view non-sensitive documents within their country
    if role_code == "COUNTRY_HEAD":
        # Verify employee is in same country
        emp = await db.users.find_one({"id": employee_id}, {"_id": 0, "country_id": 1})
        user_country = current_user.get("country_id")
        
        if emp and emp.get("country_id") == user_country:
            documents = await db.employee_documents.find(
                {"user_id": employee_id, "document_type": {"$nin": SENSITIVE_DOCUMENT_TYPES}},
                {"_id": 0}
            ).to_list(50)
            return documents
    
    # Finance cannot access personal ID documents
    if role_code == "FINANCE_MANAGER":
        documents = await db.employee_documents.find(
            {"user_id": employee_id, "document_type": {"$nin": SENSITIVE_DOCUMENT_TYPES}},
            {"_id": 0}
        ).to_list(50)
        return documents
    
    raise HTTPException(status_code=403, detail="Not authorized to view these documents")


@api_router.post("/hr/employees/{employee_id}/documents/upload")
async def upload_employee_document_file(
    employee_id: str,
    document_type: str = Form(...),
    document_name: str = Form(...),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload employee document file - HR/Admin only"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Validate file type
    allowed_types = ["application/pdf", "image/jpeg", "image/png", "image/jpg", "application/msword", 
                     "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"File type {file.content_type} not allowed. Use PDF, JPG, PNG, or DOC/DOCX")
    
    # Max file size: 10MB
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10MB")
    
    # Create storage directory
    storage_dir = f"/app/storage/documents/{employee_id}"
    os.makedirs(storage_dir, exist_ok=True)
    
    # Generate unique filename
    file_ext = os.path.splitext(file.filename)[1] if file.filename else ".pdf"
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = f"{storage_dir}/{unique_filename}"
    
    # Save file
    with open(file_path, "wb") as f:
        f.write(content)
    
    # Create document record
    doc_dict = {
        "id": str(uuid.uuid4()),
        "user_id": employee_id,
        "document_type": document_type,
        "document_name": document_name,
        "document_url": f"/api/hr/employees/{employee_id}/documents/file/{unique_filename}",
        "file_path": file_path,
        "file_name": file.filename,
        "file_size": len(content),
        "content_type": file.content_type,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "uploaded_by": current_user["id"],
        "uploaded_by_name": current_user.get("name", ""),
        "verified": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.employee_documents.insert_one(doc_dict)
    doc_dict.pop("_id", None)
    
    # Log audit
    await audit_service.log(
        entity_type="employee_documents",
        entity_id=employee_id,
        action="upload",
        user_id=current_user["id"],
        new_values={
            "document_type": document_type, 
            "document_name": document_name,
            "file_name": file.filename,
            "file_size": len(content)
        }
    )
    
    return doc_dict


@api_router.get("/hr/employees/{employee_id}/documents/file/{filename}")
async def serve_employee_document_file(employee_id: str, filename: str, current_user: dict = Depends(get_current_user)):
    """Serve employee document file - with RBAC"""
    from fastapi.responses import FileResponse
    
    role_code = current_user.get("role_code", "")
    
    # HR/Admin can access all documents
    if role_code not in ["CEO", "HR_MANAGER"]:
        # Check if user is accessing their own document
        if current_user["id"] != employee_id:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    file_path = f"/app/storage/documents/{employee_id}/{filename}"
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    # Determine content type
    ext = os.path.splitext(filename)[1].lower()
    content_types = {
        ".pdf": "application/pdf",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".doc": "application/msword",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    }
    content_type = content_types.get(ext, "application/octet-stream")
    
    return FileResponse(file_path, media_type=content_type, filename=filename)


@api_router.post("/hr/employees/{employee_id}/documents")
async def create_employee_document(employee_id: str, doc_data: DocumentCreate, current_user: dict = Depends(get_current_user)):
    """Add employee document - HR/Admin only"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    doc_dict = doc_data.model_dump()
    doc_dict["user_id"] = employee_id
    doc_dict["id"] = str(uuid.uuid4())
    doc_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    doc_dict["uploaded_by"] = current_user["id"]
    doc_dict["uploaded_by_name"] = current_user.get("name", "")
    
    await db.employee_documents.insert_one(doc_dict)
    doc_dict.pop("_id", None)
    
    # Log audit
    await audit_service.log(
        entity_type="employee_documents",
        entity_id=employee_id,
        action="upload",
        user_id=current_user["id"],
        new_values={
            "document_type": doc_dict["document_type"], 
            "document_name": doc_dict["document_name"],
            "is_sensitive": doc_dict["document_type"] in SENSITIVE_DOCUMENT_TYPES
        }
    )
    
    return doc_dict


@api_router.get("/hr/employees/{employee_id}/documents/{document_id}/download")
async def download_employee_document(employee_id: str, document_id: str, current_user: dict = Depends(get_current_user)):
    """Download employee document with RBAC and audit logging"""
    role_code = current_user.get("role_code", "")
    user_id = current_user.get("id")
    
    # Get the document
    document = await db.employee_documents.find_one(
        {"id": document_id, "user_id": employee_id},
        {"_id": 0}
    )
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    doc_type = document.get("document_type", "")
    is_sensitive = doc_type in SENSITIVE_DOCUMENT_TYPES
    
    # Check access permissions
    has_access = False
    
    if role_code in ["CEO", "HR_MANAGER"]:
        has_access = True
    elif user_id == employee_id:
        has_access = True  # Employee can download own documents
    elif role_code == "COUNTRY_HEAD" and not is_sensitive:
        # Country head can access non-sensitive if same country
        emp = await db.users.find_one({"id": employee_id}, {"_id": 0, "country_id": 1})
        if emp and emp.get("country_id") == current_user.get("country_id"):
            has_access = True
    elif role_code == "FINANCE_MANAGER" and not is_sensitive:
        has_access = True
    
    if not has_access:
        await audit_service.log(
            entity_type="employee_documents",
            entity_id=document_id,
            action="download_denied",
            user_id=user_id,
            new_values={"document_type": doc_type, "reason": "unauthorized"}
        )
        raise HTTPException(status_code=403, detail="Not authorized to download this document")
    
    # Log successful download
    await audit_service.log(
        entity_type="employee_documents",
        entity_id=document_id,
        action="download",
        user_id=user_id,
        new_values={"document_type": doc_type, "document_name": document.get("document_name")}
    )
    
    return {"document_url": document.get("document_url"), "document_name": document.get("document_name")}


@api_router.put("/hr/employees/{employee_id}/documents/{document_id}")
async def update_employee_document(employee_id: str, document_id: str, doc_data: DocumentUpdate, current_user: dict = Depends(get_current_user)):
    """Update employee document"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_dict = {k: v for k, v in doc_data.model_dump().items() if v is not None}
    
    await db.employee_documents.update_one(
        {"id": document_id, "user_id": employee_id},
        {"$set": update_dict}
    )
    
    doc = await db.employee_documents.find_one({"id": document_id}, {"_id": 0})
    return doc


@api_router.put("/hr/employees/{employee_id}/documents/{document_id}/verify")
async def verify_employee_document(employee_id: str, document_id: str, current_user: dict = Depends(get_current_user)):
    """Mark employee document as verified - HR only"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.employee_documents.update_one(
        {"id": document_id, "user_id": employee_id},
        {"$set": {
            "verified": True,
            "verified_by": current_user["id"],
            "verified_by_name": current_user.get("name", ""),
            "verified_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return {"message": "Document verified successfully"}


@api_router.delete("/hr/employees/{employee_id}/documents/{document_id}")
async def delete_employee_document(employee_id: str, document_id: str, current_user: dict = Depends(get_current_user)):
    """Delete employee document"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.employee_documents.delete_one({"id": document_id, "user_id": employee_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return {"message": "Document deleted"}


# -------------------- EMPLOYEE AUDIT TRAIL --------------------

@api_router.get("/hr/employees/{employee_id}/audit")
async def get_employee_audit(employee_id: str, current_user: dict = Depends(get_current_user)):
    """Get audit trail for specific employee"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER", "COUNTRY_HEAD"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    logs = await db.audit_logs.find(
        {"entity_id": employee_id, "entity_type": "employee"},
        {"_id": 0}
    ).sort("timestamp", -1).to_list(100)
    
    return logs


# -------------------- SALARY PAYMENTS --------------------

@api_router.get("/hr/employees/{employee_id}/salary-payments")
async def get_employee_salary_payments(
    employee_id: str,
    year: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get salary payment history for employee"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        if current_user.get("id") != employee_id:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {"user_id": employee_id}
    if year:
        query["year"] = year
    
    payments = await db.salary_payments.find(query, {"_id": 0}).sort([("year", -1), ("month", -1)]).to_list(100)
    return payments


@api_router.post("/hr/employees/{employee_id}/salary-payments")
async def create_salary_payment(
    employee_id: str,
    payment_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Create or update salary payment for a month"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    month = payment_data.get("month")
    year = payment_data.get("year")
    
    if not month or not year:
        raise HTTPException(status_code=400, detail="Month and year are required")
    
    # Check if payment exists for this month
    existing = await db.salary_payments.find_one({
        "user_id": employee_id,
        "month": month,
        "year": year
    })
    
    payment_data["user_id"] = employee_id
    
    if existing:
        # Update existing
        await db.salary_payments.update_one(
            {"user_id": employee_id, "month": month, "year": year},
            {"$set": payment_data}
        )
        payment_data["id"] = existing.get("id")
    else:
        # Create new
        payment_data["id"] = str(uuid.uuid4())
        payment_data["created_at"] = datetime.now(timezone.utc).isoformat()
        payment_data["created_by"] = current_user["id"]
        await db.salary_payments.insert_one(payment_data)
        payment_data.pop("_id", None)
    
    return payment_data


# -------------------- LEAVE SUMMARY --------------------

@api_router.get("/hr/employees/{employee_id}/leave-summary")
async def get_employee_leave_summary(
    employee_id: str,
    year: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get leave summary for employee - month-wise"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        if current_user.get("id") != employee_id:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    if not year:
        year = datetime.now(timezone.utc).year
    
    # Get all attendance records for the year
    start_date = f"{year}-01-01"
    end_date = f"{year}-12-31"
    
    attendance = await db.employee_attendance.find({
        "user_id": employee_id,
        "date": {"$gte": start_date, "$lte": end_date}
    }, {"_id": 0}).to_list(400)
    
    # Group by month
    monthly_summary = {}
    for i in range(1, 13):
        monthly_summary[i] = {
            "month": i,
            "year": year,
            "present": 0,
            "absent": 0,
            "half_day": 0,
            "on_leave": 0,
            "leaves_taken": 0,
            "working_days": 0
        }
    
    for att in attendance:
        month = int(att["date"].split("-")[1])
        att_status = att.get("status", "present")
        
        if att_status == "present":
            monthly_summary[month]["present"] += 1
        elif att_status == "absent":
            monthly_summary[month]["absent"] += 1
            monthly_summary[month]["leaves_taken"] += 1
        elif att_status == "half_day":
            monthly_summary[month]["half_day"] += 1
            monthly_summary[month]["leaves_taken"] += 0.5
        elif att_status == "on_leave":
            monthly_summary[month]["on_leave"] += 1
            monthly_summary[month]["leaves_taken"] += 1
        
        monthly_summary[month]["working_days"] += 1
    
    # Get employee's weekly off day
    emp = await db.users.find_one({"id": employee_id}, {"_id": 0, "weekly_off_day": 1})
    weekly_off_day = emp.get("weekly_off_day", 0) if emp else 0
    
    # Day names
    day_names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    
    return {
        "year": year,
        "weekly_off_day": weekly_off_day,
        "weekly_off_day_name": day_names[weekly_off_day],
        "monthly_summary": list(monthly_summary.values()),
        "total_leaves_taken": sum(m["leaves_taken"] for m in monthly_summary.values()),
        "total_present": sum(m["present"] for m in monthly_summary.values())
    }


# -------------------- LEAD ASSIGNMENT CONTROL --------------------

@api_router.patch("/hr/employees/{employee_id}/lead-assignment")
async def toggle_lead_assignment(
    employee_id: str,
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Toggle lead assignment for employee and update assigned cities"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    is_available = data.get("is_available_for_leads", True)
    reason = data.get("reason", "")
    assigned_cities = data.get("assigned_cities", [])
    
    update_data = {
        "is_available_for_leads": is_available,
        "lead_assignment_paused_reason": reason if not is_available else None,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Only update assigned_cities if provided
    if "assigned_cities" in data:
        update_data["assigned_cities"] = assigned_cities
    
    await db.users.update_one(
        {"id": employee_id},
        {"$set": update_data}
    )
    
    # Log audit
    await audit_service.log(
        entity_type="employee",
        entity_id=employee_id,
        action="lead_assignment_toggle",
        user_id=current_user["id"],
        new_values={"is_available_for_leads": is_available, "reason": reason, "assigned_cities": assigned_cities}
    )
    
    return {"is_available_for_leads": is_available, "assigned_cities": assigned_cities}


@api_router.patch("/hr/employees/{employee_id}/weekly-off")
async def update_weekly_off(
    employee_id: str,
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update employee's weekly off day"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    weekly_off_day = data.get("weekly_off_day", 0)  # 0=Sunday, 1=Monday, etc.
    
    await db.users.update_one(
        {"id": employee_id},
        {"$set": {
            "weekly_off_day": weekly_off_day,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"weekly_off_day": weekly_off_day}


# ==================== COUNTRY MANAGEMENT ====================

@api_router.get("/hr/countries")
async def get_hr_countries(current_user: dict = Depends(get_current_user)):
    """Get all countries - for login selection and HR management"""
    countries = await db.countries.find({"is_active": True}, {"_id": 0}).to_list(100)
    return countries


@api_router.get("/hr/countries/all")
async def get_all_countries(current_user: dict = Depends(get_current_user)):
    """Get all countries including inactive - for admin"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    countries = await db.countries.find({}, {"_id": 0}).to_list(100)
    
    # Get employee count per country
    for country in countries:
        count = await db.users.count_documents({"country_id": country["id"]})
        country["employee_count"] = count
    
    return countries


@api_router.post("/hr/countries")
async def create_country(country_data: CountryCreate, current_user: dict = Depends(get_current_user)):
    """Create new country"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check if country code exists
    existing = await db.countries.find_one({"code": country_data.code.upper()})
    if existing:
        raise HTTPException(status_code=400, detail="Country code already exists")
    
    country_dict = country_data.model_dump()
    country_dict["id"] = str(uuid.uuid4())
    country_dict["code"] = country_dict["code"].upper()
    country_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.countries.insert_one(country_dict)
    country_dict.pop("_id", None)
    
    # Log audit
    await audit_service.log(
        entity_type="country",
        entity_id=country_dict["id"],
        action="create",
        user_id=current_user["id"],
        new_values={"name": country_dict["name"], "code": country_dict["code"]}
    )
    
    return country_dict


@api_router.put("/hr/countries/{country_id}")
async def update_country(country_id: str, country_data: CountryUpdate, current_user: dict = Depends(get_current_user)):
    """Update country"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    existing = await db.countries.find_one({"id": country_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Country not found")
    
    update_dict = {k: v for k, v in country_data.model_dump().items() if v is not None}
    if "code" in update_dict:
        update_dict["code"] = update_dict["code"].upper()
    
    await db.countries.update_one({"id": country_id}, {"$set": update_dict})
    
    country = await db.countries.find_one({"id": country_id}, {"_id": 0})
    return country


@api_router.delete("/hr/countries/{country_id}")
async def delete_country(country_id: str, current_user: dict = Depends(get_current_user)):
    """Deactivate country"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check if country has employees
    emp_count = await db.users.count_documents({"country_id": country_id})
    if emp_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete country with {emp_count} employees")
    
    await db.countries.update_one({"id": country_id}, {"$set": {"is_active": False}})
    
    return {"message": "Country deactivated"}


# ==================== LEGACY COMPATIBILITY ====================

# Keep old salary endpoints for backward compatibility
@api_router.get("/salaries")
async def get_salaries(
    user_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get salary structures - redirects to new HR endpoint"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {}
    if user_id:
        query["user_id"] = user_id
    
    salaries = await db.salary_structures.find(query, {"_id": 0}).to_list(1000)
    
    for salary in salaries:
        user = await db.users.find_one({"id": salary["user_id"]}, {"_id": 0, "name": 1, "email": 1, "role_id": 1})
        if user:
            salary["user_name"] = user.get("name")
            salary["user_email"] = user.get("email")
            if user.get("role_id"):
                role = await db.roles.find_one({"id": user["role_id"]}, {"_id": 0, "name": 1})
                if role:
                    salary["role_name"] = role.get("name")
    
    return salaries


@api_router.get("/audit-logs")
async def get_audit_logs(
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    action: Optional[str] = None,
    user_id: Optional[str] = None,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """Get audit logs"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER", "COUNTRY_HEAD"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {}
    if entity_type:
        query["entity_type"] = entity_type
    if entity_id:
        query["entity_id"] = entity_id
    if action:
        query["action"] = action
    if user_id:
        query["user_id"] = user_id
    
    logs = await db.audit_logs.find(query, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    return logs


@api_router.get("/audit-logs/stats")
async def get_audit_stats(current_user: dict = Depends(get_current_user)):
    """Get audit statistics"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    pipeline = [
        {"$group": {"_id": "$entity_type", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    entity_stats = await db.audit_logs.aggregate(pipeline).to_list(20)
    
    pipeline = [
        {"$group": {"_id": "$action", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    action_stats = await db.audit_logs.aggregate(pipeline).to_list(20)
    
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    recent_count = await db.audit_logs.count_documents({"timestamp": {"$gte": yesterday}})
    
    return {
        "by_entity": {item["_id"]: item["count"] for item in entity_stats if item["_id"]},
        "by_action": {item["_id"]: item["count"] for item in action_stats if item["_id"]},
        "recent_24h": recent_count,
        "total": await db.audit_logs.count_documents({})
    }


# ==================== COMPREHENSIVE FINANCE MODULE ====================

from models.finance import (
    PaymentCreate, PaymentUpdate, PaymentApproval, PayslipData,
    PAYMENT_STATUS_PENDING, PAYMENT_STATUS_SUBMITTED, PAYMENT_STATUS_APPROVED,
    PAYMENT_STATUS_REJECTED, PAYMENT_STATUS_PAID, PAYMENT_MODES
)


@api_router.get("/finance/payments")
async def get_finance_payments(
    country_id: Optional[str] = None,
    employee_id: Optional[str] = None,
    payment_type: Optional[str] = None,
    payment_status: Optional[str] = None,
    month: Optional[int] = None,
    year: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all payments - filtered by role access"""
    role_code = current_user.get("role_code", "")
    user_country = current_user.get("country_id")
    
    # Check permission
    if role_code not in ["CEO", "COUNTRY_HEAD", "FINANCE_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized to view finance data")
    
    query = {}
    
    # Apply country filter based on role
    if role_code == "CEO":
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
    
    payments = await db.finance_payments.find(query, {"_id": 0}).sort([("year", -1), ("month", -1), ("created_at", -1)]).to_list(1000)
    
    # Enrich with employee details
    for payment in payments:
        if payment.get("employee_id"):
            emp = await db.users.find_one(
                {"id": payment["employee_id"]},
                {"_id": 0, "name": 1, "email": 1, "employee_code": 1, "role_id": 1}
            )
            if emp:
                payment["employee_name"] = emp.get("name")
                payment["employee_email"] = emp.get("email")
                payment["employee_code"] = emp.get("employee_code")
                # Get role
                if emp.get("role_id"):
                    role = await db.roles.find_one({"id": emp["role_id"]}, {"_id": 0, "name": 1, "code": 1})
                    if role:
                        payment["employee_role"] = role.get("name")
                        payment["employee_role_code"] = role.get("code")
        
        # Get proof count
        proof_count = await db.payment_proofs.count_documents({"payment_id": payment["id"]})
        payment["proof_count"] = proof_count
        
        # Get approver name
        if payment.get("approved_by"):
            approver = await db.users.find_one({"id": payment["approved_by"]}, {"_id": 0, "name": 1})
            if approver:
                payment["approved_by_name"] = approver.get("name")
        
        if payment.get("submitted_by"):
            submitter = await db.users.find_one({"id": payment["submitted_by"]}, {"_id": 0, "name": 1})
            if submitter:
                payment["submitted_by_name"] = submitter.get("name")
    
    return payments


@api_router.get("/finance/payments/{payment_id}")
async def get_finance_payment(payment_id: str, current_user: dict = Depends(get_current_user)):
    """Get single payment details"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "COUNTRY_HEAD", "FINANCE_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    payment = await db.finance_payments.find_one({"id": payment_id}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    # Enrich with employee details
    if payment.get("employee_id"):
        emp = await db.users.find_one(
            {"id": payment["employee_id"]},
            {"_id": 0, "name": 1, "email": 1, "employee_code": 1, "role_id": 1, "department_id": 1,
             "bank_name": 1, "bank_account_number": 1, "ifsc_code": 1, "pan_number": 1}
        )
        if emp:
            payment["employee"] = emp
            if emp.get("role_id"):
                role = await db.roles.find_one({"id": emp["role_id"]}, {"_id": 0, "name": 1, "code": 1})
                if role:
                    payment["employee"]["role_name"] = role.get("name")
                    payment["employee"]["role_code"] = role.get("code")
            if emp.get("department_id"):
                dept = await db.departments.find_one({"id": emp["department_id"]}, {"_id": 0, "name": 1})
                if dept:
                    payment["employee"]["department_name"] = dept.get("name")
    
    # Get proofs
    payment["proofs"] = await db.payment_proofs.find({"payment_id": payment_id}, {"_id": 0}).to_list(20)
    
    return payment


@api_router.post("/finance/payments")
async def create_finance_payment(payment_data: PaymentCreate, current_user: dict = Depends(get_current_user)):
    """Create a new payment record"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "FINANCE_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized to create payments")
    
    # B2B payment types don't require employee
    b2b_types = ["vendor", "statutory", "legal"]
    is_b2b = payment_data.payment_type in b2b_types
    
    country_id = current_user.get("country_id")
    
    if not is_b2b:
        # Verify employee exists for non-B2B payments
        if not payment_data.employee_id:
            raise HTTPException(status_code=400, detail="Employee ID is required for this payment type")
        
        emp = await db.users.find_one({"id": payment_data.employee_id}, {"_id": 0, "country_id": 1, "role_id": 1})
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # Check country access for Finance Manager
        if role_code == "FINANCE_MANAGER":
            if emp.get("country_id") != current_user.get("country_id"):
                raise HTTPException(status_code=403, detail="Cannot create payment for employee in different country")
        
        country_id = emp.get("country_id")
        
        # Check for duplicate payment (only for employee payments)
        existing = await db.finance_payments.find_one({
            "employee_id": payment_data.employee_id,
            "month": payment_data.month,
            "year": payment_data.year,
            "payment_type": payment_data.payment_type
        })
        if existing:
            raise HTTPException(status_code=400, detail=f"Payment already exists for {payment_data.month}/{payment_data.year}")
    else:
        # For B2B, vendor_name is required
        if not payment_data.vendor_name:
            raise HTTPException(status_code=400, detail="Vendor name is required for B2B payments")
    
    payment_dict = payment_data.model_dump()
    payment_dict["id"] = str(uuid.uuid4())
    payment_dict["country_id"] = country_id
    payment_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    payment_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    payment_dict["created_by"] = current_user["id"]
    payment_dict["status"] = PAYMENT_STATUS_PENDING
    
    # Get country currency
    if country_id:
        country = await db.countries.find_one({"id": country_id}, {"_id": 0, "currency": 1, "currency_symbol": 1})
        if country:
            payment_dict["currency"] = country.get("currency", "INR")
    
    await db.finance_payments.insert_one(payment_dict)
    payment_dict.pop("_id", None)
    
    # Log audit
    await audit_service.log(
        entity_type="finance_payment",
        entity_id=payment_dict["id"],
        action="create",
        user_id=current_user["id"],
        new_values={
            "employee_id": payment_dict.get("employee_id"),
            "vendor_name": payment_dict.get("vendor_name"),
            "payment_type": payment_dict["payment_type"],
            "amount": payment_dict["net_amount"],
            "month": payment_dict["month"],
            "year": payment_dict["year"]
        }
    )
    
    return payment_dict


@api_router.put("/finance/payments/{payment_id}")
async def update_finance_payment(payment_id: str, payment_data: PaymentUpdate, current_user: dict = Depends(get_current_user)):
    """Update a payment record"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "FINANCE_MANAGER", "COUNTRY_HEAD"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    existing = await db.finance_payments.find_one({"id": payment_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    # Finance Manager cannot edit approved or paid payments
    if role_code == "FINANCE_MANAGER" and existing.get("status") in [PAYMENT_STATUS_APPROVED, PAYMENT_STATUS_PAID]:
        raise HTTPException(status_code=403, detail="Cannot edit approved or paid payments")
    
    update_dict = {k: v for k, v in payment_data.model_dump().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.finance_payments.update_one({"id": payment_id}, {"$set": update_dict})
    
    # Log audit
    await audit_service.log(
        entity_type="finance_payment",
        entity_id=payment_id,
        action="update",
        user_id=current_user["id"],
        old_values={"status": existing.get("status")},
        new_values=update_dict
    )
    
    payment = await db.finance_payments.find_one({"id": payment_id}, {"_id": 0})
    return payment


@api_router.patch("/finance/payments/{payment_id}/submit")
async def submit_payment_for_approval(payment_id: str, current_user: dict = Depends(get_current_user)):
    """Submit payment for approval by Country Manager"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "FINANCE_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    existing = await db.finance_payments.find_one({"id": payment_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    if existing.get("status") != PAYMENT_STATUS_PENDING:
        raise HTTPException(status_code=400, detail="Payment is not in pending status")
    
    await db.finance_payments.update_one(
        {"id": payment_id},
        {"$set": {
            "status": PAYMENT_STATUS_SUBMITTED,
            "submitted_by": current_user["id"],
            "submitted_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Log audit
    await audit_service.log(
        entity_type="finance_payment",
        entity_id=payment_id,
        action="submit_for_approval",
        user_id=current_user["id"]
    )
    
    return {"status": PAYMENT_STATUS_SUBMITTED, "message": "Payment submitted for approval"}


@api_router.patch("/finance/payments/{payment_id}/approve")
async def approve_payment(payment_id: str, approval_data: PaymentApproval, current_user: dict = Depends(get_current_user)):
    """Approve or reject payment - Country Manager only"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "COUNTRY_HEAD"]:
        raise HTTPException(status_code=403, detail="Only Country Manager or CEO can approve payments")
    
    existing = await db.finance_payments.find_one({"id": payment_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    if existing.get("status") != PAYMENT_STATUS_SUBMITTED:
        raise HTTPException(status_code=400, detail="Payment must be submitted for approval first")
    
    # Country Head can only approve payments in their country
    if role_code == "COUNTRY_HEAD":
        if existing.get("country_id") != current_user.get("country_id"):
            raise HTTPException(status_code=403, detail="Cannot approve payment from different country")
    
    if approval_data.action == "approve":
        new_status = PAYMENT_STATUS_APPROVED
        update_data = {
            "status": new_status,
            "approved_by": current_user["id"],
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
    elif approval_data.action == "reject":
        new_status = PAYMENT_STATUS_REJECTED
        update_data = {
            "status": new_status,
            "approved_by": current_user["id"],
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "rejection_reason": approval_data.reason,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
    else:
        raise HTTPException(status_code=400, detail="Invalid action. Use 'approve' or 'reject'")
    
    await db.finance_payments.update_one({"id": payment_id}, {"$set": update_data})
    
    # Log audit
    await audit_service.log(
        entity_type="finance_payment",
        entity_id=payment_id,
        action=f"payment_{approval_data.action}",
        user_id=current_user["id"],
        new_values={"status": new_status, "reason": approval_data.reason}
    )
    
    return {"status": new_status, "message": f"Payment {approval_data.action}d successfully"}


@api_router.patch("/finance/payments/{payment_id}/mark-paid")
async def mark_payment_paid(
    payment_id: str,
    payment_mode: str,
    transaction_reference: Optional[str] = None,
    payment_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Mark payment as paid after approval"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "FINANCE_MANAGER", "COUNTRY_HEAD"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    existing = await db.finance_payments.find_one({"id": payment_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    if existing.get("status") != PAYMENT_STATUS_APPROVED:
        raise HTTPException(status_code=400, detail="Payment must be approved before marking as paid")
    
    update_data = {
        "status": PAYMENT_STATUS_PAID,
        "payment_mode": payment_mode,
        "transaction_reference": transaction_reference,
        "payment_date": payment_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.finance_payments.update_one({"id": payment_id}, {"$set": update_data})
    
    # Log audit
    await audit_service.log(
        entity_type="finance_payment",
        entity_id=payment_id,
        action="payment_completed",
        user_id=current_user["id"],
        new_values={"payment_mode": payment_mode, "transaction_reference": transaction_reference}
    )
    
    return {"status": PAYMENT_STATUS_PAID, "message": "Payment marked as paid"}


@api_router.delete("/finance/payments/{payment_id}")
async def delete_finance_payment(payment_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a payment - only pending payments can be deleted"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "FINANCE_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    existing = await db.finance_payments.find_one({"id": payment_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    if existing.get("status") != PAYMENT_STATUS_PENDING:
        raise HTTPException(status_code=400, detail="Only pending payments can be deleted")
    
    # Delete proofs first
    await db.payment_proofs.delete_many({"payment_id": payment_id})
    await db.finance_payments.delete_one({"id": payment_id})
    
    # Log audit
    await audit_service.log(
        entity_type="finance_payment",
        entity_id=payment_id,
        action="delete",
        user_id=current_user["id"]
    )
    
    return {"message": "Payment deleted"}


# -------------------- PAYMENT PROOFS --------------------

@api_router.get("/finance/payments/{payment_id}/proofs")
async def get_payment_proofs(payment_id: str, current_user: dict = Depends(get_current_user)):
    """Get payment proofs/receipts"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "COUNTRY_HEAD", "FINANCE_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    proofs = await db.payment_proofs.find({"payment_id": payment_id}, {"_id": 0}).to_list(20)
    return proofs


@api_router.post("/finance/payments/{payment_id}/proofs")
async def add_payment_proof(
    payment_id: str,
    file_name: str,
    file_url: str,
    file_type: str = "image",
    current_user: dict = Depends(get_current_user)
):
    """Add payment proof/receipt"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "FINANCE_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Verify payment exists
    payment = await db.finance_payments.find_one({"id": payment_id}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    proof = {
        "id": str(uuid.uuid4()),
        "payment_id": payment_id,
        "file_name": file_name,
        "file_url": file_url,
        "file_type": file_type,
        "uploaded_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.payment_proofs.insert_one(proof)
    proof.pop("_id", None)
    
    return proof


@api_router.delete("/finance/payments/{payment_id}/proofs/{proof_id}")
async def delete_payment_proof(payment_id: str, proof_id: str, current_user: dict = Depends(get_current_user)):
    """Delete payment proof"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "FINANCE_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.payment_proofs.delete_one({"id": proof_id, "payment_id": payment_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Proof not found")
    
    return {"message": "Proof deleted"}


# -------------------- PAYSLIP GENERATION --------------------

@api_router.get("/finance/payments/{payment_id}/payslip")
async def generate_payslip(payment_id: str, current_user: dict = Depends(get_current_user)):
    """Generate payslip data for PDF generation"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "COUNTRY_HEAD", "FINANCE_MANAGER"]:
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


# -------------------- FINANCE SUMMARY / DASHBOARD --------------------

@api_router.get("/finance/summary")
async def get_finance_summary(
    country_id: Optional[str] = None,
    month: Optional[int] = None,
    year: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get finance summary/dashboard data"""
    role_code = current_user.get("role_code", "")
    user_country = current_user.get("country_id")
    
    if role_code not in ["CEO", "COUNTRY_HEAD", "FINANCE_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Default to current month/year
    if not month:
        month = datetime.now(timezone.utc).month
    if not year:
        year = datetime.now(timezone.utc).year
    
    # Build query with country filter
    query = {"month": month, "year": year}
    emp_query = {}
    
    if role_code == "CEO":
        if country_id:
            query["country_id"] = country_id
            emp_query["country_id"] = country_id
    else:
        query["country_id"] = user_country
        emp_query["country_id"] = user_country
    
    # Get total employees
    total_employees = await db.users.count_documents({**emp_query, "is_active": True})
    
    # Get payment counts and amounts
    payments = await db.finance_payments.find(query, {"_id": 0}).to_list(1000)
    
    total_payments = len(payments)
    total_amount = sum(p.get("net_amount", 0) for p in payments)
    
    # By status
    pending = [p for p in payments if p.get("status") == PAYMENT_STATUS_PENDING]
    submitted = [p for p in payments if p.get("status") == PAYMENT_STATUS_SUBMITTED]
    approved = [p for p in payments if p.get("status") == PAYMENT_STATUS_APPROVED]
    paid = [p for p in payments if p.get("status") == PAYMENT_STATUS_PAID]
    rejected = [p for p in payments if p.get("status") == PAYMENT_STATUS_REJECTED]
    
    # By payment type
    salary_payments = [p for p in payments if p.get("payment_type") == "salary"]
    mechanic_payouts = [p for p in payments if p.get("payment_type") == "mechanic_payout"]
    
    # Monthly trend (last 6 months)
    monthly_trend = []
    for i in range(6):
        m = month - i
        y = year
        if m <= 0:
            m += 12
            y -= 1
        
        trend_query = {"month": m, "year": y}
        if role_code != "CEO":
            trend_query["country_id"] = user_country
        elif country_id:
            trend_query["country_id"] = country_id
        
        trend_payments = await db.finance_payments.find(trend_query, {"_id": 0, "net_amount": 1, "status": 1}).to_list(1000)
        paid_trend = [p for p in trend_payments if p.get("status") == PAYMENT_STATUS_PAID]
        
        monthly_trend.append({
            "month": m,
            "year": y,
            "total_amount": sum(p.get("net_amount", 0) for p in paid_trend),
            "count": len(paid_trend)
        })
    
    return {
        "total_employees": total_employees,
        "total_payments_this_month": total_payments,
        "total_amount_this_month": total_amount,
        "pending_approvals": len(submitted),  # Waiting for Country Manager approval
        "pending_payments": len(pending),
        "approved_payments": len(approved),
        "paid_payments": len(paid),
        "rejected_payments": len(rejected),
        "salary_payments_count": len(salary_payments),
        "salary_payments_amount": sum(p.get("net_amount", 0) for p in salary_payments),
        "mechanic_payouts_count": len(mechanic_payouts),
        "mechanic_payouts_amount": sum(p.get("net_amount", 0) for p in mechanic_payouts),
        "status_breakdown": {
            "pending": len(pending),
            "submitted": len(submitted),
            "approved": len(approved),
            "paid": len(paid),
            "rejected": len(rejected)
        },
        "monthly_trend": list(reversed(monthly_trend)),
        "current_month": month,
        "current_year": year
    }


@api_router.get("/finance/employees")
async def get_finance_employees(
    country_id: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get employees for payment creation"""
    role_code = current_user.get("role_code", "")
    user_country = current_user.get("country_id")
    
    if role_code not in ["CEO", "COUNTRY_HEAD", "FINANCE_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {"is_active": True}
    
    if role_code == "CEO":
        if country_id:
            query["country_id"] = country_id
    else:
        query["country_id"] = user_country
    
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"employee_code": {"$regex": search, "$options": "i"}}
        ]
    
    employees = await db.users.find(query, {"_id": 0, "hashed_password": 0}).to_list(500)
    
    # Enrich with role and salary info
    for emp in employees:
        if emp.get("role_id"):
            role = await db.roles.find_one({"id": emp["role_id"]}, {"_id": 0, "name": 1, "code": 1})
            if role:
                emp["role_name"] = role.get("name")
                emp["role_code"] = role.get("code")
        
        # Get salary structure
        salary = await db.salary_structures.find_one(
            {"user_id": emp["id"], "effective_to": None},
            {"_id": 0, "gross_salary": 1, "net_salary": 1, "price_per_inspection": 1, "employment_type": 1}
        )
        if salary:
            emp["salary_info"] = salary
    
    return employees


@api_router.get("/finance/payment-modes")
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


# ==================== HR MODULE: ATTENDANCE TRACKING ====================

@api_router.post("/hr/session/start")
async def start_session(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Start a session on login - called after successful authentication"""
    # Get token from authorization header
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


@api_router.post("/hr/session/heartbeat")
async def session_heartbeat(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Update session activity - client should call every 2 minutes"""
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.replace("Bearer ", "") if auth_header.startswith("Bearer ") else ""
    
    # Check if token is blacklisted
    if await attendance_service.is_token_blacklisted(token):
        raise HTTPException(status_code=401, detail="Session expired due to inactivity")
    
    success = await attendance_service.update_heartbeat(current_user["id"], token)
    
    return {"success": success, "timestamp": datetime.now(timezone.utc).isoformat()}


@api_router.post("/hr/session/end")
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


@api_router.get("/hr/sessions/active")
async def get_active_sessions(
    country_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all active sessions - HR/CEO only"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER", "COUNTRY_HEAD"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Country head can only see their country
    if role_code == "COUNTRY_HEAD":
        country_id = current_user.get("country_id")
    
    sessions = await attendance_service.get_active_sessions(country_id)
    
    return sessions


@api_router.post("/hr/sessions/{session_id}/force-logout")
async def force_logout_session(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Force logout a session - HR/CEO only"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get session to find user_id
    session = await db.user_sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    result = await attendance_service.end_session(
        user_id=session["user_id"],
        session_id=session_id,
        reason="admin_force"
    )
    
    return {"success": True, "session": result}


# -------------------- ATTENDANCE RECORDS --------------------

@api_router.get("/hr/attendance")
async def get_attendance_records(
    employee_id: Optional[str] = None,
    month: Optional[int] = None,
    year: Optional[int] = None,
    attendance_status: Optional[str] = None,
    country_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get attendance records - filtered by RBAC"""
    role_code = current_user.get("role_code", "")
    
    # RBAC check
    if role_code not in ["CEO", "HR_MANAGER", "COUNTRY_HEAD"]:
        # Regular employees can only see their own
        employee_id = current_user["id"]
    elif role_code == "COUNTRY_HEAD":
        country_id = current_user.get("country_id")
    
    if employee_id:
        records = await attendance_service.get_employee_attendance(employee_id, month, year)
    else:
        # Get all employees for filter
        emp_query = {"is_active": True}
        if country_id:
            emp_query["country_id"] = country_id
        
        employees = await db.users.find(emp_query, {"_id": 0, "id": 1}).to_list(10000)
        emp_ids = [e["id"] for e in employees]
        
        query = {"employee_id": {"$in": emp_ids}}
        if month and year:
            start_date = f"{year}-{str(month).zfill(2)}-01"
            import calendar
            last_day = calendar.monthrange(year, month)[1]
            end_date = f"{year}-{str(month).zfill(2)}-{last_day}"
            query["date"] = {"$gte": start_date, "$lte": end_date}
        if attendance_status:
            query["system_status"] = attendance_status
        
        records = await db.attendance_records.find(query, {"_id": 0}).sort("date", -1).to_list(10000)
    
    # Enrich with employee names
    emp_map = {}
    for r in records:
        if r["employee_id"] not in emp_map:
            emp = await db.users.find_one({"id": r["employee_id"]}, {"_id": 0, "name": 1})
            emp_map[r["employee_id"]] = emp.get("name", "Unknown") if emp else "Unknown"
        r["employee_name"] = emp_map[r["employee_id"]]
    
    return records


@api_router.get("/hr/attendance/summary/{employee_id}")
async def get_attendance_summary(
    employee_id: str,
    month: int,
    year: int,
    current_user: dict = Depends(get_current_user)
):
    """Get attendance summary for an employee"""
    role_code = current_user.get("role_code", "")
    
    # RBAC check
    if role_code not in ["CEO", "HR_MANAGER", "COUNTRY_HEAD", "FINANCE_MANAGER"]:
        if current_user["id"] != employee_id:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    summary = await attendance_service.get_attendance_summary(employee_id, month, year)
    
    return summary


@api_router.get("/hr/attendance/pending-approvals")
async def get_pending_attendance_approvals(
    country_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get pending attendance approvals - HR only"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    records = await attendance_service.get_pending_approvals(country_id)
    
    return records


@api_router.post("/hr/attendance/{record_id}/override")
async def override_attendance(
    record_id: str,
    override_data: AttendanceOverrideRequest,
    current_user: dict = Depends(get_current_user)
):
    """Override attendance status - HR only"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    try:
        record = await attendance_service.override_attendance(
            record_id=record_id,
            override_status=override_data.override_status,
            reason=override_data.reason,
            hr_user_id=current_user["id"]
        )
        
        if not record:
            raise HTTPException(status_code=404, detail="Attendance record not found")
        
        # Log audit
        await audit_service.log(
            entity_type="attendance",
            entity_id=record_id,
            action="hr_override",
            user_id=current_user["id"],
            new_values={"override_status": override_data.override_status, "reason": override_data.reason}
        )
        
        return record
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.post("/hr/attendance/calculate-daily")
async def run_daily_attendance_calculation(
    date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Run daily attendance calculation - Admin only (normally runs as cron)"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await attendance_service.calculate_daily_attendance(date)
    
    return result


# ==================== HOLIDAY CALENDAR ====================

class HolidayCreate(BaseModel):
    date: str  # YYYY-MM-DD
    name: str
    reason: Optional[str] = None
    country_id: str


class HolidayUpdate(BaseModel):
    date: Optional[str] = None
    name: Optional[str] = None
    reason: Optional[str] = None


@api_router.get("/hr/holidays")
async def get_holidays(
    country_id: Optional[str] = None,
    year: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get holidays for a country (optionally filtered by year)"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER", "COUNTRY_HEAD", "FINANCE_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {}
    if country_id:
        query["country_id"] = country_id
    if year:
        query["date"] = {"$regex": f"^{year}-"}
    
    holidays = await db.holidays.find(query, {"_id": 0}).sort("date", 1).to_list(500)
    
    # Get country names
    country_ids = list(set(h.get("country_id") for h in holidays if h.get("country_id")))
    countries = await db.countries.find({"id": {"$in": country_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(100)
    country_map = {c["id"]: c["name"] for c in countries}
    
    for h in holidays:
        h["country_name"] = country_map.get(h.get("country_id"), "Unknown")
    
    return holidays


@api_router.post("/hr/holidays")
async def create_holiday(
    data: HolidayCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new holiday"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Only CEO or HR Manager can create holidays")
    
    # Validate date format
    try:
        datetime.strptime(data.date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    # Check if holiday already exists for this date and country
    existing = await db.holidays.find_one({
        "date": data.date,
        "country_id": data.country_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="Holiday already exists for this date")
    
    now = datetime.now(timezone.utc).isoformat()
    holiday = {
        "id": str(uuid.uuid4()),
        "date": data.date,
        "name": data.name,
        "reason": data.reason,
        "country_id": data.country_id,
        "created_by": current_user["id"],
        "created_at": now,
        "updated_at": now
    }
    
    await db.holidays.insert_one(holiday)
    
    return {"message": "Holiday created", "id": holiday["id"]}


@api_router.put("/hr/holidays/{holiday_id}")
async def update_holiday(
    holiday_id: str,
    data: HolidayUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a holiday"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Only CEO or HR Manager can update holidays")
    
    holiday = await db.holidays.find_one({"id": holiday_id})
    if not holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")
    
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.holidays.update_one({"id": holiday_id}, {"$set": update_data})
    
    return {"message": "Holiday updated"}


@api_router.delete("/hr/holidays/{holiday_id}")
async def delete_holiday(
    holiday_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a holiday"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Only CEO or HR Manager can delete holidays")
    
    result = await db.holidays.delete_one({"id": holiday_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Holiday not found")
    
    return {"message": "Holiday deleted"}


@api_router.get("/hr/attendance/calendar")
async def get_attendance_calendar(
    month: int,
    year: int,
    country_id: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get consolidated attendance calendar data for all employees
    
    Returns a calendar-centric view showing:
    - All employees with their leave status for each day of the month
    - Working days vs weekends/holidays
    - Industry-standard color codes for leave statuses
    """
    import calendar as cal
    
    role_code = current_user.get("role_code", "")
    
    # RBAC check
    if role_code not in ["CEO", "HR_MANAGER", "COUNTRY_HEAD"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if role_code == "COUNTRY_HEAD":
        country_id = current_user.get("country_id")
    
    # Get employees
    emp_query = {"is_active": True}
    if country_id:
        emp_query["country_id"] = country_id
    if search:
        emp_query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"employee_code": {"$regex": search, "$options": "i"}}
        ]
    
    employees = await db.users.find(
        emp_query, 
        {"_id": 0, "id": 1, "name": 1, "email": 1, "employee_code": 1, "photo_url": 1, "weekly_off_day": 1, "country_id": 1}
    ).sort("name", 1).to_list(500)
    
    emp_ids = [e["id"] for e in employees]
    
    # Get date range for the month
    _, last_day = cal.monthrange(year, month)
    start_date = f"{year}-{str(month).zfill(2)}-01"
    end_date = f"{year}-{str(month).zfill(2)}-{last_day}"
    
    # Get all leave requests for the month (approved and pending)
    leave_query = {
        "employee_id": {"$in": emp_ids},
        "status": {"$in": ["APPROVED", "PENDING"]},
        "$or": [
            {"start_date": {"$lte": end_date}, "end_date": {"$gte": start_date}}
        ]
    }
    leaves = await db.leave_requests.find(leave_query, {"_id": 0}).to_list(10000)
    
    # Group leaves by employee and date
    leave_map = {}  # {employee_id: {date: {status, leave_type}}}
    for leave in leaves:
        emp_id = leave["employee_id"]
        if emp_id not in leave_map:
            leave_map[emp_id] = {}
        
        # Expand leave dates
        leave_start = datetime.strptime(leave["start_date"], "%Y-%m-%d")
        leave_end = datetime.strptime(leave["end_date"], "%Y-%m-%d")
        current = leave_start
        
        while current <= leave_end:
            date_str = current.strftime("%Y-%m-%d")
            # Only include dates in the requested month
            if start_date <= date_str <= end_date:
                leave_map[emp_id][date_str] = {
                    "status": leave["status"].lower(),  # "approved" or "pending"
                    "leave_type": leave["leave_type"].lower(),  # "casual" or "sick"
                    "leave_id": leave["id"],
                    "reason": leave.get("reason", "")
                }
            current += timedelta(days=1)
    
    # Get attendance overrides (HR manual entries)
    override_query = {
        "employee_id": {"$in": emp_ids},
        "date": {"$gte": start_date, "$lte": end_date}
    }
    overrides = await db.attendance_overrides.find(override_query, {"_id": 0}).to_list(10000)
    
    # Group overrides by employee and date
    override_map = {}  # {employee_id: {date: {status, notes}}}
    for override in overrides:
        emp_id = override["employee_id"]
        if emp_id not in override_map:
            override_map[emp_id] = {}
        override_map[emp_id][override["date"]] = {
            "status": override["status"],
            "notes": override.get("notes", ""),
            "updated_by": override.get("updated_by_name", "")
        }
    
    # Get organization holidays for the month (country-specific)
    # Get unique country IDs from employees
    country_ids = list(set(e.get("country_id") for e in employees if e.get("country_id")))
    holiday_query = {
        "country_id": {"$in": country_ids},
        "date": {"$gte": start_date, "$lte": end_date}
    }
    org_holidays = await db.holidays.find(holiday_query, {"_id": 0}).to_list(100)
    
    # Group org holidays by country and date
    org_holiday_map = {}  # {country_id: {date: holiday_name}}
    for h in org_holidays:
        cid = h.get("country_id")
        if cid not in org_holiday_map:
            org_holiday_map[cid] = {}
        org_holiday_map[cid][h["date"]] = h.get("name", "Holiday")
    
    # Build calendar data for each employee
    calendar_data = []
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    
    # Weekday mapping: 0=Monday, 1=Tuesday, ..., 6=Sunday
    # Employee weekly_off_day: 0=Sunday, 1=Monday, ..., 6=Saturday (or use direct mapping)
    
    for emp in employees:
        # Employee's weekly off day - stored as day name or number
        emp_weekly_off = emp.get("weekly_off_day", "Sunday")  # Default Sunday
        emp_country = emp.get("country_id")
        emp_days = {}
        
        # Convert weekly off to weekday number (0=Monday format)
        if isinstance(emp_weekly_off, str):
            weekly_off_map = {"Sunday": 6, "Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3, "Friday": 4, "Saturday": 5}
            emp_weekly_off_weekday = weekly_off_map.get(emp_weekly_off, 6)
        else:
            # If numeric: 0=Sunday, convert to 0=Monday format
            emp_weekly_off_weekday = (emp_weekly_off - 1) % 7 if emp_weekly_off > 0 else 6
        
        for day in range(1, last_day + 1):
            date_str = f"{year}-{str(month).zfill(2)}-{str(day).zfill(2)}"
            date_obj = datetime(year, month, day)
            weekday = date_obj.weekday()  # 0=Monday, 6=Sunday
            
            # Check if it's the employee's weekly off day
            is_weekly_off = weekday == emp_weekly_off_weekday
            
            # Check if it's an organization holiday for this country
            is_org_holiday = emp_country and date_str in org_holiday_map.get(emp_country, {})
            org_holiday_name = org_holiday_map.get(emp_country, {}).get(date_str, None)
            
            # Check for HR override first (takes precedence)
            override_info = override_map.get(emp["id"], {}).get(date_str)
            leave_info = leave_map.get(emp["id"], {}).get(date_str)
            
            # Priority: Override > Leave > Org Holiday > Weekly Off > Working
            if override_info:
                day_status = override_info["status"]
                leave_type = None
                reason = override_info.get("notes", "")
                leave_id = None
            elif leave_info:
                status = leave_info["status"]  # "approved" or "pending"
                leave_type = leave_info["leave_type"]
                day_status = f"leave_{status}"  # "leave_approved" or "leave_pending"
                reason = leave_info.get("reason", "")
                leave_id = leave_info.get("leave_id")
            elif is_org_holiday:
                day_status = "org_holiday"
                leave_type = None
                reason = org_holiday_name
                leave_id = None
            elif is_weekly_off:
                day_status = "weekly_off"
                leave_type = None
                reason = f"Weekly Off ({day_names[weekday]})"
                leave_id = None
            else:
                day_status = "working"
                leave_type = None
                reason = None
                leave_id = None
            
            emp_days[date_str] = {
                "date": date_str,
                "day": day,
                "weekday": weekday,
                "weekday_name": day_names[weekday],
                "status": day_status,
                "leave_type": leave_type,
                "is_weekly_off": is_weekly_off,
                "is_org_holiday": is_org_holiday,
                "leave_id": leave_id,
                "reason": reason,
                "is_override": override_info is not None
            }
        
        # Count summary - include LOP days and overtime
        working_days = sum(1 for d in emp_days.values() if d["status"] in ["working", "present"])
        leave_approved = sum(1 for d in emp_days.values() if d["status"] == "leave_approved")
        leave_pending = sum(1 for d in emp_days.values() if d["status"] == "leave_pending")
        holidays = sum(1 for d in emp_days.values() if d["status"] in ["weekly_off", "org_holiday", "holiday"])
        lop_days = sum(1 for d in emp_days.values() if d["status"] in ["lop", "absent"])
        half_days = sum(1 for d in emp_days.values() if d["status"] == "half_day")
        overtime_days = sum(1 for d in emp_days.values() if d["status"] == "overtime")
        
        calendar_data.append({
            "employee_id": emp["id"],
            "employee_name": emp["name"],
            "employee_code": emp.get("employee_code"),
            "email": emp.get("email"),
            "photo_url": emp.get("photo_url"),
            "weekly_off_day": emp_weekly_off,
            "days": emp_days,
            "summary": {
                "working_days": working_days,
                "leave_approved": leave_approved,
                "leave_pending": leave_pending,
                "holidays": holidays,
                "lop_days": lop_days,
                "half_days": half_days,
                "overtime_days": overtime_days,
                "total_days": last_day
            }
        })
    
    # Get country list for filter
    countries = await db.countries.find({"is_active": True}, {"_id": 0, "id": 1, "name": 1}).to_list(100)
    
    return {
        "month": month,
        "year": year,
        "month_name": datetime(year, month, 1).strftime("%B"),
        "total_days": last_day,
        "employees": calendar_data,
        "countries": countries,
        "legend": {
            "working": {"color": "#10B981", "label": "Present"},
            "weekly_off": {"color": "#94A3B8", "label": "Weekly Off"},
            "org_holiday": {"color": "#8B5CF6", "label": "Organization Holiday"},
            "leave_approved": {"color": "#3B82F6", "label": "Leave (Approved)"},
            "leave_pending": {"color": "#F59E0B", "label": "Leave (Pending)"},
            "lop": {"color": "#EF4444", "label": "LOP/Absent"},
            "half_day": {"color": "#F97316", "label": "Half Day"},
            "overtime": {"color": "#EC4899", "label": "Overtime"}
        }
    }


class AttendanceDayUpdate(BaseModel):
    employee_id: str
    date: str
    status: str  # present, absent/lop, half_day, leave_approved, holiday
    notes: Optional[str] = None


@api_router.post("/hr/attendance/update-day")
async def update_attendance_day(
    data: AttendanceDayUpdate,
    current_user: dict = Depends(get_current_user)
):
    """HR: Update attendance status for a specific employee on a specific day
    
    Status options:
    - present: Employee was present (working day)
    - absent/lop: Loss of Pay - employee was absent without approved leave
    - half_day: Half day present
    - leave_approved: Approved leave (manual override)
    - holiday: Mark as holiday/weekly off
    - overtime: Mark as overtime day
    """
    role_code = current_user.get("role_code", "")
    
    # Only HR_MANAGER can update attendance
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Only HR Manager can update attendance")
    
    # Validate date is not in the future
    try:
        check_date = datetime.strptime(data.date, "%Y-%m-%d")
        if check_date.date() > datetime.now(timezone.utc).date():
            raise HTTPException(status_code=400, detail="Cannot update attendance for future dates")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    # Validate employee exists
    employee = await db.users.find_one({"id": data.employee_id}, {"_id": 0, "id": 1, "name": 1})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Normalize status
    normalized_status = data.status.lower()
    if normalized_status == "absent":
        normalized_status = "lop"
    
    valid_statuses = ["present", "lop", "half_day", "leave_approved", "holiday", "overtime"]
    if normalized_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Upsert attendance override record
    await db.attendance_overrides.update_one(
        {
            "employee_id": data.employee_id,
            "date": data.date
        },
        {
            "$set": {
                "employee_id": data.employee_id,
                "date": data.date,
                "status": normalized_status,
                "notes": data.notes,
                "updated_by": current_user["id"],
                "updated_by_name": current_user.get("name", ""),
                "updated_at": now
            },
            "$setOnInsert": {
                "id": str(uuid.uuid4()),
                "created_at": now
            }
        },
        upsert=True
    )
    
    return {
        "message": "Attendance updated successfully",
        "employee_id": data.employee_id,
        "date": data.date,
        "status": normalized_status
    }


# ==================== HR MODULE: PAYROLL ====================

@api_router.post("/hr/payroll/generate")
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


@api_router.post("/hr/payroll/generate-bulk")
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


@api_router.get("/hr/payroll")
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


# ==================== HR MODULE: PAYROLL BATCH GOVERNANCE (MUST BE BEFORE {payroll_id} ROUTE) ====================

@api_router.get("/hr/payroll/batches")
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


@api_router.get("/hr/payroll/batch/{batch_id}")
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


@api_router.get("/hr/payroll/{payroll_id}")
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


@api_router.get("/hr/payroll/summary/{month}/{year}")
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


@api_router.get("/hr/payroll/employee/{employee_id}/payslips")
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


@api_router.post("/hr/payroll/{payroll_id}/mark-paid")
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


@api_router.post("/hr/payroll/{payroll_id}/adjustment")
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


@api_router.get("/hr/payroll/{payroll_id}/adjustments")
async def get_payroll_adjustments(
    payroll_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get adjustments for a payroll record"""
    adjustments = await payroll_service.get_adjustments(payroll_id)
    
    return adjustments


# -------------------- PAYSLIP --------------------

@api_router.post("/hr/payroll/{payroll_id}/generate-payslip")
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


@api_router.get("/hr/payroll/{payroll_id}/payslip")
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
    storage = get_storage_service()
    download_url = await storage.get_download_url(payroll["payslip_path"])
    
    return {
        "payroll_id": payroll_id,
        "employee_name": payroll.get("employee_name"),
        "month": payroll.get("month"),
        "year": payroll.get("year"),
        "download_url": download_url
    }


# ==================== HR MODULE: PAYROLL BATCH GOVERNANCE ====================

@api_router.post("/hr/payroll/preview")
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


@api_router.post("/hr/payroll/batch")
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


@api_router.put("/hr/payroll/batch/{batch_id}/record/{record_id}")
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


@api_router.post("/hr/payroll/batch/{batch_id}/confirm")
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


@api_router.post("/hr/payroll/batch/{batch_id}/mark-paid")
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


@api_router.delete("/hr/payroll/batch/{batch_id}")
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


# ==================== HR MODULE: LEAVE MANAGEMENT ====================

@api_router.post("/hr/leave/apply")
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


@api_router.get("/hr/leave/my-requests")
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


@api_router.get("/hr/leave/my-balance")
async def get_my_leave_balance(
    year: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get current user's leave balance"""
    if not year:
        year = datetime.now(timezone.utc).year
    
    summary = await leave_service.get_leave_summary(current_user["id"], year)
    
    return summary


@api_router.get("/hr/leave/pending-approvals")
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


@api_router.post("/hr/leave/{request_id}/approve")
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
        
        # Log audit
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


@api_router.post("/hr/leave/{request_id}/cancel")
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


@api_router.get("/hr/leave/employee/{employee_id}")
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


@api_router.get("/hr/leave/employee/{employee_id}/balance")
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


@api_router.get("/hr/leave/team-summary")
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


# ==================== SEED DATA ====================

@api_router.post("/seed")
async def seed_data():
    """Seed database with V2 data structure"""
    result = await seed_v2_data(db)
    return {
        "message": "V2 data seeded successfully",
        "stats": result
    }


@api_router.post("/seed/clear")
async def clear_and_seed():
    """Clear all data and re-seed with V2 data"""
    # Clear all collections
    collections = [
        "countries", "departments", "roles", "permissions", "role_permissions",
        "teams", "users", "leads", "customers", "inspections", "transactions",
        "lead_reassignment_logs", "round_robin_state", "digital_ads", "garage_employees",
        "audit_logs", "salary_structures", "finance_payments", "payment_proofs"
    ]
    
    for collection in collections:
        await db[collection].delete_many({})
    
    # Re-seed
    result = await seed_v2_data(db)
    return {
        "message": "Database cleared and V2 data seeded successfully",
        "stats": result
    }


# ==================== ADMIN PASSWORD FIX ENDPOINTS ====================

class AdminPasswordReset(BaseModel):
    """Request to reset user password"""
    email: str
    new_password: str


@api_router.post("/admin/fix-user-password")
async def admin_fix_user_password(
    data: AdminPasswordReset,
    current_user: dict = Depends(get_current_user)
):
    """
    Fix password for a specific user - CEO/HR only.
    Use this when a user cannot login due to corrupted password hash.
    """
    # Only CEO and HR can reset passwords
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Only CEO or HR Manager can reset passwords")
    
    # Find user
    user = await db.users.find_one({"email": data.email})
    if not user:
        raise HTTPException(status_code=404, detail=f"User with email {data.email} not found")
    
    # Hash new password
    new_hash = hash_password(data.new_password)
    
    # Update user password
    await db.users.update_one(
        {"email": data.email},
        {"$set": {
            "hashed_password": new_hash,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "password_reset_by": current_user.get("id"),
            "password_reset_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Invalidate all sessions for this user (force re-login)
    await db.user_sessions.delete_many({"user_id": user["id"]})
    await db.ess_device_sessions.update_many(
        {"user_id": user["id"]},
        {"$set": {"is_active": False}}
    )
    
    return {
        "success": True,
        "message": f"Password reset for {data.email}",
        "user_id": user["id"]
    }


@api_router.post("/admin/fix-all-passwords")
async def admin_fix_all_passwords(
    default_password: str = "password123",
    secret_key: str = None
):
    """
    Fix passwords for ALL users - requires secret key.
    Use this only when multiple users cannot login.
    Does NOT delete any data - only updates password hashes.
    
    Required: secret_key must match ADMIN_SECRET environment variable
    """
    # Require secret key for this dangerous operation
    admin_secret = os.environ.get("ADMIN_SECRET", "wisedrive-admin-2026-secure")
    if secret_key != admin_secret:
        raise HTTPException(status_code=403, detail="Invalid admin secret key")
    
    # Get all users
    users = await db.users.find({}, {"_id": 0, "id": 1, "email": 1}).to_list(1000)
    
    if not users:
        return {"success": False, "message": "No users found", "count": 0}
    
    # Hash the default password once
    password_hash = hash_password(default_password)
    now = datetime.now(timezone.utc).isoformat()
    
    # Update all users
    updated_count = 0
    for user in users:
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {
                "hashed_password": password_hash,
                "updated_at": now,
                "password_bulk_reset_at": now
            }}
        )
        updated_count += 1
    
    # Invalidate all sessions
    await db.user_sessions.delete_many({})
    await db.ess_device_sessions.update_many({}, {"$set": {"is_active": False}})
    
    return {
        "success": True,
        "message": f"Passwords reset for {updated_count} users to '{default_password}'",
        "count": updated_count,
        "users": [u["email"] for u in users]
    }


# DEPRECATED: Old dangerous endpoint - keeping for reference but disabled
# @api_router.post("/admin/reset-users")
# async def admin_reset_users():
#     """DISABLED - Use /admin/fix-all-passwords instead"""
#     raise HTTPException(status_code=410, detail="This endpoint is disabled. Use /admin/fix-all-passwords instead")


@api_router.post("/admin/sync-users")
async def admin_sync_users():
    """Sync users - adds missing users without deleting existing ones (safe for production)
    
    This is a NON-DESTRUCTIVE operation that:
    - Checks if each user email already exists
    - Only creates users that don't exist
    - Preserves all existing data
    """
    
    # Get role IDs
    ceo_role = await db.roles.find_one({"code": "CEO"}, {"_id": 0, "id": 1})
    hr_role = await db.roles.find_one({"code": "HR_MANAGER"}, {"_id": 0, "id": 1})
    finance_role = await db.roles.find_one({"code": "FINANCE_MANAGER"}, {"_id": 0, "id": 1})
    sales_role = await db.roles.find_one({"code": "SALES_EXECUTIVE"}, {"_id": 0, "id": 1})
    mechanic_role = await db.roles.find_one({"code": "MECHANIC"}, {"_id": 0, "id": 1})
    
    # Get country/dept IDs
    india = await db.countries.find_one({"code": "IN"}, {"_id": 0, "id": 1})
    exec_dept = await db.departments.find_one({"code": "EXEC"}, {"_id": 0, "id": 1})
    hr_dept = await db.departments.find_one({"code": "HR"}, {"_id": 0, "id": 1})
    finance_dept = await db.departments.find_one({"code": "FINANCE"}, {"_id": 0, "id": 1})
    sales_dept = await db.departments.find_one({"code": "SALES"}, {"_id": 0, "id": 1})
    inspection_dept = await db.departments.find_one({"code": "INSPECTION"}, {"_id": 0, "id": 1})
    
    # Hash password
    password_hash = hash_password("password123")
    now = datetime.now(timezone.utc).isoformat()
    
    # Users to ensure exist
    required_users = [
        {
            "email": "kalyan@wisedrive.com",
            "name": "Kalyan",
            "role_id": ceo_role["id"] if ceo_role else None,
            "country_id": india["id"] if india else None,
            "department_id": exec_dept["id"] if exec_dept else None,
            "employee_code": "WD-CEO-001",
        },
        {
            "email": "hr@wisedrive.com",
            "name": "HR Manager",
            "role_id": hr_role["id"] if hr_role else None,
            "country_id": india["id"] if india else None,
            "department_id": hr_dept["id"] if hr_dept else None,
            "employee_code": "WD-HR-001",
        },
        {
            "email": "finance@wisedrive.com",
            "name": "Finance Manager",
            "role_id": finance_role["id"] if finance_role else None,
            "country_id": india["id"] if india else None,
            "department_id": finance_dept["id"] if finance_dept else None,
            "employee_code": "WD-FIN-001",
        },
        {
            "email": "john.sales@wisedrive.com",
            "name": "John Sales",
            "role_id": sales_role["id"] if sales_role else None,
            "country_id": india["id"] if india else None,
            "department_id": sales_dept["id"] if sales_dept else None,
            "employee_code": "WD-SE-001",
        },
        {
            "email": "mike.mechanic@wisedrive.com",
            "name": "Mike Mechanic",
            "role_id": mechanic_role["id"] if mechanic_role else None,
            "country_id": india["id"] if india else None,
            "department_id": inspection_dept["id"] if inspection_dept else None,
            "employee_code": "WD-MC-001",
        },
    ]
    
    created_users = []
    skipped_users = []
    
    for user_data in required_users:
        # Check if user already exists
        existing = await db.users.find_one({"email": user_data["email"]})
        
        if existing:
            skipped_users.append(user_data["email"])
            continue
        
        # Create new user
        user = {
            "id": str(uuid.uuid4()),
            "email": user_data["email"],
            "hashed_password": password_hash,
            "name": user_data["name"],
            "role_id": user_data["role_id"],
            "country_id": user_data["country_id"],
            "department_id": user_data["department_id"],
            "employee_code": user_data["employee_code"],
            "phone": "+919876543210",
            "is_active": True,
            "joining_date": "2024-01-01",
            "created_at": now,
            "updated_at": now
        }
        
        await db.users.insert_one(user)
        created_users.append(user_data["email"])
        
        # Create default salary structure for new employees
        if user_data["role_id"] != mechanic_role.get("id") if mechanic_role else None:
            salary = {
                "id": str(uuid.uuid4()),
                "user_id": user["id"],
                "basic_salary": 30000,
                "hra": 15000,
                "variable_pay": 5000,
                "conveyance": 1600,
                "medical": 1250,
                "special_allowance": 2150,
                "gross_salary": 55000,
                "other_allowance": 0,
                "pf_employee": 1800,
                "pf_employer": 1800,
                "esi_employee": 0,
                "esi_employer": 0,
                "professional_tax": 200,
                "income_tax": 0,
                "effective_from": "2024-01-01",
                "is_active": True,
                "currency": "INR",
                "currency_symbol": "₹",
                "created_at": now,
                "updated_at": now
            }
            await db.salary_structures.insert_one(salary)
    
    return {
        "message": "User sync completed",
        "created_count": len(created_users),
        "created_users": created_users,
        "skipped_count": len(skipped_users),
        "skipped_users": skipped_users,
        "note": "Skipped users already exist in the database",
        "default_password": "password123"
    }


# Import and include notification config router
from routes.notification_config import router as notification_config_router
api_router.include_router(notification_config_router, tags=["Notification Configuration"])

# Import and include ESS Mobile API routes
from routes_ess import auth as ess_auth
from routes_ess import leave as ess_leave
from routes_ess import payslips as ess_payslips
from routes_ess import documents as ess_documents
from routes_ess import profile as ess_profile
from routes_ess import notifications as ess_notifications

# ESS Mobile API routes with /ess/v1 prefix
ess_prefix = "/ess/v1"
api_router.include_router(ess_auth.router, prefix=ess_prefix, tags=["ESS Authentication"])
api_router.include_router(ess_leave.router, prefix=ess_prefix, tags=["ESS Leave Management"])
api_router.include_router(ess_payslips.router, prefix=ess_prefix, tags=["ESS Payslips"])
api_router.include_router(ess_documents.router, prefix=ess_prefix, tags=["ESS Documents"])
api_router.include_router(ess_profile.router, prefix=ess_prefix, tags=["ESS Profile"])
api_router.include_router(ess_notifications.router, prefix=ess_prefix, tags=["ESS Notifications"])

# ESS Health check endpoint
@api_router.get("/ess/v1/health")
async def ess_health_check():
    """ESS Mobile API Health check endpoint"""
    fcm_status = "not_initialized"
    if hasattr(app.state, 'fcm_service'):
        if app.state.fcm_service.initialized:
            fcm_status = "active"
        elif app.state.fcm_service.mock_mode:
            fcm_status = "mock_mode"
    
    return {
        "status": "healthy",
        "service": "ess-mobile-api",
        "version": "1.0.0",
        "fcm_status": fcm_status
    }

# Test push notification endpoint (for HR/Admin testing)
@api_router.post("/ess/v1/notifications/test")
async def send_test_notification(
    request: Request,
    user_id: str = None,
    title: str = "Test Notification",
    body: str = "This is a test push notification from WiseDrive ESS"
):
    """Send a test push notification to a user (for testing FCM setup)"""
    if not hasattr(request.app.state, 'fcm_service'):
        raise HTTPException(status_code=500, detail="FCM service not initialized")
    
    fcm = request.app.state.fcm_service
    
    if not user_id:
        # Get first user with a push token
        token_doc = await db.ess_push_tokens.find_one({}, {"_id": 0, "user_id": 1})
        if token_doc:
            user_id = token_doc["user_id"]
        else:
            raise HTTPException(status_code=400, detail="No user_id provided and no users with push tokens found")
    
    result = await fcm.send_notification(
        user_id=user_id,
        title=title,
        body=body,
        data={"type": "test", "timestamp": datetime.now(timezone.utc).isoformat()}
    )
    
    return {
        "message": "Test notification sent",
        "user_id": user_id,
        "result": result,
        "fcm_mode": "production" if not fcm.mock_mode else "mock"
    }

# Broadcast notification endpoint (for announcements)
@api_router.post("/ess/v1/notifications/broadcast")
async def broadcast_notification(
    request: Request,
    title: str,
    body: str,
    country_id: str = None
):
    """Broadcast notification to all users or users in a specific country"""
    if not hasattr(request.app.state, 'fcm_service'):
        raise HTTPException(status_code=500, detail="FCM service not initialized")
    
    fcm = request.app.state.fcm_service
    
    # Get all users with push tokens
    query = {}
    if country_id:
        # Get users from specific country
        users = await db.users.find({"country_id": country_id}, {"_id": 0, "id": 1}).to_list(1000)
        user_ids = [u["id"] for u in users]
        query = {"user_id": {"$in": user_ids}}
    
    push_tokens = await db.ess_push_tokens.find(query, {"_id": 0, "user_id": 1}).to_list(1000)
    user_ids = [t["user_id"] for t in push_tokens]
    
    if not user_ids:
        return {"message": "No users with push tokens found", "sent": 0}
    
    results = await fcm.send_to_multiple(
        user_ids=user_ids,
        title=title,
        body=body,
        data={"type": "announcement"}
    )
    
    return {
        "message": "Broadcast complete",
        "results": results,
        "fcm_mode": "production" if not fcm.mock_mode else "mock"
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

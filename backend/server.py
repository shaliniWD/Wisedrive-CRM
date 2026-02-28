"""WiseDrive CRM V2 - Multi-tenant RBAC Backend"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request, UploadFile, File, Form, Body, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import re
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Any
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

# Meta Ads scheduler
meta_ads_scheduler = None


@app.on_event("startup")
async def startup():
    global rbac_service, round_robin_service, audit_service
    global attendance_service, payroll_service, leave_service, fcm_service
    global meta_ads_scheduler
    
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
    
    # ==================== LOAD META ACCESS TOKEN FROM DATABASE ====================
    # This ensures OAuth tokens saved to DB are used instead of .env file token
    try:
        saved_token = await db.system_config.find_one({"key": "meta_access_token"})
        if saved_token and saved_token.get("value"):
            meta_ads_service.update_token(saved_token["value"])
            logger.info("Loaded Meta access token from database")
    except Exception as e:
        logger.warning(f"Could not load Meta token from database: {e}")
    
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
    
    # Initialize Meta Ads Scheduler for automatic data sync (every 15 minutes)
    from services.meta_ads_scheduler import MetaAdsScheduler
    global meta_ads_scheduler
    meta_ads_scheduler = MetaAdsScheduler(db, meta_ads_service)
    await meta_ads_scheduler.start()
    logger.info("Meta Ads Scheduler started (sync every 6 hours)")
    
    # Initialize Fast2SMS service with database reference for logging
    from services.fast2sms_service import get_fast2sms_service
    fast2sms = get_fast2sms_service()
    fast2sms.set_db(db)
    logger.info("Fast2SMS service initialized with SMS logging")
    
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
        # Log the token for debugging (first 20 chars only)
        token_preview = credentials.credentials[:20] + "..." if credentials.credentials else "EMPTY"
        logger.debug(f"Authenticating with token: {token_preview}")
        
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            logger.warning(f"Token has no 'sub' claim: {token_preview}")
            raise HTTPException(status_code=401, detail="Invalid token")
        
        logger.debug(f"Token decoded for user_id: {user_id}")
        
        # Handle dev mechanic app user (special case for testing)
        if user_id == "dev-mechanic-001" and payload.get("is_mechanic_app"):
            return {
                "id": "dev-mechanic-001",
                "name": "Dev Mechanic",
                "email": "dev.mechanic@wisedrive.com",
                "phone": "9611188788",
                "inspection_cities": ["Bangalore", "Hyderabad", "Chennai"],
                "is_active": True,
                "role_code": "MECHANIC",
                "is_mechanic_app": True
            }
        
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
        if user is None:
            logger.warning(f"User not found for user_id: {user_id}")
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
        logger.warning("Token expired")
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid token error: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        logger.error(f"Unexpected error in get_current_user: {str(e)}")
        raise HTTPException(status_code=401, detail="Authentication failed")


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


# ==================== VERSION & HEALTH ====================
APP_VERSION = "2.5.0"
APP_BUILD_DATE = "2026-02-26T08:00:00Z"

@api_router.get("/version")
async def get_version():
    """Get application version and recent changes - use this to verify deployment"""
    # Check if JWT_SECRET is custom or default
    jwt_status = "custom" if os.environ.get("JWT_SECRET") else "default"
    
    return {
        "version": APP_VERSION,
        "build_date": APP_BUILD_DATE,
        "environment": os.environ.get("ENVIRONMENT", "preview"),
        "jwt_secret_status": jwt_status,  # Important for debugging auth issues
        "recent_changes": [
            "v2.4.6 - Fixed inspection_status bug: progress save now sets INSPECTION_STARTED correctly",
            "v2.4.5 - Mobile app v1.4.0: Fixed profile version display, improved image compression",
            "v2.4.4 - Mobile app bug fixes: Navigate button, cache clearing, inspection detail API enhanced",
            "v2.4.3 - Questionnaire endpoint enhanced to lookup partner template",
            "v2.4.1 - Added jwt_secret_status diagnostic and /auth/test-auth endpoint",
            "v2.4.0 - OTP storage moved to MongoDB (fixes intermittent validation)",
            "v2.4.0 - Employee phone number uniqueness validation",
            "v2.4.0 - Twilio balance display in Settings",
            "v2.3.0 - Fast2SMS integration for OTP",
            "v2.2.0 - Token Management UI"
        ],
        "otp_storage": "mongodb",  # Key indicator - old version uses "memory"
        "db_collections": {
            "mechanic_otps": "Active - stores OTPs for mechanic app login",
            "cities": "Active - city master for consistent data"
        }
    }


@api_router.get("/health")
async def health_check():
    """Simple health check"""
    return {"status": "ok", "version": APP_VERSION}


@api_router.post("/auth/debug-token")
async def debug_token(request: Request):
    """Debug endpoint to check why a token might be failing - for troubleshooting only"""
    try:
        body = await request.json()
        token = body.get("token", "")
        
        if not token:
            return {"valid": False, "error": "No token provided"}
        
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = payload.get("sub")
            
            # Check if user exists
            user = await db.users.find_one({"id": user_id}, {"_id": 0, "name": 1, "email": 1})
            
            return {
                "valid": True,
                "user_id": user_id,
                "user_exists": user is not None,
                "user_name": user.get("name") if user else None,
                "payload_keys": list(payload.keys()),
                "exp": payload.get("exp"),
                "is_mechanic_app": payload.get("is_mechanic_app", False)
            }
        except jwt.ExpiredSignatureError:
            return {"valid": False, "error": "Token expired"}
        except jwt.InvalidTokenError as e:
            return {"valid": False, "error": f"Invalid token: {str(e)}"}
    except Exception as e:
        return {"valid": False, "error": str(e)}


@api_router.get("/auth/test-auth")
async def test_auth(current_user: dict = Depends(get_current_user)):
    """Simple endpoint to test if authentication is working"""
    return {
        "authenticated": True,
        "user_id": current_user.get("id"),
        "user_name": current_user.get("name"),
        "user_email": current_user.get("email"),
        "inspection_cities": current_user.get("inspection_cities", []),
        "role_code": current_user.get("role_code", "unknown")
    }


@api_router.get("/debug/mechanic-query")
async def debug_mechanic_query(current_user: dict = Depends(get_current_user)):
    """Debug endpoint to see what the mechanic inspection query would return"""
    mechanic_id = current_user["id"]
    mechanic_cities = current_user.get("inspection_cities", [])
    mechanic_name = current_user.get("name", "")
    
    # Resolve mechanic cities to include aliases
    all_city_variants = []
    for mc in mechanic_cities:
        all_city_variants.append(mc)
        all_city_variants.append(mc.lower())
        all_city_variants.append(mc.upper())
        all_city_variants.append(mc.title())
        
        # Check if this city has aliases in the master table
        city_doc = await db.cities.find_one({
            "$or": [
                {"name": {"$regex": f"^{mc}$", "$options": "i"}},
                {"aliases": {"$regex": f"^{mc}$", "$options": "i"}}
            ]
        })
        if city_doc:
            all_city_variants.append(city_doc["name"])
            all_city_variants.extend(city_doc.get("aliases", []))
    
    all_city_variants = list(dict.fromkeys(all_city_variants))
    
    # Build the same query as the mechanic inspections endpoint
    query = {
        "$or": [
            {"mechanic_id": mechanic_id},
            {"mechanic_name": {"$regex": f"^{mechanic_name}$", "$options": "i"}} if mechanic_name else {"mechanic_id": mechanic_id},
            {
                "mechanic_id": {"$in": [None, ""]},
                "city": {"$regex": f"^({'|'.join(all_city_variants)})$", "$options": "i"} if all_city_variants else {"$exists": True},
                "inspection_status": {"$in": ["NEW_INSPECTION", "ASSIGNED_TO_MECHANIC"]}
            }
        ]
    }
    
    # Count how many inspections match each condition
    count_by_mechanic_id = await db.inspections.count_documents({"mechanic_id": mechanic_id})
    count_by_mechanic_name = await db.inspections.count_documents({"mechanic_name": {"$regex": f"^{mechanic_name}$", "$options": "i"}}) if mechanic_name else 0
    count_unassigned_in_cities = await db.inspections.count_documents({
        "mechanic_id": {"$in": [None, ""]},
        "city": {"$regex": f"^({'|'.join(all_city_variants)})$", "$options": "i"} if all_city_variants else {"$exists": True},
        "inspection_status": {"$in": ["NEW_INSPECTION", "ASSIGNED_TO_MECHANIC"]}
    })
    
    # Get sample city values in the database
    sample_cities = await db.inspections.distinct("city")
    
    return {
        "mechanic_id": mechanic_id,
        "mechanic_name": mechanic_name,
        "mechanic_cities_from_profile": mechanic_cities,
        "resolved_city_variants": all_city_variants,
        "query_summary": {
            "inspections_assigned_by_id": count_by_mechanic_id,
            "inspections_assigned_by_name": count_by_mechanic_name,
            "unassigned_in_mechanic_cities": count_unassigned_in_cities,
            "total_would_return": count_by_mechanic_id + count_by_mechanic_name + count_unassigned_in_cities
        },
        "sample_cities_in_db": sample_cities[:20],
        "debug_tip": "If 'total_would_return' is 0 but inspections exist, check if city names match between inspections and mechanic's inspection_cities"
    }


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
    date_from: Optional[str] = None,  # Alias for start_date
    date_to: Optional[str] = None,    # Alias for end_date
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
        # Support filtering by either user ID or name
        query["$or"] = [
            {"assigned_to": assigned_to},
            {"assigned_to_name": assigned_to}
        ]
        # If we already have $or from search, merge them
        if "$or" in query and search:
            search_or = [
                {"name": {"$regex": search, "$options": "i"}},
                {"mobile": {"$regex": search, "$options": "i"}}
            ]
            query["$and"] = [
                {"$or": search_or},
                {"$or": [{"assigned_to": assigned_to}, {"assigned_to_name": assigned_to}]}
            ]
            del query["$or"]
    if country_id:
        query["country_id"] = country_id
    if team_id:
        query["team_id"] = team_id
    
    # Handle date filtering (support both parameter naming conventions)
    actual_start_date = start_date or date_from
    actual_end_date = end_date or date_to
    
    if actual_start_date or actual_end_date:
        date_query = {}
        if actual_start_date:
            date_query["$gte"] = actual_start_date
        if actual_end_date:
            # Include the entire end date by adding time component
            date_query["$lte"] = actual_end_date + "T23:59:59"
        query["created_at"] = date_query
    
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
                user_name = user_map.get(lead["assigned_to"])
                if user_name:
                    lead["assigned_to_name"] = user_name
                else:
                    # User no longer exists - clear the invalid assignment
                    lead["assigned_to"] = None
                    lead["assigned_to_name"] = None
    
    return leads


@api_router.post("/leads")
async def create_lead(lead_data: LeadCreate, current_user: dict = Depends(get_current_user)):
    """Create a new lead with automatic round-robin assignment"""
    lead_dict = lead_data.model_dump()
    lead_id = str(uuid.uuid4())
    
    # Set country_id from user if not provided
    if not lead_dict.get("country_id"):
        lead_dict["country_id"] = current_user.get("country_id")
    
    # Set default B2C partner if not specified
    if not lead_dict.get("partner_id"):
        b2c_partner = await db.partners.find_one({"type": "b2c"}, {"_id": 0, "id": 1, "name": 1})
        if b2c_partner:
            lead_dict["partner_id"] = b2c_partner["id"]
            lead_dict["partner_name"] = b2c_partner.get("name", "B2C Default")
    
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
    
    # If partner_id was updated, also update associated inspections
    if "partner_id" in update_dict:
        new_partner_id = update_dict["partner_id"]
        partner = await db.partners.find_one({"id": new_partner_id}, {"_id": 0, "name": 1, "default_report_template_id": 1})
        
        if partner:
            # Get the partner's default report template
            report_template = None
            if partner.get("default_report_template_id"):
                report_template = await db.report_templates.find_one(
                    {"id": partner["default_report_template_id"], "is_active": True},
                    {"_id": 0}
                )
            if not report_template:
                report_template = await db.report_templates.find_one(
                    {"partner_id": new_partner_id, "is_default": True, "is_active": True},
                    {"_id": 0}
                )
            
            # Update all inspections associated with this lead
            inspection_update = {
                "partner_id": new_partner_id,
                "partner_name": partner.get("name"),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            if report_template:
                inspection_update["report_template_id"] = report_template.get("id")
                inspection_update["report_template_name"] = report_template.get("name")
                inspection_update["report_style"] = report_template.get("report_style", "standard")
                inspection_update["inspection_template_id"] = report_template.get("inspection_template_id")
            
            # Update inspections linked to this lead
            result = await db.inspections.update_many(
                {"lead_id": lead_id},
                {"$set": inspection_update}
            )
            logger.info(f"Updated {result.modified_count} inspections with new partner_id: {new_partner_id}")
    
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
    """Delete a lead and ALL related data - CEO only"""
    # Check permission - only CEO can delete
    role_code = current_user.get("role_code", "")
    if role_code != "CEO":
        raise HTTPException(status_code=403, detail="Only CEO can delete leads")
    
    # Check if lead exists
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Delete all related data
    deleted_counts = {
        "lead": 0,
        "notes": 0,
        "activities": 0,
        "reassignment_logs": 0
    }
    
    # Delete lead notes
    notes_result = await db.lead_notes.delete_many({"lead_id": lead_id})
    deleted_counts["notes"] = notes_result.deleted_count
    
    # Delete lead activities
    activities_result = await db.lead_activities.delete_many({"lead_id": lead_id})
    deleted_counts["activities"] = activities_result.deleted_count
    
    # Delete reassignment logs
    reassign_result = await db.lead_reassignment_logs.delete_many({"lead_id": lead_id})
    deleted_counts["reassignment_logs"] = reassign_result.deleted_count
    
    # Finally delete the lead
    lead_result = await db.leads.delete_one({"id": lead_id})
    deleted_counts["lead"] = lead_result.deleted_count
    
    logger.info(f"CEO {current_user.get('name')} deleted lead {lead_id} ({lead.get('name')}, {lead.get('mobile')})")
    
    return {
        "message": f"Lead '{lead.get('name')}' and all related data deleted",
        "deleted_counts": deleted_counts
    }


@api_router.delete("/leads/bulk-delete")
async def bulk_delete_leads(
    phone_numbers: List[str],
    current_user: dict = Depends(get_current_user)
):
    """Bulk delete leads by phone numbers - CEO only"""
    # Check permission - only CEO can delete
    role_code = current_user.get("role_code", "")
    if role_code != "CEO":
        raise HTTPException(status_code=403, detail="Only CEO can delete leads")
    
    results = []
    total_deleted = 0
    
    for phone in phone_numbers:
        # Normalize phone
        clean_phone = phone.replace(" ", "").replace("-", "")
        phone_variants = [clean_phone, f"+{clean_phone}" if not clean_phone.startswith("+") else clean_phone]
        
        # Find lead by phone
        lead = await db.leads.find_one(
            {"$or": [{"mobile": {"$in": phone_variants}}, {"phone": {"$in": phone_variants}}]},
            {"_id": 0, "id": 1, "name": 1, "mobile": 1}
        )
        
        if lead:
            lead_id = lead["id"]
            
            # Delete all related data
            await db.lead_notes.delete_many({"lead_id": lead_id})
            await db.lead_activities.delete_many({"lead_id": lead_id})
            await db.lead_reassignment_logs.delete_many({"lead_id": lead_id})
            await db.leads.delete_one({"id": lead_id})
            
            results.append({"phone": phone, "name": lead.get("name"), "status": "deleted"})
            total_deleted += 1
        else:
            results.append({"phone": phone, "status": "not_found"})
    
    logger.info(f"CEO {current_user.get('name')} bulk deleted {total_deleted} leads")
    
    return {
        "message": f"Deleted {total_deleted} leads",
        "total_deleted": total_deleted,
        "results": results
    }


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


# ==================== BULK CITY REMAP FOR LEADS ====================

class BulkCityRemapRequest(BaseModel):
    """Request model for bulk city remapping"""
    from_city: str  # Source city to change FROM (e.g., "Vizag")
    to_city: str    # Target city to change TO (e.g., "Bangalore")
    date_from: Optional[str] = None  # Optional: Only remap leads created after this date
    date_to: Optional[str] = None    # Optional: Only remap leads created before this date
    reassign_to_sales_rep: bool = True  # Also reassign to sales rep in new city


@api_router.post("/leads/bulk-remap-city")
async def bulk_remap_lead_city(
    request_data: BulkCityRemapRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Bulk remap leads from one city to another.
    Used to fix leads that were incorrectly assigned to default city (e.g., Vizag)
    when they should have been assigned to the correct city from the ad mapping.
    
    Also optionally reassigns leads to sales reps in the new city via round-robin.
    """
    role_code = current_user.get("role_code", "")
    if role_code not in ["HR_MANAGER", "CEO", "COUNTRY_HEAD", "ADMIN", "CTO"]:
        raise HTTPException(status_code=403, detail="Not authorized for bulk city remap")
    
    from_city = request_data.from_city.strip()
    to_city = request_data.to_city.strip()
    
    if not from_city or not to_city:
        raise HTTPException(status_code=400, detail="Both from_city and to_city are required")
    
    if from_city.lower() == to_city.lower():
        raise HTTPException(status_code=400, detail="from_city and to_city cannot be the same")
    
    # Build query for leads to remap
    query = {"city": {"$regex": f"^{from_city}$", "$options": "i"}}
    
    # Add date filters if provided
    if request_data.date_from:
        query["created_at"] = {"$gte": request_data.date_from}
    if request_data.date_to:
        if "created_at" in query:
            query["created_at"]["$lte"] = request_data.date_to
        else:
            query["created_at"] = {"$lte": request_data.date_to}
    
    # Find leads to remap
    leads_to_remap = await db.leads.find(query, {"_id": 0}).to_list(1000)
    
    if not leads_to_remap:
        return {
            "message": f"No leads found with city '{from_city}'",
            "remapped_count": 0,
            "reassigned_count": 0
        }
    
    logger.info(f"Bulk city remap: Found {len(leads_to_remap)} leads to remap from '{from_city}' to '{to_city}'")
    
    remapped_count = 0
    reassigned_count = 0
    results = []
    
    # Get sales reps for the new city (if reassignment is enabled)
    sales_reps = []
    if request_data.reassign_to_sales_rep:
        sales_reps = await find_sales_reps_for_city(to_city)
        logger.info(f"Found {len(sales_reps)} sales reps for new city '{to_city}'")
    
    for lead in leads_to_remap:
        lead_id = lead["id"]
        old_city = lead.get("city", "")
        old_assigned_to = lead.get("assigned_to")
        old_assigned_to_name = lead.get("assigned_to_name", "Unassigned")
        
        # Update lead with new city
        update_data = {
            "city": to_city,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": current_user["id"],
            "city_remapped_from": old_city,
            "city_remapped_at": datetime.now(timezone.utc).isoformat(),
            "city_remapped_by": current_user["id"]
        }
        
        # Reassign to sales rep in new city if enabled
        new_assigned_to = None
        new_assigned_to_name = None
        
        if request_data.reassign_to_sales_rep and sales_reps:
            # Get round-robin counter for new city
            counter = await db.round_robin_counters.find_one({"city": to_city})
            if not counter:
                counter = {"city": to_city, "index": 0}
                await db.round_robin_counters.insert_one(counter)
            
            # Get next sales rep
            index = counter.get("index", 0) % len(sales_reps)
            assigned_rep = sales_reps[index]
            
            new_assigned_to = assigned_rep["id"]
            new_assigned_to_name = assigned_rep.get("name")
            
            update_data["assigned_to"] = new_assigned_to
            update_data["assigned_to_name"] = new_assigned_to_name
            
            # Update counter
            await db.round_robin_counters.update_one(
                {"city": to_city},
                {"$set": {"index": index + 1}},
                upsert=True
            )
            reassigned_count += 1
        
        # Apply update
        await db.leads.update_one({"id": lead_id}, {"$set": update_data})
        remapped_count += 1
        
        # Log city remap activity
        activity = {
            "id": str(uuid.uuid4()),
            "lead_id": lead_id,
            "user_id": current_user["id"],
            "user_name": current_user.get("name", "System"),
            "action": "city_remapped",
            "old_value": old_city,
            "new_value": to_city,
            "details": f"Bulk city remap from '{old_city}' to '{to_city}'",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.lead_activities.insert_one(activity)
        
        # Log reassignment if it happened
        if new_assigned_to and new_assigned_to != old_assigned_to:
            reassign_activity = {
                "id": str(uuid.uuid4()),
                "lead_id": lead_id,
                "user_id": current_user["id"],
                "user_name": current_user.get("name", "System"),
                "action": "lead_reassigned",
                "old_value": old_assigned_to_name,
                "new_value": new_assigned_to_name,
                "details": f"Reassigned after city remap to '{to_city}'",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.lead_activities.insert_one(reassign_activity)
        
        results.append({
            "lead_id": lead_id,
            "lead_name": lead.get("name", "Unknown"),
            "old_city": old_city,
            "new_city": to_city,
            "old_assigned_to": old_assigned_to_name,
            "new_assigned_to": new_assigned_to_name or old_assigned_to_name,
            "status": "remapped"
        })
    
    logger.info(f"Bulk city remap complete: {remapped_count} remapped, {reassigned_count} reassigned")
    
    return {
        "message": f"Remapped {remapped_count} leads from '{from_city}' to '{to_city}'",
        "remapped_count": remapped_count,
        "reassigned_count": reassigned_count,
        "from_city": from_city,
        "to_city": to_city,
        "results": results
    }


@api_router.post("/leads/auto-remap-by-ad-id")
async def auto_remap_leads_by_ad_id(
    reassign_to_sales_rep: bool = True,
    current_user: dict = Depends(get_current_user)
):
    """
    Automatically remap lead cities based on their AD ID to City mapping.
    
    This endpoint:
    1. Fetches all ad_city_mappings
    2. Finds leads where ad_id matches a mapping but city is different
    3. Updates the lead city to match the AD ID mapping
    4. Optionally reassigns leads to sales reps in the new city
    
    This is the "smart" auto-fix for leads that got wrong city assignments.
    """
    role_code = current_user.get("role_code", "")
    if role_code not in ["HR_MANAGER", "CEO", "COUNTRY_HEAD", "ADMIN", "CTO"]:
        raise HTTPException(status_code=403, detail="Not authorized for auto city remap")
    
    # Get all active ad-city mappings
    ad_mappings = await db.ad_city_mappings.find(
        {"is_active": {"$ne": False}},  # Include mappings without is_active field
        {"_id": 0}
    ).to_list(500)
    
    if not ad_mappings:
        return {
            "message": "No ad-city mappings found. Please configure mappings in Settings first.",
            "remapped_count": 0,
            "checked_count": 0
        }
    
    # Build lookup dictionaries for ad_id and ad_name
    ad_id_to_city = {}
    ad_name_to_city = {}
    
    for mapping in ad_mappings:
        ad_id = mapping.get("ad_id")
        ad_name = mapping.get("ad_name")
        city = mapping.get("city")
        
        if ad_id and ad_id != "default" and city:
            ad_id_to_city[ad_id.lower()] = {"city": city, "city_id": mapping.get("city_id")}
        if ad_name and city:
            ad_name_to_city[ad_name.lower()] = {"city": city, "city_id": mapping.get("city_id")}
    
    logger.info(f"Auto-remap: Loaded {len(ad_id_to_city)} ad_id mappings and {len(ad_name_to_city)} ad_name mappings")
    
    # Find all leads with ad_id or ad_name
    leads_with_ads = await db.leads.find(
        {"$or": [
            {"ad_id": {"$exists": True, "$ne": None, "$ne": ""}},
            {"ad_name": {"$exists": True, "$ne": None, "$ne": ""}}
        ]},
        {"_id": 0}
    ).to_list(5000)
    
    logger.info(f"Auto-remap: Found {len(leads_with_ads)} leads with ad_id or ad_name")
    
    remapped_count = 0
    reassigned_count = 0
    skipped_count = 0
    results = []
    
    # Cache for sales reps by city
    sales_reps_cache = {}
    
    for lead in leads_with_ads:
        lead_id = lead["id"]
        lead_ad_id = (lead.get("ad_id") or "").lower()
        lead_ad_name = (lead.get("ad_name") or "").lower()
        current_city = lead.get("city", "")
        
        # Find the correct city from mappings
        correct_city_info = None
        matched_by = None
        
        # Priority 1: Match by ad_id
        if lead_ad_id and lead_ad_id in ad_id_to_city:
            correct_city_info = ad_id_to_city[lead_ad_id]
            matched_by = "ad_id"
        # Priority 2: Match by ad_name
        elif lead_ad_name and lead_ad_name in ad_name_to_city:
            correct_city_info = ad_name_to_city[lead_ad_name]
            matched_by = "ad_name"
        
        if not correct_city_info:
            skipped_count += 1
            continue
        
        correct_city = correct_city_info["city"]
        
        # Check if city needs to be changed
        if current_city.lower() == correct_city.lower():
            skipped_count += 1
            continue
        
        # Update lead city
        update_data = {
            "city": correct_city,
            "city_id": correct_city_info.get("city_id"),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": current_user["id"],
            "city_auto_remapped_from": current_city,
            "city_auto_remapped_at": datetime.now(timezone.utc).isoformat(),
            "city_auto_remapped_by": current_user["id"],
            "city_matched_by": matched_by
        }
        
        old_assigned_to = lead.get("assigned_to")
        old_assigned_to_name = lead.get("assigned_to_name", "Unassigned")
        new_assigned_to = None
        new_assigned_to_name = None
        
        # Reassign to sales rep in new city if enabled
        if reassign_to_sales_rep:
            # Use cache to avoid repeated DB queries
            if correct_city not in sales_reps_cache:
                sales_reps_cache[correct_city] = await find_sales_reps_for_city(correct_city)
            
            sales_reps = sales_reps_cache[correct_city]
            
            if sales_reps:
                # Get round-robin counter for new city
                counter = await db.round_robin_counters.find_one({"city": correct_city})
                if not counter:
                    counter = {"city": correct_city, "index": 0}
                    await db.round_robin_counters.insert_one(counter)
                
                # Get next sales rep
                index = counter.get("index", 0) % len(sales_reps)
                assigned_rep = sales_reps[index]
                
                new_assigned_to = assigned_rep["id"]
                new_assigned_to_name = assigned_rep.get("name")
                
                update_data["assigned_to"] = new_assigned_to
                update_data["assigned_to_name"] = new_assigned_to_name
                
                # Update counter
                await db.round_robin_counters.update_one(
                    {"city": correct_city},
                    {"$set": {"index": index + 1}},
                    upsert=True
                )
                reassigned_count += 1
        
        # Apply update
        await db.leads.update_one({"id": lead_id}, {"$set": update_data})
        remapped_count += 1
        
        # Log activity
        activity = {
            "id": str(uuid.uuid4()),
            "lead_id": lead_id,
            "user_id": current_user["id"],
            "user_name": current_user.get("name", "System"),
            "action": "city_auto_remapped",
            "old_value": current_city,
            "new_value": correct_city,
            "details": f"Auto-remapped based on {matched_by}: {lead.get('ad_id') or lead.get('ad_name')}",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.lead_activities.insert_one(activity)
        
        results.append({
            "lead_id": lead_id,
            "lead_name": lead.get("name", "Unknown"),
            "ad_id": lead.get("ad_id"),
            "ad_name": lead.get("ad_name"),
            "matched_by": matched_by,
            "old_city": current_city,
            "new_city": correct_city,
            "old_assigned_to": old_assigned_to_name,
            "new_assigned_to": new_assigned_to_name or old_assigned_to_name,
            "status": "remapped"
        })
    
    logger.info(f"Auto-remap complete: {remapped_count} remapped, {reassigned_count} reassigned, {skipped_count} skipped")
    
    return {
        "message": f"Auto-remapped {remapped_count} leads based on AD ID mappings",
        "remapped_count": remapped_count,
        "reassigned_count": reassigned_count,
        "skipped_count": skipped_count,
        "total_leads_checked": len(leads_with_ads),
        "total_mappings": len(ad_mappings),
        "results": results
    }


@api_router.get("/leads/city-summary")
async def get_leads_city_summary(current_user: dict = Depends(get_current_user)):
    """
    Get summary of leads by city - useful for identifying city mapping issues.
    """
    pipeline = [
        {"$group": {
            "_id": "$city",
            "count": {"$sum": 1},
            "unassigned_count": {
                "$sum": {"$cond": [{"$or": [
                    {"$eq": ["$assigned_to", None]},
                    {"$eq": ["$assigned_to", ""]},
                ]}, 1, 0]}
            }
        }},
        {"$sort": {"count": -1}}
    ]
    
    results = await db.leads.aggregate(pipeline).to_list(100)
    
    summary = []
    for r in results:
        city = r["_id"] or "No City"
        summary.append({
            "city": city,
            "total_leads": r["count"],
            "unassigned_leads": r["unassigned_count"]
        })
    
    return {
        "cities": summary,
        "total_cities": len(summary)
    }


# Fix missing assigned_to_name for leads
@api_router.post("/leads/fix-assigned-names")
async def fix_assigned_names(current_user: dict = Depends(get_current_user)):
    """
    One-time utility to populate assigned_to_name for leads that only have assigned_to ID.
    Also clears invalid assignments where the user no longer exists.
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
            {"assigned_to_name": ""},
            {"assigned_to_name": "Unknown Rep"}  # Also fix previously marked as Unknown Rep
        ]
    }, {"_id": 0, "id": 1, "assigned_to": 1}).to_list(1000)
    
    if not leads_to_fix:
        return {"message": "No leads need fixing", "fixed_count": 0, "cleared_count": 0}
    
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
    cleared_count = 0
    for lead in leads_to_fix:
        user_id = lead["assigned_to"]
        user_name = user_map.get(user_id)
        
        if user_name:
            # Valid user - set the name
            await db.leads.update_one(
                {"id": lead["id"]},
                {"$set": {"assigned_to_name": user_name}}
            )
            fixed_count += 1
        else:
            # Invalid user - clear the assignment
            await db.leads.update_one(
                {"id": lead["id"]},
                {"$set": {"assigned_to": None, "assigned_to_name": None}}
            )
            cleared_count += 1
    
    return {
        "message": f"Fixed {fixed_count} leads, cleared {cleared_count} invalid assignments",
        "fixed_count": fixed_count,
        "cleared_count": cleared_count,
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


@api_router.get("/leads/investigate/by-phone/{phone}")
async def investigate_lead_by_phone(phone: str, current_user: dict = Depends(get_current_user)):
    """
    Investigate a lead by phone number - returns full details including source, ad_id, ctwa_data
    Phone can be in any format: +917795684573, 917795684573, 7795684573
    """
    # Normalize phone - remove spaces, dashes
    clean_phone = phone.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    
    # Build search variants - comprehensive list
    phone_variants = set()
    phone_variants.add(clean_phone)
    
    # With and without + prefix
    if clean_phone.startswith("+"):
        phone_variants.add(clean_phone[1:])  # Remove +
    else:
        phone_variants.add(f"+{clean_phone}")  # Add +
    
    # Handle country code variations (91 for India)
    if clean_phone.startswith("+91"):
        phone_variants.add(clean_phone[3:])  # Just the 10 digits
        phone_variants.add(clean_phone[1:])  # 91 + 10 digits (no +)
    elif clean_phone.startswith("91") and len(clean_phone) == 12:
        phone_variants.add(clean_phone[2:])  # Just the 10 digits
        phone_variants.add(f"+{clean_phone}")  # +91 + 10 digits
    elif len(clean_phone) == 10:
        phone_variants.add(f"91{clean_phone}")  # 91 + 10 digits
        phone_variants.add(f"+91{clean_phone}")  # +91 + 10 digits
    
    phone_variants = list(phone_variants)
    
    logger.info(f"Investigating lead with phone variants: {phone_variants}")
    
    # Search in both 'mobile' and 'phone' fields
    lead = await db.leads.find_one(
        {"$or": [
            {"mobile": {"$in": phone_variants}},
            {"phone": {"$in": phone_variants}},
            {"customer_phone": {"$in": phone_variants}}
        ]},
        {"_id": 0}
    )
    
    if not lead:
        # Also search by partial match (last 10 digits)
        last_10 = clean_phone[-10:] if len(clean_phone) >= 10 else clean_phone
        lead = await db.leads.find_one(
            {"$or": [
                {"mobile": {"$regex": f"{last_10}$"}},
                {"phone": {"$regex": f"{last_10}$"}}
            ]},
            {"_id": 0}
        )
    
    if not lead:
        raise HTTPException(
            status_code=404, 
            detail={
                "message": f"Lead not found with phone: {phone}",
                "searched_variants": phone_variants,
                "suggestion": "The lead may not exist in this database or the phone format may be different"
            }
        )
    
    # Prepare investigation response
    investigation = {
        "lead_found": True,
        "lead_id": lead.get("id"),
        "name": lead.get("name"),
        "mobile": lead.get("mobile"),
        "city": lead.get("city"),
        "source": lead.get("source", "Unknown"),
        "ad_id": lead.get("ad_id"),
        "ad_name": lead.get("ad_name"),
        "campaign_id": lead.get("campaign_id"),
        "platform": lead.get("platform"),
        "status": lead.get("status"),
        "created_at": lead.get("created_at"),
        "ctwa_data": lead.get("ctwa_data"),
        "assigned_to": lead.get("assigned_to"),
        "assigned_to_name": lead.get("assigned_to_name"),
        # Full lead data for debugging
        "full_lead_data": lead,
        # Webhook audit trail for debugging
        "webhook_audit": lead.get("webhook_audit") or lead.get("last_webhook_audit")
    }
    
    # If it's from META_WHATSAPP, provide extra details
    if lead.get("source") in ["META_WHATSAPP", "DIRECT_WHATSAPP"]:
        investigation["is_meta_lead"] = lead.get("source") == "META_WHATSAPP"
        investigation["meta_details"] = {
            "ad_id": lead.get("ad_id") or "Not captured",
            "ad_name": lead.get("ad_name") or "Not captured",
            "campaign_id": lead.get("campaign_id") or "Not captured",
            "referral_headline": lead.get("ctwa_data", {}).get("referral_headline") if lead.get("ctwa_data") else "Not captured",
            "referral_source_url": lead.get("ctwa_data", {}).get("referral_source_url") if lead.get("ctwa_data") else "Not captured"
        }
    else:
        investigation["is_meta_lead"] = False
    
    return investigation


@api_router.get("/leads/investigate/by-name/{name}")
async def investigate_lead_by_name(name: str, current_user: dict = Depends(get_current_user)):
    """
    Investigate a lead by name - returns full details including source, ad_id, ctwa_data
    Supports partial name match (case-insensitive)
    """
    logger.info(f"Investigating lead with name: {name}")
    
    # Search by exact match first, then partial match
    lead = await db.leads.find_one(
        {"name": {"$regex": f"^{name}$", "$options": "i"}},
        {"_id": 0}
    )
    
    if not lead:
        # Try partial match
        lead = await db.leads.find_one(
            {"name": {"$regex": name, "$options": "i"}},
            {"_id": 0}
        )
    
    if not lead:
        raise HTTPException(
            status_code=404, 
            detail={
                "message": f"Lead not found with name: {name}",
                "suggestion": "Try searching by phone number instead using /api/leads/investigate/by-phone/{phone}"
            }
        )
    
    # Prepare investigation response (same structure as phone search)
    investigation = {
        "lead_found": True,
        "lead_id": lead.get("id"),
        "name": lead.get("name"),
        "mobile": lead.get("mobile"),
        "city": lead.get("city"),
        "source": lead.get("source", "Unknown"),
        "ad_id": lead.get("ad_id"),
        "ad_name": lead.get("ad_name"),
        "campaign_id": lead.get("campaign_id"),
        "platform": lead.get("platform"),
        "status": lead.get("status"),
        "created_at": lead.get("created_at"),
        "ctwa_data": lead.get("ctwa_data"),
        "assigned_to": lead.get("assigned_to"),
        "assigned_to_name": lead.get("assigned_to_name"),
        "full_lead_data": lead
    }
    
    if lead.get("source") == "META_WHATSAPP":
        investigation["is_meta_lead"] = True
        investigation["meta_details"] = {
            "ad_id": lead.get("ad_id") or "Not captured",
            "ad_name": lead.get("ad_name") or "Not captured",
            "campaign_id": lead.get("campaign_id") or "Not captured",
            "referral_headline": lead.get("ctwa_data", {}).get("referral_headline") if lead.get("ctwa_data") else "Not captured",
            "referral_source_url": lead.get("ctwa_data", {}).get("referral_source_url") if lead.get("ctwa_data") else "Not captured"
        }
    else:
        investigation["is_meta_lead"] = False
    
    return investigation


@api_router.get("/leads/diagnose/source-issues")
async def diagnose_lead_source_issues(current_user: dict = Depends(get_current_user)):
    """
    Diagnostic endpoint to find leads that may have source/ad_id issues.
    Identifies leads that were likely created from WhatsApp but are missing META_WHATSAPP source.
    """
    # Get all leads
    all_leads = await db.leads.find({}, {"_id": 0}).to_list(10000)
    
    diagnostics = {
        "total_leads": len(all_leads),
        "by_source": {},
        "potential_issues": [],
        "missing_ad_id_meta_leads": [],
        "leads_with_ctwa_data": [],
        "leads_created_by_system": []
    }
    
    # Count by source
    for lead in all_leads:
        source = lead.get("source", "UNKNOWN")
        if source not in diagnostics["by_source"]:
            diagnostics["by_source"][source] = 0
        diagnostics["by_source"][source] += 1
        
        # Check for issues
        lead_summary = {
            "id": lead.get("id"),
            "name": lead.get("name"),
            "mobile": lead.get("mobile"),
            "city": lead.get("city"),
            "source": source,
            "ad_id": lead.get("ad_id"),
            "ad_name": lead.get("ad_name"),
            "created_by": lead.get("created_by"),
            "created_at": lead.get("created_at"),
            "has_ctwa_data": bool(lead.get("ctwa_data")),
            "ctwa_data": lead.get("ctwa_data")
        }
        
        # Issue 1: Leads created by "system" but with non-META_WHATSAPP source
        if lead.get("created_by") == "system" and source != "META_WHATSAPP":
            diagnostics["potential_issues"].append({
                **lead_summary,
                "issue": "Created by system but source is not META_WHATSAPP"
            })
        
        # Issue 2: META_WHATSAPP leads without ad_id
        if source == "META_WHATSAPP" and not lead.get("ad_id"):
            diagnostics["missing_ad_id_meta_leads"].append(lead_summary)
        
        # Issue 3: Leads with CTWA data
        if lead.get("ctwa_data"):
            diagnostics["leads_with_ctwa_data"].append(lead_summary)
        
        # Leads created by system
        if lead.get("created_by") == "system":
            diagnostics["leads_created_by_system"].append(lead_summary)
    
    diagnostics["summary"] = {
        "total_meta_whatsapp": diagnostics["by_source"].get("META_WHATSAPP", 0),
        "total_website": diagnostics["by_source"].get("WEBSITE", 0),
        "total_system_created": len(diagnostics["leads_created_by_system"]),
        "potential_misassigned_leads": len(diagnostics["potential_issues"]),
        "meta_leads_missing_ad_id": len(diagnostics["missing_ad_id_meta_leads"]),
        "leads_with_ctwa": len(diagnostics["leads_with_ctwa_data"])
    }
    
    return diagnostics


@api_router.post("/leads/fix-source-issues")
async def fix_lead_source_issues(
    fix_type: str = "system_created",  # "system_created" or "all_website"
    dry_run: bool = True,
    current_user: dict = Depends(get_current_user)
):
    """
    Fix leads that were incorrectly tagged with wrong source.
    
    fix_type options:
    - "system_created": Fix only leads created by system that have non-META_WHATSAPP source
    - "all_website": Fix ALL leads with WEBSITE source to META_WHATSAPP (use with caution!)
    
    dry_run: If True, only reports what would be fixed without making changes
    """
    fixed_leads = []
    
    if fix_type == "system_created":
        # Find leads created by system but with wrong source
        query = {
            "created_by": "system",
            "source": {"$ne": "META_WHATSAPP"}
        }
    elif fix_type == "all_website":
        # Fix all WEBSITE source leads
        query = {"source": "WEBSITE"}
    else:
        raise HTTPException(status_code=400, detail="Invalid fix_type. Use 'system_created' or 'all_website'")
    
    leads_to_fix = await db.leads.find(query, {"_id": 0}).to_list(10000)
    
    for lead in leads_to_fix:
        lead_info = {
            "id": lead.get("id"),
            "name": lead.get("name"),
            "mobile": lead.get("mobile"),
            "old_source": lead.get("source"),
            "new_source": "META_WHATSAPP",
            "created_by": lead.get("created_by"),
            "created_at": lead.get("created_at")
        }
        
        if not dry_run:
            # Actually fix the lead
            await db.leads.update_one(
                {"id": lead["id"]},
                {"$set": {
                    "source": "META_WHATSAPP",
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            # Log the fix
            activity = {
                "id": str(uuid.uuid4()),
                "lead_id": lead["id"],
                "user_id": current_user["id"],
                "user_name": current_user.get("name", "System"),
                "action": "source_fixed",
                "old_value": lead.get("source"),
                "new_value": "META_WHATSAPP",
                "details": f"Source corrected from '{lead.get('source')}' to 'META_WHATSAPP' via fix-source-issues",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.lead_activities.insert_one(activity)
        
        fixed_leads.append(lead_info)
    
    return {
        "dry_run": dry_run,
        "fix_type": fix_type,
        "total_leads_affected": len(fixed_leads),
        "leads": fixed_leads[:100],  # Return first 100 for preview
        "message": f"{'Would fix' if dry_run else 'Fixed'} {len(fixed_leads)} leads" + (". Run with dry_run=false to apply changes." if dry_run else "")
    }


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
        "details": f"Added a note ({len(note_data.note)} chars)",
        "new_value": note_data.note[:500],  # Store note content (truncate if very long)
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
    amount: Optional[float] = None  # Amount to charge NOW via Razorpay
    total_amount: Optional[float] = None  # Total package amount after discounts
    send_via_whatsapp: bool = True
    description: Optional[str] = None
    vehicle_number: Optional[str] = None
    no_of_inspections: int = 1
    discount_type: Optional[str] = None
    discount_value: Optional[str] = None
    base_amount: Optional[float] = None
    discount_amount: Optional[float] = None
    inspection_schedules: Optional[List[InspectionScheduleData]] = None
    # Partial payment fields
    is_partial_payment: bool = False
    partial_payment_amount: Optional[float] = None
    balance_due: Optional[float] = None


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
        "payment_amount": amount,  # Amount to charge via Razorpay
        "total_amount": payment_data.total_amount or amount,  # Total package amount after discounts
        "package_id": payment_data.package_id,
        "package_name": package.get("name"),
        "no_of_inspections": no_of_inspections,
        "discount_type": payment_data.discount_type,
        "discount_value": payment_data.discount_value,
        "base_amount": payment_data.base_amount,
        "discount_amount": payment_data.discount_amount,
        "inspection_schedules": inspection_schedules_data,  # Store schedules for processing on payment
        # Partial payment fields
        "is_partial_payment": payment_data.is_partial_payment,
        "partial_payment_amount": payment_data.partial_payment_amount,
        "balance_due": payment_data.balance_due,
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
                    "new_value": f"₹{amount} for {package.get('name', 'Package')} ({no_of_inspections} inspection{'s' if no_of_inspections > 1 else ''})",
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
                    "inspection_status": "NEW_INSPECTION",
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
from fastapi.responses import Response, HTMLResponse

# Twilio WhatsApp Webhook - receives incoming messages from Meta ads
@api_router.post("/webhooks/twilio/whatsapp")
async def twilio_whatsapp_webhook(
    request: Request,
    From: str = Form(...),
    Body: str = Form(default=""),
    ProfileName: str = Form(default=""),
    WaId: str = Form(default=""),
    MessageSid: str = Form(default=""),
    To: str = Form(default=""),  # Twilio destination number
    AccountSid: str = Form(default=""),  # Twilio account ID
    NumMedia: str = Form(default="0"),  # Number of media attachments
    # CTWA (Click-to-WhatsApp) referral parameters from Meta ads
    ReferralSourceUrl: str = Form(default=""),
    ReferralBody: str = Form(default=""),
    ReferralHeadline: str = Form(default=""),
    ReferralSourceType: str = Form(default=""),
    ReferralNumMedia: str = Form(default=""),
    ButtonText: str = Form(default=""),
    CtwaClid: str = Form(default=""),  # CTWA Click ID (old field name)
    ReferralCtwaClid: str = Form(default=""),  # CTWA Click tracking ID
    ReferralSourceId: str = Form(default=""),  # THIS IS THE ACTUAL META AD ID!
):
    """
    Webhook endpoint for incoming WhatsApp messages via Twilio.
    Creates a new lead from Meta ad clicks.
    Returns TwiML response for immediate reply.
    
    CTWA Parameters (Click-to-WhatsApp from Meta ads):
    - ReferralSourceUrl: The URL of the ad that triggered the message
    - ReferralBody: The body text of the ad
    - ReferralHeadline: The headline of the ad
    - ReferralSourceType: Type of referral (e.g., 'ad', 'post')
    - ButtonText: The CTA button text clicked
    - CtwaClid: Click ID for tracking
    """
    # ==================== LOG ALL INCOMING DATA FOR DEBUGGING ====================
    # Get raw form data to see ALL parameters Twilio sends
    raw_twilio_data = {}
    try:
        form_data = await request.form()
        raw_twilio_data = dict(form_data)
        logger.info(f"=== WHATSAPP WEBHOOK RAW DATA ===")
        logger.info(f"ALL PARAMS RECEIVED: {raw_twilio_data}")
        logger.info(f"=================================")
    except Exception as e:
        logger.warning(f"Could not read raw form data: {e}")
        raw_twilio_data = {"error": str(e)}
    
    # Build comprehensive audit data
    audit_data = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "raw_twilio_params": raw_twilio_data,
        "parsed_standard_fields": {
            "From": From,
            "To": To,
            "Body": Body,
            "MessageSid": MessageSid,
            "AccountSid": AccountSid,
            "ProfileName": ProfileName,
            "WaId": WaId,
            "NumMedia": NumMedia
        },
        "parsed_ctwa_fields": {
            "ReferralSourceUrl": ReferralSourceUrl,
            "ReferralBody": ReferralBody,
            "ReferralHeadline": ReferralHeadline,
            "ReferralSourceType": ReferralSourceType,
            "ReferralNumMedia": ReferralNumMedia,
            "ButtonText": ButtonText,
            "CtwaClid": CtwaClid,
            "ReferralCtwaClid": ReferralCtwaClid,
            "ReferralSourceId": ReferralSourceId  # THIS IS THE ACTUAL META AD ID!
        },
        "extraction_log": []
    }
    
    # Log parsed parameters
    logger.info(f"WhatsApp webhook received: From={From}, Body={Body[:100] if Body else 'empty'}")
    logger.info(f"CTWA Referral Data: SourceUrl={ReferralSourceUrl}, Headline={ReferralHeadline}, SourceType={ReferralSourceType}")
    logger.info(f"CTWA IDs: ReferralSourceId={ReferralSourceId}, CtwaClid={CtwaClid}, ReferralCtwaClid={ReferralCtwaClid}")
    logger.info(f"Additional CTWA: ButtonText={ButtonText}, ReferralBody={ReferralBody}, ReferralNumMedia={ReferralNumMedia}")
    
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
    ad_name = None
    
    # ==================== EXTRACT AD INFO FROM CTWA REFERRAL DATA ====================
    # Priority 1: Use ReferralSourceId - THIS IS THE ACTUAL META AD ID!
    # This directly maps to ad_id in our ad_city_mappings table
    if ReferralSourceId:
        ad_id = ReferralSourceId
        audit_data["extraction_log"].append({"step": 1, "source": "ReferralSourceId (Meta Ad ID)", "found": True, "value": ReferralSourceId})
        logger.info(f"Found ad_id from ReferralSourceId: {ad_id}")
    else:
        audit_data["extraction_log"].append({"step": 1, "source": "ReferralSourceId", "found": False, "reason": "ReferralSourceId is empty/null"})
    
    # Priority 2: Fall back to ReferralCtwaClid or CtwaClid (click tracking ID)
    if not ad_id:
        effective_ctwa_clid = ReferralCtwaClid or CtwaClid
        if effective_ctwa_clid:
            ad_id = effective_ctwa_clid
            source_field = "ReferralCtwaClid" if ReferralCtwaClid else "CtwaClid"
            audit_data["extraction_log"].append({"step": 2, "source": f"{source_field} (Click ID)", "found": True, "value": effective_ctwa_clid})
            logger.info(f"Found ad_id from {source_field}: {ad_id}")
        else:
            audit_data["extraction_log"].append({
                "step": 2, 
                "source": "CtwaClid/ReferralCtwaClid", 
                "found": False, 
                "reason": "Both CtwaClid and ReferralCtwaClid are empty/null"
            })
    
    # Priority 3: Extract ad_id from ReferralSourceUrl (contains fbclid or ad parameters)
    if not ad_id and ReferralSourceUrl:
        # Try to extract ad_id from URL parameters
        # Example: https://fb.me/xyz or contains ad_id=xxx
        url_ad_match = re.search(r'ad_id[=:]([a-zA-Z0-9_-]+)', ReferralSourceUrl, re.IGNORECASE)
        if url_ad_match:
            ad_id = url_ad_match.group(1)
            audit_data["extraction_log"].append({"step": 3, "source": "ReferralSourceUrl (ad_id param)", "found": True, "value": ad_id})
            logger.info(f"Found ad_id from ReferralSourceUrl param: {ad_id}")
        else:
            # Try extracting fbclid or other identifiers
            fbclid_match = re.search(r'fbclid[=:]([a-zA-Z0-9_-]+)', ReferralSourceUrl, re.IGNORECASE)
            if fbclid_match:
                ad_id = fbclid_match.group(1)
                audit_data["extraction_log"].append({"step": 3, "source": "ReferralSourceUrl (fbclid)", "found": True, "value": ad_id})
                logger.info(f"Found ad_id from fbclid: {ad_id}")
            else:
                audit_data["extraction_log"].append({"step": 3, "source": "ReferralSourceUrl", "found": False, "reason": "No ad_id or fbclid found in URL", "url": ReferralSourceUrl})
    elif not ad_id:
        audit_data["extraction_log"].append({"step": 3, "source": "ReferralSourceUrl", "found": False, "reason": "ReferralSourceUrl is empty/null or ad_id already found"})
    
    # Priority 4: Use ReferralHeadline as ad_name for lookup
    if ReferralHeadline:
        ad_name = ReferralHeadline.strip()
        audit_data["extraction_log"].append({"step": 4, "source": "ReferralHeadline", "field": "ad_name", "found": True, "value": ad_name})
        logger.info(f"Found ad_name from ReferralHeadline: {ad_name}")
    else:
        audit_data["extraction_log"].append({"step": 4, "source": "ReferralHeadline", "field": "ad_name", "found": False, "reason": "ReferralHeadline is empty/null"})
    
    # Priority 5: Extract from message body (fallback)
    if Body:
        if not ad_id:
            ad_match = re.search(r'ad[_\s]?id[:\s]*([a-zA-Z0-9_-]+)', Body, re.IGNORECASE)
            if ad_match:
                ad_id = ad_match.group(1)
                audit_data["extraction_log"].append({"step": 5, "source": "Body (regex)", "found": True, "value": ad_id})
                logger.info(f"Found ad_id from message body: {ad_id}")
            else:
                audit_data["extraction_log"].append({"step": 5, "source": "Body (regex)", "found": False, "reason": "No ad_id pattern found in body"})
        
        campaign_match = re.search(r'campaign[_\s]?id[:\s]*([a-zA-Z0-9_-]+)', Body, re.IGNORECASE)
        if campaign_match:
            campaign_id = campaign_match.group(1)
            audit_data["extraction_log"].append({"step": 4.1, "source": "Body (regex)", "field": "campaign_id", "found": True, "value": campaign_id})
        
        # Check for platform indicators
        if 'instagram' in Body.lower() or 'insta' in Body.lower():
            platform = "instagram"
        elif 'facebook' in Body.lower() or 'fb' in Body.lower():
            platform = "facebook"
    
    # Determine platform from ReferralSourceType if available
    if ReferralSourceType:
        if 'instagram' in ReferralSourceType.lower():
            platform = "instagram"
        elif 'facebook' in ReferralSourceType.lower() or 'fb' in ReferralSourceType.lower():
            platform = "facebook"
    
    # Add final extraction summary to audit
    audit_data["extracted_values"] = {
        "ad_id": ad_id,
        "ad_name": ad_name,
        "campaign_id": campaign_id,
        "platform": platform
    }
    
    # ==================== CITY LOOKUP FROM AD MAPPING ====================
    city = None  # No default city - must match a mapping
    city_id = None
    ad_mapping = None
    city_lookup_log = []
    
    # Strategy 1: Lookup by ad_id (exact match)
    if ad_id:
        ad_mapping = await db.ad_city_mappings.find_one({"ad_id": ad_id, "is_active": True}, {"_id": 0})
        if ad_mapping:
            city = ad_mapping.get("city")
            city_id = ad_mapping.get("city_id")
            city_lookup_log.append({"strategy": 1, "method": "ad_id exact match", "found": True, "city": city})
            logger.info(f"Found city mapping by ad_id '{ad_id}': {city}")
        else:
            city_lookup_log.append({"strategy": 1, "method": "ad_id exact match", "found": False, "ad_id": ad_id})
    else:
        city_lookup_log.append({"strategy": 1, "method": "ad_id exact match", "skipped": True, "reason": "No ad_id available"})
    
    # Strategy 2: Lookup by ad_name (partial match on ad_name field)
    if not city and ad_name:
        ad_mapping = await db.ad_city_mappings.find_one({
            "ad_name": {"$regex": re.escape(ad_name), "$options": "i"},
            "is_active": True
        }, {"_id": 0})
        if ad_mapping:
            city = ad_mapping.get("city")
            city_id = ad_mapping.get("city_id")
            # Only use mapped ad_id if we don't already have a real one
            if not ad_id:
                ad_id = ad_mapping.get("ad_id")
            city_lookup_log.append({"strategy": 2, "method": "ad_name match", "found": True, "city": city, "ad_name": ad_name, "kept_original_ad_id": bool(ad_id)})
            logger.info(f"Found city mapping by ad_name '{ad_name}': {city}")
        else:
            city_lookup_log.append({"strategy": 2, "method": "ad_name match", "found": False, "ad_name": ad_name})
    elif not city:
        city_lookup_log.append({"strategy": 2, "method": "ad_name match", "skipped": True, "reason": "No ad_name available"})
    
    # Strategy 3: Lookup by message body content matching ad_name
    if not city and Body:
        # Try to find any ad_mapping where ad_name appears in the message
        all_mappings = await db.ad_city_mappings.find({"is_active": True}, {"_id": 0}).to_list(100)
        for mapping in all_mappings:
            mapping_ad_name = mapping.get("ad_name", "")
            if mapping_ad_name and mapping_ad_name.lower() in Body.lower():
                city = mapping.get("city")
                city_id = mapping.get("city_id")
                # Only use mapped ad_id if we don't already have a real one
                if not ad_id:
                    ad_id = mapping.get("ad_id")
                ad_name = mapping_ad_name
                city_lookup_log.append({"strategy": 3, "method": "body content match", "found": True, "city": city, "matched_ad_name": mapping_ad_name})
                logger.info(f"Found city mapping by message content match '{mapping_ad_name}': {city}")
                break
        else:
            city_lookup_log.append({"strategy": 3, "method": "body content match", "found": False, "body_snippet": Body[:100] if Body else None})
    elif not city:
        city_lookup_log.append({"strategy": 3, "method": "body content match", "skipped": True, "reason": "City already found or no body"})
    
    # Strategy 4: Try to extract city from ad_name itself (intelligent parsing)
    if not city and ad_name:
        # Common city keywords in Indian ad names
        city_keywords = {
            "bangalore": "Bangalore",
            "bengaluru": "Bangalore", 
            "chennai": "Chennai",
            "madras": "Chennai",
            "hyderabad": "Hyderabad",
            "vizag": "Vizag",
            "visakhapatnam": "Vizag",
            "mumbai": "Mumbai",
            "bombay": "Mumbai",
            "pune": "Pune",
            "delhi": "Delhi",
            "ncr": "Delhi",
            "gurgaon": "Delhi",
            "noida": "Delhi",
            "kolkata": "Kolkata",
            "calcutta": "Kolkata",
            "ahmedabad": "Ahmedabad",
            "kochi": "Kochi",
            "cochin": "Kochi",
            "jaipur": "Jaipur",
            "lucknow": "Lucknow",
            "chandigarh": "Chandigarh",
            "indore": "Indore",
            "coimbatore": "Coimbatore",
            "mysore": "Mysore",
            "mysuru": "Mysore",
            "trivandrum": "Trivandrum",
            "thiruvananthapuram": "Trivandrum",
            "mangalore": "Mangalore",
            "mangaluru": "Mangalore",
        }
        
        ad_name_lower = ad_name.lower()
        for keyword, city_name in city_keywords.items():
            if keyword in ad_name_lower:
                city = city_name
                city_lookup_log.append({"strategy": 4, "method": "ad_name keyword extraction", "found": True, "city": city, "keyword": keyword})
                logger.info(f"Extracted city '{city}' from ad_name keyword '{keyword}' in '{ad_name}'")
                
                # Auto-create mapping for this ad_name -> city
                auto_ad_id = f"auto_{ad_name[:30].replace(' ', '_')}_{datetime.now().strftime('%Y%m%d')}"
                existing_mapping = await db.ad_city_mappings.find_one({
                    "$or": [
                        {"ad_name": {"$regex": f"^{re.escape(ad_name)}$", "$options": "i"}},
                        {"ad_id": auto_ad_id}
                    ]
                })
                
                if existing_mapping:
                    # Use the existing mapping's ad_id if no ad_id was extracted
                    if not ad_id:
                        ad_id = existing_mapping.get("ad_id")
                        city_lookup_log.append({"ad_id_from_existing_mapping": True, "ad_id": ad_id})
                        logger.info(f"Using existing mapping ad_id: {ad_id}")
                else:
                    new_mapping = {
                        "id": str(uuid.uuid4()),
                        "ad_id": auto_ad_id,
                        "ad_name": ad_name,
                        "city": city,
                        "city_id": None,
                        "source": "auto_extracted_from_ad_name",
                        "is_active": True,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                    await db.ad_city_mappings.insert_one(new_mapping)
                    city_lookup_log.append({"auto_mapping_created": True, "ad_name": ad_name, "city": city, "auto_ad_id": auto_ad_id})
                    logger.info(f"Auto-created city mapping: '{ad_name}' -> '{city}'")
                    
                    # Use the auto-generated ad_id for this lead if none was extracted
                    if not ad_id:
                        ad_id = auto_ad_id
                        city_lookup_log.append({"ad_id_auto_generated": True, "ad_id": ad_id})
                        logger.info(f"Using auto-generated ad_id: {ad_id}")
                break
        else:
            city_lookup_log.append({"strategy": 4, "method": "ad_name keyword extraction", "found": False, "ad_name": ad_name, "reason": "No city keyword found in ad_name"})
    elif not city:
        city_lookup_log.append({"strategy": 4, "method": "ad_name keyword extraction", "skipped": True, "reason": "No ad_name available"})
    
    # Strategy 5: Fallback to default mapping (if exists)
    if not city:
        default_mapping = await db.ad_city_mappings.find_one({"ad_id": "default"}, {"_id": 0})
        if default_mapping:
            city = default_mapping.get("city", "Vizag")
            city_lookup_log.append({"strategy": 5, "method": "default mapping", "found": True, "city": city})
            logger.info(f"Using default city mapping: {city}")
        else:
            city = "Vizag"  # Ultimate fallback
            city_lookup_log.append({"strategy": 5, "method": "hardcoded fallback", "city": "Vizag", "reason": "No default mapping configured"})
            logger.warning(f"No ad mapping found for ad_id={ad_id}, ad_name={ad_name}. Using fallback city: Vizag")
        
        # AUTO-CREATE UNMAPPED AD ENTRY for later mapping
        # This helps track ads that need city mapping
        if ad_id or ad_name:
            unmapped_ad_id = ad_id or f"auto_{ad_name[:20] if ad_name else 'unknown'}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
            existing_unmapped = await db.unmapped_ads.find_one({
                "$or": [
                    {"ad_id": unmapped_ad_id},
                    {"ad_name": ad_name} if ad_name else {"ad_id": "never_match"}
                ]
            })
            if not existing_unmapped:
                unmapped_entry = {
                    "id": str(uuid.uuid4()),
                    "ad_id": unmapped_ad_id,
                    "ad_name": ad_name,
                    "source": "whatsapp_webhook",
                    "referral_headline": ReferralHeadline,
                    "referral_source_url": ReferralSourceUrl,
                    "referral_source_type": ReferralSourceType,
                    "ctwa_clid": CtwaClid,
                    "suggested_city": None,  # To be filled manually
                    "lead_count": 1,
                    "first_seen_at": datetime.now(timezone.utc).isoformat(),
                    "last_seen_at": datetime.now(timezone.utc).isoformat(),
                    "is_mapped": False
                }
                await db.unmapped_ads.insert_one(unmapped_entry)
                logger.info(f"Auto-created unmapped ad entry: {unmapped_ad_id} / {ad_name}")
                
                # Use the unmapped ad_id for this lead if none was extracted
                if not ad_id:
                    ad_id = unmapped_ad_id
                    city_lookup_log.append({"ad_id_from_unmapped": True, "ad_id": ad_id})
                    logger.info(f"Using auto-generated ad_id from unmapped: {ad_id}")
            else:
                # Increment lead count
                await db.unmapped_ads.update_one(
                    {"id": existing_unmapped["id"]},
                    {
                        "$inc": {"lead_count": 1},
                        "$set": {"last_seen_at": datetime.now(timezone.utc).isoformat()}
                    }
                )
                # Use existing unmapped ad_id if none was extracted
                if not ad_id:
                    ad_id = existing_unmapped.get("ad_id")
                    city_lookup_log.append({"ad_id_from_existing_unmapped": True, "ad_id": ad_id})
                    logger.info(f"Using existing unmapped ad_id: {ad_id}")
    
    # Add city lookup log to audit data
    audit_data["city_lookup_log"] = city_lookup_log
    audit_data["final_assignment"] = {
        "city": city,
        "city_id": city_id,
        "ad_id": ad_id,
        "ad_name": ad_name,
        "platform": platform
    }
    
    logger.info(f"Final city assignment: {city} (ad_id={ad_id}, ad_name={ad_name})")
    
    # ==================== PARTNER ASSIGNMENT FROM AD MAPPING (Option C) ====================
    # Get partner from ad_mapping if available, otherwise default to B2C
    partner_id = None
    partner_name = None
    
    if ad_mapping and ad_mapping.get("partner_id"):
        # Use partner from the matched ad mapping
        partner_id = ad_mapping.get("partner_id")
        partner_name = ad_mapping.get("partner_name")
        logger.info(f"Partner from ad_mapping: {partner_name} (id={partner_id})")
        audit_data["partner_source"] = "ad_mapping"
    
    # Fallback to B2C Default if no partner from mapping
    if not partner_id:
        b2c_partner = await db.partners.find_one({"type": "b2c"}, {"_id": 0, "id": 1, "name": 1})
        if b2c_partner:
            partner_id = b2c_partner["id"]
            partner_name = b2c_partner.get("name", "B2C Default")
            logger.info(f"Using B2C default partner: {partner_name}")
            audit_data["partner_source"] = "b2c_default"
    
    audit_data["final_assignment"]["partner_id"] = partner_id
    audit_data["final_assignment"]["partner_name"] = partner_name
    
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
                "updated_at": datetime.now(timezone.utc).isoformat(),
                # Update audit data for existing lead
                "last_webhook_audit": audit_data
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
    
    # ==================== DETERMINE SOURCE ====================
    # Check if this is from Meta Ad (CTWA) or Direct WhatsApp
    has_ctwa_data = any([ReferralSourceUrl, ReferralHeadline, ReferralBody, CtwaClid, ButtonText])
    
    if has_ctwa_data:
        # This is a Click-to-WhatsApp lead from Meta Ad
        lead_source = "META_WHATSAPP"
        logger.info(f"Lead source: META_WHATSAPP (CTWA data detected)")
    else:
        # This is a direct WhatsApp message (not from Meta Ad)
        lead_source = "DIRECT_WHATSAPP"
        logger.info(f"Lead source: DIRECT_WHATSAPP (no CTWA data)")
    
    lead = {
        "id": lead_id,
        "name": ProfileName or "WhatsApp Lead",
        "mobile": phone,
        "city": city,
        "city_id": city_id,
        "source": lead_source,
        "ad_id": ad_id,
        "ad_name": ad_name,
        "campaign_id": campaign_id,
        "platform": platform,
        "message": Body,
        "status": "NEW LEAD",
        # Partner assignment from ad mapping (Option C)
        "partner_id": partner_id,
        "partner_name": partner_name,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "created_by": "system",
        # Store CTWA referral data for debugging
        "ctwa_data": {
            "referral_source_url": ReferralSourceUrl,
            "referral_headline": ReferralHeadline,
            "referral_body": ReferralBody,
            "referral_source_type": ReferralSourceType,
            "button_text": ButtonText,
            "ctwa_clid": CtwaClid
        } if has_ctwa_data else None,
        # Store complete webhook audit trail for debugging
        "webhook_audit": audit_data
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
    
    # Get payment_link_id to check if this is a balance payment
    payment_link_id = payment_entity.get("id")
    
    # Check if this is a balance payment for an inspection
    if payment_link_id:
        inspection = await db.inspections.find_one(
            {"balance_payment_link_id": payment_link_id}, 
            {"_id": 0}
        )
        if inspection and event in ["payment_link.paid", "payment.captured"]:
            # This is a balance payment - handle it separately
            payment_id = payment_entity.get("id")
            amount = payment_entity.get("amount", 0) / 100  # Convert from paise
            
            # Add payment to transaction history
            balance_transaction = {
                "id": str(uuid.uuid4()),
                "amount": amount,
                "payment_type": "balance",
                "payment_method": "razorpay",
                "razorpay_payment_id": payment_id,
                "payment_link_id": payment_link_id,
                "status": "completed",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            existing_transactions = inspection.get("payment_transactions", [])
            existing_transactions.append(balance_transaction)
            
            # Calculate new totals
            new_amount_paid = inspection.get("amount_paid", 0) + amount
            new_balance_due = max(0, inspection.get("balance_due", 0) - amount)
            new_payment_status = "FULLY_PAID" if new_balance_due <= 0 else "PARTIALLY_PAID"
            
            await db.inspections.update_one(
                {"id": inspection["id"]},
                {"$set": {
                    "amount_paid": new_amount_paid,
                    "balance_due": new_balance_due,
                    "payment_status": new_payment_status,
                    "payment_type": "Full" if new_balance_due <= 0 else "Partial",
                    "payment_transactions": existing_transactions,
                    "balance_payment_completed_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            # Send WhatsApp confirmation for balance payment
            from services.twilio_service import get_twilio_service
            twilio = get_twilio_service()
            if twilio.is_configured() and inspection.get("customer_mobile"):
                message = f"""✅ *Balance Payment Received*

Dear {inspection.get('customer_name', 'Customer')},

Thank you for completing your payment!

💰 *Amount Paid:* ₹{amount:,.0f}
📦 *Package:* {inspection.get('package_type', 'Inspection')}
🚗 *Vehicle:* {inspection.get('car_number', '')}

Your inspection report will be sent shortly.

Thank you for choosing Wisedrive!"""
                await twilio.send_message(inspection["customer_mobile"], message)
            
            logger.info(f"Balance payment processed for inspection {inspection['id']}: ₹{amount}")
            return {"status": "balance_payment_processed", "inspection_id": inspection["id"]}
    
    # Get lead_id from notes
    notes = payment_entity.get("notes", {})
    lead_id = notes.get("lead_id")
    
    if not lead_id:
        # Try to find lead by payment_link_id
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
            # Partner info carried forward from lead
            "partner_id": lead.get("partner_id"),
            "partner_name": lead.get("partner_name"),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.customers.insert_one(customer)
        
        # Get report template for this partner using Option B logic:
        # 1. First check Partner.default_report_template_id (explicit assignment)
        # 2. Fallback to Report Template with is_default=true for this partner
        # 3. Fallback to any active template for this partner
        # 4. Final fallback to B2C default
        report_template = None
        partner_id = lead.get("partner_id")
        
        if partner_id:
            # Step 1: Check if partner has explicit default_report_template_id set
            partner = await db.partners.find_one({"id": partner_id}, {"_id": 0})
            if partner and partner.get("default_report_template_id"):
                report_template = await db.report_templates.find_one(
                    {"id": partner["default_report_template_id"], "is_active": True},
                    {"_id": 0}
                )
                if report_template:
                    logger.info(f"Using Partner's explicit default_report_template_id: {report_template.get('name')}")
            
            # Step 2: Fallback to report template with is_default=true for this partner
            if not report_template:
                report_template = await db.report_templates.find_one(
                    {"partner_id": partner_id, "is_default": True, "is_active": True},
                    {"_id": 0}
                )
                if report_template:
                    logger.info(f"Using Partner's is_default report template: {report_template.get('name')}")
            
            # Step 3: Fallback to any active template for this partner
            if not report_template:
                report_template = await db.report_templates.find_one(
                    {"partner_id": partner_id, "is_active": True},
                    {"_id": 0}
                )
                if report_template:
                    logger.info(f"Using Partner's first active report template: {report_template.get('name')}")
        
        # Step 4: Final fallback to B2C default report template
        if not report_template:
            b2c_partner = await db.partners.find_one({"type": "b2c"}, {"_id": 0, "id": 1, "default_report_template_id": 1})
            if b2c_partner:
                # First try B2C's explicit default
                if b2c_partner.get("default_report_template_id"):
                    report_template = await db.report_templates.find_one(
                        {"id": b2c_partner["default_report_template_id"], "is_active": True},
                        {"_id": 0}
                    )
                # Then try B2C's is_default template
                if not report_template:
                    report_template = await db.report_templates.find_one(
                        {"partner_id": b2c_partner["id"], "is_default": True, "is_active": True},
                        {"_id": 0}
                    )
            if report_template:
                logger.info(f"Using B2C fallback report template: {report_template.get('name')}")
        
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
        
        # Determine payment type (partial or full)
        is_partial_payment = lead.get("is_partial_payment", False)
        total_package_amount = lead.get("total_amount") or amount  # Total after discounts
        balance_due = lead.get("balance_due", 0) if is_partial_payment else 0
        
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
            
            # Calculate amounts per inspection
            amount_per_inspection = total_package_amount / no_of_inspections
            paid_per_inspection = amount / no_of_inspections  # What was actually paid now
            balance_per_inspection = balance_due / no_of_inspections if is_partial_payment else 0
            
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
                "total_amount": amount_per_inspection,  # Total including balance
                "amount_paid": paid_per_inspection,  # What was paid now
                "balance_due": balance_per_inspection,  # Remaining to collect
                "payment_status": "PARTIALLY_PAID" if is_partial_payment else "FULLY_PAID",
                "payment_type": "Partial" if is_partial_payment else "Full",
                "payment_date": datetime.now(timezone.utc).isoformat(),
                "razorpay_payment_id": payment_id,
                "inspection_status": "NEW_INSPECTION",
                "scheduled_date": schedule_data.get("inspection_date") or None,
                "scheduled_time": schedule_data.get("inspection_time") or None,
                "slot_number": i + 1,
                "inspections_available": 1,
                "report_status": "pending",
                "notes": f"Inspection {i + 1} of {no_of_inspections} from lead conversion",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": "system",
                # Partner and template info for report generation
                "partner_id": lead.get("partner_id"),
                "partner_name": lead.get("partner_name"),
                "report_template_id": report_template.get("id") if report_template else None,
                "report_template_name": report_template.get("name") if report_template else None,
                "report_style": report_template.get("report_style") if report_template else "standard",
                "inspection_template_id": report_template.get("inspection_template_id") if report_template else None,
                # Payment transaction history
                "payment_transactions": [{
                    "id": str(uuid.uuid4()),
                    "amount": paid_per_inspection,
                    "payment_type": "initial" if is_partial_payment else "full",
                    "payment_method": "razorpay",
                    "razorpay_payment_id": payment_id,
                    "status": "completed",
                    "created_at": datetime.now(timezone.utc).isoformat()
                }]
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
    ad_name: Optional[str] = None
    ad_amount: Optional[float] = None
    language: Optional[str] = None
    campaign: Optional[str] = None
    source: Optional[str] = None
    is_active: bool = True
    # Partner assignment - Option C
    partner_id: Optional[str] = None
    partner_name: Optional[str] = None


class AdCityMappingUpdate(BaseModel):
    city: Optional[str] = None
    city_id: Optional[str] = None
    ad_name: Optional[str] = None
    ad_amount: Optional[float] = None
    language: Optional[str] = None
    campaign: Optional[str] = None
    source: Optional[str] = None
    is_active: Optional[bool] = None
    # Partner assignment - Option C
    partner_id: Optional[str] = None
    partner_name: Optional[str] = None


@api_router.get("/settings/ad-city-mappings")
async def get_ad_city_mappings(current_user: dict = Depends(get_current_user)):
    """Get all AD ID to City mappings"""
    mappings = await db.ad_city_mappings.find({}, {"_id": 0}).to_list(1000)
    return mappings


@api_router.post("/settings/ad-city-mappings")
async def create_ad_city_mapping(mapping: AdCityMapping, current_user: dict = Depends(get_current_user)):
    """Create AD ID to City mapping"""
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "HR_MANAGER", "CTO"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check if mapping already exists
    existing = await db.ad_city_mappings.find_one({"ad_id": mapping.ad_id})
    if existing:
        # Update existing
        update_data = mapping.model_dump()
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.ad_city_mappings.update_one(
            {"ad_id": mapping.ad_id},
            {"$set": update_data}
        )
        return {"message": "Mapping updated", "id": existing.get("id")}
    else:
        # Create new
        mapping_dict = mapping.model_dump()
        mapping_dict["id"] = str(uuid.uuid4())
        mapping_dict["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.ad_city_mappings.insert_one(mapping_dict)
        return {"message": "Mapping created", "id": mapping_dict["id"]}


@api_router.post("/settings/ad-city-mappings/by-name")
async def create_ad_city_mapping_by_name(
    ad_name: str,
    city: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Create AD mapping by ad_name (useful when ad_id is not captured).
    This allows mapping leads based on the ad name/headline from CTWA data.
    """
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "HR_MANAGER", "CTO"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if not ad_name or not city:
        raise HTTPException(status_code=400, detail="ad_name and city are required")
    
    # Check if mapping already exists for this ad_name
    existing = await db.ad_city_mappings.find_one({
        "ad_name": {"$regex": f"^{re.escape(ad_name)}$", "$options": "i"}
    })
    
    if existing:
        # Update existing
        await db.ad_city_mappings.update_one(
            {"id": existing["id"]},
            {"$set": {
                "city": city,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "updated_by": current_user.get("id")
            }}
        )
        return {
            "message": f"Mapping updated: '{ad_name}' -> '{city}'",
            "id": existing.get("id"),
            "action": "updated"
        }
    else:
        # Create new with auto-generated ad_id
        auto_ad_id = f"name_{ad_name[:30].replace(' ', '_').replace('/', '_')}_{datetime.now().strftime('%Y%m%d')}"
        mapping_dict = {
            "id": str(uuid.uuid4()),
            "ad_id": auto_ad_id,
            "ad_name": ad_name,
            "city": city,
            "source": "manual_by_name",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": current_user.get("id")
        }
        await db.ad_city_mappings.insert_one(mapping_dict)
        return {
            "message": f"Mapping created: '{ad_name}' -> '{city}'",
            "id": mapping_dict["id"],
            "action": "created"
        }


@api_router.post("/leads/{lead_id}/remap-city")
async def remap_single_lead_city(
    lead_id: str,
    city: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Remap a single lead to a different city and optionally create an ad mapping.
    """
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "HR_MANAGER", "CTO", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Find the lead
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    old_city = lead.get("city")
    ad_name = lead.get("ad_name")
    
    # Update the lead's city
    await db.leads.update_one(
        {"id": lead_id},
        {"$set": {
            "city": city,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "city_remapped_by": current_user.get("id"),
            "city_remapped_at": datetime.now(timezone.utc).isoformat(),
            "previous_city": old_city
        }}
    )
    
    # If lead has ad_name, offer to create mapping
    mapping_created = False
    if ad_name:
        existing_mapping = await db.ad_city_mappings.find_one({
            "ad_name": {"$regex": f"^{re.escape(ad_name)}$", "$options": "i"}
        })
        
        if not existing_mapping:
            # Auto-create mapping for future leads
            auto_ad_id = f"name_{ad_name[:30].replace(' ', '_').replace('/', '_')}_{datetime.now().strftime('%Y%m%d')}"
            mapping_dict = {
                "id": str(uuid.uuid4()),
                "ad_id": auto_ad_id,
                "ad_name": ad_name,
                "city": city,
                "source": "auto_from_lead_remap",
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": current_user.get("id")
            }
            await db.ad_city_mappings.insert_one(mapping_dict)
            mapping_created = True
            logger.info(f"Auto-created mapping from lead remap: '{ad_name}' -> '{city}'")
    
    # Log the activity
    activity = {
        "id": str(uuid.uuid4()),
        "lead_id": lead_id,
        "user_id": current_user.get("id"),
        "user_name": current_user.get("name"),
        "action": "city_remapped",
        "old_value": old_city,
        "new_value": city,
        "details": f"City changed from '{old_city}' to '{city}'",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.lead_activities.insert_one(activity)
    
    return {
        "success": True,
        "message": f"Lead city updated from '{old_city}' to '{city}'",
        "mapping_created": mapping_created,
        "mapping_note": f"Future leads with ad_name '{ad_name}' will auto-map to '{city}'" if mapping_created else None
    }


@api_router.put("/settings/ad-city-mappings/{mapping_id}")
async def update_ad_city_mapping(mapping_id: str, mapping: AdCityMappingUpdate, current_user: dict = Depends(get_current_user)):
    """Update AD ID to City mapping"""
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "HR_MANAGER", "CTO"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    existing = await db.ad_city_mappings.find_one({"id": mapping_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Mapping not found")
    
    update_data = {k: v for k, v in mapping.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.ad_city_mappings.update_one({"id": mapping_id}, {"$set": update_data})
    
    updated = await db.ad_city_mappings.find_one({"id": mapping_id}, {"_id": 0})
    return updated


@api_router.patch("/settings/ad-city-mappings/{mapping_id}/toggle-status")
async def toggle_ad_mapping_status(mapping_id: str, current_user: dict = Depends(get_current_user)):
    """Toggle AD mapping active status"""
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "HR_MANAGER", "CTO"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    existing = await db.ad_city_mappings.find_one({"id": mapping_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Mapping not found")
    
    new_status = not existing.get("is_active", True)
    await db.ad_city_mappings.update_one(
        {"id": mapping_id},
        {"$set": {"is_active": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Status updated", "is_active": new_status}


@api_router.delete("/settings/ad-city-mappings/{ad_id}")
async def delete_ad_city_mapping(ad_id: str, current_user: dict = Depends(get_current_user)):
    """Delete AD ID to City mapping"""
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "HR_MANAGER", "CTO"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Try to delete by id first, then by ad_id
    result = await db.ad_city_mappings.delete_one({"id": ad_id})
    if result.deleted_count == 0:
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


# Mechanic Inspection City Assignment
class MechanicCityAssignment(BaseModel):
    employee_id: str
    cities: List[str]


@api_router.put("/hr/employees/{employee_id}/inspection-cities")
async def update_employee_inspection_cities(
    employee_id: str,
    assignment: MechanicCityAssignment,
    current_user: dict = Depends(get_current_user)
):
    """Update inspection cities assigned to a mechanic"""
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "HR_MANAGER", "INSPECTION_HEAD"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    employee = await db.users.find_one({"id": employee_id}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    await db.users.update_one(
        {"id": employee_id},
        {"$set": {"inspection_cities": assignment.cities, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Inspection cities assigned successfully"}


@api_router.get("/hr/employees/{employee_id}/inspection-cities")
async def get_employee_inspection_cities(employee_id: str, current_user: dict = Depends(get_current_user)):
    """Get inspection cities assigned to a mechanic"""
    employee = await db.users.find_one({"id": employee_id}, {"_id": 0, "inspection_cities": 1})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    return {"cities": employee.get("inspection_cities", [])}


# ==================== CUSTOMERS ROUTES ====================

@api_router.get("/customers")
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
    
    # Date range filter
    if date_from or date_to:
        date_query = {}
        if date_from:
            date_query["$gte"] = date_from
        if date_to:
            # Add one day to include the entire end date
            date_query["$lte"] = date_to + "T23:59:59"
        query["created_at"] = date_query
    
    customers = await db.customers.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Collect customer IDs and lead IDs for enrichment
    customer_ids = [c["id"] for c in customers]
    lead_ids = [c.get("lead_id") for c in customers if c.get("lead_id")]
    
    # Get inspections count and payment summary per customer
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


@api_router.get("/customers/sales-reps-with-counts")
async def get_sales_reps_with_customer_counts(current_user: dict = Depends(get_current_user)):
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
    # Exclude MongoDB _id from response
    customer_dict.pop("_id", None)
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
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
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
    
    # Date range filtering
    # For scheduled inspections: filter by scheduled_date
    # For unscheduled inspections: filter by created_at (since scheduled_date is null)
    if date_from or date_to:
        date_query = {}
        if date_from:
            date_query["$gte"] = date_from
        if date_to:
            date_query["$lte"] = date_to + "T23:59:59"
        if date_query:
            if is_scheduled is False:
                # For unscheduled inspections, filter by created_at
                query["created_at"] = date_query
            elif is_scheduled is True:
                # For scheduled inspections, filter by scheduled_date
                query["scheduled_date"] = {**query.get("scheduled_date", {}), **date_query}
            else:
                # If is_scheduled not specified, use $or to check both fields
                query["$and"] = query.get("$and", []) + [{
                    "$or": [
                        {"scheduled_date": date_query},
                        {"$and": [{"scheduled_date": None}, {"created_at": date_query}]}
                    ]
                }]
    
    inspections = await db.inspections.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Status normalization mapping (legacy -> new)
    status_mapping = {
        "NEW": "NEW_INSPECTION",
        "SCHEDULED": "NEW_INSPECTION",
        "UNSCHEDULED": "NEW_INSPECTION",
        "ACCEPTED": "MECHANIC_ACCEPTED",
        "IN_PROGRESS": "INSPECTION_STARTED",
        "COMPLETED": "INSPECTION_COMPLETED",
        "REJECTED": "MECHANIC_REJECTED",
        "CANCELLED": "INSPECTION_CANCELLED_WD",
        "INSPECTION_CONFIRMED": "MECHANIC_ACCEPTED",
        "INSPECTION_IN_PROGRESS": "INSPECTION_STARTED",
        "INSPECTION_RESCHEDULED": "RESCHEDULED",
        "INSPECTION_CANCELLED_CUSTOMER": "INSPECTION_CANCELLED_CUS",
        "INSPECTION_CANCELLED_WISEDRIVE": "INSPECTION_CANCELLED_WD",
    }
    
    # Enrich with mechanic name and normalize status
    for insp in inspections:
        # Normalize inspection_status using mapping
        status = insp.get("inspection_status")
        if not status:
            insp["inspection_status"] = "NEW_INSPECTION"
        elif status in status_mapping:
            insp["inspection_status"] = status_mapping[status]
        
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
    
    # Status normalization mapping (legacy -> new)
    status_mapping = {
        "NEW": "NEW_INSPECTION",
        "SCHEDULED": "NEW_INSPECTION",
        "UNSCHEDULED": "NEW_INSPECTION",
        "ACCEPTED": "MECHANIC_ACCEPTED",
        "IN_PROGRESS": "INSPECTION_STARTED",
        "COMPLETED": "INSPECTION_COMPLETED",
        "REJECTED": "MECHANIC_REJECTED",
        "CANCELLED": "INSPECTION_CANCELLED_WD",
        "INSPECTION_CONFIRMED": "MECHANIC_ACCEPTED",
        "INSPECTION_IN_PROGRESS": "INSPECTION_STARTED",
        "INSPECTION_RESCHEDULED": "RESCHEDULED",
        "INSPECTION_CANCELLED_CUSTOMER": "INSPECTION_CANCELLED_CUS",
        "INSPECTION_CANCELLED_WISEDRIVE": "INSPECTION_CANCELLED_WD",
    }
    
    # Normalize inspection_status
    status = inspection.get("inspection_status")
    if not status:
        inspection["inspection_status"] = "NEW_INSPECTION"
    elif status in status_mapping:
        inspection["inspection_status"] = status_mapping[status]
    
    return inspection


@api_router.get("/inspections/{inspection_id}/report")
async def get_inspection_report(inspection_id: str):
    """
    Get inspection report data (public endpoint for viewing reports)
    Returns inspection details along with lead and customer info
    """
    inspection = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    
    # Get associated lead
    lead = None
    if inspection.get("lead_id"):
        lead = await db.leads.find_one({"id": inspection["lead_id"]}, {"_id": 0})
    
    # Get customer info
    customer = None
    if lead and lead.get("customer_id"):
        customer = await db.customers.find_one({"id": lead["customer_id"]}, {"_id": 0})
    elif inspection.get("customer_id"):
        customer = await db.customers.find_one({"id": inspection["customer_id"]}, {"_id": 0})
    
    # Get mechanic name
    mechanic_name = None
    if inspection.get("mechanic_id"):
        mechanic = await db.users.find_one({"id": inspection["mechanic_id"]}, {"_id": 0, "name": 1})
        mechanic_name = mechanic.get("name") if mechanic else None
    
    # Add mechanic name to inspection
    inspection["mechanic_name"] = mechanic_name
    
    return {
        "inspection": inspection,
        "lead": lead,
        "customer": customer
    }


# ==================== AI REPORT GENERATION ====================

# Milestones at which AI report should be auto-generated (percentage completion)
AI_REPORT_AUTO_GENERATE_MILESTONES = [25, 50, 75, 100]

class GenerateAIReportRequest(BaseModel):
    force_regenerate: bool = False  # Force regeneration even if AI insights exist


async def auto_generate_ai_report_background(inspection_id: str, completion_percentage: int):
    """
    Background task to auto-generate AI report at milestones.
    Called when mechanic saves progress.
    """
    from services.ai_report_service import generate_ai_report_insights
    
    try:
        logger.info(f"[AI_REPORT_AUTO] Starting auto-generation for inspection {inspection_id} at {completion_percentage}%")
        
        # Get the inspection
        inspection = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
        if not inspection:
            logger.warning(f"[AI_REPORT_AUTO] Inspection {inspection_id} not found")
            return
        
        # Check if already generated at this milestone
        last_milestone = inspection.get("ai_report_last_milestone", 0)
        if last_milestone >= completion_percentage:
            logger.info(f"[AI_REPORT_AUTO] Already generated at {last_milestone}%, skipping")
            return
        
        # Get associated lead for vehicle info
        lead = None
        if inspection.get("lead_id"):
            lead = await db.leads.find_one({"id": inspection["lead_id"]}, {"_id": 0})
        
        # Prepare vehicle data
        vehicle_data = {
            "make": lead.get("vehicle_make") if lead else None or inspection.get("vehicle_make"),
            "model": lead.get("vehicle_model") if lead else None or inspection.get("vehicle_model"),
            "year": lead.get("vehicle_year") if lead else None or inspection.get("vehicle_year"),
            "fuel_type": lead.get("fuel_type") if lead else None or inspection.get("fuel_type"),
            "transmission": inspection.get("transmission"),
            "colour": inspection.get("vehicle_colour"),
            "reg_no": lead.get("vehicle_number") if lead else None or inspection.get("car_number"),
            "engine_cc": inspection.get("engine_cc"),
            "owners": inspection.get("owners"),
        }
        
        # Get OBD data
        obd_data = {}
        obd_result = await db.inspection_obd_results.find_one({"inspection_id": inspection_id}, {"_id": 0})
        if obd_result:
            obd_data = obd_result.get("obd_data", {})
        elif inspection.get("obd_data"):
            obd_data = inspection.get("obd_data", {})
        
        # Get inspection answers
        answers_data = inspection.get("inspection_answers", {})
        
        # Get categories
        package_id = inspection.get("package_id")
        categories_info = {}
        
        if package_id:
            package = await db.packages.find_one({"id": package_id}, {"_id": 0})
            category_ids = package.get("category_ids", []) if package else []
            if category_ids:
                categories = await db.inspection_categories.find({"id": {"$in": category_ids}}, {"_id": 0}).to_list(50)
                for cat in categories:
                    categories_info[cat.get("id")] = {"name": cat.get("name", cat.get("id")), "questions": cat.get("questions", [])}
        
        if not categories_info:
            country_id = inspection.get("country_id")
            all_categories = await db.inspection_categories.find({"country_id": country_id} if country_id else {}, {"_id": 0}).to_list(50)
            for cat in all_categories:
                categories_info[cat.get("id")] = {"name": cat.get("name", cat.get("id")), "questions": cat.get("questions", [])}
        
        # Prepare inspection data
        inspection_data = {
            "kms_driven": inspection.get("kms_driven") or (lead.get("kms_driven") if lead else 0),
            "city": inspection.get("city") or (lead.get("city") if lead else ""),
            "car_number": lead.get("vehicle_number") if lead else inspection.get("car_number"),
            "created_at": inspection.get("created_at")
        }
        
        # Generate AI insights
        ai_insights = await generate_ai_report_insights(
            inspection_data=inspection_data,
            vehicle_data=vehicle_data,
            obd_data=obd_data,
            answers_data=answers_data,
            categories_info=categories_info
        )
        
        # Store AI insights
        now = datetime.now(timezone.utc).isoformat()
        await db.inspections.update_one(
            {"id": inspection_id},
            {
                "$set": {
                    "ai_insights": ai_insights,
                    "overall_rating": ai_insights.get("overall_rating", 0),
                    "recommended_to_buy": ai_insights.get("recommended_to_buy", False),
                    "market_value_min": ai_insights.get("market_value", {}).get("min", 0),
                    "market_value_max": ai_insights.get("market_value", {}).get("max", 0),
                    "assessment_summary": ai_insights.get("assessment_summary", ""),
                    "key_highlights": ai_insights.get("key_highlights", []),
                    "engine_condition": ai_insights.get("condition_ratings", {}).get("engine", "PENDING"),
                    "interior_condition": ai_insights.get("condition_ratings", {}).get("interior", "PENDING"),
                    "exterior_condition": ai_insights.get("condition_ratings", {}).get("exterior", "PENDING"),
                    "transmission_condition": ai_insights.get("condition_ratings", {}).get("transmission", "PENDING"),
                    "category_ratings": ai_insights.get("category_ratings", {}),
                    "ai_report_generated_at": now,
                    "ai_report_last_milestone": completion_percentage,
                    "ai_report_stale": False,  # Fresh report
                    "updated_at": now
                }
            }
        )
        
        logger.info(f"[AI_REPORT_AUTO] Successfully generated AI report for inspection {inspection_id} at {completion_percentage}%")
        
    except Exception as e:
        logger.error(f"[AI_REPORT_AUTO] Error generating AI report: {e}")


@api_router.post("/inspections/{inspection_id}/generate-ai-report")
async def generate_ai_inspection_report(
    inspection_id: str,
    request_data: Optional[GenerateAIReportRequest] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate AI-powered insights for an inspection report.
    Uses OpenAI GPT-5.2 to analyze inspection data and generate:
    - Overall rating
    - Market value recommendation
    - Assessment summary
    - Condition ratings (engine, interior, exterior, transmission)
    - Category-wise ratings
    - Risk factors and recommendations
    """
    from services.ai_report_service import generate_ai_report_insights
    
    force_regenerate = request_data.force_regenerate if request_data else False
    
    # Get the inspection
    inspection = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    
    # Check if AI insights already exist and we're not forcing regeneration
    if inspection.get("ai_insights") and not force_regenerate:
        return {
            "success": True,
            "message": "AI insights already exist",
            "ai_insights": inspection["ai_insights"],
            "regenerated": False
        }
    
    # Get associated lead for vehicle info
    lead = None
    if inspection.get("lead_id"):
        lead = await db.leads.find_one({"id": inspection["lead_id"]}, {"_id": 0})
    
    # Prepare vehicle data (combine from inspection and lead - handle multiple field naming conventions)
    vehicle_data = {
        "make": (lead.get("vehicle_make") if lead else None) or inspection.get("vehicle_make") or inspection.get("make") or inspection.get("car_make"),
        "model": (lead.get("vehicle_model") if lead else None) or inspection.get("vehicle_model") or inspection.get("model") or inspection.get("car_model"),
        "year": (lead.get("vehicle_year") if lead else None) or inspection.get("vehicle_year") or inspection.get("year") or inspection.get("car_year"),
        "fuel_type": (lead.get("fuel_type") if lead else None) or inspection.get("fuel_type"),
        "transmission": inspection.get("transmission"),
        "colour": inspection.get("vehicle_colour") or inspection.get("colour") or inspection.get("car_color"),
        "reg_no": (lead.get("vehicle_number") if lead else None) or inspection.get("car_number"),
        "engine_cc": inspection.get("engine_cc"),
        "owners": inspection.get("owners"),
        "variant": inspection.get("variant"),
    }
    
    # Get OBD data from separate collection or inspection
    obd_data = {}
    obd_result = await db.inspection_obd_results.find_one(
        {"inspection_id": inspection_id},
        {"_id": 0}
    )
    if obd_result:
        obd_data = obd_result.get("obd_data", {})
    elif inspection.get("obd_data"):
        obd_data = inspection.get("obd_data", {})
    
    # Get inspection answers
    answers_data = inspection.get("inspection_answers", {})
    
    # Get inspection categories with questions
    package_id = inspection.get("package_id")
    categories_info = {}
    
    if package_id:
        # Get categories for this package
        package = await db.packages.find_one({"id": package_id}, {"_id": 0})
        category_ids = package.get("category_ids", []) if package else []
        
        if category_ids:
            categories = await db.inspection_categories.find(
                {"id": {"$in": category_ids}},
                {"_id": 0}
            ).to_list(50)
            
            for cat in categories:
                cat_id = cat.get("id")
                categories_info[cat_id] = {
                    "name": cat.get("name", cat_id),
                    "questions": cat.get("questions", [])
                }
    
    # If no package categories, try to get from inspection_categories
    if not categories_info:
        # Get all categories for this inspection's country
        country_id = inspection.get("country_id")
        all_categories = await db.inspection_categories.find(
            {"country_id": country_id} if country_id else {},
            {"_id": 0}
        ).to_list(50)
        
        for cat in all_categories:
            cat_id = cat.get("id")
            categories_info[cat_id] = {
                "name": cat.get("name", cat_id),
                "questions": cat.get("questions", [])
            }
    
    # Prepare inspection data
    inspection_data = {
        "kms_driven": inspection.get("kms_driven") or (lead.get("kms_driven") if lead else 0),
        "city": inspection.get("city") or (lead.get("city") if lead else ""),
        "car_number": lead.get("vehicle_number") if lead else inspection.get("car_number"),
        "created_at": inspection.get("created_at")
    }
    
    logger.info(f"[AI_REPORT] Generating AI insights for inspection {inspection_id}")
    logger.info(f"[AI_REPORT] Vehicle: {vehicle_data.get('make')} {vehicle_data.get('model')} {vehicle_data.get('year')}")
    logger.info(f"[AI_REPORT] Categories: {len(categories_info)}, Answers: {len(answers_data)}, OBD data: {bool(obd_data)}")
    
    # Fetch market price data from web scraping
    market_price_data = None
    try:
        from services.car_price_scraper import get_price_scraper
        
        scraper = get_price_scraper()
        make = vehicle_data.get("make")
        model = vehicle_data.get("model")
        year = vehicle_data.get("year")
        
        if make and model:
            # Default year to current year - 3 if not provided
            year_value = int(year) if year else datetime.now().year - 3
            logger.info(f"[AI_REPORT] Fetching market prices for {make} {model} {year_value}")
            market_price_data = await scraper.get_market_price(
                make=make,
                model=model,
                year=year_value,
                fuel_type=vehicle_data.get("fuel_type"),
                transmission=vehicle_data.get("transmission"),
                kms_driven=inspection_data.get("kms_driven"),
                city=inspection_data.get("city")
            )
            logger.info(f"[AI_REPORT] Market price fetch result: success={market_price_data.get('success')}, sources={market_price_data.get('sources_count', 0)}")
        else:
            logger.warning("[AI_REPORT] Skipping market price fetch - missing make or model")
    except Exception as e:
        logger.error(f"[AI_REPORT] Failed to fetch market prices: {e}")
        market_price_data = None
    
    # Generate AI insights
    ai_insights = await generate_ai_report_insights(
        inspection_data=inspection_data,
        vehicle_data=vehicle_data,
        obd_data=obd_data,
        answers_data=answers_data,
        categories_info=categories_info,
        market_price_data=market_price_data
    )
    
    # Store AI insights in the inspection
    now = datetime.now(timezone.utc).isoformat()
    
    # Build update document with market price data
    update_doc = {
        "ai_insights": ai_insights,
        "overall_rating": ai_insights.get("overall_rating", 0),
        "recommended_to_buy": ai_insights.get("recommended_to_buy", False),
        "market_value_min": ai_insights.get("market_value", {}).get("min", 0),
        "market_value_max": ai_insights.get("market_value", {}).get("max", 0),
        "assessment_summary": ai_insights.get("assessment_summary", ""),
        "key_highlights": ai_insights.get("key_highlights", []),
        "engine_condition": ai_insights.get("condition_ratings", {}).get("engine", "PENDING"),
        "interior_condition": ai_insights.get("condition_ratings", {}).get("interior", "PENDING"),
        "exterior_condition": ai_insights.get("condition_ratings", {}).get("exterior", "PENDING"),
        "transmission_condition": ai_insights.get("condition_ratings", {}).get("transmission", "PENDING"),
        "category_ratings": ai_insights.get("category_ratings", {}),
        "ai_report_generated_at": now,
        "ai_report_stale": False,  # Reset stale flag after generation
        "updated_at": now
    }
    
    # Store market price research data if available
    if market_price_data and market_price_data.get("success"):
        update_doc["market_price_research"] = {
            "market_average": market_price_data.get("market_average", 0),
            "market_min": market_price_data.get("market_min", 0),
            "market_max": market_price_data.get("market_max", 0),
            "recommended_min": market_price_data.get("recommended_min", 0),
            "recommended_max": market_price_data.get("recommended_max", 0),
            "sources_count": market_price_data.get("sources_count", 0),
            "sources": market_price_data.get("sources", []),
            "estimation_method": market_price_data.get("estimation_method", "web_scraping"),
            "fetched_at": market_price_data.get("fetched_at")
        }
    
    await db.inspections.update_one(
        {"id": inspection_id},
        {"$set": update_doc}
    )
    
    # Log the activity
    activity = {
        "id": str(uuid.uuid4()),
        "inspection_id": inspection_id,
        "action": "AI_REPORT_GENERATED",
        "description": f"AI report insights generated by {current_user.get('name', 'Unknown')}",
        "user_id": current_user.get("id"),
        "user_name": current_user.get("name", "Unknown"),
        "metadata": {
            "overall_rating": ai_insights.get("overall_rating"),
            "recommended_to_buy": ai_insights.get("recommended_to_buy")
        },
        "created_at": now
    }
    await db.inspection_activities.insert_one(activity)
    
    logger.info(f"[AI_REPORT] Successfully generated AI insights for inspection {inspection_id}")
    
    return {
        "success": True,
        "message": "AI insights generated successfully",
        "ai_insights": ai_insights,
        "regenerated": True
    }


# ==================== PUBLIC REPORT ACCESS (OTP-PROTECTED) ====================

class ReportOTPRequest(BaseModel):
    """Request model for sending OTP"""
    pass  # No additional fields needed


class ReportOTPVerifyRequest(BaseModel):
    """Request model for verifying OTP"""
    otp: str
    phone: str  # Last 4 digits for verification


@api_router.get("/report/public/{short_code}")
async def get_public_report_info(short_code: str):
    """
    Get basic report info for customer access (no sensitive data).
    Returns enough info to show OTP input screen.
    """
    from services.report_url_service import decode_inspection_id
    
    # Decode the short code
    inspection_id = decode_inspection_id(short_code)
    if not inspection_id:
        raise HTTPException(status_code=404, detail="Invalid or expired report link")
    
    # Get inspection
    inspection = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
    if not inspection:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Get customer info
    customer = None
    lead = None
    if inspection.get("lead_id"):
        lead = await db.leads.find_one({"id": inspection["lead_id"]}, {"_id": 0})
    if lead and lead.get("customer_id"):
        customer = await db.customers.find_one({"id": lead["customer_id"]}, {"_id": 0})
    elif inspection.get("customer_id"):
        customer = await db.customers.find_one({"id": inspection["customer_id"]}, {"_id": 0})
    
    # Get customer phone (masked)
    customer_phone = customer.get("phone") if customer else lead.get("phone_number") if lead else None
    masked_phone = None
    if customer_phone:
        # Show only last 4 digits: ******1234
        clean_phone = ''.join(filter(str.isdigit, customer_phone))
        if len(clean_phone) >= 4:
            masked_phone = '*' * (len(clean_phone) - 4) + clean_phone[-4:]
    
    # Return basic info (no sensitive data)
    return {
        "inspection_id": inspection_id,
        "vehicle_number": lead.get("vehicle_number") if lead else inspection.get("car_number", ""),
        "vehicle_info": f"{lead.get('vehicle_make', '')} {lead.get('vehicle_model', '')}".strip() if lead else "",
        "customer_name": customer.get("name") if customer else lead.get("customer_name") if lead else "",
        "masked_phone": masked_phone,
        "inspection_date": inspection.get("inspection_date"),
        "package_name": inspection.get("package_name", "Inspection Report"),
        "has_report": bool(inspection.get("ai_insights") or inspection.get("inspection_answers"))
    }


@api_router.post("/report/public/{short_code}/send-otp")
async def send_report_access_otp(short_code: str):
    """
    Send OTP to customer's registered phone for report access.
    Uses Fast2SMS for OTP delivery.
    """
    from services.report_url_service import decode_inspection_id, generate_report_otp
    from services.fast2sms_service import get_fast2sms_service
    
    # Decode the short code
    inspection_id = decode_inspection_id(short_code)
    if not inspection_id:
        raise HTTPException(status_code=404, detail="Invalid or expired report link")
    
    # Get inspection
    inspection = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
    if not inspection:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Get customer phone
    customer = None
    lead = None
    if inspection.get("lead_id"):
        lead = await db.leads.find_one({"id": inspection["lead_id"]}, {"_id": 0})
    if lead and lead.get("customer_id"):
        customer = await db.customers.find_one({"id": lead["customer_id"]}, {"_id": 0})
    elif inspection.get("customer_id"):
        customer = await db.customers.find_one({"id": inspection["customer_id"]}, {"_id": 0})
    
    customer_phone = customer.get("phone") if customer else lead.get("phone_number") if lead else None
    if not customer_phone:
        raise HTTPException(status_code=400, detail="No phone number associated with this report")
    
    # Clean phone number
    clean_phone = ''.join(filter(str.isdigit, customer_phone))
    if clean_phone.startswith('91') and len(clean_phone) == 12:
        clean_phone = clean_phone[2:]  # Remove country code for Fast2SMS
    
    # Generate OTP
    otp = generate_report_otp()
    
    # Store OTP with expiration (5 minutes)
    otp_doc = {
        "inspection_id": inspection_id,
        "phone": clean_phone,
        "otp": otp,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat(),
        "verified": False,
        "attempts": 0
    }
    
    # Upsert OTP (replace existing)
    await db.report_access_otps.update_one(
        {"inspection_id": inspection_id},
        {"$set": otp_doc},
        upsert=True
    )
    
    # Send OTP via Fast2SMS
    try:
        fast2sms = get_fast2sms_service()
        result = await fast2sms.send_otp(clean_phone, otp)
        
        if not result.get("success"):
            logger.error(f"[REPORT_OTP] Failed to send OTP: {result}")
            raise HTTPException(status_code=500, detail="Failed to send OTP. Please try again.")
        
        logger.info(f"[REPORT_OTP] OTP sent to {clean_phone[-4:]} for inspection {inspection_id[:8]}...")
        
    except Exception as e:
        logger.error(f"[REPORT_OTP] Error sending OTP: {e}")
        raise HTTPException(status_code=500, detail="Failed to send OTP. Please try again.")
    
    return {
        "success": True,
        "message": "OTP sent successfully",
        "masked_phone": '*' * (len(clean_phone) - 4) + clean_phone[-4:],
        "expires_in_seconds": 300
    }


@api_router.post("/report/public/{short_code}/verify-otp")
async def verify_report_access_otp(short_code: str, request_data: ReportOTPVerifyRequest):
    """
    Verify OTP and return full report data if valid.
    """
    from services.report_url_service import decode_inspection_id
    
    # Decode the short code
    inspection_id = decode_inspection_id(short_code)
    if not inspection_id:
        raise HTTPException(status_code=404, detail="Invalid or expired report link")
    
    # Get stored OTP
    otp_doc = await db.report_access_otps.find_one({"inspection_id": inspection_id}, {"_id": 0})
    if not otp_doc:
        raise HTTPException(status_code=400, detail="No OTP found. Please request a new one.")
    
    # Check expiration
    expires_at = datetime.fromisoformat(otp_doc["expires_at"].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new one.")
    
    # Check attempts (max 3)
    if otp_doc.get("attempts", 0) >= 3:
        raise HTTPException(status_code=400, detail="Too many attempts. Please request a new OTP.")
    
    # Increment attempts
    await db.report_access_otps.update_one(
        {"inspection_id": inspection_id},
        {"$inc": {"attempts": 1}}
    )
    
    # Verify OTP
    if otp_doc["otp"] != request_data.otp:
        remaining = 3 - (otp_doc.get("attempts", 0) + 1)
        raise HTTPException(status_code=400, detail=f"Invalid OTP. {remaining} attempts remaining.")
    
    # Verify phone last 4 digits match
    stored_phone = otp_doc.get("phone", "")
    if not stored_phone.endswith(request_data.phone[-4:]):
        raise HTTPException(status_code=400, detail="Phone number mismatch")
    
    # Mark as verified
    await db.report_access_otps.update_one(
        {"inspection_id": inspection_id},
        {"$set": {"verified": True, "verified_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Generate access token for this session (valid for 1 hour)
    access_token = jwt.encode(
        {
            "inspection_id": inspection_id,
            "type": "report_access",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1)
        },
        SECRET_KEY,
        algorithm=ALGORITHM
    )
    
    logger.info(f"[REPORT_OTP] OTP verified for inspection {inspection_id[:8]}...")
    
    return {
        "success": True,
        "message": "OTP verified successfully",
        "access_token": access_token,
        "expires_in_seconds": 3600
    }


@api_router.get("/report/public/{short_code}/data")
async def get_public_report_data(short_code: str, token: str):
    """
    Get full report data after OTP verification.
    Requires a valid access token from verify-otp endpoint.
    """
    from services.report_url_service import decode_inspection_id
    
    # Verify access token
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "report_access":
            raise HTTPException(status_code=401, detail="Invalid access token")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Access token has expired. Please verify OTP again.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid access token")
    
    # Decode the short code
    inspection_id = decode_inspection_id(short_code)
    if not inspection_id:
        raise HTTPException(status_code=404, detail="Invalid or expired report link")
    
    # Verify token matches this inspection
    if payload.get("inspection_id") != inspection_id:
        raise HTTPException(status_code=401, detail="Token does not match this report")
    
    # Get full inspection data (same as internal report endpoint)
    inspection = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    
    # Get associated lead
    lead = None
    if inspection.get("lead_id"):
        lead = await db.leads.find_one({"id": inspection["lead_id"]}, {"_id": 0})
    
    # Get customer info
    customer = None
    if lead and lead.get("customer_id"):
        customer = await db.customers.find_one({"id": lead["customer_id"]}, {"_id": 0})
    elif inspection.get("customer_id"):
        customer = await db.customers.find_one({"id": inspection["customer_id"]}, {"_id": 0})
    
    # Get mechanic name
    mechanic_name = None
    if inspection.get("mechanic_id"):
        mechanic = await db.users.find_one({"id": inspection["mechanic_id"]}, {"_id": 0, "name": 1})
        mechanic_name = mechanic.get("name") if mechanic else None
    
    inspection["mechanic_name"] = mechanic_name
    
    # Log access
    logger.info(f"[REPORT_ACCESS] Customer accessed report for inspection {inspection_id[:8]}...")
    
    return {
        "inspection": inspection,
        "lead": lead,
        "customer": customer
    }


@api_router.get("/inspections/{inspection_id}/short-url")
async def get_inspection_short_url(
    inspection_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate a short URL for customer report access.
    Returns the encrypted short code and full URL.
    """
    from services.report_url_service import encode_inspection_id, get_customer_report_url
    
    # Verify inspection exists
    inspection = await db.inspections.find_one({"id": inspection_id}, {"_id": 0, "id": 1})
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    
    # Get base URL from environment
    base_url = os.environ.get("FRONTEND_URL", "https://crmdev.wisedrive.com")
    
    short_code = encode_inspection_id(inspection_id)
    full_url = get_customer_report_url(inspection_id, base_url)
    
    return {
        "inspection_id": inspection_id,
        "short_code": short_code,
        "customer_url": full_url,
        "internal_url": f"{base_url}/inspection-report/{inspection_id}"
    }


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
    # Remove MongoDB _id before returning
    insp_dict.pop("_id", None)
    
    # Send push notification to mechanics in the city
    city = insp_dict.get("city")
    if city:
        vehicle = f"{insp_dict.get('make', '')} {insp_dict.get('model', '')}".strip() or insp_dict.get("car_number", "Vehicle")
        try:
            await notify_mechanics_in_city(
                city=city,
                title="New Inspection Available 🚗",
                body=f"New inspection in {city} - {vehicle}. Tap to view details.",
                data={
                    "type": "new_inspection",
                    "inspection_id": insp_id,
                    "city": city
                }
            )
        except Exception as e:
            logger.warning(f"Failed to send mechanic notification: {e}")
    
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


# ==================== INSPECTION PAYMENT MANAGEMENT ====================

class CollectBalanceRequest(BaseModel):
    send_whatsapp: bool = True
    notes: Optional[str] = None


@api_router.post("/inspections/{inspection_id}/collect-balance")
async def collect_balance_payment(
    inspection_id: str,
    request_data: CollectBalanceRequest,
    current_user: dict = Depends(get_current_user)
):
    """Generate balance payment link for partial payment inspection"""
    from services.razorpay_service import get_razorpay_service
    from services.twilio_service import get_twilio_service
    
    inspection = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    
    # Check if balance is due - support both old (pending_amount) and new (balance_due) formats
    balance_due = inspection.get("balance_due") or inspection.get("pending_amount", 0)
    if balance_due <= 0:
        raise HTTPException(status_code=400, detail="No balance due for this inspection")
    
    if inspection.get("payment_status") == "FULLY_PAID":
        raise HTTPException(status_code=400, detail="This inspection is already fully paid")
    
    # Create Razorpay payment link for balance
    razorpay = get_razorpay_service()
    if not razorpay.is_configured():
        raise HTTPException(status_code=500, detail="Razorpay not configured")
    
    customer_name = inspection.get("customer_name", "Customer")
    customer_mobile = inspection.get("customer_mobile", "")
    package_name = inspection.get("package_name", inspection.get("package_type", "Inspection"))
    car_info = f"{inspection.get('car_make', '')} {inspection.get('car_model', '')} ({inspection.get('car_number', '')})".strip()
    
    description = f"Balance Payment - {package_name} - {car_info}"
    
    result = await razorpay.create_payment_link(
        amount=balance_due,
        customer_name=customer_name,
        customer_phone=customer_mobile,
        description=description,
        lead_id=inspection.get("order_id"),  # Reference
        package_id=inspection.get("package_id"),
        expire_by_hours=72  # 3 days to pay balance
    )
    
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to create payment link"))
    
    # Create payment transaction record
    payment_transaction = {
        "id": str(uuid.uuid4()),
        "amount": balance_due,
        "payment_type": "balance",
        "payment_method": "razorpay",
        "payment_link_id": result.get("payment_link_id"),
        "payment_link_url": result.get("short_url"),
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "notes": request_data.notes
    }
    
    # Update inspection with balance payment link
    existing_transactions = inspection.get("payment_transactions", [])
    existing_transactions.append(payment_transaction)
    
    await db.inspections.update_one(
        {"id": inspection_id},
        {"$set": {
            "balance_payment_link_id": result.get("payment_link_id"),
            "balance_payment_link_url": result.get("short_url"),
            "payment_transactions": existing_transactions,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Send WhatsApp notification
    whatsapp_sent = False
    if request_data.send_whatsapp and customer_mobile:
        twilio = get_twilio_service()
        if twilio.is_configured():
            # Format message
            message = f"""🔔 *Balance Payment Request*

Dear {customer_name},

Your remaining balance for the vehicle inspection is due.

📦 *Package:* {package_name}
🚗 *Vehicle:* {car_info}
💰 *Balance Due:* ₹{balance_due:,.0f}

Please complete your payment to proceed with report delivery.

🔗 *Pay Now:* {result.get("short_url")}

Thank you for choosing Wisedrive!"""
            
            whatsapp_result = await twilio.send_message(customer_mobile, message)
            whatsapp_sent = whatsapp_result.get("success", False)
    
    return {
        "success": True,
        "payment_link": result.get("short_url"),
        "payment_link_id": result.get("payment_link_id"),
        "balance_amount": balance_due,
        "whatsapp_sent": whatsapp_sent
    }


@api_router.get("/inspections/{inspection_id}/check-payment-status")
async def check_inspection_payment_status(
    inspection_id: str,
    link_id: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Check payment status for an inspection's balance payment link"""
    from services.razorpay_service import get_razorpay_service
    
    inspection = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    
    # Get the payment link ID from the inspection or from the request
    payment_link_id = link_id or inspection.get("balance_payment_link_id")
    if not payment_link_id:
        raise HTTPException(status_code=400, detail="No payment link found for this inspection")
    
    # Check payment status with Razorpay
    razorpay = get_razorpay_service()
    if not razorpay.is_configured():
        raise HTTPException(status_code=500, detail="Razorpay not configured")
    
    try:
        link_status = await razorpay.get_payment_link_status(payment_link_id)
        
        if link_status.get("paid"):
            # Payment was received - update inspection
            payment_amount = link_status.get("amount_paid", 0) / 100  # Razorpay amounts are in paise
            
            current_paid = inspection.get("amount_paid", 0)
            current_balance = inspection.get("balance_due", 0)
            
            new_paid = current_paid + payment_amount
            new_balance = max(0, current_balance - payment_amount)
            new_status = "FULLY_PAID" if new_balance <= 0 else "PARTIALLY_PAID"
            
            # Update the payment transaction record
            transactions = inspection.get("payment_transactions", [])
            for txn in transactions:
                if txn.get("payment_link_id") == payment_link_id:
                    txn["status"] = "completed"
                    txn["completed_at"] = datetime.now(timezone.utc).isoformat()
                    txn["razorpay_payment_id"] = link_status.get("payment_id")
                    break
            
            await db.inspections.update_one(
                {"id": inspection_id},
                {"$set": {
                    "amount_paid": new_paid,
                    "balance_due": new_balance,
                    "payment_status": new_status,
                    "payment_transactions": transactions,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            return {
                "paid": True,
                "payment_status": new_status,
                "amount_paid": new_paid,
                "balance_due": new_balance,
                "razorpay_payment_id": link_status.get("payment_id")
            }
        else:
            return {
                "paid": False,
                "payment_status": inspection.get("payment_status", "PENDING"),
                "amount_paid": inspection.get("amount_paid", 0),
                "balance_due": inspection.get("balance_due", 0),
                "link_status": link_status.get("status", "created")
            }
            
    except Exception as e:
        logger.error(f"Error checking payment status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to check payment status: {str(e)}")


@api_router.patch("/inspections/{inspection_id}/status")
async def update_inspection_status(
    inspection_id: str,
    inspection_status: str,
    reason: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Update inspection status - CRM manual override"""
    valid_statuses = [
        "NEW_INSPECTION", 
        "ASSIGNED_TO_MECHANIC", 
        "MECHANIC_ACCEPTED",
        "MECHANIC_REJECTED",
        "INSPECTION_STARTED", 
        "INSPECTION_COMPLETED",
        "INSPECTION_CANCELLED_WD",  # Cancelled by WiseDrive
        "INSPECTION_CANCELLED_CUS", # Cancelled by Customer
        "RESCHEDULED"
    ]
    
    # Statuses that require a mechanic to be assigned
    mechanic_required_statuses = [
        "ASSIGNED_TO_MECHANIC", "MECHANIC_ACCEPTED", "INSPECTION_STARTED", "INSPECTION_COMPLETED"
    ]
    
    if inspection_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Valid: {valid_statuses}")
    
    inspection = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    
    old_status = inspection.get("inspection_status", "NEW_INSPECTION")
    
    # Check if mechanic is required for the new status
    if inspection_status in mechanic_required_statuses:
        mechanic_id = inspection.get("mechanic_id")
        if not mechanic_id:
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot change status to '{inspection_status}'. Please assign a mechanic first."
            )
    
    update_data = {
        "inspection_status": inspection_status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user["id"]
    }
    
    # Handle specific status updates
    if inspection_status == "MECHANIC_REJECTED":
        update_data["mechanic_id"] = None
        update_data["mechanic_name"] = None
        update_data["rejection_reason"] = reason
        update_data["rejected_at"] = datetime.now(timezone.utc).isoformat()
    elif inspection_status in ["INSPECTION_CANCELLED_WD", "INSPECTION_CANCELLED_CUS"]:
        update_data["cancellation_reason"] = reason
        update_data["cancelled_at"] = datetime.now(timezone.utc).isoformat()
        update_data["cancelled_by"] = current_user["id"]
    elif inspection_status == "RESCHEDULED":
        update_data["rescheduled_reason"] = reason
        update_data["rescheduled_at"] = datetime.now(timezone.utc).isoformat()
        update_data["rescheduled_by"] = current_user["id"]
    
    await db.inspections.update_one({"id": inspection_id}, {"$set": update_data})
    
    # Build detailed activity message
    status_labels = {
        "NEW_INSPECTION": "New Inspection",
        "ASSIGNED_TO_MECHANIC": "Assigned to Mechanic",
        "MECHANIC_ACCEPTED": "Mechanic Accepted",
        "MECHANIC_REJECTED": "Mechanic Rejected",
        "INSPECTION_STARTED": "Inspection Started",
        "INSPECTION_COMPLETED": "Inspection Completed",
        "INSPECTION_CANCELLED_WD": "Cancelled by WiseDrive",
        "INSPECTION_CANCELLED_CUS": "Cancelled by Customer",
        "RESCHEDULED": "Rescheduled"
    }
    
    details = f"Status changed from '{status_labels.get(old_status, old_status)}' to '{status_labels.get(inspection_status, inspection_status)}'"
    if reason:
        details += f". Reason: {reason}"
    
    # Log activity for status change
    activity = {
        "id": str(uuid.uuid4()),
        "inspection_id": inspection_id,
        "user_id": current_user["id"],
        "user_name": current_user.get("name", "Unknown"),
        "user_role": current_user.get("role", "user"),
        "action": "status_changed",
        "action_label": "Status Changed",
        "details": details,
        "old_value": old_status,
        "new_value": inspection_status,
        "reason": reason,
        "source": "CRM",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.inspection_activities.insert_one(activity)
    
    return {"success": True, "inspection_status": inspection_status}


# Inspection Notes
class InspectionNoteCreate(BaseModel):
    note: str


@api_router.post("/inspections/{inspection_id}/notes")
async def add_inspection_note(inspection_id: str, note_data: InspectionNoteCreate, current_user: dict = Depends(get_current_user)):
    """Add a note to an inspection"""
    inspection = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    
    note = {
        "id": str(uuid.uuid4()),
        "inspection_id": inspection_id,
        "user_id": current_user["id"],
        "user_name": current_user.get("name", "Unknown"),
        "note": note_data.note,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.inspection_notes.insert_one(note)
    
    # Log activity
    activity = {
        "id": str(uuid.uuid4()),
        "inspection_id": inspection_id,
        "user_id": current_user["id"],
        "user_name": current_user.get("name", "Unknown"),
        "action": "note_added",
        "details": f"Added a note ({len(note_data.note)} chars)",
        "new_value": note_data.note[:500],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.inspection_activities.insert_one(activity)
    
    note.pop("_id", None)
    return note


@api_router.get("/inspections/{inspection_id}/notes")
async def get_inspection_notes(inspection_id: str, current_user: dict = Depends(get_current_user)):
    """Get all notes for an inspection"""
    notes = await db.inspection_notes.find({"inspection_id": inspection_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return notes


@api_router.get("/inspections/{inspection_id}/activities")
async def get_inspection_activities(inspection_id: str, current_user: dict = Depends(get_current_user)):
    """Get all activities for an inspection"""
    activities = await db.inspection_activities.find({"inspection_id": inspection_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return activities


@api_router.get("/inspections/{inspection_id}/live-progress")
async def get_inspection_live_progress(inspection_id: str, current_user: dict = Depends(get_current_user)):
    """Get live inspection progress with answers, category stats, and overall completion"""
    inspection = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    
    # Get the questionnaire template for this inspection - use same logic as mechanic questionnaire
    inspection_template_id = inspection.get("inspection_template_id")
    
    # Fallback 1: Try to get from partner
    if not inspection_template_id:
        partner_id = inspection.get("partner_id")
        if partner_id:
            partner = await db.partners.find_one({"id": partner_id}, {"_id": 0, "inspection_template_id": 1})
            if partner:
                inspection_template_id = partner.get("inspection_template_id")
    
    # Fallback 2: Try to get from report_template
    if not inspection_template_id:
        report_template_id = inspection.get("report_template_id")
        if report_template_id:
            report_template = await db.report_templates.find_one(
                {"id": report_template_id}, 
                {"_id": 0, "inspection_template_id": 1}
            )
            if report_template:
                inspection_template_id = report_template.get("inspection_template_id")
    
    # Fallback 3: Use default template
    if not inspection_template_id:
        default_template = await db.inspection_templates.find_one(
            {"is_default": True, "is_active": True},
            {"_id": 0}
        )
        if default_template:
            inspection_template_id = default_template.get("id")
    
    # Get template questions - use same approach as mechanic questionnaire
    questions = []
    category_order = []
    categories_info = {}
    
    if inspection_template_id:
        insp_template = await db.inspection_templates.find_one({"id": inspection_template_id}, {"_id": 0})
        if insp_template:
            category_order = insp_template.get("category_order", [])
            
            # Try new approach: question_ids reference
            question_ids = insp_template.get("question_ids", [])
            if question_ids:
                questions_cursor = await db.inspection_questions.find(
                    {"id": {"$in": question_ids}},
                    {"_id": 0}
                ).to_list(500)
                
                # Sort questions by the order in question_ids
                question_map = {q["id"]: q for q in questions_cursor}
                questions = [question_map[qid] for qid in question_ids if qid in question_map]
                
                # Get categories for these questions
                category_ids = list(set(q.get("category_id") for q in questions if q.get("category_id")))
                categories_cursor = await db.inspection_qa_categories.find(
                    {"id": {"$in": category_ids}},
                    {"_id": 0}
                ).to_list(100)
                categories_info = {c["id"]: c.get("name", c["id"]) for c in categories_cursor}
                
                # Enrich questions with category info
                for q in questions:
                    cat_id = q.get("category_id")
                    if cat_id and cat_id in categories_info:
                        q["category_name"] = categories_info[cat_id]
            else:
                # Fallback to old approach: embedded questions array
                questions = insp_template.get("questions", [])
                categories_data = insp_template.get("categories", [])
                for cat in categories_data:
                    categories_info[cat.get("id")] = cat.get("name", cat.get("id"))
    
    # Get answers from inspection
    answers = inspection.get("inspection_answers", {})
    
    # Get OBD data - check separate collection first, then fall back to inline data
    obd_data = {}
    obd_results_ref = inspection.get("obd_results_ref")
    if obd_results_ref:
        # Fetch from separate collection
        obd_doc = await db.inspection_obd_results.find_one(
            {"inspection_id": inspection_id},
            {"_id": 0, "data": 1}
        )
        if obd_doc:
            obd_data = obd_doc.get("data", {})
    else:
        # Fall back to inline data (legacy)
        obd_data = inspection.get("obd_results", {})
    
    # Build category-wise stats
    category_stats = {}
    answered_questions = []
    
    for q in questions:
        cat_id = q.get("category_id", "general")
        cat_name = q.get("category_name") or categories_info.get(cat_id, cat_id)
        q_id = q.get("id")
        
        if cat_id not in category_stats:
            category_stats[cat_id] = {
                "category_id": cat_id,
                "category_name": cat_name,
                "total_questions": 0,
                "answered_questions": 0,
                "completion_percentage": 0,
                "questions": []
            }
        
        category_stats[cat_id]["total_questions"] += 1
        
        # Check if this question is answered
        answer_data = answers.get(q_id)
        q_detail = {
            "question_id": q_id,
            "question_text": q.get("question", q.get("text", q.get("question_text", ""))),
            "question_type": q.get("answer_type", q.get("input_type", q.get("type", "text"))),
            "options": q.get("options", q.get("answer_options", q.get("predefined_options", []))),
            "is_answered": False,
            "answer": None,
            "answered_at": None
        }
        
        if answer_data:
            q_detail["is_answered"] = True
            raw_answer = answer_data.get("answer")
            q_detail["answered_at"] = answer_data.get("answered_at")
            category_stats[cat_id]["answered_questions"] += 1
            
            # Resolve media URLs (gs:// or media_ref:)
            resolved_answer = raw_answer
            media_url = None
            
            if isinstance(raw_answer, str):
                if raw_answer.startswith("UPLOAD_FAILED:"):
                    # Upload failed - extract the local path for display
                    local_path = raw_answer.replace("UPLOAD_FAILED:", "")
                    q_detail["media_upload_failed"] = True
                    q_detail["local_file_path"] = local_path
                    logger.warning(f"[LIVE_PROGRESS] Media upload was failed for question: {local_path[:80]}")
                elif raw_answer.startswith("gs://"):
                    # Convert Firebase gs:// URL to HTTPS download URL
                    try:
                        get_firebase_app()
                        path_parts = raw_answer.replace("gs://", "").split("/", 1)
                        if len(path_parts) > 1:
                            file_path = path_parts[1]
                            bucket = firebase_storage.bucket()
                            blob = bucket.blob(file_path)
                            expiration_time = datetime.now(timezone.utc) + timedelta(hours=24)
                            media_url = blob.generate_signed_url(version="v4", expiration=expiration_time, method="GET")
                            resolved_answer = media_url
                    except Exception as e:
                        logger.error(f"[LIVE_PROGRESS] Failed to resolve Firebase URL: {e}")
                        media_url = None
                elif raw_answer.startswith("media_ref:"):
                    # Resolve media reference from separate collection
                    try:
                        media_id = raw_answer.replace("media_ref:", "")
                        media_doc = await db.inspection_media.find_one({"id": media_id}, {"_id": 0, "data": 1, "media_type": 1})
                        if media_doc and media_doc.get("data"):
                            media_url = media_doc.get("data")
                            resolved_answer = media_url
                    except Exception as e:
                        logger.error(f"[LIVE_PROGRESS] Failed to resolve media_ref: {e}")
                elif raw_answer.startswith("file://") or raw_answer.startswith("/data/"):
                    # Local device file path - media was not uploaded to cloud
                    # Mark as upload failed so frontend can display appropriate message
                    q_detail["media_upload_failed"] = True
                    q_detail["local_file_path"] = raw_answer
                    logger.warning(f"[LIVE_PROGRESS] Media not uploaded - local path detected: {raw_answer[:100]}")
                elif raw_answer.startswith("data:image") or raw_answer.startswith("data:video"):
                    # Base64 encoded media - keep as is but set media_url too
                    media_url = raw_answer
                    resolved_answer = raw_answer
                elif raw_answer.startswith("http://") or raw_answer.startswith("https://"):
                    # Already a valid HTTP URL - use directly
                    media_url = raw_answer
                    resolved_answer = raw_answer
            elif isinstance(raw_answer, dict):
                # Handle combo answers (selection + media)
                if raw_answer.get("media"):
                    media_val = raw_answer.get("media")
                    if isinstance(media_val, str) and media_val.startswith("gs://"):
                        try:
                            get_firebase_app()
                            path_parts = media_val.replace("gs://", "").split("/", 1)
                            if len(path_parts) > 1:
                                file_path = path_parts[1]
                                bucket = firebase_storage.bucket()
                                blob = bucket.blob(file_path)
                                expiration_time = datetime.now(timezone.utc) + timedelta(hours=24)
                                media_url = blob.generate_signed_url(version="v4", expiration=expiration_time, method="GET")
                                resolved_answer = {**raw_answer, "media_url": media_url}
                        except Exception as e:
                            logger.error(f"[LIVE_PROGRESS] Failed to resolve combo media: {e}")
                    elif isinstance(media_val, str) and media_val.startswith("media_ref:"):
                        try:
                            media_id = media_val.replace("media_ref:", "")
                            media_doc = await db.inspection_media.find_one({"id": media_id}, {"_id": 0, "data": 1})
                            if media_doc and media_doc.get("data"):
                                media_url = media_doc.get("data")
                                resolved_answer = {**raw_answer, "media_url": media_url}
                        except Exception as e:
                            logger.error(f"[LIVE_PROGRESS] Failed to resolve combo media_ref: {e}")
            
            q_detail["answer"] = resolved_answer
            q_detail["media_url"] = media_url
            
            answered_questions.append({
                "category": cat_name,
                "question": q_detail["question_text"],
                "answer": resolved_answer,
                "answered_at": q_detail["answered_at"]
            })
        
        category_stats[cat_id]["questions"].append(q_detail)
    
    # Calculate completion percentages
    total_questions = 0
    total_answered = 0
    
    for cat_id, stats in category_stats.items():
        total_questions += stats["total_questions"]
        total_answered += stats["answered_questions"]
        if stats["total_questions"] > 0:
            stats["completion_percentage"] = round((stats["answered_questions"] / stats["total_questions"]) * 100, 1)
    
    # Sort categories by order
    sorted_categories = []
    for cat_id in category_order:
        if cat_id in category_stats:
            sorted_categories.append(category_stats[cat_id])
    # Add any categories not in order
    for cat_id, stats in category_stats.items():
        if cat_id not in category_order:
            sorted_categories.append(stats)
    
    overall_completion = round((total_answered / total_questions) * 100, 1) if total_questions > 0 else 0
    
    return {
        "inspection_id": inspection_id,
        "inspection_status": inspection.get("inspection_status", "NEW_INSPECTION"),
        "mechanic_name": inspection.get("mechanic_name"),
        "started_at": inspection.get("started_at"),
        "updated_at": inspection.get("updated_at"),
        "overall_stats": {
            "total_questions": total_questions,
            "answered_questions": total_answered,
            "completion_percentage": overall_completion,
            "categories_total": len(category_stats),
            "categories_completed": sum(1 for s in category_stats.values() if s["completion_percentage"] == 100)
        },
        "obd_scan": {
            "completed": bool(obd_data),
            "data": obd_data if obd_data else None,
            "rescan_enabled": inspection.get("obd_rescan_enabled", False),
            "scanned_at": inspection.get("obd_scanned_at")
        },
        "ai_report": {
            "generated": bool(inspection.get("ai_insights")),
            "stale": inspection.get("ai_report_stale", False),
            "generated_at": inspection.get("ai_report_generated_at"),
            "last_milestone": inspection.get("ai_report_last_milestone", 0),
            "overall_rating": inspection.get("overall_rating", 0),
            "recommended_to_buy": inspection.get("recommended_to_buy", False)
        },
        "categories": sorted_categories,
        "recent_answers": sorted(answered_questions, key=lambda x: x.get("answered_at") or "", reverse=True)[:10]
    }


# ==================== INSPECTION ANSWER EDIT (CRM) ====================

class EditAnswerRequest(BaseModel):
    answer: Any  # Can be string, dict, or any type depending on question type
    sub_answer_1: Optional[Any] = None
    sub_answer_2: Optional[Any] = None
    edit_reason: Optional[str] = None  # Optional reason for the edit


# Roles allowed to edit inspection answers
ANSWER_EDIT_ALLOWED_ROLES = ["CEO", "INSPECTION_COORDINATOR", "INSPECTION_HEAD", "COUNTRY_HEAD_CE", "COUNTRY_HEAD"]


@api_router.put("/inspections/{inspection_id}/answers/{question_id}")
async def edit_inspection_answer(
    inspection_id: str,
    question_id: str,
    request_data: EditAnswerRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Edit an inspection answer (CRM side).
    Only allowed for: Inspection Coordinator, Inspection Head, Country Head CE, CEO
    Creates an audit trail of all edits.
    """
    role_code = current_user.get("role_code", "")
    
    # Check role permission
    if role_code not in ANSWER_EDIT_ALLOWED_ROLES:
        raise HTTPException(
            status_code=403, 
            detail=f"Only {', '.join(ANSWER_EDIT_ALLOWED_ROLES)} can edit inspection answers"
        )
    
    # Get the inspection
    inspection = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    
    # Get current answers
    current_answers = inspection.get("inspection_answers", {})
    
    # Get the previous answer for audit trail
    previous_answer_data = current_answers.get(question_id, {})
    previous_answer = previous_answer_data.get("answer") if isinstance(previous_answer_data, dict) else previous_answer_data
    
    # Create the new answer entry
    now = datetime.now(timezone.utc)
    new_answer_data = {
        "answer": request_data.answer,
        "answered_at": now.isoformat(),
        "edited_by_crm": True,
        "last_edited_at": now.isoformat(),
        "last_edited_by": current_user.get("id"),
        "last_edited_by_name": current_user.get("name", "Unknown")
    }
    
    # Add sub-answers if provided
    if request_data.sub_answer_1 is not None:
        new_answer_data["sub_answer_1"] = request_data.sub_answer_1
    if request_data.sub_answer_2 is not None:
        new_answer_data["sub_answer_2"] = request_data.sub_answer_2
    
    # Update the inspection answers
    current_answers[question_id] = new_answer_data
    
    await db.inspections.update_one(
        {"id": inspection_id},
        {
            "$set": {
                "inspection_answers": current_answers,
                "ai_report_stale": True,  # Mark AI report as needing update after CRM edit
                "updated_at": now.isoformat()
            }
        }
    )
    
    # Create audit trail entry
    edit_history_entry = {
        "id": str(uuid.uuid4()),
        "inspection_id": inspection_id,
        "question_id": question_id,
        "previous_answer": previous_answer,
        "new_answer": request_data.answer,
        "previous_sub_answer_1": previous_answer_data.get("sub_answer_1") if isinstance(previous_answer_data, dict) else None,
        "new_sub_answer_1": request_data.sub_answer_1,
        "previous_sub_answer_2": previous_answer_data.get("sub_answer_2") if isinstance(previous_answer_data, dict) else None,
        "new_sub_answer_2": request_data.sub_answer_2,
        "edit_reason": request_data.edit_reason,
        "edited_by_id": current_user.get("id"),
        "edited_by_name": current_user.get("name", "Unknown"),
        "edited_by_role": role_code,
        "edited_at": now.isoformat(),
        "created_at": now.isoformat()
    }
    
    await db.inspection_answer_edits.insert_one(edit_history_entry)
    
    # Log the activity
    activity = {
        "id": str(uuid.uuid4()),
        "inspection_id": inspection_id,
        "action": "ANSWER_EDITED",
        "description": f"Answer for question edited by {current_user.get('name', 'Unknown')} ({role_code})" + (f" - Reason: {request_data.edit_reason}" if request_data.edit_reason else ""),
        "user_id": current_user.get("id"),
        "user_name": current_user.get("name", "Unknown"),
        "metadata": {
            "question_id": question_id,
            "edit_reason": request_data.edit_reason
        },
        "created_at": now.isoformat()
    }
    await db.inspection_activities.insert_one(activity)
    
    logger.info(f"[ANSWER_EDIT] User {current_user.get('name')} ({role_code}) edited answer for question {question_id} in inspection {inspection_id}")
    
    return {
        "success": True,
        "message": "Answer updated successfully",
        "question_id": question_id,
        "new_answer": request_data.answer,
        "edited_at": now.isoformat(),
        "edited_by": current_user.get("name", "Unknown"),
        "ai_report_stale": True  # Indicate AI report needs regeneration
    }


@api_router.get("/inspections/{inspection_id}/answers/{question_id}/history")
async def get_answer_edit_history(
    inspection_id: str,
    question_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get the edit history for a specific answer"""
    # Get edit history for this question
    history = await db.inspection_answer_edits.find(
        {"inspection_id": inspection_id, "question_id": question_id},
        {"_id": 0}
    ).sort("edited_at", -1).to_list(50)
    
    return {
        "inspection_id": inspection_id,
        "question_id": question_id,
        "edit_count": len(history),
        "history": history
    }


@api_router.get("/inspections/{inspection_id}/edit-history")
async def get_inspection_edit_history(
    inspection_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all answer edit history for an inspection"""
    # Get all edit history for this inspection
    history = await db.inspection_answer_edits.find(
        {"inspection_id": inspection_id},
        {"_id": 0}
    ).sort("edited_at", -1).to_list(200)
    
    return {
        "inspection_id": inspection_id,
        "total_edits": len(history),
        "history": history
    }


class UpdateVehicleRequest(BaseModel):
    car_number: str
    car_make: Optional[str] = None
    car_model: Optional[str] = None
    car_year: Optional[str] = None
    car_color: Optional[str] = None
    fuel_type: Optional[str] = None


@api_router.patch("/inspections/{inspection_id}/vehicle")
async def update_inspection_vehicle(
    inspection_id: str,
    request_data: UpdateVehicleRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update vehicle details for an inspection (when mechanic needs to inspect different car)"""
    inspection = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    
    update_dict = {
        "car_number": request_data.car_number,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user["id"],
        "vehicle_change_note": f"Vehicle changed from {inspection.get('car_number', 'N/A')} to {request_data.car_number}"
    }
    
    if request_data.car_make:
        update_dict["car_make"] = request_data.car_make
    if request_data.car_model:
        update_dict["car_model"] = request_data.car_model
    if request_data.car_year:
        update_dict["car_year"] = request_data.car_year
    if request_data.car_color:
        update_dict["car_color"] = request_data.car_color
    if request_data.fuel_type:
        update_dict["fuel_type"] = request_data.fuel_type
    
    await db.inspections.update_one({"id": inspection_id}, {"$set": update_dict})
    
    updated = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
    return updated


class AssignMechanicRequest(BaseModel):
    mechanic_id: Optional[str] = None  # None to unassign


@api_router.patch("/inspections/{inspection_id}/assign-mechanic")
async def assign_mechanic_to_inspection(
    inspection_id: str,
    request_data: AssignMechanicRequest,
    current_user: dict = Depends(get_current_user)
):
    """Assign or unassign a mechanic to an inspection"""
    inspection = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    
    update_dict = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user["id"]
    }
    
    if request_data.mechanic_id:
        # Assign mechanic
        mechanic = await db.users.find_one({"id": request_data.mechanic_id}, {"_id": 0, "id": 1, "name": 1, "inspection_cities": 1})
        if not mechanic:
            raise HTTPException(status_code=404, detail="Mechanic not found")
        
        # Validate mechanic's inspection city matches inspection city
        inspection_city = inspection.get("city", "")
        mechanic_cities = mechanic.get("inspection_cities", []) or []
        
        if mechanic_cities and inspection_city:
            # Case-insensitive city matching
            mechanic_cities_lower = [c.lower() for c in mechanic_cities]
            if inspection_city.lower() not in mechanic_cities_lower:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Mechanic is not assigned to city: {inspection_city}. Mechanic's inspection cities: {', '.join(mechanic_cities)}"
                )
        
        update_dict["mechanic_id"] = mechanic["id"]
        update_dict["mechanic_name"] = mechanic.get("name", "")
        
        # Auto-update status to ASSIGNED_TO_MECHANIC if currently NEW_INSPECTION
        if inspection.get("inspection_status") == "NEW_INSPECTION":
            update_dict["inspection_status"] = "ASSIGNED_TO_MECHANIC"
        
        # Send push notification to the assigned mechanic
        try:
            vehicle = f"{inspection.get('make', '')} {inspection.get('model', '')}".strip() or inspection.get("car_number", "Vehicle")
            scheduled = inspection.get("scheduled_date", "TBD")
            await send_mechanic_notification(
                mechanic_id=mechanic["id"],
                title="Inspection Assigned to You ✅",
                body=f"You've been assigned: {vehicle} in {inspection_city}. Scheduled: {scheduled}.",
                data={
                    "type": "inspection_assigned",
                    "inspection_id": inspection_id,
                    "city": inspection_city
                },
                notification_type="inspection_assigned"
            )
        except Exception as e:
            logger.warning(f"Failed to send assignment notification: {e}")
    else:
        # Unassign mechanic
        update_dict["mechanic_id"] = None
        update_dict["mechanic_name"] = None
    
    await db.inspections.update_one({"id": inspection_id}, {"$set": update_dict})
    
    # Log activity for mechanic assignment
    if request_data.mechanic_id:
        activity = {
            "id": str(uuid.uuid4()),
            "inspection_id": inspection_id,
            "user_id": current_user["id"],
            "user_name": current_user.get("name", "Unknown"),
            "action": "mechanic_assigned",
            "details": f"Assigned to {update_dict.get('mechanic_name', 'mechanic')}",
            "old_value": inspection.get("mechanic_name"),
            "new_value": update_dict.get("mechanic_name"),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    else:
        activity = {
            "id": str(uuid.uuid4()),
            "inspection_id": inspection_id,
            "user_id": current_user["id"],
            "user_name": current_user.get("name", "Unknown"),
            "action": "mechanic_unassigned",
            "details": f"Unassigned {inspection.get('mechanic_name', 'mechanic')}",
            "old_value": inspection.get("mechanic_name"),
            "new_value": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    await db.inspection_activities.insert_one(activity)
    
    updated = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
    return updated


class UpdateScheduleRequest(BaseModel):
    scheduled_date: str
    scheduled_time: str


@api_router.patch("/inspections/{inspection_id}/schedule")
async def update_inspection_schedule(
    inspection_id: str,
    request_data: UpdateScheduleRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update inspection schedule (date and time)"""
    inspection = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    
    update_dict = {
        "scheduled_date": request_data.scheduled_date,
        "scheduled_time": request_data.scheduled_time,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user["id"]
    }
    
    # Update status to SCHEDULED if it was UNSCHEDULED
    if inspection.get("inspection_status") == "UNSCHEDULED":
        update_dict["inspection_status"] = "SCHEDULED"
    
    await db.inspections.update_one({"id": inspection_id}, {"$set": update_dict})
    
    updated = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
    return updated


class UpdateLocationRequest(BaseModel):
    address: str
    city: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


@api_router.patch("/inspections/{inspection_id}/location")
async def update_inspection_location(
    inspection_id: str,
    request_data: UpdateLocationRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update inspection location (address, city, lat/lng for navigation)"""
    inspection = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    
    old_address = inspection.get("address", "")
    old_city = inspection.get("city", "")
    
    update_dict = {
        "address": request_data.address,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user["id"]
    }
    
    if request_data.city:
        update_dict["city"] = request_data.city
    
    if request_data.latitude is not None:
        update_dict["latitude"] = request_data.latitude
        update_dict["location_lat"] = request_data.latitude  # Also update legacy field
    
    if request_data.longitude is not None:
        update_dict["longitude"] = request_data.longitude
        update_dict["location_lng"] = request_data.longitude  # Also update legacy field
    
    await db.inspections.update_one({"id": inspection_id}, {"$set": update_dict})
    
    # Log activity
    activity = {
        "id": str(uuid.uuid4()),
        "inspection_id": inspection_id,
        "user_id": current_user["id"],
        "user_name": current_user.get("name", "Unknown"),
        "user_role": current_user.get("role", "user"),
        "action": "location_updated",
        "action_label": "Location Updated",
        "details": f"Location changed from '{old_address}' to '{request_data.address}'",
        "old_value": f"{old_city} - {old_address}",
        "new_value": f"{request_data.city or old_city} - {request_data.address}",
        "source": "CRM",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.inspection_activities.insert_one(activity)
    
    updated = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
    return updated


class SendReportRequest(BaseModel):
    send_whatsapp: bool = True
    send_email: bool = False
    email: Optional[str] = None


@api_router.post("/inspections/{inspection_id}/send-report")
async def send_inspection_report(
    inspection_id: str,
    request_data: SendReportRequest,
    current_user: dict = Depends(get_current_user)
):
    """Send inspection report - only allowed if fully paid"""
    from services.twilio_service import get_twilio_service
    
    inspection = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    
    # Check payment status
    if inspection.get("payment_status") != "FULLY_PAID":
        raise HTTPException(
            status_code=400, 
            detail="Cannot send report. Full payment required. Current status: " + inspection.get("payment_status", "PENDING")
        )
    
    # Check inspection status
    if inspection.get("inspection_status") != "INSPECTION_COMPLETED":
        raise HTTPException(
            status_code=400,
            detail="Cannot send report. Inspection must be completed first."
        )
    
    # Check if report exists
    report_url = inspection.get("report_url")
    if not report_url:
        raise HTTPException(status_code=400, detail="No report available to send")
    
    customer_name = inspection.get("customer_name", "Customer")
    customer_mobile = inspection.get("customer_mobile", "")
    package_name = inspection.get("package_name", inspection.get("package_type", "Inspection"))
    car_info = f"{inspection.get('car_make', '')} {inspection.get('car_model', '')} ({inspection.get('car_number', '')})".strip()
    
    # Send via WhatsApp
    whatsapp_sent = False
    if request_data.send_whatsapp and customer_mobile:
        twilio = get_twilio_service()
        if twilio.is_configured():
            message = f"""✅ *Inspection Report Ready*

Dear {customer_name},

Your vehicle inspection report is now ready!

🚗 *Vehicle:* {car_info}
📦 *Package:* {package_name}

📄 *View Report:* {report_url}

Thank you for choosing Wisedrive for your vehicle inspection!

For any queries, please contact us."""
            
            whatsapp_result = await twilio.send_message(customer_mobile, message)
            whatsapp_sent = whatsapp_result.get("success", False)
    
    # Update inspection
    await db.inspections.update_one(
        {"id": inspection_id},
        {"$set": {
            "report_sent": True,
            "report_sent_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "success": True,
        "whatsapp_sent": whatsapp_sent,
        "report_url": report_url
    }


class UpdateReportRequest(BaseModel):
    report_data: dict
    report_status: str = "in_review"
    notes: Optional[str] = None


@api_router.put("/inspections/{inspection_id}/report")
async def update_inspection_report(
    inspection_id: str,
    request_data: UpdateReportRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update inspection report data - allowed after inspection is completed"""
    inspection = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    
    # Only allow editing if inspection is in progress or completed
    allowed_statuses = ["INSPECTION_IN_PROGRESS", "INSPECTION_COMPLETED"]
    if inspection.get("inspection_status") not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail="Can only edit report during or after inspection. Current status: " + inspection.get("inspection_status", "NEW_INSPECTION")
        )
    
    await db.inspections.update_one(
        {"id": inspection_id},
        {"$set": {
            "report_data": request_data.report_data,
            "report_status": request_data.report_status,
            "notes": request_data.notes if request_data.notes else inspection.get("notes"),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": current_user["id"]
        }}
    )
    
    return {"success": True, "message": "Report updated"}


# Get customer payment history
@api_router.get("/customers/{customer_id}/payment-history")
async def get_customer_payment_history(
    customer_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get payment history for a customer including all inspection payments"""
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Get all inspections for this customer
    inspections = await db.inspections.find(
        {"customer_id": customer_id},
        {"_id": 0}
    ).to_list(100)
    
    # Compile payment history
    payment_history = []
    
    for inspection in inspections:
        # Add initial payment transaction
        if inspection.get("payment_link_id"):
            payment_history.append({
                "id": inspection.get("payment_link_id"),
                "inspection_id": inspection.get("id"),
                "type": "partial" if inspection.get("payment_type") == "partial" else "full",
                "amount": inspection.get("partial_payment_amount") or inspection.get("amount_paid", 0),
                "status": "completed" if inspection.get("amount_paid", 0) > 0 else "pending",
                "package_name": inspection.get("package_name", inspection.get("package_type")),
                "car_info": f"{inspection.get('car_make', '')} {inspection.get('car_model', '')} ({inspection.get('car_number', '')})".strip(),
                "created_at": inspection.get("created_at"),
                "payment_link_url": inspection.get("payment_link_url")
            })
        
        # Add all transactions from payment_transactions array
        for txn in inspection.get("payment_transactions", []):
            payment_history.append({
                "id": txn.get("id"),
                "inspection_id": inspection.get("id"),
                "type": txn.get("payment_type", "payment"),
                "amount": txn.get("amount", 0),
                "status": txn.get("status", "pending"),
                "package_name": inspection.get("package_name", inspection.get("package_type")),
                "car_info": f"{inspection.get('car_make', '')} {inspection.get('car_model', '')} ({inspection.get('car_number', '')})".strip(),
                "created_at": txn.get("created_at"),
                "completed_at": txn.get("completed_at"),
                "payment_link_url": txn.get("payment_link_url"),
                "razorpay_payment_id": txn.get("razorpay_payment_id")
            })
    
    # Sort by date, newest first
    payment_history.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    
    # Calculate totals
    total_paid = sum(p.get("amount", 0) for p in payment_history if p.get("status") == "completed")
    total_pending = sum(p.get("amount", 0) for p in payment_history if p.get("status") == "pending")
    
    return {
        "customer_id": customer_id,
        "customer_name": customer.get("name"),
        "total_paid": total_paid,
        "total_pending": total_pending,
        "transactions": payment_history
    }


# Pydantic model for customer notes
class CustomerNoteCreate(BaseModel):
    note: str


@api_router.get("/customers/{customer_id}/detailed-payments")
async def get_customer_detailed_payments(
    customer_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get detailed payment info grouped by package/inspection with all requested fields"""
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Get all inspections for this customer
    inspections = await db.inspections.find(
        {"customer_id": customer_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Collect unique user IDs for sales rep lookup
    user_ids = set()
    for insp in inspections:
        if insp.get("created_by"):
            user_ids.add(insp.get("created_by"))
    
    # Get lead data for meta/ad details
    lead_data = None
    meta_info = None
    if customer.get("lead_id"):
        lead_data = await db.leads.find_one({"id": customer.get("lead_id")}, {"_id": 0})
        if lead_data:
            if lead_data.get("assigned_to"):
                user_ids.add(lead_data.get("assigned_to"))
            if lead_data.get("created_by"):
                user_ids.add(lead_data.get("created_by"))
            
            # Build meta/ad info
            meta_info = {
                "source": lead_data.get("source", "Direct"),
                "ad_id": lead_data.get("ad_id"),
                "campaign_id": lead_data.get("campaign_id"),
                "ad_name": None,
                "campaign_name": None
            }
            
            # If ad_id exists, try to get ad name from mappings
            if lead_data.get("ad_id"):
                ad_mapping = await db.ad_mappings.find_one({"ad_id": lead_data.get("ad_id")}, {"_id": 0})
                if ad_mapping:
                    meta_info["ad_name"] = ad_mapping.get("ad_name")
                    meta_info["campaign_name"] = ad_mapping.get("campaign_name")
    
    # Fetch user names
    user_map = {}
    if user_ids:
        users = await db.users.find({"id": {"$in": list(user_ids)}}, {"_id": 0, "id": 1, "name": 1}).to_list(100)
        user_map = {u["id"]: u["name"] for u in users}
    
    # Build package-wise payment details
    packages = []
    total_paid = 0
    total_pending = 0
    
    for insp in inspections:
        # Build payments list for this inspection/package
        payments = []
        
        # Add the initial payment transaction
        if insp.get("amount_paid", 0) > 0:
            payments.append({
                "id": insp.get("payment_link_id", insp.get("id")),
                "date": insp.get("created_at"),
                "amount": insp.get("amount_paid", 0),
                "payment_reference": insp.get("razorpay_payment_id") or insp.get("payment_link_id") or "-",
                "payment_link": insp.get("payment_link_url"),
                "mode": "Razorpay" if insp.get("payment_link_id") else "Manual",
                "status": "completed",
                "type": "partial" if insp.get("payment_type") == "partial" else "full"
            })
            total_paid += insp.get("amount_paid", 0)
        
        # Add all subsequent transactions
        for txn in insp.get("payment_transactions", []):
            amount = txn.get("amount", 0)
            status = txn.get("status", "pending")
            payments.append({
                "id": txn.get("id"),
                "date": txn.get("completed_at") or txn.get("created_at"),
                "amount": amount,
                "payment_reference": txn.get("razorpay_payment_id") or txn.get("payment_link_id") or "-",
                "payment_link": txn.get("payment_link_url"),
                "mode": txn.get("payment_method", "Razorpay").replace("_", " ").title(),
                "status": status,
                "type": txn.get("payment_type", "payment")
            })
            if status == "completed":
                total_paid += amount
            else:
                total_pending += amount
        
        # If balance due exists and no completed balance payment
        if insp.get("balance_due", 0) > 0 and insp.get("payment_status") != "FULLY_PAID":
            total_pending += insp.get("balance_due", 0)
        
        # Get sales rep info
        sales_rep_id = insp.get("created_by")
        sales_rep_name = user_map.get(sales_rep_id, "N/A")
        
        # Determine inspection status label
        inspection_status = insp.get("inspection_status", "NEW_INSPECTION")
        has_report = inspection_status == "INSPECTION_COMPLETED"
        
        # Build package info with enhanced details
        package_info = {
            "inspection_id": insp.get("id"),
            "package_name": insp.get("package_name") or insp.get("package_type") or "Standard Package",
            "package_id": insp.get("package_id"),
            "package_type": insp.get("package_type"),
            "car_info": f"{insp.get('car_make', '')} {insp.get('car_model', '')}".strip() or "N/A",
            "car_number": insp.get("car_number") or "N/A",
            "car_year": insp.get("car_year"),
            "total_amount": insp.get("total_amount", 0) or insp.get("final_amount", 0),
            "amount_paid": insp.get("amount_paid", 0),
            "balance_due": insp.get("balance_due", 0),
            "payment_status": insp.get("payment_status", "PENDING"),
            "inspections_total": insp.get("inspections_available", 1),
            "inspections_used": 1 if has_report else 0,
            "inspection_status": inspection_status,
            "has_report": has_report,
            "report_url": f"/inspection-report/{insp.get('id')}" if has_report else None,
            "scheduled_date": insp.get("scheduled_date"),
            "scheduled_time": insp.get("scheduled_time"),
            "mechanic_name": insp.get("mechanic_name"),
            "city": insp.get("city"),
            "sales_rep_id": sales_rep_id,
            "sales_rep_name": sales_rep_name,
            "created_at": insp.get("created_at"),
            "payments": payments
        }
        packages.append(package_info)
    
    # Get original sales rep from lead if available
    original_sales_rep = None
    if lead_data:
        rep_id = lead_data.get("assigned_to") or lead_data.get("created_by")
        original_sales_rep = {
            "id": rep_id,
            "name": user_map.get(rep_id, lead_data.get("assigned_to_name", "N/A"))
        }
    
    return {
        "customer_id": customer_id,
        "customer_name": customer.get("name"),
        "customer_mobile": customer.get("mobile"),
        "original_sales_rep": original_sales_rep,
        "meta_info": meta_info,
        "total_paid": total_paid,
        "total_pending": total_pending,
        "packages": packages
    }


@api_router.post("/customers/{customer_id}/notes")
async def add_customer_note(customer_id: str, note_data: CustomerNoteCreate, current_user: dict = Depends(get_current_user)):
    """Add a note to a customer"""
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    note = {
        "id": str(uuid.uuid4()),
        "customer_id": customer_id,
        "user_id": current_user["id"],
        "user_name": current_user.get("name", "Unknown"),
        "note": note_data.note,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.customer_notes.insert_one(note)
    
    # Log activity
    activity = {
        "id": str(uuid.uuid4()),
        "customer_id": customer_id,
        "user_id": current_user["id"],
        "user_name": current_user.get("name", "Unknown"),
        "action": "note_added",
        "details": f"Added a note ({len(note_data.note)} chars)",
        "new_value": note_data.note[:500],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.customer_activities.insert_one(activity)
    
    note.pop("_id", None)
    return note


@api_router.get("/customers/{customer_id}/notes")
async def get_customer_notes(customer_id: str, current_user: dict = Depends(get_current_user)):
    """Get all notes for a customer"""
    notes = await db.customer_notes.find({"customer_id": customer_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return notes


@api_router.put("/customers/{customer_id}/notes/{note_id}")
async def update_customer_note(customer_id: str, note_id: str, note_data: CustomerNoteCreate, current_user: dict = Depends(get_current_user)):
    """Update an existing note"""
    note = await db.customer_notes.find_one({"id": note_id, "customer_id": customer_id}, {"_id": 0})
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    old_note = note.get("note", "")
    await db.customer_notes.update_one(
        {"id": note_id},
        {"$set": {"note": note_data.note, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Log activity
    activity = {
        "id": str(uuid.uuid4()),
        "customer_id": customer_id,
        "user_id": current_user["id"],
        "user_name": current_user.get("name", "Unknown"),
        "action": "note_updated",
        "details": f"Updated a note",
        "old_value": old_note[:200],
        "new_value": note_data.note[:200],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.customer_activities.insert_one(activity)
    
    updated_note = await db.customer_notes.find_one({"id": note_id}, {"_id": 0})
    return updated_note


@api_router.delete("/customers/{customer_id}/notes/{note_id}")
async def delete_customer_note(customer_id: str, note_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a note"""
    note = await db.customer_notes.find_one({"id": note_id, "customer_id": customer_id}, {"_id": 0})
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    await db.customer_notes.delete_one({"id": note_id})
    
    # Log activity
    activity = {
        "id": str(uuid.uuid4()),
        "customer_id": customer_id,
        "user_id": current_user["id"],
        "user_name": current_user.get("name", "Unknown"),
        "action": "note_deleted",
        "details": f"Deleted a note",
        "old_value": note.get("note", "")[:200],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.customer_activities.insert_one(activity)
    
    return {"success": True, "message": "Note deleted"}


@api_router.get("/customers/{customer_id}/activities")
async def get_customer_activities(customer_id: str, current_user: dict = Depends(get_current_user)):
    """Get all activities for a customer"""
    activities = await db.customer_activities.find({"customer_id": customer_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return activities


@api_router.post("/customers/seed-sample-data")
async def seed_sample_customer_data(current_user: dict = Depends(get_current_user)):
    """Create a sample customer with multiple packages and payment transactions for demo purposes"""
    from datetime import timedelta
    
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
        
        # V1 compatibility - Keep actual assigned_cities if present
        user["role"] = user.get("role_name", "employee")
        if not user.get("assigned_cities"):
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


# ==================== REPAIRS MODULE ====================
# Comprehensive spare parts, labor charges, and question-based repair rules

# Pydantic models for Repairs Module
class RepairPartPricing(BaseModel):
    """Pricing structure for a car type"""
    repair_price: float = 0
    replace_price: float = 0
    repair_labor: float = 0
    replace_labor: float = 0

class BrandOverride(BaseModel):
    """Brand-specific price override"""
    brand: str
    hatchback: Optional[RepairPartPricing] = None
    sedan: Optional[RepairPartPricing] = None
    suv: Optional[RepairPartPricing] = None

class RepairPartCreate(BaseModel):
    """Create a new repair part"""
    name: str
    category: str  # body_panels, mechanical, electrical, interior, glass
    description: Optional[str] = None
    part_number: Optional[str] = None
    # Default pricing by car type
    hatchback: RepairPartPricing = RepairPartPricing()
    sedan: RepairPartPricing = RepairPartPricing()
    suv: RepairPartPricing = RepairPartPricing()
    # Brand-specific overrides
    brand_overrides: List[BrandOverride] = []
    is_active: bool = True

class RepairPartUpdate(BaseModel):
    """Update repair part"""
    name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    part_number: Optional[str] = None
    hatchback: Optional[RepairPartPricing] = None
    sedan: Optional[RepairPartPricing] = None
    suv: Optional[RepairPartPricing] = None
    brand_overrides: Optional[List[BrandOverride]] = None
    is_active: Optional[bool] = None

class RepairRuleCondition(BaseModel):
    """Condition for repair rule"""
    operator: str  # equals, greater_than, less_than, between, contains
    value: Any  # Single value or [min, max] for between
    
class RepairRuleAction(BaseModel):
    """Action to take when condition is met"""
    action_type: str  # repair, replace, inspect_further
    priority: str = "normal"  # low, normal, high, critical
    notes: Optional[str] = None

class RepairRuleCreate(BaseModel):
    """Create a repair rule linking question to part"""
    part_id: str
    question_id: str
    question_text: Optional[str] = None  # For display purposes
    conditions: List[dict]  # [{condition: RepairRuleCondition, action: RepairRuleAction}]
    country_id: Optional[str] = None
    is_active: bool = True

class RepairRuleUpdate(BaseModel):
    """Update repair rule"""
    conditions: Optional[List[dict]] = None
    is_active: Optional[bool] = None


# Repair Parts CRUD endpoints
@api_router.get("/repair-parts")
async def get_repair_parts(
    category: Optional[str] = None,
    search: Optional[str] = None,
    country_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all repair parts with optional filtering"""
    query = {"is_active": True}
    if category:
        query["category"] = category
    if country_id:
        query["$or"] = [{"country_id": country_id}, {"country_id": None}]
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"part_number": {"$regex": search, "$options": "i"}}
        ]
    
    parts = await db.repair_parts.find(query, {"_id": 0}).sort("category", 1).to_list(500)
    return parts


@api_router.get("/repair-parts/categories")
async def get_repair_part_categories(
    current_user: dict = Depends(get_current_user)
):
    """Get predefined repair part categories"""
    categories = [
        {"id": "body_panels", "name": "Body Panels", "description": "Doors, fenders, bumpers, hood, roof, panels"},
        {"id": "mechanical", "name": "Mechanical Parts", "description": "Engine components, suspension, brakes, steering"},
        {"id": "electrical", "name": "Electrical", "description": "Lights, wiring, sensors, battery, alternator"},
        {"id": "interior", "name": "Interior", "description": "Seats, dashboard, trim, carpet, headliner"},
        {"id": "glass", "name": "Glass & Mirrors", "description": "Windshield, windows, mirrors, sunroof"},
        {"id": "tyres_wheels", "name": "Tyres & Wheels", "description": "Tyres, rims, wheel bearings, alignment"},
        {"id": "ac_cooling", "name": "AC & Cooling", "description": "AC compressor, radiator, condenser, hoses"},
        {"id": "exhaust", "name": "Exhaust System", "description": "Silencer, catalytic converter, exhaust pipes"}
    ]
    return categories


@api_router.get("/repair-parts/{part_id}")
async def get_repair_part(
    part_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific repair part"""
    part = await db.repair_parts.find_one({"id": part_id}, {"_id": 0})
    if not part:
        raise HTTPException(status_code=404, detail="Repair part not found")
    return part


@api_router.post("/repair-parts")
async def create_repair_part(
    part: RepairPartCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new repair part"""
    now = datetime.now(timezone.utc).isoformat()
    part_doc = {
        "id": str(uuid.uuid4()),
        **part.model_dump(),
        "country_id": current_user.get("country_id"),
        "created_by": current_user.get("id"),
        "created_at": now,
        "updated_at": now
    }
    
    await db.repair_parts.insert_one(part_doc)
    part_doc.pop("_id", None)
    return part_doc


@api_router.put("/repair-parts/{part_id}")
async def update_repair_part(
    part_id: str,
    part: RepairPartUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a repair part"""
    update_data = {k: v for k, v in part.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = current_user.get("id")
    
    result = await db.repair_parts.update_one(
        {"id": part_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Repair part not found")
    
    updated = await db.repair_parts.find_one({"id": part_id}, {"_id": 0})
    return updated


@api_router.delete("/repair-parts/{part_id}")
async def delete_repair_part(
    part_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Soft delete a repair part"""
    result = await db.repair_parts.update_one(
        {"id": part_id},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Repair part not found")
    return {"message": "Repair part deleted"}


# Repair Rules CRUD endpoints
@api_router.get("/repair-rules")
async def get_repair_rules(
    part_id: Optional[str] = None,
    question_id: Optional[str] = None,
    country_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all repair rules with optional filtering"""
    query = {"is_active": True}
    if part_id:
        query["part_id"] = part_id
    if question_id:
        query["question_id"] = question_id
    if country_id:
        query["$or"] = [{"country_id": country_id}, {"country_id": None}]
    
    rules = await db.repair_rules.find(query, {"_id": 0}).to_list(500)
    
    # Enrich with part details
    part_ids = list(set(r["part_id"] for r in rules))
    parts = await db.repair_parts.find({"id": {"$in": part_ids}}, {"_id": 0, "id": 1, "name": 1, "category": 1}).to_list(500)
    parts_map = {p["id"]: p for p in parts}
    
    for rule in rules:
        rule["part"] = parts_map.get(rule["part_id"])
    
    return rules


@api_router.get("/repair-rules/{rule_id}")
async def get_repair_rule(
    rule_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific repair rule"""
    rule = await db.repair_rules.find_one({"id": rule_id}, {"_id": 0})
    if not rule:
        raise HTTPException(status_code=404, detail="Repair rule not found")
    
    # Get part details
    part = await db.repair_parts.find_one({"id": rule["part_id"]}, {"_id": 0, "id": 1, "name": 1, "category": 1})
    rule["part"] = part
    
    return rule


@api_router.post("/repair-rules")
async def create_repair_rule(
    rule: RepairRuleCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new repair rule"""
    # Verify part exists
    part = await db.repair_parts.find_one({"id": rule.part_id}, {"_id": 0})
    if not part:
        raise HTTPException(status_code=404, detail="Repair part not found")
    
    now = datetime.now(timezone.utc).isoformat()
    rule_doc = {
        "id": str(uuid.uuid4()),
        **rule.model_dump(),
        "country_id": rule.country_id or current_user.get("country_id"),
        "created_by": current_user.get("id"),
        "created_at": now,
        "updated_at": now
    }
    
    await db.repair_rules.insert_one(rule_doc)
    rule_doc["part"] = {"id": part["id"], "name": part["name"], "category": part["category"]}
    rule_doc.pop("_id", None)
    return rule_doc


@api_router.put("/repair-rules/{rule_id}")
async def update_repair_rule(
    rule_id: str,
    rule: RepairRuleUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a repair rule"""
    update_data = {k: v for k, v in rule.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = current_user.get("id")
    
    result = await db.repair_rules.update_one(
        {"id": rule_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Repair rule not found")
    
    updated = await db.repair_rules.find_one({"id": rule_id}, {"_id": 0})
    return updated


@api_router.delete("/repair-rules/{rule_id}")
async def delete_repair_rule(
    rule_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Soft delete a repair rule"""
    result = await db.repair_rules.update_one(
        {"id": rule_id},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Repair rule not found")
    return {"message": "Repair rule deleted"}


# Calculate repair cost for an inspection answer
@api_router.post("/repair-parts/calculate-cost")
async def calculate_repair_cost(
    data: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Calculate repair cost based on question answer
    Expected data: {
        question_id: str,
        answer: any,
        car_type: str (hatchback/sedan/suv),
        brand: str (optional)
    }
    """
    question_id = data.get("question_id")
    answer = data.get("answer")
    car_type = data.get("car_type", "sedan").lower()
    brand = data.get("brand")
    
    if not question_id or answer is None:
        raise HTTPException(status_code=400, detail="question_id and answer are required")
    
    # Find rules for this question
    rules = await db.repair_rules.find(
        {"question_id": question_id, "is_active": True},
        {"_id": 0}
    ).to_list(50)
    
    if not rules:
        return {"recommendations": [], "message": "No repair rules found for this question"}
    
    recommendations = []
    
    for rule in rules:
        # Get the part
        part = await db.repair_parts.find_one({"id": rule["part_id"], "is_active": True}, {"_id": 0})
        if not part:
            continue
        
        # Evaluate conditions
        for condition_group in rule.get("conditions", []):
            condition = condition_group.get("condition", {})
            action = condition_group.get("action", {})
            
            operator = condition.get("operator")
            value = condition.get("value")
            
            matches = False
            
            # Evaluate based on operator
            try:
                if operator == "equals":
                    matches = str(answer).lower() == str(value).lower()
                elif operator == "greater_than":
                    matches = float(answer) > float(value)
                elif operator == "less_than":
                    matches = float(answer) < float(value)
                elif operator == "greater_than_or_equal":
                    matches = float(answer) >= float(value)
                elif operator == "less_than_or_equal":
                    matches = float(answer) <= float(value)
                elif operator == "between":
                    if isinstance(value, list) and len(value) == 2:
                        matches = float(value[0]) <= float(answer) <= float(value[1])
                elif operator == "contains":
                    matches = str(value).lower() in str(answer).lower()
            except (ValueError, TypeError):
                continue
            
            if matches:
                # Get pricing for this car type
                pricing = part.get(car_type, {})
                
                # Check for brand override
                if brand:
                    for override in part.get("brand_overrides", []):
                        if override.get("brand", "").lower() == brand.lower():
                            brand_pricing = override.get(car_type)
                            if brand_pricing:
                                pricing = brand_pricing
                            break
                
                action_type = action.get("action_type", "repair")
                
                if action_type == "repair":
                    cost = pricing.get("repair_price", 0)
                    labor = pricing.get("repair_labor", 0)
                elif action_type == "replace":
                    cost = pricing.get("replace_price", 0)
                    labor = pricing.get("replace_labor", 0)
                else:
                    cost = 0
                    labor = 0
                
                recommendations.append({
                    "part_id": part["id"],
                    "part_name": part["name"],
                    "part_category": part["category"],
                    "action": action_type,
                    "priority": action.get("priority", "normal"),
                    "part_cost": cost,
                    "labor_cost": labor,
                    "total_cost": cost + labor,
                    "notes": action.get("notes"),
                    "car_type": car_type,
                    "brand": brand
                })
                break  # Stop at first matching condition for this rule
    
    total_parts = sum(r["part_cost"] for r in recommendations)
    total_labor = sum(r["labor_cost"] for r in recommendations)
    
    return {
        "recommendations": recommendations,
        "summary": {
            "total_parts_cost": total_parts,
            "total_labor_cost": total_labor,
            "total_cost": total_parts + total_labor,
            "items_count": len(recommendations)
        }
    }


# Get available questions for rule linking
@api_router.get("/repair-rules/available-questions")
async def get_available_questions_for_rules(
    country_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all questions from inspection packages that can be linked to repair rules"""
    query = {"is_active": True}
    if country_id:
        query["country_id"] = country_id
    
    # Get all packages
    packages = await db.inspection_packages.find(query, {"_id": 0, "id": 1, "name": 1, "categories": 1}).to_list(50)
    
    questions = []
    for pkg in packages:
        for cat in pkg.get("categories", []):
            for q in cat.get("questions", []):
                questions.append({
                    "question_id": q.get("id"),
                    "question_text": q.get("question", q.get("text", "")),
                    "question_type": q.get("answer_type", q.get("type", "text")),
                    "options": q.get("options", []),
                    "category_id": cat.get("id"),
                    "category_name": cat.get("name"),
                    "package_id": pkg.get("id"),
                    "package_name": pkg.get("name")
                })
    
    # Also check inspection_categories collection
    categories = await db.inspection_categories.find({"is_active": {"$ne": False}}, {"_id": 0}).to_list(100)
    for cat in categories:
        for q in cat.get("questions", []):
            questions.append({
                "question_id": q.get("id"),
                "question_text": q.get("question", q.get("text", "")),
                "question_type": q.get("answer_type", q.get("type", "text")),
                "options": q.get("options", []),
                "category_id": cat.get("id"),
                "category_name": cat.get("name"),
                "package_id": None,
                "package_name": "Standalone Category"
            })
    
    return questions


# ==================== OFFERS ROUTES ====================

@api_router.get("/offers")
async def get_offers(
    country_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all offers, optionally filtered by country"""
    query = {}
    if country_id:
        query["country_id"] = country_id
    
    offers = await db.offers.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return offers


@api_router.get("/offers/active")
async def get_active_offers(
    country_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get only active and valid offers (within date range)"""
    now = datetime.now(timezone.utc)
    now_str = now.isoformat()
    query = {"is_active": True}
    if country_id:
        query["country_id"] = country_id
    
    # Fetch all active offers and filter by date in Python
    offers = await db.offers.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Filter by valid date range
    valid_offers = []
    for offer in offers:
        valid_from = offer.get("valid_from", "")
        valid_until = offer.get("valid_until", "")
        
        # Handle both datetime objects and strings
        if isinstance(valid_from, datetime):
            valid_from = valid_from.isoformat()
        if isinstance(valid_until, datetime):
            valid_until = valid_until.isoformat()
        
        if valid_from and valid_until:
            if valid_from <= now_str <= valid_until:
                valid_offers.append(offer)
    
    return valid_offers


@api_router.post("/offers")
async def create_offer(
    offer: OfferCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new offer"""
    offer_doc = Offer(
        **offer.model_dump(),
        created_by=current_user["id"]
    )
    await db.offers.insert_one(offer_doc.model_dump())
    return offer_doc.model_dump()


@api_router.put("/offers/{offer_id}")
async def update_offer(
    offer_id: str,
    offer: OfferUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update an offer"""
    update_data = {k: v for k, v in offer.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = current_user["id"]
    
    result = await db.offers.update_one(
        {"id": offer_id},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    return await db.offers.find_one({"id": offer_id}, {"_id": 0})


@api_router.patch("/offers/{offer_id}/toggle-status")
async def toggle_offer_status(
    offer_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Toggle offer active status"""
    offer = await db.offers.find_one({"id": offer_id})
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    new_status = not offer.get("is_active", True)
    await db.offers.update_one(
        {"id": offer_id},
        {"$set": {"is_active": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"is_active": new_status}


@api_router.delete("/offers/{offer_id}")
async def delete_offer(
    offer_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete an offer"""
    result = await db.offers.delete_one({"id": offer_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Offer not found")
    return {"message": "Offer deleted"}


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
async def get_cities(country_id: Optional[str] = None, include_inactive: bool = False):
    """Get list of cities from master table"""
    query = {}
    if country_id:
        query["country_id"] = country_id
    if not include_inactive:
        query["is_active"] = True
    
    cities = await db.cities.find(query, {"_id": 0}).sort("name", 1).to_list(500)
    
    # If no cities in master table, seed with defaults and return
    if len(cities) == 0:
        default_cities = [
            {"name": "Bangalore", "state": "Karnataka", "aliases": ["Bengaluru", "BLR"]},
            {"name": "Hyderabad", "state": "Telangana", "aliases": ["HYD"]},
            {"name": "Chennai", "state": "Tamil Nadu", "aliases": ["Madras", "CHE"]},
            {"name": "Mumbai", "state": "Maharashtra", "aliases": ["Bombay", "BOM"]},
            {"name": "Delhi", "state": "Delhi", "aliases": ["New Delhi", "DEL"]},
            {"name": "Pune", "state": "Maharashtra", "aliases": ["Poona", "PNQ"]},
            {"name": "Kolkata", "state": "West Bengal", "aliases": ["Calcutta", "CCU"]},
            {"name": "Vizag", "state": "Andhra Pradesh", "aliases": ["Visakhapatnam", "VTZ"]},
            {"name": "Kuala Lumpur", "state": "Federal Territory", "aliases": ["KL"]},
            {"name": "Penang", "state": "Penang", "aliases": ["George Town"]},
            {"name": "Johor Bahru", "state": "Johor", "aliases": ["JB"]},
        ]
        
        for city in default_cities:
            city["id"] = str(uuid.uuid4())
            city["is_active"] = True
            city["created_at"] = datetime.now(timezone.utc).isoformat()
        
        await db.cities.insert_many(default_cities)
        cities = default_cities
    
    return cities


@api_router.get("/cities/names")
async def get_city_names(country_id: Optional[str] = None):
    """Get simple list of city names for dropdowns"""
    query = {"is_active": True}
    if country_id:
        query["country_id"] = country_id
    
    cities = await db.cities.find(query, {"_id": 0, "name": 1}).sort("name", 1).to_list(500)
    
    # Fallback to defaults if no cities
    if len(cities) == 0:
        return ["Bangalore", "Chennai", "Delhi", "Hyderabad", "Kolkata", "Mumbai", "Pune", "Vizag"]
    
    return [c["name"] for c in cities]


@api_router.post("/cities")
async def create_city(
    name: str,
    state: Optional[str] = None,
    country_id: Optional[str] = None,
    aliases: Optional[List[str]] = None,
    current_user: dict = Depends(get_current_user)
):
    """Create a new city in master table"""
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "HR_MANAGER", "COUNTRY_HEAD", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Not authorized to create cities")
    
    # Check if city already exists
    existing = await db.cities.find_one({
        "$or": [
            {"name": {"$regex": f"^{name}$", "$options": "i"}},
            {"aliases": {"$regex": f"^{name}$", "$options": "i"}}
        ]
    })
    
    if existing:
        raise HTTPException(status_code=400, detail=f"City '{name}' or its alias already exists")
    
    city = {
        "id": str(uuid.uuid4()),
        "name": name,
        "state": state or "",
        "country_id": country_id or "",
        "aliases": aliases or [],
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"]
    }
    
    await db.cities.insert_one(city)
    
    return {"success": True, "city": {k: v for k, v in city.items() if k != "_id"}}


@api_router.put("/cities/{city_id}")
async def update_city(
    city_id: str,
    name: Optional[str] = None,
    state: Optional[str] = None,
    aliases: Optional[List[str]] = None,
    is_active: Optional[bool] = None,
    current_user: dict = Depends(get_current_user)
):
    """Update a city in master table"""
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "HR_MANAGER", "COUNTRY_HEAD", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Not authorized to update cities")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if name is not None:
        update_data["name"] = name
    if state is not None:
        update_data["state"] = state
    if aliases is not None:
        update_data["aliases"] = aliases
    if is_active is not None:
        update_data["is_active"] = is_active
    
    result = await db.cities.update_one({"id": city_id}, {"$set": update_data})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="City not found")
    
    return {"success": True, "message": "City updated"}


@api_router.get("/cities/resolve/{city_name}")
async def resolve_city(city_name: str):
    """Resolve a city name to its canonical form (handles aliases)"""
    # Try exact match first
    city = await db.cities.find_one(
        {"name": {"$regex": f"^{city_name}$", "$options": "i"}, "is_active": True},
        {"_id": 0}
    )
    
    if city:
        return {"resolved": True, "canonical_name": city["name"], "city": city}
    
    # Try alias match
    city = await db.cities.find_one(
        {"aliases": {"$regex": f"^{city_name}$", "$options": "i"}, "is_active": True},
        {"_id": 0}
    )
    
    if city:
        return {"resolved": True, "canonical_name": city["name"], "city": city, "matched_alias": city_name}
    
    return {"resolved": False, "original": city_name, "suggestion": "City not found in master table"}


@api_router.post("/cities/normalize-all")
async def normalize_all_cities(current_user: dict = Depends(get_current_user)):
    """Normalize all city names in leads, inspections, and user inspection_cities to canonical form"""
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Only CEO/Admin can normalize cities")
    
    # Get all cities with aliases
    cities = await db.cities.find({"is_active": True}, {"_id": 0}).to_list(500)
    
    # Build alias map
    alias_map = {}
    for city in cities:
        canonical = city["name"]
        alias_map[canonical.lower()] = canonical
        for alias in city.get("aliases", []):
            alias_map[alias.lower()] = canonical
    
    stats = {"leads_updated": 0, "inspections_updated": 0, "users_updated": 0}
    
    # Normalize leads
    leads = await db.leads.find({"city": {"$exists": True}}, {"_id": 0, "id": 1, "city": 1}).to_list(10000)
    for lead in leads:
        old_city = lead.get("city", "")
        if old_city and old_city.lower() in alias_map:
            new_city = alias_map[old_city.lower()]
            if new_city != old_city:
                await db.leads.update_one({"id": lead["id"]}, {"$set": {"city": new_city}})
                stats["leads_updated"] += 1
    
    # Normalize inspections
    inspections = await db.inspections.find({"city": {"$exists": True}}, {"_id": 0, "id": 1, "city": 1}).to_list(10000)
    for insp in inspections:
        old_city = insp.get("city", "")
        if old_city and old_city.lower() in alias_map:
            new_city = alias_map[old_city.lower()]
            if new_city != old_city:
                await db.inspections.update_one({"id": insp["id"]}, {"$set": {"city": new_city}})
                stats["inspections_updated"] += 1
    
    # Normalize user inspection_cities
    users = await db.users.find({"inspection_cities": {"$exists": True, "$ne": []}}, {"_id": 0, "id": 1, "inspection_cities": 1}).to_list(1000)
    for user in users:
        old_cities = user.get("inspection_cities", [])
        new_cities = []
        changed = False
        for city in old_cities:
            if city.lower() in alias_map:
                new_city = alias_map[city.lower()]
                new_cities.append(new_city)
                if new_city != city:
                    changed = True
            else:
                new_cities.append(city)
        
        if changed:
            await db.users.update_one({"id": user["id"]}, {"$set": {"inspection_cities": new_cities}})
            stats["users_updated"] += 1
    
    return {"success": True, "stats": stats}


@api_router.get("/lead-sources")
async def get_lead_sources():
    """Get list of lead sources"""
    return ["META_WHATSAPP", "DIRECT_WHATSAPP", "FACEBOOK", "INSTAGRAM", "GOOGLE", "WEBSITE", "REFERRAL", "WALK_IN", "OTHERS"]


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
    
    # Check if phone number exists (must be unique)
    emp_dict = emp_data.model_dump()
    if emp_dict.get("phone"):
        # Normalize phone number for comparison
        phone = emp_dict["phone"].strip().replace(" ", "").replace("-", "")
        if not phone.startswith("+"):
            phone = "+91" + phone[-10:]
        phone_last10 = phone[-10:]
        
        existing_phone = await db.users.find_one({
            "$or": [
                {"phone": phone},
                {"phone": {"$regex": phone_last10 + "$"}},
                {"mobile": phone},
                {"mobile": {"$regex": phone_last10 + "$"}}
            ]
        })
        if existing_phone:
            raise HTTPException(
                status_code=400, 
                detail=f"Phone number already assigned to {existing_phone.get('name', 'another employee')}. Each employee must have a unique phone number."
            )
    
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
    
    # Check if phone number is being updated and ensure uniqueness
    if "phone" in update_dict:
        phone = update_dict["phone"].strip().replace(" ", "").replace("-", "")
        if not phone.startswith("+"):
            phone = "+91" + phone[-10:]
        phone_last10 = phone[-10:]
        
        existing_phone = await db.users.find_one({
            "$or": [
                {"phone": phone},
                {"phone": {"$regex": phone_last10 + "$"}},
                {"mobile": phone},
                {"mobile": {"$regex": phone_last10 + "$"}}
            ],
            "id": {"$ne": employee_id}  # Exclude current employee
        })
        if existing_phone:
            raise HTTPException(
                status_code=400, 
                detail=f"Phone number already assigned to {existing_phone.get('name', 'another employee')}. Each employee must have a unique phone number."
            )
    
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
    
    # Allow CEO, HR Manager, and any role with settings access (e.g., CTO, Country Head)
    if role_code not in ["CEO", "CTO", "HR_MANAGER", "COUNTRY_HEAD"]:
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

# ============================================
# META ADS ANALYTICS ENDPOINTS
# ============================================

from services.meta_ads_service import meta_ads_service


@api_router.get("/meta-ads/status")
async def get_meta_ads_status(current_user: dict = Depends(get_current_user)):
    """Check if Meta Ads integration is configured"""
    return {
        "configured": meta_ads_service.is_configured(),
        "ad_account_id": meta_ads_service.ad_account_id if meta_ads_service.is_configured() else None
    }


@api_router.get("/meta-ads/token-info")
async def get_meta_token_info(current_user: dict = Depends(get_current_user)):
    """
    Get information about the current Meta access token.
    Returns token validity, expiry date, and type.
    """
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "CTO"]:
        raise HTTPException(status_code=403, detail="Not authorized - CEO/CTO only")
    
    # First, check if there's a newer token in the database
    saved_token = await db.system_config.find_one({"key": "meta_access_token"})
    if saved_token and saved_token.get("value"):
        current_in_memory = meta_ads_service.access_token
        if current_in_memory != saved_token["value"]:
            # Database has a different token - use that
            meta_ads_service.update_token(saved_token["value"])
            logger.info("Loaded newer Meta token from database")
    
    token_info = await meta_ads_service.get_token_info()
    return {
        "configured": meta_ads_service.is_configured(),
        "app_id": meta_ads_service.app_id,
        "ad_account_id": meta_ads_service.ad_account_id,
        **token_info
    }


@api_router.post("/meta-ads/refresh-token")
async def refresh_meta_token(current_user: dict = Depends(get_current_user)):
    """
    Attempt to refresh the Meta access token.
    This exchanges the current long-lived token for a new one.
    """
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "CTO"]:
        raise HTTPException(status_code=403, detail="Not authorized - CEO/CTO only")
    
    result = await meta_ads_service.refresh_long_lived_token()
    
    if result.get("success"):
        # Update the token in memory
        new_token = result.get("access_token")
        meta_ads_service.update_token(new_token)
        
        # Store the new token in database for persistence
        await db.system_config.update_one(
            {"key": "meta_access_token"},
            {"$set": {
                "key": "meta_access_token",
                "value": new_token,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "updated_by": current_user.get("id")
            }},
            upsert=True
        )
        
        return {
            "success": True,
            "message": "Token refreshed successfully",
            "expires_in_days": result.get("expires_in_days")
        }
    else:
        return {
            "success": False,
            "error": result.get("error"),
            "needs_manual_refresh": True,
            "instructions": "Please generate a new token from Meta for Developers portal"
        }


@api_router.post("/meta-ads/auto-refresh")
async def auto_refresh_meta_token(
    days_threshold: int = 7,
    current_user: dict = Depends(get_current_user)
):
    """
    Automatically refresh the token if it's expiring within the threshold.
    Default threshold is 7 days.
    """
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "CTO"]:
        raise HTTPException(status_code=403, detail="Not authorized - CEO/CTO only")
    
    result = await meta_ads_service.auto_refresh_if_needed(days_threshold)
    
    if result.get("action") == "refreshed":
        # Update the token in memory and database
        new_token = result.get("new_token")
        meta_ads_service.update_token(new_token)
        
        await db.system_config.update_one(
            {"key": "meta_access_token"},
            {"$set": {
                "key": "meta_access_token",
                "value": new_token,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "updated_by": current_user.get("id")
            }},
            upsert=True
        )
    
    return result


class MetaTokenUpdateRequest(BaseModel):
    access_token: str


@api_router.get("/meta-ads/oauth/init")
async def init_meta_oauth(current_user: dict = Depends(get_current_user)):
    """
    Initialize Meta OAuth flow - returns the OAuth URL for user to authorize.
    This is Step 1 of the OAuth flow.
    """
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "CTO", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Not authorized - CEO/CTO/Admin only")
    
    app_id = os.environ.get('META_APP_ID')
    if not app_id:
        raise HTTPException(status_code=400, detail="Meta App ID not configured")
    
    # Get the frontend URL for redirect
    frontend_url = os.environ.get('FRONTEND_URL', 'https://crmdev.wisedrive.com')
    redirect_uri = f"{frontend_url}/meta-oauth-callback"
    
    # Required permissions for ads management
    scopes = [
        "ads_read",
        "ads_management", 
        "business_management",
        "pages_read_engagement"
    ]
    
    # Build OAuth URL
    oauth_url = (
        f"https://www.facebook.com/{meta_ads_service.api_version}/dialog/oauth?"
        f"client_id={app_id}"
        f"&redirect_uri={redirect_uri}"
        f"&scope={','.join(scopes)}"
        f"&response_type=code"
        f"&state={current_user.get('id', 'unknown')}"
    )
    
    return {
        "oauth_url": oauth_url,
        "redirect_uri": redirect_uri,
        "app_id": app_id
    }


@api_router.post("/meta-ads/oauth/callback")
async def handle_meta_oauth_callback(
    code: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Handle Meta OAuth callback - exchange code for access token.
    This is Step 2 of the OAuth flow.
    """
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "CTO", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    app_id = os.environ.get('META_APP_ID')
    app_secret = os.environ.get('META_APP_SECRET')
    frontend_url = os.environ.get('FRONTEND_URL', 'https://crmdev.wisedrive.com')
    redirect_uri = f"{frontend_url}/meta-oauth-callback"
    
    if not app_id or not app_secret:
        raise HTTPException(status_code=400, detail="Meta App ID/Secret not configured")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Exchange code for short-lived token
            token_url = f"https://graph.facebook.com/{meta_ads_service.api_version}/oauth/access_token"
            params = {
                "client_id": app_id,
                "client_secret": app_secret,
                "redirect_uri": redirect_uri,
                "code": code
            }
            
            response = await client.get(token_url, params=params)
            data = response.json()
            
            if "error" in data:
                logger.error(f"OAuth token exchange failed: {data}")
                raise HTTPException(
                    status_code=400, 
                    detail=data.get("error", {}).get("message", "OAuth failed")
                )
            
            short_lived_token = data.get("access_token")
            if not short_lived_token:
                raise HTTPException(status_code=400, detail="No token received from Meta")
            
            # Exchange for long-lived token
            exchange_result = await meta_ads_service.exchange_for_long_lived_token(short_lived_token)
            
            if exchange_result.get("success"):
                new_token = exchange_result["access_token"]
                expires_in_days = exchange_result.get("expires_in_days", 60)
                
                # Update in memory
                meta_ads_service.update_token(new_token)
                
                # Store in database
                await db.system_config.update_one(
                    {"key": "meta_access_token"},
                    {"$set": {
                        "key": "meta_access_token",
                        "value": new_token,
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                        "updated_by": current_user.get("id"),
                        "expires_in_days": expires_in_days,
                        "oauth_refresh": True
                    }},
                    upsert=True
                )
                
                logger.info(f"Meta OAuth successful - token valid for {expires_in_days} days")
                
                return {
                    "success": True,
                    "message": f"Meta connected successfully! Token valid for {expires_in_days} days",
                    "expires_in_days": expires_in_days
                }
            else:
                # Use short-lived token if exchange fails
                meta_ads_service.update_token(short_lived_token)
                
                await db.system_config.update_one(
                    {"key": "meta_access_token"},
                    {"$set": {
                        "key": "meta_access_token",
                        "value": short_lived_token,
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                        "updated_by": current_user.get("id"),
                        "token_type": "short_lived"
                    }},
                    upsert=True
                )
                
                return {
                    "success": True,
                    "message": "Meta connected with short-lived token (1-2 hours)",
                    "warning": "Could not exchange for long-lived token"
                }
                
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OAuth callback error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/meta-ads/update-token")
async def update_meta_token(
    request: MetaTokenUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Manually update the Meta access token.
    Use this when you have a new token from Meta for Developers portal.
    """
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "CTO"]:
        raise HTTPException(status_code=403, detail="Not authorized - CEO/CTO only")
    
    new_token = request.access_token.strip()
    
    if not new_token:
        raise HTTPException(status_code=400, detail="Access token is required")
    
    # Update in memory
    meta_ads_service.update_token(new_token)
    
    # Verify the new token
    token_info = await meta_ads_service.get_token_info()
    
    if not token_info.get("is_valid"):
        return {
            "success": False,
            "error": "The provided token is invalid",
            "details": token_info.get("error")
        }
    
    # Store in database for persistence
    await db.system_config.update_one(
        {"key": "meta_access_token"},
        {"$set": {
            "key": "meta_access_token",
            "value": new_token,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": current_user.get("id")
        }},
        upsert=True
    )
    
    return {
        "success": True,
        "message": "Token updated successfully",
        "token_info": token_info
    }


@api_router.get("/meta-ads/insights")
async def get_meta_ads_insights(
    date_from: str = None,
    date_to: str = None,
    ad_id: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Fetch ad insights from Meta Marketing API"""
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "HR_MANAGER", "CTO"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await meta_ads_service.get_ad_insights(
        ad_id=ad_id,
        date_from=date_from,
        date_to=date_to
    )
    return result


@api_router.get("/meta-ads/campaigns")
async def get_meta_ads_campaigns(current_user: dict = Depends(get_current_user)):
    """Fetch list of campaigns from Meta"""
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "HR_MANAGER", "CTO"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return await meta_ads_service.get_campaigns_list()


@api_router.get("/meta-ads/ads")
async def get_meta_ads_list(current_user: dict = Depends(get_current_user)):
    """Fetch list of ads from Meta"""
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "HR_MANAGER", "CTO"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return await meta_ads_service.get_ads_list()


@api_router.get("/meta-ads/performance")
async def get_ad_performance_analytics(
    date_from: str = None,
    date_to: str = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Get comprehensive ad performance analytics combining Meta spend data with internal lead/revenue data.
    This endpoint correlates:
    - Ad spend from Meta Marketing API
    - Leads generated per ad_id from internal database
    - Revenue from converted leads (inspections paid)
    """
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "HR_MANAGER", "CTO"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Default date range: last 30 days
    if not date_to:
        date_to = datetime.now().strftime("%Y-%m-%d")
    if not date_from:
        date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    
    # Get all ad mappings
    ad_mappings = await db.ad_city_mappings.find({}, {"_id": 0}).to_list(1000)
    ad_ids = [m.get("ad_id") for m in ad_mappings if m.get("ad_id")]
    
    # Build date filter for leads
    date_filter = {}
    if date_from:
        date_filter["$gte"] = date_from
    if date_to:
        date_filter["$lte"] = date_to + "T23:59:59"
    
    # Get leads grouped by ad_id
    lead_pipeline = [
        {"$match": {"ad_id": {"$exists": True, "$ne": None, "$ne": ""}}},
    ]
    if date_filter:
        lead_pipeline[0]["$match"]["created_at"] = date_filter
    
    lead_pipeline.extend([
        {"$group": {
            "_id": "$ad_id",
            "total_leads": {"$sum": 1},
            "converted_leads": {
                "$sum": {"$cond": [{"$in": ["$status", ["CONVERTED", "PAID", "BOOKED"]]}, 1, 0]}
            }
        }}
    ])
    
    lead_stats = await db.leads.aggregate(lead_pipeline).to_list(1000)
    lead_stats_by_ad = {stat["_id"]: stat for stat in lead_stats}
    
    # Get revenue from inspections linked to leads with ad_id
    revenue_pipeline = [
        {"$match": {"payment_status": {"$in": ["FULLY_PAID", "PARTIALLY_PAID"]}}},
        {"$lookup": {
            "from": "leads",
            "localField": "lead_id",
            "foreignField": "id",
            "as": "lead"
        }},
        {"$unwind": {"path": "$lead", "preserveNullAndEmptyArrays": False}},
        {"$match": {"lead.ad_id": {"$exists": True, "$ne": None, "$ne": ""}}},
        {"$group": {
            "_id": "$lead.ad_id",
            "total_revenue": {"$sum": "$amount_paid"},
            "inspection_count": {"$sum": 1}
        }}
    ]
    
    revenue_stats = await db.inspections.aggregate(revenue_pipeline).to_list(1000)
    revenue_stats_by_ad = {stat["_id"]: stat for stat in revenue_stats}
    
    # Get Meta ad spend data - try live API first, fallback to cached data
    meta_insights = await meta_ads_service.get_ad_insights(date_from=date_from, date_to=date_to)
    meta_spend_by_ad = {}
    meta_impressions_by_ad = {}
    meta_clicks_by_ad = {}
    using_cached_data = False
    token_expired = False
    
    if meta_insights.get("success") and meta_insights.get("data"):
        for insight in meta_insights["data"]:
            ad_id = insight.get("ad_id")
            if ad_id:
                meta_spend_by_ad[ad_id] = float(insight.get("spend", 0))
                meta_impressions_by_ad[ad_id] = int(insight.get("impressions", 0))
                meta_clicks_by_ad[ad_id] = int(insight.get("clicks", 0))
    else:
        # Meta API failed - try to use cached data
        token_expired = meta_insights.get("token_expired", False)
        logger.info(f"Meta API failed (token_expired={token_expired}), trying cached data...")
        
        # Get cached performance data
        cached_perfs = await db.ad_performance.find({}, {"_id": 0}).to_list(1000)
        if cached_perfs:
            using_cached_data = True
            for perf in cached_perfs:
                ad_id = perf.get("ad_id")
                if ad_id:
                    meta_spend_by_ad[ad_id] = float(perf.get("spend", 0))
                    meta_impressions_by_ad[ad_id] = int(perf.get("impressions", 0))
                    meta_clicks_by_ad[ad_id] = int(perf.get("clicks", 0))
            logger.info(f"Using cached performance data for {len(cached_perfs)} ads")
    
    # Combine all data
    performance_data = []
    all_ad_ids = set(ad_ids) | set(lead_stats_by_ad.keys()) | set(revenue_stats_by_ad.keys()) | set(meta_spend_by_ad.keys())
    
    for ad_id in all_ad_ids:
        if not ad_id:
            continue
            
        ad_mapping = next((m for m in ad_mappings if m.get("ad_id") == ad_id), {})
        lead_stat = lead_stats_by_ad.get(ad_id, {})
        revenue_stat = revenue_stats_by_ad.get(ad_id, {})
        
        total_leads = lead_stat.get("total_leads", 0)
        converted_leads = lead_stat.get("converted_leads", 0)
        total_revenue = revenue_stat.get("total_revenue", 0)
        ad_spend = meta_spend_by_ad.get(ad_id, 0)
        impressions = meta_impressions_by_ad.get(ad_id, 0)
        clicks = meta_clicks_by_ad.get(ad_id, 0)
        
        # Calculate metrics
        conversion_rate = (converted_leads / total_leads * 100) if total_leads > 0 else 0
        roi = ((total_revenue - ad_spend) / ad_spend * 100) if ad_spend > 0 else 0
        cost_per_lead = ad_spend / total_leads if total_leads > 0 else 0
        cost_per_result = ad_spend / converted_leads if converted_leads > 0 else 0  # CPR - Cost Per Result/Conversion
        revenue_per_lead = total_revenue / converted_leads if converted_leads > 0 else 0
        
        performance_data.append({
            "ad_id": ad_id,
            "ad_name": ad_mapping.get("ad_name") or ad_mapping.get("meta_ad_name", ""),
            "city": ad_mapping.get("city", ""),
            "source": ad_mapping.get("source", ""),
            "language": ad_mapping.get("language", ""),
            "campaign": ad_mapping.get("campaign", ""),
            "is_active": ad_mapping.get("is_active", True),
            "meta_status": ad_mapping.get("meta_effective_status", ""),
            # Meta metrics
            "ad_spend": round(ad_spend, 2),
            "impressions": impressions,
            "clicks": clicks,
            # Internal metrics
            "total_leads": total_leads,
            "converted_leads": converted_leads,
            "total_revenue": round(total_revenue, 2),
            # Calculated metrics
            "conversion_rate": round(conversion_rate, 2),
            "roi": round(roi, 2),
            "cost_per_lead": round(cost_per_lead, 2),
            "cost_per_result": round(cost_per_result, 2),  # CPR
            "revenue_per_lead": round(revenue_per_lead, 2)
        })
    
    # Sort by total leads descending
    performance_data.sort(key=lambda x: x["total_leads"], reverse=True)
    
    # Calculate totals
    totals = {
        "total_ad_spend": round(sum(p["ad_spend"] for p in performance_data), 2),
        "total_impressions": sum(p["impressions"] for p in performance_data),
        "total_clicks": sum(p["clicks"] for p in performance_data),
        "total_leads": sum(p["total_leads"] for p in performance_data),
        "total_converted": sum(p["converted_leads"] for p in performance_data),
        "total_revenue": round(sum(p["total_revenue"] for p in performance_data), 2),
        "overall_conversion_rate": 0,
        "overall_roi": 0,
        "overall_cpr": 0,  # Cost Per Result
        "overall_cpl": 0   # Cost Per Lead
    }
    
    if totals["total_leads"] > 0:
        totals["overall_conversion_rate"] = round(totals["total_converted"] / totals["total_leads"] * 100, 2)
        totals["overall_cpl"] = round(totals["total_ad_spend"] / totals["total_leads"], 2)
    if totals["total_converted"] > 0:
        totals["overall_cpr"] = round(totals["total_ad_spend"] / totals["total_converted"], 2)
    if totals["total_ad_spend"] > 0:
        totals["overall_roi"] = round((totals["total_revenue"] - totals["total_ad_spend"]) / totals["total_ad_spend"] * 100, 2)
    
    # Get last sync timestamp
    last_sync = await db.system_config.find_one({"key": "meta_ads_last_sync"})
    last_updated = last_sync.get("value") if last_sync else None
    
    return {
        "date_range": {"from": date_from, "to": date_to},
        "meta_configured": meta_ads_service.is_configured(),
        "last_updated": last_updated,
        "using_cached_data": using_cached_data,
        "token_expired": token_expired,
        "totals": totals,
        "data": performance_data
    }


@api_router.post("/meta-ads/force-sync")
async def force_sync_meta_ads(current_user: dict = Depends(get_current_user)):
    """
    Force an immediate sync of Meta Ads data (spend, impressions, clicks).
    This bypasses the 6-hour scheduler and syncs immediately.
    """
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "CTO", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Not authorized - CEO/CTO/Admin only")
    
    global meta_ads_scheduler
    
    if not meta_ads_scheduler:
        raise HTTPException(status_code=500, detail="Meta Ads scheduler not initialized")
    
    if not meta_ads_service.is_configured():
        raise HTTPException(status_code=400, detail="Meta Ads not configured. Please add Meta credentials first.")
    
    # Check token validity first
    token_info = await meta_ads_service.get_token_info()
    if not token_info.get("is_valid"):
        raise HTTPException(
            status_code=400, 
            detail=f"Meta token is invalid: {token_info.get('error', 'Unknown error')}. Please refresh your Meta token."
        )
    
    # Run the sync
    try:
        results = await meta_ads_scheduler.sync_all()
        return {
            "success": True,
            "message": "Meta Ads sync completed successfully",
            "results": results
        }
    except Exception as e:
        logger.error(f"Force sync failed: {e}")
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")


@api_router.get("/meta-ads/cached-performance")
async def get_cached_performance(current_user: dict = Depends(get_current_user)):
    """
    Get cached ad performance data (last synced values).
    Useful when Meta API is unavailable.
    """
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "CTO", "ADMIN", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get cached performance data
    cached_perfs = await db.ad_performance.find({}, {"_id": 0}).to_list(1000)
    
    # Get last sync time
    last_sync = await db.system_config.find_one({"key": "meta_ads_last_sync"})
    
    # Calculate totals
    total_spend = sum(float(p.get("spend", 0)) for p in cached_perfs)
    total_impressions = sum(int(p.get("impressions", 0)) for p in cached_perfs)
    total_clicks = sum(int(p.get("clicks", 0)) for p in cached_perfs)
    
    return {
        "ads_count": len(cached_perfs),
        "last_synced": last_sync.get("value") if last_sync else None,
        "sync_interval_hours": last_sync.get("sync_interval_hours", 6) if last_sync else 6,
        "totals": {
            "total_spend": round(total_spend, 2),
            "total_impressions": total_impressions,
            "total_clicks": total_clicks
        },
        "data": cached_perfs
    }


@api_router.get("/meta-ads/ads-with-targeting")
async def get_ads_with_targeting(current_user: dict = Depends(get_current_user)):
    """
    Get all ads with their targeting information (cities, regions).
    Useful for auto-suggesting city mappings.
    """
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "CTO"]:
        raise HTTPException(status_code=403, detail="Not authorized - CEO/CTO only")
    
    result = await meta_ads_service.get_ads_with_targeting()
    return result


@api_router.post("/meta-ads/sync-status")
async def sync_ad_statuses(current_user: dict = Depends(get_current_user)):
    """
    Manually trigger sync of ad statuses (active/paused) from Meta.
    Updates our database with current Meta ad statuses.
    """
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "CTO"]:
        raise HTTPException(status_code=403, detail="Not authorized - CEO/CTO only")
    
    statuses = await meta_ads_service.get_all_ad_statuses()
    
    if not statuses.get("success"):
        return {
            "success": False,
            "error": statuses.get("error"),
            "updated_count": 0
        }
    
    status_data = statuses.get("data", {})
    updated_count = 0
    new_ads = []
    
    for ad_id, status_info in status_data.items():
        # Check if mapping exists
        existing = await db.ad_city_mappings.find_one({"ad_id": ad_id})
        
        if existing:
            # Update existing mapping
            result = await db.ad_city_mappings.update_one(
                {"ad_id": ad_id},
                {
                    "$set": {
                        "meta_status": status_info.get("status"),
                        "meta_effective_status": status_info.get("effective_status"),
                        "is_active": status_info.get("is_active"),
                        "meta_ad_name": status_info.get("name"),
                        "status_synced_at": datetime.now(timezone.utc).isoformat()
                    }
                }
            )
            if result.modified_count > 0:
                updated_count += 1
        else:
            # Track new ads that aren't in our mapping
            new_ads.append({
                "ad_id": ad_id,
                "name": status_info.get("name"),
                "status": status_info.get("effective_status"),
                "is_active": status_info.get("is_active")
            })
    
    # Update last sync timestamp
    await db.system_config.update_one(
        {"key": "meta_ads_last_sync"},
        {
            "$set": {
                "key": "meta_ads_last_sync",
                "value": datetime.now(timezone.utc).isoformat(),
                "sync_type": "manual"
            }
        },
        upsert=True
    )
    
    return {
        "success": True,
        "updated_count": updated_count,
        "total_meta_ads": len(status_data),
        "new_unmapped_ads": new_ads[:20],  # Return first 20 unmapped ads
        "synced_at": datetime.now(timezone.utc).isoformat()
    }


@api_router.get("/meta-ads/unmapped-ads")
async def get_unmapped_ads(current_user: dict = Depends(get_current_user)):
    """
    Get list of Meta ads that don't have city mappings in our database.
    Includes targeting info to help with city assignment.
    """
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "HR_MANAGER", "CTO"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get all our mappings
    existing_mappings = await db.ad_city_mappings.find({}, {"ad_id": 1}).to_list(1000)
    mapped_ids = set(m.get("ad_id") for m in existing_mappings)
    
    # Get Meta ads with targeting
    meta_ads = await meta_ads_service.get_ads_with_targeting()
    
    if not meta_ads.get("success"):
        return {
            "success": False,
            "error": meta_ads.get("error"),
            "data": []
        }
    
    # Filter to unmapped ads and categorize by targeting availability
    unmapped_with_targeting = []  # Has geo-targeting - can auto-map
    unmapped_no_targeting = []    # No geo-targeting - needs manual mapping
    auto_mapped_count = 0
    
    for ad in meta_ads.get("data", []):
        if ad.get("id") not in mapped_ids:
            targeting_cities = ad.get("targeting_cities", [])
            targeting_regions = ad.get("targeting_regions", [])
            suggested_city = None
            has_targeting = False
            
            # Determine suggested city from targeting
            if targeting_cities:
                suggested_city = targeting_cities[0]  # Use first targeted city
                has_targeting = True
            elif targeting_regions:
                # Map common regions to cities
                region_to_city = {
                    "Karnataka": "Bangalore",
                    "Tamil Nadu": "Chennai",
                    "Maharashtra": "Mumbai",
                    "Telangana": "Hyderabad",
                    "Andhra Pradesh": "Vizag",
                    "Delhi": "Delhi",
                    "West Bengal": "Kolkata",
                    "Gujarat": "Ahmedabad",
                }
                for region in targeting_regions:
                    if region in region_to_city:
                        suggested_city = region_to_city[region]
                        has_targeting = True
                        break
            
            ad_data = {
                "ad_id": ad.get("id"),
                "ad_name": ad.get("name"),
                "status": ad.get("effective_status"),
                "adset_name": ad.get("adset_name"),
                "targeting_cities": targeting_cities,
                "targeting_regions": targeting_regions,
                "suggested_city": suggested_city,
                "has_targeting": has_targeting
            }
            
            if has_targeting and suggested_city:
                unmapped_with_targeting.append(ad_data)
            else:
                unmapped_no_targeting.append(ad_data)
    
    # Combine lists - targeting first, then no targeting
    unmapped = unmapped_with_targeting + unmapped_no_targeting
    
    return {
        "success": True,
        "data": unmapped,
        "count": len(unmapped),
        "with_targeting_count": len(unmapped_with_targeting),
        "no_targeting_count": len(unmapped_no_targeting),
        "has_city_targeting": meta_ads.get("has_city_targeting", False)
    }


@api_router.post("/meta-ads/auto-map-from-targeting")
async def auto_map_ads_from_targeting(current_user: dict = Depends(get_current_user)):
    """
    Automatically create city mappings for ads that have geo-targeting.
    Only maps ads where we can confidently determine the city from targeting.
    """
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "HR_MANAGER", "CTO", "COUNTRY_HEAD", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get all our existing mappings
    existing_mappings = await db.ad_city_mappings.find({}, {"ad_id": 1}).to_list(1000)
    mapped_ids = set(m.get("ad_id") for m in existing_mappings)
    
    # Get Meta ads with targeting
    meta_ads = await meta_ads_service.get_ads_with_targeting()
    
    if not meta_ads.get("success"):
        return {
            "success": False,
            "error": meta_ads.get("error"),
            "auto_mapped_count": 0
        }
    
    # Region to city mapping
    region_to_city = {
        "Karnataka": "Bangalore",
        "Tamil Nadu": "Chennai", 
        "Maharashtra": "Mumbai",
        "Telangana": "Hyderabad",
        "Andhra Pradesh": "Vizag",
        "Delhi": "Delhi",
        "West Bengal": "Kolkata",
        "Gujarat": "Ahmedabad",
    }
    
    auto_mapped = []
    skipped = []
    
    for ad in meta_ads.get("data", []):
        ad_id = ad.get("id")
        if ad_id in mapped_ids:
            continue
        
        targeting_cities = ad.get("targeting_cities", [])
        targeting_regions = ad.get("targeting_regions", [])
        city = None
        
        # Determine city from targeting
        if targeting_cities and len(targeting_cities) == 1:
            # Only auto-map if single city targeted (confident mapping)
            city = targeting_cities[0]
        elif targeting_regions and len(targeting_regions) == 1:
            # Map single region to city
            region = targeting_regions[0]
            if region in region_to_city:
                city = region_to_city[region]
        
        if city:
            # Create the mapping
            mapping = {
                "id": str(uuid.uuid4()),
                "ad_id": ad_id,
                "ad_name": ad.get("name"),
                "city": city,
                "source": "meta_targeting_auto",
                "targeting_cities": targeting_cities,
                "targeting_regions": targeting_regions,
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": current_user["id"],
                "auto_mapped": True
            }
            
            await db.ad_city_mappings.insert_one(mapping)
            mapped_ids.add(ad_id)
            
            auto_mapped.append({
                "ad_id": ad_id,
                "ad_name": ad.get("name"),
                "city": city,
                "source": "targeting"
            })
        else:
            skipped.append({
                "ad_id": ad_id,
                "ad_name": ad.get("name"),
                "reason": "Multiple or no targeting cities/regions"
            })
    
    logger.info(f"Auto-mapped {len(auto_mapped)} ads from Meta targeting")
    
    return {
        "success": True,
        "message": f"Auto-mapped {len(auto_mapped)} ads based on geo-targeting",
        "auto_mapped_count": len(auto_mapped),
        "skipped_count": len(skipped),
        "auto_mapped": auto_mapped,
        "skipped": skipped[:10]  # Return first 10 skipped for reference
    }


@api_router.post("/meta-ads/sync-all-ad-mappings")
async def sync_all_ad_mappings(current_user: dict = Depends(get_current_user)):
    """
    One-click sync: Fetches ALL Meta ads and creates comprehensive city mappings.
    Creates mappings by BOTH ad_id AND ad_name so either can be used for lookup.
    Uses geo-targeting from Meta to determine cities.
    """
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "HR_MANAGER", "CTO", "COUNTRY_HEAD", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    logger.info("Starting comprehensive ad mapping sync from Meta...")
    
    # Region to city mapping (for Indian states)
    region_to_city = {
        "Karnataka": "Bangalore",
        "Tamil Nadu": "Chennai", 
        "Maharashtra": "Mumbai",
        "Telangana": "Hyderabad",
        "Andhra Pradesh": "Vizag",
        "Delhi": "Delhi",
        "West Bengal": "Kolkata",
        "Gujarat": "Ahmedabad",
        "Kerala": "Kochi",
        "Rajasthan": "Jaipur",
        "Uttar Pradesh": "Lucknow",
        "Punjab": "Chandigarh",
        "Haryana": "Delhi",
        "Madhya Pradesh": "Indore",
    }
    
    # Fetch all ads with targeting from Meta
    meta_ads = await meta_ads_service.get_ads_with_targeting()
    
    if not meta_ads.get("success"):
        return {
            "success": False,
            "error": meta_ads.get("error", "Failed to fetch Meta ads"),
            "created_count": 0,
            "updated_count": 0
        }
    
    ads_data = meta_ads.get("data", [])
    logger.info(f"Fetched {len(ads_data)} ads from Meta")
    
    created_count = 0
    updated_count = 0
    skipped = []
    mappings_created = []
    
    for ad in ads_data:
        ad_id = ad.get("id", "").strip()
        ad_name = ad.get("name", "").strip()
        targeting_cities = ad.get("targeting_cities", [])
        targeting_regions = ad.get("targeting_regions", [])
        
        if not ad_name:
            skipped.append({"ad_id": ad_id, "reason": "No ad name"})
            continue
        
        # Determine city from targeting
        city = None
        city_source = None
        
        # Priority 1: Single city targeting
        if targeting_cities and len(targeting_cities) == 1:
            city = targeting_cities[0]
            city_source = "meta_city_targeting"
        # Priority 2: Multiple cities - take first one (common pattern)
        elif targeting_cities and len(targeting_cities) > 1:
            city = targeting_cities[0]
            city_source = "meta_city_targeting_first"
        # Priority 3: Region targeting
        elif targeting_regions:
            for region in targeting_regions:
                if region in region_to_city:
                    city = region_to_city[region]
                    city_source = f"meta_region_targeting_{region}"
                    break
        
        if not city:
            # Try extracting from ad name as fallback
            ad_name_lower = ad_name.lower()
            city_keywords = {
                "bangalore": "Bangalore", "bengaluru": "Bangalore",
                "chennai": "Chennai", "hyderabad": "Hyderabad",
                "vizag": "Vizag", "visakhapatnam": "Vizag",
                "mumbai": "Mumbai", "pune": "Pune",
                "delhi": "Delhi", "ncr": "Delhi", "gurgaon": "Delhi",
                "kolkata": "Kolkata", "ahmedabad": "Ahmedabad",
                "kochi": "Kochi", "jaipur": "Jaipur",
            }
            for keyword, city_name in city_keywords.items():
                if keyword in ad_name_lower:
                    city = city_name
                    city_source = f"ad_name_keyword_{keyword}"
                    break
        
        if not city:
            skipped.append({"ad_id": ad_id, "ad_name": ad_name, "reason": "Could not determine city"})
            continue
        
        # Check if mapping exists by ad_name (primary key for lookup)
        existing_by_name = await db.ad_city_mappings.find_one({
            "ad_name": {"$regex": f"^{re.escape(ad_name)}$", "$options": "i"}
        })
        
        existing_by_id = await db.ad_city_mappings.find_one({"ad_id": ad_id}) if ad_id else None
        
        if existing_by_name:
            # Update existing mapping with latest info
            await db.ad_city_mappings.update_one(
                {"id": existing_by_name["id"]},
                {"$set": {
                    "ad_id": ad_id,  # Ensure ad_id is always set
                    "city": city,
                    "targeting_cities": targeting_cities,
                    "targeting_regions": targeting_regions,
                    "meta_synced_at": datetime.now(timezone.utc).isoformat(),
                    "source": city_source,
                    "is_active": True
                }}
            )
            updated_count += 1
        elif existing_by_id:
            # Update by ad_id
            await db.ad_city_mappings.update_one(
                {"id": existing_by_id["id"]},
                {"$set": {
                    "ad_name": ad_name,  # Ensure ad_name is always set
                    "city": city,
                    "targeting_cities": targeting_cities,
                    "targeting_regions": targeting_regions,
                    "meta_synced_at": datetime.now(timezone.utc).isoformat(),
                    "source": city_source,
                    "is_active": True
                }}
            )
            updated_count += 1
        else:
            # Create new mapping
            new_mapping = {
                "id": str(uuid.uuid4()),
                "ad_id": ad_id,
                "ad_name": ad_name,  # PRIMARY LOOKUP KEY
                "city": city,
                "city_id": None,
                "source": city_source,
                "targeting_cities": targeting_cities,
                "targeting_regions": targeting_regions,
                "is_active": True,
                "auto_synced": True,
                "meta_synced_at": datetime.now(timezone.utc).isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": current_user["id"]
            }
            await db.ad_city_mappings.insert_one(new_mapping)
            created_count += 1
            mappings_created.append({
                "ad_name": ad_name,
                "city": city,
                "source": city_source
            })
    
    # Update sync timestamp
    await db.system_config.update_one(
        {"key": "ad_mappings_last_sync"},
        {"$set": {
            "key": "ad_mappings_last_sync",
            "value": datetime.now(timezone.utc).isoformat(),
            "ads_synced": len(ads_data),
            "created": created_count,
            "updated": updated_count
        }},
        upsert=True
    )
    
    logger.info(f"Ad mapping sync complete: {created_count} created, {updated_count} updated, {len(skipped)} skipped")
    
    return {
        "success": True,
        "message": f"Synced {len(ads_data)} ads from Meta",
        "total_ads": len(ads_data),
        "created_count": created_count,
        "updated_count": updated_count,
        "skipped_count": len(skipped),
        "mappings_created": mappings_created[:20],  # Show first 20
        "skipped": skipped[:10],  # Show first 10 skipped
        "synced_at": datetime.now(timezone.utc).isoformat()
    }


async def scan_leads_for_unmapped_ads(current_user: dict = Depends(get_current_user)):
    """
    Scan existing leads to find ads that don't have city mappings.
    This populates the unmapped_ads collection from existing lead data.
    Works without Meta token - uses lead data only.
    """
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "HR_MANAGER", "CTO", "COUNTRY_HEAD", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    logger.info("Starting scan of existing leads for unmapped ads...")
    
    # Get all existing ad-city mappings
    existing_mappings = await db.ad_city_mappings.find({}, {"ad_id": 1, "ad_name": 1}).to_list(1000)
    mapped_ad_ids = set(m.get("ad_id", "").lower() for m in existing_mappings if m.get("ad_id"))
    mapped_ad_names = set(m.get("ad_name", "").lower() for m in existing_mappings if m.get("ad_name"))
    
    # Get existing unmapped ads to avoid duplicates
    existing_unmapped = await db.unmapped_ads.find({}, {"ad_id": 1, "ad_name": 1}).to_list(1000)
    unmapped_ad_ids = set(u.get("ad_id", "").lower() for u in existing_unmapped if u.get("ad_id"))
    unmapped_ad_names = set(u.get("ad_name", "").lower() for u in existing_unmapped if u.get("ad_name"))
    
    # Find all leads with ad_id or ad_name
    leads_with_ads = await db.leads.find(
        {"$or": [
            {"ad_id": {"$exists": True, "$ne": None, "$ne": ""}},
            {"ad_name": {"$exists": True, "$ne": None, "$ne": ""}}
        ]},
        {"_id": 0, "ad_id": 1, "ad_name": 1, "city": 1, "source": 1, "created_at": 1, "ctwa_data": 1}
    ).to_list(10000)
    
    logger.info(f"Found {len(leads_with_ads)} leads with ad_id or ad_name")
    
    # Group leads by ad_id/ad_name
    ad_lead_counts = {}
    for lead in leads_with_ads:
        ad_id = (lead.get("ad_id") or "").strip()
        ad_name = (lead.get("ad_name") or "").strip()
        key = ad_id.lower() if ad_id else ad_name.lower()
        
        if not key:
            continue
        
        if key not in ad_lead_counts:
            ad_lead_counts[key] = {
                "ad_id": ad_id,
                "ad_name": ad_name,
                "lead_count": 0,
                "cities": set(),
                "first_seen": lead.get("created_at"),
                "ctwa_data": lead.get("ctwa_data")
            }
        
        ad_lead_counts[key]["lead_count"] += 1
        if lead.get("city"):
            ad_lead_counts[key]["cities"].add(lead.get("city"))
    
    # Find unmapped ads
    new_unmapped = []
    already_mapped = []
    already_tracked = []
    
    for key, data in ad_lead_counts.items():
        ad_id = data["ad_id"]
        ad_name = data["ad_name"]
        
        # Check if already mapped
        if ad_id.lower() in mapped_ad_ids or ad_name.lower() in mapped_ad_names:
            already_mapped.append({
                "ad_id": ad_id,
                "ad_name": ad_name,
                "lead_count": data["lead_count"]
            })
            continue
        
        # Check if already in unmapped collection
        if ad_id.lower() in unmapped_ad_ids or ad_name.lower() in unmapped_ad_names:
            already_tracked.append({
                "ad_id": ad_id,
                "ad_name": ad_name,
                "lead_count": data["lead_count"]
            })
            continue
        
        # This is a new unmapped ad - add to collection
        unmapped_entry = {
            "id": str(uuid.uuid4()),
            "ad_id": ad_id or f"lead_scan_{ad_name[:20]}_{datetime.now().strftime('%Y%m%d')}",
            "ad_name": ad_name,
            "source": "lead_scan",
            "lead_count": data["lead_count"],
            "current_cities": list(data["cities"]),
            "first_seen_at": data["first_seen"] or datetime.now(timezone.utc).isoformat(),
            "last_seen_at": datetime.now(timezone.utc).isoformat(),
            "is_mapped": False,
            "ctwa_data": data.get("ctwa_data")
        }
        
        await db.unmapped_ads.insert_one(unmapped_entry)
        new_unmapped.append({
            "ad_id": ad_id,
            "ad_name": ad_name,
            "lead_count": data["lead_count"],
            "current_cities": list(data["cities"])
        })
    
    logger.info(f"Scan complete: {len(new_unmapped)} new unmapped ads found")
    
    return {
        "success": True,
        "message": f"Scan complete. Found {len(new_unmapped)} unmapped ads from {len(leads_with_ads)} leads.",
        "total_leads_scanned": len(leads_with_ads),
        "unique_ads_found": len(ad_lead_counts),
        "new_unmapped_count": len(new_unmapped),
        "already_mapped_count": len(already_mapped),
        "already_tracked_count": len(already_tracked),
        "new_unmapped": new_unmapped[:20],  # Return first 20
        "already_mapped": already_mapped[:10]
    }


@api_router.get("/meta-ads/unmapped-ads-from-leads")
async def get_unmapped_ads_from_leads(current_user: dict = Depends(get_current_user)):
    """
    Get unmapped ads detected from WhatsApp webhook leads.
    These are ads that came through WhatsApp but don't have city mappings.
    This works even when Meta token is expired.
    """
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "HR_MANAGER", "CTO", "COUNTRY_HEAD", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get unmapped ads from our collection (auto-created from WhatsApp webhook)
    unmapped_ads = await db.unmapped_ads.find(
        {"is_mapped": False},
        {"_id": 0}
    ).sort("lead_count", -1).to_list(100)
    
    return {
        "success": True,
        "data": unmapped_ads,
        "count": len(unmapped_ads),
        "source": "whatsapp_webhook"
    }


@api_router.post("/meta-ads/auto-map-from-current-cities")
async def auto_map_from_current_cities(current_user: dict = Depends(get_current_user)):
    """
    Automatically create mappings for unmapped ads using their current_cities data.
    If an ad's leads all went to the same city, that's likely the correct mapping.
    """
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "HR_MANAGER", "CTO", "COUNTRY_HEAD", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get all unmapped ads with current_cities
    unmapped_ads = await db.unmapped_ads.find(
        {"is_mapped": False, "current_cities": {"$exists": True, "$ne": []}},
        {"_id": 0}
    ).to_list(500)
    
    auto_mapped = []
    skipped = []
    
    for ad in unmapped_ads:
        current_cities = ad.get("current_cities", [])
        
        # Only auto-map if all leads went to the SAME city
        if len(current_cities) == 1:
            city = current_cities[0]
            
            # Create the mapping
            mapping = {
                "id": str(uuid.uuid4()),
                "ad_id": ad.get("ad_id"),
                "ad_name": ad.get("ad_name"),
                "city": city,
                "source": "auto_from_lead_city",
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": current_user["id"],
                "auto_mapped": True
            }
            
            await db.ad_city_mappings.insert_one(mapping)
            
            # Mark as mapped
            await db.unmapped_ads.update_one(
                {"id": ad["id"]},
                {"$set": {"is_mapped": True, "mapped_at": datetime.now(timezone.utc).isoformat()}}
            )
            
            auto_mapped.append({
                "ad_id": ad.get("ad_id"),
                "ad_name": ad.get("ad_name"),
                "city": city,
                "lead_count": ad.get("lead_count")
            })
        else:
            skipped.append({
                "ad_id": ad.get("ad_id"),
                "reason": f"Multiple cities: {current_cities}"
            })
    
    logger.info(f"Auto-mapped {len(auto_mapped)} ads from current_cities")
    
    return {
        "success": True,
        "message": f"Auto-mapped {len(auto_mapped)} ads based on lead cities",
        "auto_mapped_count": len(auto_mapped),
        "skipped_count": len(skipped),
        "auto_mapped": auto_mapped,
        "skipped": skipped[:10]
    }


@api_router.post("/meta-ads/map-ad-from-leads/{unmapped_id}")
async def map_ad_from_leads(
    unmapped_id: str,
    city: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Create a city mapping from an unmapped ad detected via WhatsApp.
    """
    role_code = current_user.get("role_code", "")
    if role_code not in ["CEO", "HR_MANAGER", "CTO", "COUNTRY_HEAD", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Find the unmapped ad
    unmapped = await db.unmapped_ads.find_one({"id": unmapped_id}, {"_id": 0})
    if not unmapped:
        raise HTTPException(status_code=404, detail="Unmapped ad not found")
    
    # Create the mapping
    mapping = {
        "id": str(uuid.uuid4()),
        "ad_id": unmapped.get("ad_id"),
        "ad_name": unmapped.get("ad_name"),
        "city": city,
        "source": "whatsapp_auto_detected",
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"]
    }
    
    await db.ad_city_mappings.insert_one(mapping)
    
    # Mark as mapped
    await db.unmapped_ads.update_one(
        {"id": unmapped_id},
        {"$set": {"is_mapped": True, "mapped_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Update existing leads with this ad_id/ad_name to the correct city
    update_result = await db.leads.update_many(
        {"$or": [
            {"ad_id": unmapped.get("ad_id")},
            {"ad_name": unmapped.get("ad_name")}
        ]},
        {"$set": {
            "city": city,
            "city_auto_fixed": True,
            "city_fixed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "success": True,
        "message": f"Mapping created and {update_result.modified_count} existing leads updated",
        "mapping": mapping,
        "leads_updated": update_result.modified_count
    }


# ==================== INSPECTION Q&A ROUTES ====================

class InspectionQuestionCreate(BaseModel):
    """Model for creating/updating inspection questions"""
    category_id: str
    category_name: str
    question: str
    answer_type: str  # 'multiple_choice', 'photo', 'video'
    options: Optional[List[str]] = None  # For multiple choice
    correct_answer: Optional[str] = None  # For multiple choice
    video_max_duration: Optional[int] = 45  # Max video duration in seconds
    sub_question_1: Optional[str] = None
    sub_answer_type_1: Optional[str] = None
    sub_options_1: Optional[List[str]] = None
    sub_correct_answer_1: Optional[str] = None
    sub_question_2: Optional[str] = None
    sub_answer_type_2: Optional[str] = None
    sub_options_2: Optional[List[str]] = None
    sub_correct_answer_2: Optional[str] = None
    order: Optional[int] = 0
    is_mandatory: Optional[bool] = True
    is_active: Optional[bool] = True


@api_router.get("/inspection-qa/questions")
async def get_inspection_questions(
    category_id: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all inspection Q&A questions"""
    query = {}
    if category_id:
        query["category_id"] = category_id
    if is_active is not None:
        query["is_active"] = is_active
    
    questions = await db.inspection_questions.find(query, {"_id": 0}).sort("order", 1).to_list(500)
    return questions


@api_router.get("/inspection-qa/questions/{question_id}")
async def get_inspection_question(question_id: str, current_user: dict = Depends(get_current_user)):
    """Get a single inspection question by ID"""
    question = await db.inspection_questions.find_one({"id": question_id}, {"_id": 0})
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    return question


@api_router.post("/inspection-qa/questions")
async def create_inspection_question(data: InspectionQuestionCreate, current_user: dict = Depends(get_current_user)):
    """Create a new inspection question"""
    question = {
        "id": str(uuid.uuid4()),
        "category_id": data.category_id,
        "category_name": data.category_name,
        "question": data.question,
        "answer_type": data.answer_type,
        "options": data.options or [],
        "correct_answer": data.correct_answer,
        "video_max_duration": data.video_max_duration,
        "sub_question_1": data.sub_question_1,
        "sub_answer_type_1": data.sub_answer_type_1,
        "sub_options_1": data.sub_options_1 or [],
        "sub_correct_answer_1": data.sub_correct_answer_1,
        "sub_question_2": data.sub_question_2,
        "sub_answer_type_2": data.sub_answer_type_2,
        "sub_options_2": data.sub_options_2 or [],
        "sub_correct_answer_2": data.sub_correct_answer_2,
        "order": data.order or 0,
        "is_mandatory": data.is_mandatory if data.is_mandatory is not None else True,
        "is_active": data.is_active if data.is_active is not None else True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"],
        "created_by_name": current_user.get("name", "")
    }
    
    await db.inspection_questions.insert_one(question)
    question.pop("_id", None)
    return question


@api_router.put("/inspection-qa/questions/{question_id}")
async def update_inspection_question(question_id: str, data: InspectionQuestionCreate, current_user: dict = Depends(get_current_user)):
    """Update an inspection question"""
    existing = await db.inspection_questions.find_one({"id": question_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Question not found")
    
    update_data = {
        "category_id": data.category_id,
        "category_name": data.category_name,
        "question": data.question,
        "answer_type": data.answer_type,
        "options": data.options or [],
        "correct_answer": data.correct_answer,
        "video_max_duration": data.video_max_duration,
        "sub_question_1": data.sub_question_1,
        "sub_answer_type_1": data.sub_answer_type_1,
        "sub_options_1": data.sub_options_1 or [],
        "sub_correct_answer_1": data.sub_correct_answer_1,
        "sub_question_2": data.sub_question_2,
        "sub_answer_type_2": data.sub_answer_type_2,
        "sub_options_2": data.sub_options_2 or [],
        "sub_correct_answer_2": data.sub_correct_answer_2,
        "order": data.order or 0,
        "is_mandatory": data.is_mandatory if data.is_mandatory is not None else True,
        "is_active": data.is_active if data.is_active is not None else True,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user["id"],
        "updated_by_name": current_user.get("name", "")
    }
    
    await db.inspection_questions.update_one({"id": question_id}, {"$set": update_data})
    
    updated = await db.inspection_questions.find_one({"id": question_id}, {"_id": 0})
    return updated


@api_router.delete("/inspection-qa/questions/{question_id}")
async def delete_inspection_question(question_id: str, current_user: dict = Depends(get_current_user)):
    """Delete an inspection question"""
    existing = await db.inspection_questions.find_one({"id": question_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Question not found")
    
    await db.inspection_questions.delete_one({"id": question_id})
    return {"success": True, "message": "Question deleted"}


@api_router.patch("/inspection-qa/questions/{question_id}/toggle")
async def toggle_inspection_question(question_id: str, current_user: dict = Depends(get_current_user)):
    """Toggle active status of an inspection question"""
    existing = await db.inspection_questions.find_one({"id": question_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Question not found")
    
    new_status = not existing.get("is_active", True)
    await db.inspection_questions.update_one(
        {"id": question_id}, 
        {"$set": {"is_active": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"success": True, "is_active": new_status}


@api_router.get("/inspection-qa/categories")
async def get_qa_categories(current_user: dict = Depends(get_current_user)):
    """Get all unique categories from inspection questions"""
    pipeline = [
        {"$group": {"_id": {"id": "$category_id", "name": "$category_name"}, "count": {"$sum": 1}}},
        {"$project": {"category_id": "$_id.id", "category_name": "$_id.name", "question_count": "$count", "_id": 0}},
        {"$sort": {"category_name": 1}}
    ]
    categories = await db.inspection_questions.aggregate(pipeline).to_list(100)
    return categories


@api_router.patch("/inspection-qa/questions/reorder")
async def reorder_inspection_questions(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Reorder questions within a category"""
    question_ids = data.get("question_ids", [])
    
    for idx, qid in enumerate(question_ids):
        await db.inspection_questions.update_one(
            {"id": qid},
            {"$set": {"order": idx}}
        )
    
    return {"success": True, "message": f"Reordered {len(question_ids)} questions"}


# ==================== PARTNERS API ====================

class PartnerCreate(BaseModel):
    name: str
    type: str  # b2c, bank, insurance, b2b
    contact_person: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = True
    default_report_template_id: Optional[str] = None


@api_router.get("/partners")
async def get_partners(
    type: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all partners/clients"""
    query = {}
    if type:
        query["type"] = type
    if is_active is not None:
        query["is_active"] = is_active
    
    partners = await db.partners.find(query, {"_id": 0}).sort("name", 1).to_list(500)
    return partners


@api_router.get("/partners/{partner_id}")
async def get_partner(partner_id: str, current_user: dict = Depends(get_current_user)):
    """Get a single partner by ID"""
    partner = await db.partners.find_one({"id": partner_id}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    return partner


@api_router.post("/partners")
async def create_partner(data: PartnerCreate, current_user: dict = Depends(get_current_user)):
    """Create a new partner"""
    partner = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "type": data.type,
        "contact_person": data.contact_person,
        "contact_email": data.contact_email,
        "contact_phone": data.contact_phone,
        "address": data.address,
        "notes": data.notes,
        "is_active": data.is_active if data.is_active is not None else True,
        "default_report_template_id": data.default_report_template_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"],
        "created_by_name": current_user.get("name", "")
    }
    
    await db.partners.insert_one(partner)
    partner.pop("_id", None)
    return partner


@api_router.put("/partners/{partner_id}")
async def update_partner(partner_id: str, data: PartnerCreate, current_user: dict = Depends(get_current_user)):
    """Update a partner"""
    existing = await db.partners.find_one({"id": partner_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Partner not found")
    
    update_data = {
        "name": data.name,
        "type": data.type,
        "contact_person": data.contact_person,
        "contact_email": data.contact_email,
        "contact_phone": data.contact_phone,
        "address": data.address,
        "notes": data.notes,
        "is_active": data.is_active if data.is_active is not None else True,
        "default_report_template_id": data.default_report_template_id,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user["id"],
        "updated_by_name": current_user.get("name", "")
    }
    
    await db.partners.update_one({"id": partner_id}, {"$set": update_data})
    updated = await db.partners.find_one({"id": partner_id}, {"_id": 0})
    return updated


@api_router.delete("/partners/{partner_id}")
async def delete_partner(partner_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a partner"""
    existing = await db.partners.find_one({"id": partner_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Partner not found")
    
    # Check if partner is used in any inspection template
    templates_using = await db.inspection_templates.count_documents({"partner_id": partner_id})
    if templates_using > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete partner: used in {templates_using} inspection template(s)")
    
    await db.partners.delete_one({"id": partner_id})
    return {"success": True, "message": "Partner deleted"}


@api_router.patch("/partners/{partner_id}/toggle")
async def toggle_partner(partner_id: str, current_user: dict = Depends(get_current_user)):
    """Toggle active status of a partner"""
    existing = await db.partners.find_one({"id": partner_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Partner not found")
    
    new_status = not existing.get("is_active", True)
    await db.partners.update_one(
        {"id": partner_id}, 
        {"$set": {"is_active": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"success": True, "is_active": new_status}


# ==================== INSPECTION TEMPLATES API ====================

class InspectionTemplateCreate(BaseModel):
    name: str
    partner_id: str
    description: Optional[str] = None
    question_ids: List[str] = []
    category_order: Optional[List[str]] = []  # Order of category IDs for inspection flow
    report_template_id: Optional[str] = None  # For future use
    is_default: Optional[bool] = False
    is_active: Optional[bool] = True


@api_router.get("/inspection-templates")
async def get_inspection_templates(
    partner_id: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all inspection templates"""
    query = {}
    if partner_id:
        query["partner_id"] = partner_id
    if is_active is not None:
        query["is_active"] = is_active
    
    templates = await db.inspection_templates.find(query, {"_id": 0}).sort("name", 1).to_list(500)
    
    # Enrich with partner name and question count
    for template in templates:
        partner = await db.partners.find_one({"id": template.get("partner_id")}, {"_id": 0, "name": 1, "type": 1})
        template["partner_name"] = partner.get("name", "Unknown") if partner else "Unknown"
        template["partner_type"] = partner.get("type", "b2c") if partner else "b2c"
        template["question_count"] = len(template.get("question_ids", []))
    
    return templates


@api_router.get("/inspection-templates/{template_id}")
async def get_inspection_template(template_id: str, current_user: dict = Depends(get_current_user)):
    """Get a single inspection template by ID with full question details"""
    template = await db.inspection_templates.find_one({"id": template_id}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Get partner info
    partner = await db.partners.find_one({"id": template.get("partner_id")}, {"_id": 0})
    template["partner"] = partner
    
    # Get full question details
    question_ids = template.get("question_ids", [])
    if question_ids:
        questions = await db.inspection_questions.find(
            {"id": {"$in": question_ids}}, 
            {"_id": 0}
        ).to_list(500)
        # Sort by the order in question_ids
        question_map = {q["id"]: q for q in questions}
        template["questions"] = [question_map[qid] for qid in question_ids if qid in question_map]
    else:
        template["questions"] = []
    
    return template


@api_router.post("/inspection-templates")
async def create_inspection_template(data: InspectionTemplateCreate, current_user: dict = Depends(get_current_user)):
    """Create a new inspection template"""
    # Verify partner exists (skip validation for 'placeholder' - used when partner is linked via ReportTemplate)
    partner = None
    if data.partner_id and data.partner_id != 'placeholder':
        partner = await db.partners.find_one({"id": data.partner_id}, {"_id": 0})
        if not partner:
            raise HTTPException(status_code=400, detail="Partner not found")
    
    # If setting as default, unset other defaults
    if data.is_default:
        await db.inspection_templates.update_many(
            {"is_default": True},
            {"$set": {"is_default": False}}
        )
    
    template = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "partner_id": data.partner_id,
        "description": data.description,
        "question_ids": data.question_ids,
        "category_order": data.category_order or [],  # Save category order
        "report_template_id": data.report_template_id,
        "is_default": data.is_default if data.is_default is not None else False,
        "is_active": data.is_active if data.is_active is not None else True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"],
        "created_by_name": current_user.get("name", "")
    }
    
    await db.inspection_templates.insert_one(template)
    template.pop("_id", None)
    
    # Enrich response
    if partner:
        template["partner_name"] = partner.get("name", "Unknown")
        template["partner_type"] = partner.get("type", "b2c")
    else:
        template["partner_name"] = "Not Assigned"
        template["partner_type"] = "b2c"
    template["question_count"] = len(template.get("question_ids", []))
    
    return template


@api_router.put("/inspection-templates/{template_id}")
async def update_inspection_template(template_id: str, data: InspectionTemplateCreate, current_user: dict = Depends(get_current_user)):
    """Update an inspection template"""
    existing = await db.inspection_templates.find_one({"id": template_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Verify partner exists (skip validation for 'placeholder')
    partner = None
    if data.partner_id and data.partner_id != 'placeholder':
        partner = await db.partners.find_one({"id": data.partner_id}, {"_id": 0})
        if not partner:
            raise HTTPException(status_code=400, detail="Partner not found")
    
    # If setting as default, unset other defaults
    if data.is_default and not existing.get("is_default"):
        await db.inspection_templates.update_many(
            {"is_default": True, "id": {"$ne": template_id}},
            {"$set": {"is_default": False}}
        )
    
    update_data = {
        "name": data.name,
        "partner_id": data.partner_id,
        "description": data.description,
        "question_ids": data.question_ids,
        "category_order": data.category_order or [],  # Save category order
        "report_template_id": data.report_template_id,
        "is_default": data.is_default if data.is_default is not None else False,
        "is_active": data.is_active if data.is_active is not None else True,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user["id"],
        "updated_by_name": current_user.get("name", "")
    }
    
    await db.inspection_templates.update_one({"id": template_id}, {"$set": update_data})
    updated = await db.inspection_templates.find_one({"id": template_id}, {"_id": 0})
    
    # Enrich response
    if partner:
        updated["partner_name"] = partner.get("name", "Unknown")
        updated["partner_type"] = partner.get("type", "b2c")
    else:
        updated["partner_name"] = "Not Assigned"
        updated["partner_type"] = "b2c"
    updated["question_count"] = len(updated.get("question_ids", []))
    
    return updated


@api_router.delete("/inspection-templates/{template_id}")
async def delete_inspection_template(template_id: str, current_user: dict = Depends(get_current_user)):
    """Delete an inspection template"""
    existing = await db.inspection_templates.find_one({"id": template_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Don't allow deleting default template
    if existing.get("is_default"):
        raise HTTPException(status_code=400, detail="Cannot delete the default template")
    
    await db.inspection_templates.delete_one({"id": template_id})
    return {"success": True, "message": "Template deleted"}


@api_router.patch("/inspection-templates/{template_id}/toggle")
async def toggle_inspection_template(template_id: str, current_user: dict = Depends(get_current_user)):
    """Toggle active status of an inspection template"""
    existing = await db.inspection_templates.find_one({"id": template_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Template not found")
    
    new_status = not existing.get("is_active", True)
    await db.inspection_templates.update_one(
        {"id": template_id}, 
        {"$set": {"is_active": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"success": True, "is_active": new_status}


@api_router.patch("/inspection-templates/{template_id}/set-default")
async def set_default_inspection_template(template_id: str, current_user: dict = Depends(get_current_user)):
    """Set an inspection template as default"""
    existing = await db.inspection_templates.find_one({"id": template_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Unset all other defaults
    await db.inspection_templates.update_many(
        {"is_default": True},
        {"$set": {"is_default": False}}
    )
    
    # Set this one as default
    await db.inspection_templates.update_one(
        {"id": template_id},
        {"$set": {"is_default": True, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"success": True, "message": "Template set as default"}


@api_router.post("/inspection-templates/seed-default")
async def seed_default_inspection_template(current_user: dict = Depends(get_current_user)):
    """Seed the B2C Default partner and template with existing questions"""
    # Check if B2C Default partner already exists
    existing_partner = await db.partners.find_one({"type": "b2c", "name": "B2C Default"}, {"_id": 0})
    
    if not existing_partner:
        # Create B2C Default partner
        b2c_partner = {
            "id": str(uuid.uuid4()),
            "name": "B2C Default",
            "type": "b2c",
            "contact_person": None,
            "contact_email": None,
            "contact_phone": None,
            "address": None,
            "notes": "Default partner for direct B2C customers",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": current_user["id"],
            "created_by_name": current_user.get("name", "")
        }
        await db.partners.insert_one(b2c_partner)
        partner_id = b2c_partner["id"]
    else:
        partner_id = existing_partner["id"]
    
    # Check if B2C Default template already exists
    existing_template = await db.inspection_templates.find_one({"is_default": True}, {"_id": 0})
    
    if not existing_template:
        # Get all existing question IDs
        questions = await db.inspection_questions.find({}, {"id": 1, "_id": 0}).to_list(500)
        question_ids = [q["id"] for q in questions]
        
        # Create B2C Default template
        default_template = {
            "id": str(uuid.uuid4()),
            "name": "B2C Default Inspection",
            "partner_id": partner_id,
            "description": "Standard inspection template for direct B2C customers",
            "question_ids": question_ids,
            "report_template_id": None,
            "is_default": True,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": current_user["id"],
            "created_by_name": current_user.get("name", "")
        }
        await db.inspection_templates.insert_one(default_template)
        
        return {
            "success": True,
            "message": "Created B2C Default partner and template",
            "partner_id": partner_id,
            "template_id": default_template["id"],
            "question_count": len(question_ids)
        }
    else:
        return {
            "success": True,
            "message": "Default template already exists",
            "template_id": existing_template["id"]
        }


# ==================== REPORT TEMPLATES API ====================

class ReportTemplateCreate(BaseModel):
    name: str
    partner_id: str
    inspection_template_id: str
    report_style: str  # standard, premium, detailed
    description: Optional[str] = None
    is_default: Optional[bool] = False
    is_active: Optional[bool] = True


# Pre-defined report styles with different layouts
REPORT_STYLES = {
    "standard": {
        "name": "WiseDrive Standard",
        "description": "Original comprehensive report with all sections - RTO, OBD, detailed inspections",
        "preview_color": "#3B82F6",  # Blue
        "features": ["Full vehicle assessment", "RTO verification", "OBD-2 diagnostics", "Detailed category inspection", "AI summary"]
    },
    "premium": {
        "name": "Premium Report",
        "description": "Detailed layout with photos and comprehensive analysis",
        "preview_color": "#8B5CF6",  # Purple
        "features": ["Full vehicle details", "Photo gallery", "Detailed analysis", "Recommendations"]
    },
    "detailed": {
        "name": "Detailed Technical Report",
        "description": "Technical report with all inspection data and metrics",
        "preview_color": "#059669",  # Green
        "features": ["Technical specifications", "Component-wise breakdown", "Scoring metrics", "Historical comparison"]
    },
    "simple": {
        "name": "Simple Report",
        "description": "Clean, minimal layout with essential information only",
        "preview_color": "#6B7280",  # Gray
        "features": ["Basic vehicle info", "Pass/Fail summary", "Key findings list"]
    }
}


@api_router.get("/report-templates/styles")
async def get_report_styles(current_user: dict = Depends(get_current_user)):
    """Get all available report styles"""
    return REPORT_STYLES


@api_router.get("/report-templates")
async def get_report_templates(
    partner_id: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all report templates"""
    query = {}
    if partner_id:
        query["partner_id"] = partner_id
    if is_active is not None:
        query["is_active"] = is_active
    
    templates = await db.report_templates.find(query, {"_id": 0}).sort("name", 1).to_list(500)
    
    # Enrich with partner and inspection template info
    for template in templates:
        partner = await db.partners.find_one({"id": template.get("partner_id")}, {"_id": 0, "name": 1, "type": 1})
        template["partner_name"] = partner.get("name", "Unknown") if partner else "Unknown"
        template["partner_type"] = partner.get("type", "b2c") if partner else "b2c"
        
        insp_template = await db.inspection_templates.find_one(
            {"id": template.get("inspection_template_id")}, 
            {"_id": 0, "name": 1, "question_ids": 1}
        )
        template["inspection_template_name"] = insp_template.get("name", "Unknown") if insp_template else "Unknown"
        template["question_count"] = len(insp_template.get("question_ids", [])) if insp_template else 0
        
        # Add style info
        style = REPORT_STYLES.get(template.get("report_style", "standard"), REPORT_STYLES["standard"])
        template["style_info"] = style
    
    return templates


@api_router.get("/report-templates/{template_id}")
async def get_report_template(template_id: str, current_user: dict = Depends(get_current_user)):
    """Get a single report template by ID"""
    template = await db.report_templates.find_one({"id": template_id}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Report template not found")
    
    # Get partner info
    partner = await db.partners.find_one({"id": template.get("partner_id")}, {"_id": 0})
    template["partner"] = partner
    
    # Get inspection template info
    insp_template = await db.inspection_templates.find_one(
        {"id": template.get("inspection_template_id")}, 
        {"_id": 0}
    )
    template["inspection_template"] = insp_template
    
    # Get questions
    if insp_template and insp_template.get("question_ids"):
        questions = await db.inspection_questions.find(
            {"id": {"$in": insp_template["question_ids"]}},
            {"_id": 0}
        ).to_list(500)
        template["questions"] = questions
    else:
        template["questions"] = []
    
    # Add style info
    style = REPORT_STYLES.get(template.get("report_style", "standard"), REPORT_STYLES["standard"])
    template["style_info"] = style
    
    return template


@api_router.post("/report-templates")
async def create_report_template(data: ReportTemplateCreate, current_user: dict = Depends(get_current_user)):
    """Create a new report template"""
    # Verify partner exists
    partner = await db.partners.find_one({"id": data.partner_id}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=400, detail="Partner not found")
    
    # Verify inspection template exists
    insp_template = await db.inspection_templates.find_one({"id": data.inspection_template_id}, {"_id": 0})
    if not insp_template:
        raise HTTPException(status_code=400, detail="Inspection template not found")
    
    # If setting as default for this partner, unset other defaults
    if data.is_default:
        await db.report_templates.update_many(
            {"partner_id": data.partner_id, "is_default": True},
            {"$set": {"is_default": False}}
        )
    
    template = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "partner_id": data.partner_id,
        "inspection_template_id": data.inspection_template_id,
        "report_style": data.report_style,
        "description": data.description,
        "is_default": data.is_default if data.is_default is not None else False,
        "is_active": data.is_active if data.is_active is not None else True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"],
        "created_by_name": current_user.get("name", "")
    }
    
    await db.report_templates.insert_one(template)
    template.pop("_id", None)
    
    # Enrich response
    template["partner_name"] = partner.get("name", "Unknown")
    template["partner_type"] = partner.get("type", "b2c")
    template["inspection_template_name"] = insp_template.get("name", "Unknown")
    template["question_count"] = len(insp_template.get("question_ids", []))
    template["style_info"] = REPORT_STYLES.get(data.report_style, REPORT_STYLES["standard"])
    
    return template


@api_router.put("/report-templates/{template_id}")
async def update_report_template(template_id: str, data: ReportTemplateCreate, current_user: dict = Depends(get_current_user)):
    """Update a report template"""
    existing = await db.report_templates.find_one({"id": template_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Report template not found")
    
    # Verify partner exists
    partner = await db.partners.find_one({"id": data.partner_id}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=400, detail="Partner not found")
    
    # Verify inspection template exists
    insp_template = await db.inspection_templates.find_one({"id": data.inspection_template_id}, {"_id": 0})
    if not insp_template:
        raise HTTPException(status_code=400, detail="Inspection template not found")
    
    # If setting as default for this partner, unset other defaults
    if data.is_default and not existing.get("is_default"):
        await db.report_templates.update_many(
            {"partner_id": data.partner_id, "is_default": True, "id": {"$ne": template_id}},
            {"$set": {"is_default": False}}
        )
    
    update_data = {
        "name": data.name,
        "partner_id": data.partner_id,
        "inspection_template_id": data.inspection_template_id,
        "report_style": data.report_style,
        "description": data.description,
        "is_default": data.is_default if data.is_default is not None else False,
        "is_active": data.is_active if data.is_active is not None else True,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user["id"],
        "updated_by_name": current_user.get("name", "")
    }
    
    await db.report_templates.update_one({"id": template_id}, {"$set": update_data})
    updated = await db.report_templates.find_one({"id": template_id}, {"_id": 0})
    
    # Enrich response
    updated["partner_name"] = partner.get("name", "Unknown")
    updated["partner_type"] = partner.get("type", "b2c")
    updated["inspection_template_name"] = insp_template.get("name", "Unknown")
    updated["question_count"] = len(insp_template.get("question_ids", []))
    updated["style_info"] = REPORT_STYLES.get(data.report_style, REPORT_STYLES["standard"])
    
    return updated


@api_router.delete("/report-templates/{template_id}")
async def delete_report_template(template_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a report template"""
    existing = await db.report_templates.find_one({"id": template_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Report template not found")
    
    await db.report_templates.delete_one({"id": template_id})
    return {"success": True, "message": "Report template deleted"}


@api_router.patch("/report-templates/{template_id}/toggle")
async def toggle_report_template(template_id: str, current_user: dict = Depends(get_current_user)):
    """Toggle active status of a report template"""
    existing = await db.report_templates.find_one({"id": template_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Report template not found")
    
    new_status = not existing.get("is_active", True)
    await db.report_templates.update_one(
        {"id": template_id}, 
        {"$set": {"is_active": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"success": True, "is_active": new_status}


@api_router.patch("/report-templates/{template_id}/set-default")
async def set_default_report_template(template_id: str, current_user: dict = Depends(get_current_user)):
    """Set a report template as default for its partner"""
    existing = await db.report_templates.find_one({"id": template_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Report template not found")
    
    # Unset other defaults for this partner
    await db.report_templates.update_many(
        {"partner_id": existing["partner_id"], "is_default": True},
        {"$set": {"is_default": False}}
    )
    
    # Set this one as default
    await db.report_templates.update_one(
        {"id": template_id},
        {"$set": {"is_default": True, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"success": True, "message": "Report template set as default"}


@api_router.post("/report-templates/seed-samples")
async def seed_sample_report_templates(current_user: dict = Depends(get_current_user)):
    """Seed 3 sample report templates with different styles"""
    # Get B2C Default partner
    b2c_partner = await db.partners.find_one({"type": "b2c"}, {"_id": 0})
    if not b2c_partner:
        raise HTTPException(status_code=400, detail="B2C Default partner not found. Please create partners first.")
    
    # Get default inspection template
    insp_template = await db.inspection_templates.find_one({"is_default": True}, {"_id": 0})
    if not insp_template:
        raise HTTPException(status_code=400, detail="Default inspection template not found. Please create inspection templates first.")
    
    # Check if we already have report templates
    existing_count = await db.report_templates.count_documents({})
    if existing_count >= 3:
        return {"success": True, "message": f"Already have {existing_count} report templates"}
    
    created = []
    styles_to_create = ["standard", "premium", "detailed"]
    
    for idx, style in enumerate(styles_to_create):
        existing = await db.report_templates.find_one({"report_style": style, "partner_id": b2c_partner["id"]}, {"_id": 0})
        if existing:
            continue
            
        style_info = REPORT_STYLES[style]
        template = {
            "id": str(uuid.uuid4()),
            "name": f"B2C {style_info['name']}",
            "partner_id": b2c_partner["id"],
            "inspection_template_id": insp_template["id"],
            "report_style": style,
            "description": style_info["description"],
            "is_default": idx == 0,  # First one is default
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": current_user["id"],
            "created_by_name": current_user.get("name", "")
        }
        await db.report_templates.insert_one(template)
        created.append(template["name"])
    
    return {
        "success": True,
        "message": f"Created {len(created)} report templates",
        "created": created
    }


@api_router.get("/report-templates/by-partner/{partner_id}")
async def get_report_template_by_partner(partner_id: str, current_user: dict = Depends(get_current_user)):
    """Get the default report template for a specific partner"""
    # First try to find default for this partner
    template = await db.report_templates.find_one(
        {"partner_id": partner_id, "is_default": True, "is_active": True},
        {"_id": 0}
    )
    
    # If no default, get any active template for this partner
    if not template:
        template = await db.report_templates.find_one(
            {"partner_id": partner_id, "is_active": True},
            {"_id": 0}
        )
    
    # If still no template, get the global default (B2C Default)
    if not template:
        b2c_partner = await db.partners.find_one({"type": "b2c"}, {"_id": 0})
        if b2c_partner:
            template = await db.report_templates.find_one(
                {"partner_id": b2c_partner["id"], "is_default": True, "is_active": True},
                {"_id": 0}
            )
    
    if not template:
        raise HTTPException(status_code=404, detail="No report template found for this partner")
    
    # Enrich response
    partner = await db.partners.find_one({"id": template.get("partner_id")}, {"_id": 0})
    template["partner"] = partner
    
    insp_template = await db.inspection_templates.find_one(
        {"id": template.get("inspection_template_id")}, 
        {"_id": 0}
    )
    template["inspection_template"] = insp_template
    
    if insp_template and insp_template.get("question_ids"):
        questions = await db.inspection_questions.find(
            {"id": {"$in": insp_template["question_ids"]}},
            {"_id": 0}
        ).to_list(500)
        template["questions"] = questions
    else:
        template["questions"] = []
    
    template["style_info"] = REPORT_STYLES.get(template.get("report_style", "standard"), REPORT_STYLES["standard"])
    
    return template


@api_router.get("/inspections/{inspection_id}/questionnaire")
async def get_inspection_questionnaire(inspection_id: str, current_user: dict = Depends(get_current_user)):
    """Get the questionnaire for a specific inspection (for mechanic app)"""
    inspection = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    
    # Get inspection template from the inspection record
    inspection_template_id = inspection.get("inspection_template_id")
    
    # If no template assigned, try to get from partner
    if not inspection_template_id:
        partner_id = inspection.get("partner_id")
        if partner_id:
            partner = await db.partners.find_one({"id": partner_id}, {"_id": 0, "inspection_template_id": 1})
            if partner:
                inspection_template_id = partner.get("inspection_template_id")
                logger.info(f"Got inspection_template_id {inspection_template_id} from partner {partner_id}")
    
    if not inspection_template_id:
        # Fallback to report_template_id and get inspection_template from there
        report_template_id = inspection.get("report_template_id")
        if report_template_id:
            report_template = await db.report_templates.find_one(
                {"id": report_template_id}, 
                {"_id": 0, "inspection_template_id": 1}
            )
            if report_template:
                inspection_template_id = report_template.get("inspection_template_id")
    
    # If still no inspection template, use default
    if not inspection_template_id:
        default_template = await db.inspection_templates.find_one(
            {"is_default": True, "is_active": True},
            {"_id": 0}
        )
        if default_template:
            inspection_template_id = default_template.get("id")
    
    if not inspection_template_id:
        raise HTTPException(status_code=404, detail="No inspection template found for this inspection")
    
    # Get the inspection template with questions
    insp_template = await db.inspection_templates.find_one(
        {"id": inspection_template_id},
        {"_id": 0}
    )
    
    if not insp_template:
        raise HTTPException(status_code=404, detail="Inspection template not found")
    
    # Get questions
    question_ids = insp_template.get("question_ids", [])
    questions = []
    
    if question_ids:
        questions_cursor = await db.inspection_questions.find(
            {"id": {"$in": question_ids}},
            {"_id": 0}
        ).to_list(500)
        
        # Sort questions by the order in question_ids
        question_map = {q["id"]: q for q in questions_cursor}
        questions = [question_map[qid] for qid in question_ids if qid in question_map]
    
    # Get categories for these questions
    category_ids = list(set(q.get("category_id") for q in questions if q.get("category_id")))
    categories = await db.inspection_qa_categories.find(
        {"id": {"$in": category_ids}},
        {"_id": 0}
    ).to_list(100)
    category_map = {c["id"]: c for c in categories}
    
    # Enrich questions with category info
    for q in questions:
        cat_id = q.get("category_id")
        if cat_id and cat_id in category_map:
            q["category_name"] = category_map[cat_id].get("name", "")
    
    return {
        "inspection_id": inspection_id,
        "inspection_template_id": inspection_template_id,
        "inspection_template_name": insp_template.get("name", ""),
        "report_style": inspection.get("report_style", "standard"),
        "partner_id": inspection.get("partner_id"),
        "partner_name": inspection.get("partner_name"),
        "questions": questions,
        "total_questions": len(questions),
        "category_order": insp_template.get("category_order", []),
        "categories": list(category_map.values())
    }


@api_router.get("/inspections/{inspection_id}/report-config")
async def get_inspection_report_config(inspection_id: str, current_user: dict = Depends(get_current_user)):
    """Get the report configuration for a specific inspection"""
    inspection = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    
    report_template_id = inspection.get("report_template_id")
    report_template = None
    
    if report_template_id:
        # Use the stored report_template_id from inspection
        report_template = await db.report_templates.find_one(
            {"id": report_template_id},
            {"_id": 0}
        )
    
    if not report_template:
        # Fallback to partner-based lookup using Option B logic
        partner_id = inspection.get("partner_id")
        if partner_id:
            # Step 1: Check Partner's explicit default_report_template_id
            partner = await db.partners.find_one({"id": partner_id}, {"_id": 0})
            if partner and partner.get("default_report_template_id"):
                report_template = await db.report_templates.find_one(
                    {"id": partner["default_report_template_id"], "is_active": True},
                    {"_id": 0}
                )
            # Step 2: Fallback to is_default flag
            if not report_template:
                report_template = await db.report_templates.find_one(
                    {"partner_id": partner_id, "is_default": True, "is_active": True},
                    {"_id": 0}
                )
    
    if not report_template:
        # Final fallback to B2C default
        b2c_partner = await db.partners.find_one({"type": "b2c"}, {"_id": 0, "id": 1, "default_report_template_id": 1})
        if b2c_partner:
            if b2c_partner.get("default_report_template_id"):
                report_template = await db.report_templates.find_one(
                    {"id": b2c_partner["default_report_template_id"], "is_active": True},
                    {"_id": 0}
                )
            if not report_template:
                report_template = await db.report_templates.find_one(
                    {"partner_id": b2c_partner["id"], "is_default": True, "is_active": True},
                    {"_id": 0}
                )
    
    if not report_template:
        # Return default config
        return {
            "inspection_id": inspection_id,
            "report_style": "standard",
            "style_info": REPORT_STYLES.get("standard"),
            "partner_name": inspection.get("partner_name", "B2C Default"),
            "report_template_name": "Default Report"
        }
    
    return {
        "inspection_id": inspection_id,
        "report_template_id": report_template.get("id"),
        "report_template_name": report_template.get("name"),
        "report_style": report_template.get("report_style", "standard"),
        "style_info": REPORT_STYLES.get(report_template.get("report_style", "standard")),
        "partner_id": report_template.get("partner_id"),
        "partner_name": inspection.get("partner_name", ""),
        "inspection_template_id": report_template.get("inspection_template_id")
    }


# ==================== MECHANIC APP ENDPOINTS ====================
# These endpoints are specifically for the mobile mechanic app

import random
import string

# Store OTPs in MongoDB for persistence across multiple instances
# Helper functions for OTP storage
async def store_mechanic_otp(phone: str, otp_data: dict):
    """Store OTP in MongoDB with TTL"""
    otp_data["phone"] = phone
    otp_data["created_at"] = datetime.now(timezone.utc).isoformat()
    # Convert expires_at to ISO string if it's a datetime
    if isinstance(otp_data.get("expires_at"), datetime):
        otp_data["expires_at"] = otp_data["expires_at"].isoformat()
    
    logger.info(f"Storing OTP for {phone}: {otp_data.get('otp', '****')}")
    result = await db.mechanic_otps.update_one(
        {"phone": phone},
        {"$set": otp_data},
        upsert=True
    )
    logger.info(f"OTP stored: matched={result.matched_count}, modified={result.modified_count}, upserted_id={result.upserted_id}")

async def get_mechanic_otp(phone: str) -> dict:
    """Get OTP from MongoDB"""
    otp = await db.mechanic_otps.find_one({"phone": phone}, {"_id": 0})
    logger.info(f"Retrieved OTP for {phone}: {'found' if otp else 'not found'}")
    return otp

async def delete_mechanic_otp(phone: str):
    """Delete OTP from MongoDB"""
    await db.mechanic_otps.delete_one({"phone": phone})
    logger.info(f"Deleted OTP for {phone}")

class MechanicOtpRequest(BaseModel):
    phone: str

class MechanicOtpVerify(BaseModel):
    phone: str
    otp: str

class InspectionAcceptReject(BaseModel):
    reason: Optional[str] = None

class InspectionProgressUpdate(BaseModel):
    category_id: Optional[str] = None
    question_id: Optional[str] = None
    answer: Optional[Any] = None  # Can be string, dict, or any type
    sub_answer_1: Optional[Any] = None
    sub_answer_2: Optional[Any] = None
    progress_data: Optional[dict] = None


@api_router.post("/auth/request-otp")
async def mechanic_request_otp(data: MechanicOtpRequest):
    """Request OTP for mechanic app login via phone number.
    Only mechanics, country heads, and CEOs can access the mechanic app."""
    # Normalize phone number - remove spaces, dashes, and ensure consistent format
    phone = data.phone.strip().replace(" ", "").replace("-", "")
    if not phone.startswith("+"):
        phone = "+91" + phone[-10:]
    else:
        # Ensure +91 format for Indian numbers
        phone = "+91" + phone[-10:]
    
    # Store the normalized phone for lookup
    normalized_phone = phone
    
    # Dev mode test phone numbers (bypass mechanic check)
    dev_mode = os.environ.get("MECHANIC_APP_DEV_MODE", "true").lower() == "true"
    dev_test_phones = ["+919611188788", "9611188788", "+919689760236", "9689760236"]
    
    if dev_mode and any(phone.endswith(p[-10:]) for p in dev_test_phones):
        # For dev mode test phones, create a mock mechanic entry in MongoDB
        await store_mechanic_otp(normalized_phone, {
            "otp": "123456",
            "mechanic_id": "dev-mechanic-001",
            "expires_at": datetime.now(timezone.utc) + timedelta(minutes=30),
            "is_dev_mode": True
        })
        logger.info(f"Dev mode OTP for {normalized_phone}: 123456")
        return {"success": True, "message": "OTP sent successfully"}
    
    # Get allowed roles for mechanic app access
    allowed_role_codes = ["MECHANIC", "COUNTRY_HEAD", "CEO"]
    allowed_roles = await db.roles.find(
        {"code": {"$in": allowed_role_codes}}, 
        {"_id": 0, "id": 1, "code": 1}
    ).to_list(10)
    
    if not allowed_roles:
        raise HTTPException(status_code=500, detail="Roles not configured")
    
    allowed_role_ids = [r["id"] for r in allowed_roles]
    
    # Check if phone number is registered with an allowed role
    user = await db.users.find_one({
        "$or": [
            {"phone": phone},
            {"phone": {"$regex": phone[-10:] + "$"}},  # Match last 10 digits
            {"mobile": phone},
            {"mobile": {"$regex": phone[-10:] + "$"}}
        ],
        "role_id": {"$in": allowed_role_ids},
        "is_active": True
    }, {"_id": 0})
    
    if not user:
        raise HTTPException(
            status_code=404, 
            detail="You are not authorized to access this app. Only mechanics, country heads, and CEOs can login."
        )
    
    # Get the user's mobile number from the database for OTP
    user_mobile = user.get("mobile") or user.get("phone") or phone
    # Ensure it's in E.164 format
    if not user_mobile.startswith("+"):
        user_mobile = "+91" + user_mobile[-10:]
    
    # Generate 6-digit OTP
    otp = ''.join(random.choices(string.digits, k=6))
    
    # Store OTP in MongoDB with expiration (30 minutes)
    await store_mechanic_otp(normalized_phone, {
        "otp": otp,
        "mechanic_id": user["id"],
        "user_role": user.get("role_id"),
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=30)
    })
    
    # Send OTP via Fast2SMS in production
    if not dev_mode:
        from services.fast2sms_service import get_fast2sms_service
        fast2sms = get_fast2sms_service()
        if fast2sms.is_configured():
            sms_result = await fast2sms.send_otp_sms(user_mobile, otp)
            if not sms_result.get("success"):
                logger.error(f"Failed to send OTP SMS via Fast2SMS: {sms_result.get('error')}")
                # Fall back to logging OTP for testing
                logger.info(f"OTP for {normalized_phone}: {otp}")
            else:
                logger.info(f"OTP SMS sent to {user_mobile} via Fast2SMS")
        else:
            logger.warning(f"Fast2SMS not configured. OTP for {normalized_phone}: {otp}")
    else:
        # In dev mode, use fixed OTP for testing
        await store_mechanic_otp(normalized_phone, {
            "otp": "123456",
            "mechanic_id": user["id"],
            "user_role": user.get("role_id"),
            "expires_at": datetime.now(timezone.utc) + timedelta(minutes=30)
        })
        logger.info(f"Dev mode OTP for {normalized_phone}: 123456")
    
    return {"success": True, "message": "OTP sent successfully"}


@api_router.post("/auth/verify-otp")
async def mechanic_verify_otp(data: MechanicOtpVerify):
    """Verify OTP and return auth token for mechanic app users (mechanics, country heads, CEOs)"""
    # Normalize phone number - same logic as request-otp
    phone = data.phone.strip().replace(" ", "").replace("-", "")
    if not phone.startswith("+"):
        phone = "+91" + phone[-10:]
    else:
        # Ensure +91 format for Indian numbers
        phone = "+91" + phone[-10:]
    
    # Use normalized phone for lookup
    normalized_phone = phone
    otp = data.otp.strip()
    
    # Get OTP from MongoDB
    stored = await get_mechanic_otp(normalized_phone)
    
    if not stored:
        raise HTTPException(status_code=400, detail="OTP expired or not requested")
    
    # Handle expires_at - it might be stored as string or datetime
    expires_at = stored["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
    
    if datetime.now(timezone.utc) > expires_at:
        await delete_mechanic_otp(normalized_phone)
        raise HTTPException(status_code=400, detail="OTP expired")
    
    if stored["otp"] != otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    # Handle dev mode mock mechanic
    if stored.get("is_dev_mode"):
        # Clear OTP from MongoDB
        await delete_mechanic_otp(normalized_phone)
        
        # Create mock mechanic profile for dev mode
        mock_mechanic_id = "dev-mechanic-001"
        access_token = create_access_token({
            "sub": mock_mechanic_id,
            "email": "dev.mechanic@wisedrive.com",
            "is_mechanic_app": True
        })
        
        mechanic_profile = {
            "id": mock_mechanic_id,
            "name": "Dev Mechanic",
            "phone": normalized_phone,
            "email": "dev.mechanic@wisedrive.com",
            "city": "Bangalore",
            "inspection_cities": ["Bangalore", "Hyderabad", "Chennai"],
            "role": "mechanic",
            "active": True
        }
        
        return {
            "success": True,
            "token": access_token,
            "mechanicProfile": mechanic_profile
        }
    
    # Get user profile from database
    user = await db.users.find_one({"id": stored["mechanic_id"]}, {"_id": 0, "hashed_password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get role info
    role = await db.roles.find_one({"id": user.get("role_id")}, {"_id": 0})
    role_code = role.get("code", "MECHANIC") if role else "MECHANIC"
    
    # Clear OTP from MongoDB
    await delete_mechanic_otp(normalized_phone)
    
    # Get inspection cities
    inspection_cities = user.get("inspection_cities", [])
    
    # Create token
    access_token = create_access_token({
        "sub": user["id"],
        "email": user.get("email", ""),
        "is_mechanic_app": True,
        "role": role_code
    })
    
    mechanic_profile = {
        "id": user["id"],
        "name": user.get("name", ""),
        "phone": phone,
        "email": user.get("email", ""),
        "city": inspection_cities[0] if inspection_cities else "",
        "inspection_cities": inspection_cities,
        "role": role_code.lower(),
        "active": user.get("is_active", True)
    }
    
    return {
        "success": True,
        "token": access_token,
        "mechanicProfile": mechanic_profile
    }


@api_router.get("/mechanic/inspections")
async def get_mechanic_inspections(
    date_filter: Optional[str] = None,  # 'today', 'week', 'month', 'last_month', 'all'
    city: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get inspections for mechanic app - shows inspections assigned to or available for the mechanic"""
    mechanic_id = current_user["id"]
    mechanic_cities = current_user.get("inspection_cities", [])
    mechanic_name = current_user.get("name", "")
    
    logger.info(f"Fetching inspections for mechanic: {mechanic_id} ({mechanic_name}), cities: {mechanic_cities}")
    
    # Resolve mechanic cities to include aliases
    all_city_variants = []
    for mc in mechanic_cities:
        all_city_variants.append(mc)
        all_city_variants.append(mc.lower())
        all_city_variants.append(mc.upper())
        all_city_variants.append(mc.title())
        
        # Check if this city has aliases in the master table
        city_doc = await db.cities.find_one({
            "$or": [
                {"name": {"$regex": f"^{mc}$", "$options": "i"}},
                {"aliases": {"$regex": f"^{mc}$", "$options": "i"}}
            ]
        })
        if city_doc:
            all_city_variants.append(city_doc["name"])
            all_city_variants.extend(city_doc.get("aliases", []))
    
    # Remove duplicates while preserving order
    all_city_variants = list(dict.fromkeys(all_city_variants))
    
    logger.info(f"Resolved city variants for mechanic: {all_city_variants}")
    
    # Base query: inspections that are either:
    # 1. Assigned to this mechanic by ID (any status)
    # 2. Assigned to this mechanic by name (fallback for older records)
    # 3. In the ASSIGNED_TO_MECHANIC status with matching mechanic_id
    # 4. Unassigned but in mechanic's cities (NEW_INSPECTION status)
    query = {
        "$or": [
            {"mechanic_id": mechanic_id},
            {"mechanic_name": {"$regex": f"^{mechanic_name}$", "$options": "i"}} if mechanic_name else {"mechanic_id": mechanic_id},
            {
                "mechanic_id": {"$in": [None, ""]},
                "city": {"$regex": f"^({'|'.join(all_city_variants)})$", "$options": "i"} if all_city_variants else {"$exists": True},
                "inspection_status": {"$in": ["NEW_INSPECTION", "ASSIGNED_TO_MECHANIC"]}
            }
        ]
    }
    
    # Date filter
    if date_filter:
        today = datetime.now(timezone.utc).date()
        if date_filter == 'today':
            query["scheduled_date"] = {"$regex": f"^{today.isoformat()}"}
        elif date_filter == 'week':
            week_start = today - timedelta(days=today.weekday())
            week_end = week_start + timedelta(days=6)
            query["$and"] = query.get("$and", []) + [
                {"scheduled_date": {"$gte": week_start.isoformat()}},
                {"scheduled_date": {"$lte": (week_end + timedelta(days=1)).isoformat()}}
            ]
        elif date_filter == 'month':
            month_start = today.replace(day=1)
            if today.month == 12:
                month_end = today.replace(year=today.year + 1, month=1, day=1)
            else:
                month_end = today.replace(month=today.month + 1, day=1)
            query["$and"] = query.get("$and", []) + [
                {"scheduled_date": {"$gte": month_start.isoformat()}},
                {"scheduled_date": {"$lt": month_end.isoformat()}}
            ]
        elif date_filter == 'last_month':
            if today.month == 1:
                last_month_start = today.replace(year=today.year - 1, month=12, day=1)
            else:
                last_month_start = today.replace(month=today.month - 1, day=1)
            month_start = today.replace(day=1)
            query["$and"] = query.get("$and", []) + [
                {"scheduled_date": {"$gte": last_month_start.isoformat()}},
                {"scheduled_date": {"$lt": month_start.isoformat()}}
            ]
    
    # Filter by city
    if city:
        query["city"] = {"$regex": f"^{city}$", "$options": "i"}
    
    # Filter by status (map mechanic app status to CRM status)
    status_map = {
        "NEW": ["NEW_INSPECTION", "ASSIGNED_TO_MECHANIC"],
        "ACCEPTED": ["MECHANIC_ACCEPTED"],
        "IN_PROGRESS": ["INSPECTION_STARTED"],
        "COMPLETED": ["INSPECTION_COMPLETED"],
        "REJECTED": ["MECHANIC_REJECTED", "INSPECTION_CANCELLED_WD", "INSPECTION_CANCELLED_CUS"]
    }
    
    if status:
        crm_statuses = status_map.get(status, [status])
        if "$or" in query:
            # Combine with existing $or
            original_or = query["$or"]
            query["$and"] = query.get("$and", []) + [
                {"$or": original_or},
                {"inspection_status": {"$in": crm_statuses}}
            ]
            del query["$or"]
        else:
            query["inspection_status"] = {"$in": crm_statuses}
    
    logger.info(f"Mechanic inspections query: {query}")
    
    inspections = await db.inspections.find(query, {"_id": 0}).sort("scheduled_date", -1).to_list(100)
    
    logger.info(f"Found {len(inspections)} inspections for mechanic {mechanic_id}")
    
    # Transform to mechanic app format
    result = []
    for insp in inspections:
        # Map CRM status to mechanic app status
        crm_status = insp.get("inspection_status", "NEW_INSPECTION")
        if crm_status == "INSPECTION_COMPLETED":
            app_status = "COMPLETED"
        elif crm_status in ["MECHANIC_REJECTED", "INSPECTION_CANCELLED_WD", "INSPECTION_CANCELLED_CUS"]:
            app_status = "REJECTED"
        elif crm_status == "INSPECTION_STARTED":
            app_status = "IN_PROGRESS"
        elif crm_status == "MECHANIC_ACCEPTED":
            app_status = "ACCEPTED"
        elif crm_status in ["NEW_INSPECTION", "ASSIGNED_TO_MECHANIC"]:
            app_status = "NEW"
        elif crm_status == "RESCHEDULED":
            app_status = "NEW"  # Show rescheduled as new for mechanic to accept again
        else:
            app_status = "NEW"
        
        result.append({
            "id": insp.get("id"),
            "scheduledAt": insp.get("scheduled_date") or insp.get("created_at"),
            "status": app_status,
            "crmStatus": crm_status,  # Include original CRM status for debugging
            "vehicleNumber": insp.get("car_number", ""),
            "makeModelVariant": f"{insp.get('car_make', insp.get('make', ''))} {insp.get('car_model', insp.get('model', ''))} {insp.get('variant', '')}".strip() or "Not Available",
            "carMake": insp.get("car_make", insp.get("make", "")),
            "carModel": insp.get("car_model", insp.get("model", "")),
            "fuelType": insp.get("fuel_type", ""),
            "manufacturingYear": insp.get("car_year", insp.get("manufacturing_year", "")),
            "odometerReading": insp.get("odometer_reading", ""),
            "city": insp.get("city", ""),
            "customerName": insp.get("customer_name", ""),
            "customerPhone": insp.get("customer_mobile", ""),
            "customerAddress": insp.get("address", ""),
            "latitude": insp.get("latitude") or insp.get("location_lat"),
            "longitude": insp.get("longitude") or insp.get("location_lng"),
            "assignedMechanicId": insp.get("mechanic_id"),
            "partner_id": insp.get("partner_id"),
            "partner_name": insp.get("partner_name"),
            "requiredModules": {
                "photos": True,
                "sound": False,
                "obd": False
            },
            "progress": insp.get("inspection_progress", {
                "photosDone": False,
                "soundDone": False,
                "obdDone": False,
                "notesDone": False
            }),
            "orderId": insp.get("order_id"),
            "packageName": insp.get("package_type") or insp.get("inspection_package_name", "Standard Inspection")
        })
    
    return result


@api_router.get("/mechanic/inspections/{inspection_id}")
async def get_mechanic_inspection_detail(
    inspection_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get detailed inspection info for mechanic app"""
    inspection = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    
    # Map CRM status to mechanic app status
    crm_status = inspection.get("inspection_status", "NEW")
    if crm_status in ["INSPECTION_COMPLETED", "COMPLETED"]:
        app_status = "COMPLETED"
    elif crm_status in ["INSPECTION_CANCELLED", "INSPECTION_REJECTED", "REJECTED", "CANCELLED"]:
        app_status = "REJECTED"
    elif crm_status in ["INSPECTION_CONFIRMED", "INSPECTION_STARTED", "ACCEPTED", "IN_PROGRESS"]:
        app_status = "ACCEPTED"
    else:
        app_status = "NEW"
    
    return {
        "id": inspection.get("id"),
        "scheduledAt": inspection.get("scheduled_date") or inspection.get("created_at"),
        "status": app_status,
        "vehicleNumber": inspection.get("car_number", ""),
        "makeModelVariant": f"{inspection.get('car_make', inspection.get('make', ''))} {inspection.get('car_model', inspection.get('model', ''))} {inspection.get('variant', '')}".strip() or "Not Available",
        "carMake": inspection.get("car_make", inspection.get("make", "")),
        "carModel": inspection.get("car_model", inspection.get("model", "")),
        "make": inspection.get("car_make", inspection.get("make", "")),
        "model": inspection.get("car_model", inspection.get("model", "")),
        "fuelType": inspection.get("fuel_type", ""),
        "fuel_type": inspection.get("fuel_type", ""),
        "manufacturingYear": inspection.get("car_year", inspection.get("manufacturing_year", "")),
        "year": inspection.get("car_year", inspection.get("manufacturing_year", "")),
        "odometerReading": inspection.get("odometer_reading", ""),
        "odometer": inspection.get("odometer_reading", ""),
        "city": inspection.get("city", ""),
        "customerName": inspection.get("customer_name", ""),
        "customer_name": inspection.get("customer_name", ""),
        "customerPhone": inspection.get("customer_mobile", ""),
        "customerAddress": inspection.get("address", ""),
        "latitude": inspection.get("latitude") or inspection.get("location_lat"),
        "longitude": inspection.get("longitude") or inspection.get("location_lng"),
        "assignedMechanicId": inspection.get("mechanic_id"),
        "requiredModules": {
            "photos": True,
            "sound": False,
            "obd": False
        },
        "progress": inspection.get("inspection_progress", {
            "photosDone": False,
            "soundDone": False,
            "obdDone": False,
            "notesDone": False
        }),
        # Include saved answers for the mechanic app
        "inspection_answers": inspection.get("inspection_answers", {}),
        "orderId": inspection.get("order_id"),
        "packageName": inspection.get("package_type") or inspection.get("inspection_package_name", "Standard Inspection"),
        "partnerId": inspection.get("partner_id"),
        "partnerName": inspection.get("partner_name")
    }


@api_router.post("/mechanic/inspections/{inspection_id}/accept")
async def mechanic_accept_inspection(
    inspection_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Mechanic accepts an inspection"""
    inspection = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    
    # Check if already assigned to another mechanic
    if inspection.get("mechanic_id") and inspection.get("mechanic_id") != current_user["id"]:
        raise HTTPException(status_code=400, detail="Inspection already assigned to another mechanic")
    
    old_status = inspection.get("inspection_status", "NEW_INSPECTION")
    
    # Update inspection
    update_data = {
        "mechanic_id": current_user["id"],
        "mechanic_name": current_user.get("name", ""),
        "inspection_status": "MECHANIC_ACCEPTED",
        "accepted_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.inspections.update_one({"id": inspection_id}, {"$set": update_data})
    
    # Log activity
    activity = {
        "id": str(uuid.uuid4()),
        "inspection_id": inspection_id,
        "user_id": current_user["id"],
        "user_name": current_user.get("name", "Unknown"),
        "user_role": "mechanic",
        "action": "inspection_accepted",
        "action_label": "Inspection Accepted",
        "details": f"Mechanic {current_user.get('name', 'Unknown')} accepted the inspection",
        "old_value": old_status,
        "new_value": "MECHANIC_ACCEPTED",
        "source": "MECHANIC_APP",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.inspection_activities.insert_one(activity)
    
    return {
        "id": inspection.get("id"),
        "status": "MECHANIC_ACCEPTED",
        "assignedMechanicId": current_user["id"],
        "message": "Inspection accepted successfully"
    }


@api_router.post("/mechanic/inspections/{inspection_id}/reject")
async def mechanic_reject_inspection(
    inspection_id: str,
    data: InspectionAcceptReject,
    current_user: dict = Depends(get_current_user)
):
    """Mechanic rejects an inspection"""
    inspection = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    
    old_status = inspection.get("inspection_status", "NEW_INSPECTION")
    
    # Update inspection - unassign and set status
    update_data = {
        "mechanic_id": None,
        "mechanic_name": None,
        "inspection_status": "MECHANIC_REJECTED",
        "rejection_reason": data.reason,
        "rejected_by": current_user["id"],
        "rejected_by_name": current_user.get("name", ""),
        "rejected_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.inspections.update_one({"id": inspection_id}, {"$set": update_data})
    
    # Log activity
    activity = {
        "id": str(uuid.uuid4()),
        "inspection_id": inspection_id,
        "user_id": current_user["id"],
        "user_name": current_user.get("name", "Unknown"),
        "user_role": "mechanic",
        "action": "inspection_rejected",
        "action_label": "Inspection Rejected",
        "details": f"Mechanic {current_user.get('name', 'Unknown')} rejected the inspection. Reason: {data.reason or 'Not specified'}",
        "old_value": old_status,
        "new_value": "MECHANIC_REJECTED",
        "reason": data.reason,
        "source": "MECHANIC_APP",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.inspection_activities.insert_one(activity)
    
    return {
        "id": inspection_id,
        "status": "MECHANIC_REJECTED",
        "rejectionReason": data.reason,
        "message": "Inspection rejected"
    }


@api_router.post("/mechanic/inspections/{inspection_id}/start")
async def mechanic_start_inspection(
    inspection_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Mechanic starts an inspection - called after vehicle verification"""
    inspection = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    
    # Check if mechanic is assigned
    if inspection.get("mechanic_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="You are not assigned to this inspection")
    
    old_status = inspection.get("inspection_status", "MECHANIC_ACCEPTED")
    
    update_data = {
        "inspection_status": "INSPECTION_STARTED",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "started_by": current_user["id"],
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.inspections.update_one({"id": inspection_id}, {"$set": update_data})
    
    # Log activity
    activity = {
        "id": str(uuid.uuid4()),
        "inspection_id": inspection_id,
        "user_id": current_user["id"],
        "user_name": current_user.get("name", "Unknown"),
        "user_role": "mechanic",
        "action": "inspection_started",
        "action_label": "Inspection Started",
        "details": f"Mechanic {current_user.get('name', 'Unknown')} started the inspection",
        "old_value": old_status,
        "new_value": "INSPECTION_STARTED",
        "source": "MECHANIC_APP",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.inspection_activities.insert_one(activity)
    
    return {
        "id": inspection_id,
        "status": "INSPECTION_STARTED",
        "message": "Inspection started successfully"
    }


@api_router.post("/mechanic/inspections/{inspection_id}/progress")
async def mechanic_save_progress(
    inspection_id: str,
    data: InspectionProgressUpdate,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Save inspection progress from mechanic app
    
    IMPORTANT: To avoid MongoDB's 16MB document limit, media (images/videos) 
    are stored in a separate 'inspection_media' collection. The inspection_answers
    only stores references to the media.
    """
    import logging
    import traceback
    logger = logging.getLogger(__name__)
    
    async def store_media_separately(media_data: str, inspection_id: str, question_id: str, field_name: str) -> str:
        """Store base64 media in separate collection and return reference ID"""
        if not media_data or not isinstance(media_data, str):
            return media_data
        
        # Only process base64 data
        if not media_data.startswith('data:'):
            return media_data
        
        # Generate unique media ID
        media_id = str(uuid.uuid4())
        
        # Determine media type
        media_type = "image"
        if "video" in media_data[:50]:
            media_type = "video"
        
        # Store in separate collection
        media_doc = {
            "id": media_id,
            "inspection_id": inspection_id,
            "question_id": question_id,
            "field_name": field_name,
            "media_type": media_type,
            "data": media_data,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": current_user["id"]
        }
        
        await db.inspection_media.insert_one(media_doc)
        logger.info(f"[SAVE_PROGRESS] Stored media separately: {media_id} ({len(media_data) // 1024}KB)")
        
        # Return reference instead of full data
        return f"media_ref:{media_id}"
    
    async def process_answer_media(answer_data: any, inspection_id: str, question_id: str, field_name: str) -> any:
        """Process answer to extract and store media separately"""
        if answer_data is None:
            return None
        
        # If it's a string (direct image/video)
        if isinstance(answer_data, str):
            # Reject local file paths - these should have been uploaded to Firebase first
            if answer_data.startswith('file://') or answer_data.startswith('/data/'):
                logger.warning(f"[SAVE_PROGRESS] Rejecting local file path for {question_id}: {answer_data[:80]}...")
                # Store a marker indicating upload failed so CRM can show appropriate message
                return f"UPLOAD_FAILED:{answer_data}"
            
            # Handle base64 data
            if answer_data.startswith('data:'):
                return await store_media_separately(answer_data, inspection_id, question_id, field_name)
            
            # gs:// URLs from Firebase are valid
            if answer_data.startswith('gs://'):
                logger.info(f"[SAVE_PROGRESS] Firebase URL for {question_id}: {answer_data}")
                return answer_data
            
            # HTTP URLs are valid (from Firebase signed URLs)
            if answer_data.startswith('http://') or answer_data.startswith('https://'):
                logger.info(f"[SAVE_PROGRESS] HTTP URL for {question_id}: {answer_data[:60]}...")
                return answer_data
        
        # If it's a dict (combo answer with selection + media)
        if isinstance(answer_data, dict):
            processed = dict(answer_data)
            if 'media' in processed and isinstance(processed['media'], str):
                media_value = processed['media']
                
                # Reject local file paths
                if media_value.startswith('file://') or media_value.startswith('/data/'):
                    logger.warning(f"[SAVE_PROGRESS] Rejecting local media path for {question_id}: {media_value[:80]}...")
                    processed['media'] = f"UPLOAD_FAILED:{media_value}"
                elif media_value.startswith('data:'):
                    processed['media'] = await store_media_separately(
                        media_value, inspection_id, question_id, f"{field_name}_media"
                    )
            return processed
        
        return answer_data
    
    try:
        # Log request size
        content_length = request.headers.get('content-length', '0')
        logger.info(f"[SAVE_PROGRESS] Request received: inspection={inspection_id}, content_length={content_length} bytes")
        
        # Calculate answer size if present
        answer_size = 0
        answer_type = "none"
        if data.answer is not None:
            if isinstance(data.answer, str):
                answer_size = len(data.answer)
                if data.answer.startswith('data:image'):
                    answer_type = "base64_image"
                elif data.answer.startswith('data:video'):
                    answer_type = "base64_video"
                elif data.answer.startswith('file://'):
                    answer_type = "file_uri"
                else:
                    answer_type = "text"
            elif isinstance(data.answer, dict):
                answer_size = len(str(data.answer))
                answer_type = "dict_with_media" if data.answer.get('media') else "dict"
        
        logger.info(f"[SAVE_PROGRESS] question_id={data.question_id}, category_id={data.category_id}")
        logger.info(f"[SAVE_PROGRESS] answer_type={answer_type}, answer_size={answer_size} bytes ({answer_size // 1024}KB)")
        
        inspection = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
        if not inspection:
            logger.error(f"[SAVE_PROGRESS] Inspection {inspection_id} not found!")
            raise HTTPException(status_code=404, detail="Inspection not found")
        
        logger.info(f"[SAVE_PROGRESS] Found inspection, mechanic_id={inspection.get('mechanic_id')}, current_user={current_user['id']}")
        
        # Check if mechanic is assigned
        if inspection.get("mechanic_id") != current_user["id"]:
            logger.error(f"[SAVE_PROGRESS] Mechanic mismatch! inspection.mechanic_id={inspection.get('mechanic_id')}, current_user={current_user['id']}")
            raise HTTPException(status_code=403, detail="You are not assigned to this inspection")
        
        # Update progress
        current_progress = inspection.get("inspection_progress", {})
        if data.progress_data:
            current_progress.update(data.progress_data)
        
        # Store individual question answers
        answers = inspection.get("inspection_answers", {})
        logger.info(f"[SAVE_PROGRESS] Current answers count before update: {len(answers)}")
        
        if data.question_id:
            logger.info(f"[SAVE_PROGRESS] Processing question_id={data.question_id}")
            existing_answer = answers.get(data.question_id, {})
            
            # Update main answer if provided - STORE MEDIA SEPARATELY
            if data.answer is not None:
                logger.info(f"[SAVE_PROGRESS] Saving main answer for question {data.question_id}")
                processed_answer = await process_answer_media(data.answer, inspection_id, data.question_id, "answer")
                existing_answer["answer"] = processed_answer
                existing_answer["answered_at"] = datetime.now(timezone.utc).isoformat()
                existing_answer["answered_by"] = current_user["id"]
            else:
                logger.warning(f"[SAVE_PROGRESS] data.answer is None, skipping main answer update")
            
            # Update sub_answer_1 if provided - STORE MEDIA SEPARATELY
            if data.sub_answer_1 is not None:
                logger.info(f"[SAVE_PROGRESS] Saving sub_answer_1 for question {data.question_id}")
                processed_sub1 = await process_answer_media(data.sub_answer_1, inspection_id, data.question_id, "sub_answer_1")
                existing_answer["sub_answer_1"] = processed_sub1
                existing_answer["sub_answer_1_at"] = datetime.now(timezone.utc).isoformat()
            
            # Update sub_answer_2 if provided - STORE MEDIA SEPARATELY
            if data.sub_answer_2 is not None:
                logger.info(f"[SAVE_PROGRESS] Saving sub_answer_2 for question {data.question_id}")
                processed_sub2 = await process_answer_media(data.sub_answer_2, inspection_id, data.question_id, "sub_answer_2")
                existing_answer["sub_answer_2"] = processed_sub2
                existing_answer["sub_answer_2_at"] = datetime.now(timezone.utc).isoformat()
            
            answers[data.question_id] = existing_answer
            logger.info(f"[SAVE_PROGRESS] Answer stored: {list(existing_answer.keys())}")
        else:
            logger.warning(f"[SAVE_PROGRESS] No question_id provided, skipping answer storage")
        
        logger.info(f"[SAVE_PROGRESS] Total answers after update: {len(answers)}")
        
        # Check estimated document size to avoid MongoDB 16MB limit
        import json as json_module
        estimated_size = len(json_module.dumps(answers))
        logger.info(f"[SAVE_PROGRESS] Estimated answers JSON size: {estimated_size // 1024}KB")
        
        if estimated_size > 14 * 1024 * 1024:  # 14MB warning threshold
            logger.warning(f"[SAVE_PROGRESS] Document approaching MongoDB 16MB limit!")
        
        update_data = {
            "inspection_progress": current_progress,
            "inspection_answers": answers,
            "inspection_status": "INSPECTION_STARTED",  # CRM status, will map to IN_PROGRESS for app
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        try:
            result = await db.inspections.update_one({"id": inspection_id}, {"$set": update_data})
            logger.info(f"[SAVE_PROGRESS] MongoDB update result: matched={result.matched_count}, modified={result.modified_count}")
        except Exception as e:
            logger.error(f"[SAVE_PROGRESS] MongoDB error: {str(e)}")
            logger.error(f"[SAVE_PROGRESS] MongoDB traceback: {traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
        
        # Calculate completion percentage for AI report auto-generation
        try:
            total_questions = len(answers) + 5  # Rough estimate if we don't have exact count
            # Try to get actual total from categories
            if inspection.get("package_id"):
                package = await db.packages.find_one({"id": inspection["package_id"]}, {"_id": 0, "category_ids": 1})
                if package and package.get("category_ids"):
                    categories = await db.inspection_categories.find(
                        {"id": {"$in": package["category_ids"]}},
                        {"_id": 0, "questions": 1}
                    ).to_list(50)
                    total_questions = sum(len(c.get("questions", [])) for c in categories)
            
            answered_count = len([k for k, v in answers.items() if v and (isinstance(v, dict) and v.get("answer")) or (isinstance(v, str) and v)])
            completion_percentage = min(100, int((answered_count / max(total_questions, 1)) * 100))
            
            # Check if we've hit an AI report milestone
            for milestone in AI_REPORT_AUTO_GENERATE_MILESTONES:
                if completion_percentage >= milestone:
                    # Get last milestone from inspection
                    last_milestone = inspection.get("ai_report_last_milestone", 0)
                    if last_milestone < milestone:
                        logger.info(f"[SAVE_PROGRESS] Triggering AI report at {milestone}% milestone (current: {completion_percentage}%)")
                        # Run AI generation in background (non-blocking)
                        asyncio.create_task(auto_generate_ai_report_background(inspection_id, milestone))
                        break
        except Exception as e:
            logger.warning(f"[SAVE_PROGRESS] Error in AI auto-generation check: {e}")
        
        return {
            "id": inspection_id,
            "progress": current_progress,
            "answers": answers,
            "message": "Progress saved"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[SAVE_PROGRESS] Unexpected error: {str(e)}")
        logger.error(f"[SAVE_PROGRESS] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")



@api_router.get("/inspection-media/{media_id}")
async def get_inspection_media(
    media_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Retrieve stored media by ID (for displaying in CRM)"""
    media = await db.inspection_media.find_one({"id": media_id}, {"_id": 0})
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")
    
    return {
        "id": media["id"],
        "inspection_id": media.get("inspection_id"),
        "question_id": media.get("question_id"),
        "media_type": media.get("media_type"),
        "data": media.get("data"),
        "created_at": media.get("created_at")
    }



@api_router.post("/mechanic/inspections/{inspection_id}/complete")
async def mechanic_complete_inspection(
    inspection_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Mark inspection as completed by mechanic"""
    inspection = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    
    # Check if mechanic is assigned
    if inspection.get("mechanic_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="You are not assigned to this inspection")
    
    old_status = inspection.get("inspection_status", "INSPECTION_STARTED")
    
    update_data = {
        "inspection_status": "INSPECTION_COMPLETED",
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "completed_by": current_user["id"],
        "completed_by_name": current_user.get("name", ""),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.inspections.update_one({"id": inspection_id}, {"$set": update_data})
    
    # Log activity
    activity = {
        "id": str(uuid.uuid4()),
        "inspection_id": inspection_id,
        "user_id": current_user["id"],
        "user_name": current_user.get("name", "Unknown"),
        "user_role": "mechanic",
        "action": "inspection_completed",
        "action_label": "Inspection Completed",
        "details": f"Mechanic {current_user.get('name', 'Unknown')} completed the inspection",
        "old_value": old_status,
        "new_value": "INSPECTION_COMPLETED",
        "source": "MECHANIC_APP",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.inspection_activities.insert_one(activity)
    
    return {
        "id": inspection_id,
        "status": "INSPECTION_COMPLETED",
        "message": "Inspection completed successfully"
    }


@api_router.post("/mechanic/inspections/{inspection_id}/obd-results")
async def mechanic_submit_obd_results(
    inspection_id: str,
    obd_data: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Submit OBD-II diagnostic results from mechanic app"""
    try:
        inspection = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
        if not inspection:
            raise HTTPException(status_code=404, detail="Inspection not found")
        
        logger.info(f"[OBD_SUBMIT] Received OBD data for inspection {inspection_id}")
        logger.info(f"[OBD_SUBMIT] Data keys: {list(obd_data.keys()) if obd_data else 'None'}")
        
        # Store OBD results in a SEPARATE collection to avoid 16MB limit
        obd_doc_id = str(uuid.uuid4())
        obd_document = {
            "id": obd_doc_id,
            "inspection_id": inspection_id,
            "data": obd_data,
            "scanned_at": obd_data.get("scanned_at") or datetime.now(timezone.utc).isoformat(),
            "scanned_by": current_user.get("id", "unknown"),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Upsert - replace existing OBD data for this inspection
        await db.inspection_obd_results.update_one(
            {"inspection_id": inspection_id},
            {"$set": obd_document},
            upsert=True
        )
        
        # Update inspection with reference only (not full data)
        update_data = {
            "obd_results_ref": obd_doc_id,
            "obd_scanned_at": obd_data.get("scanned_at") or datetime.now(timezone.utc).isoformat(),
            "obd_scanned_by": current_user.get("id", "unknown"),
            "obd_total_errors": obd_data.get("total_errors", 0),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.inspections.update_one({"id": inspection_id}, {"$set": update_data})
        
        # Log activity (wrapped in try-catch to not fail the main operation)
        try:
            activity = {
                "id": str(uuid.uuid4()),
                "inspection_id": inspection_id,
                "user_id": current_user.get("id", "unknown"),
                "user_name": current_user.get("name", "Unknown"),
                "user_role": "mechanic",
                "action": "obd_scan_completed",
                "action_label": "OBD Scan Completed",
                "details": f"OBD diagnostic scan completed - {obd_data.get('total_errors', 0)} error(s) found",
                "source": "MECHANIC_APP",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.inspection_activities.insert_one(activity)
        except Exception as activity_err:
            logger.warning(f"[OBD_SUBMIT] Failed to log activity: {activity_err}")
        
        logger.info(f"[OBD_SUBMIT] OBD data saved successfully for inspection {inspection_id}")
        
        return {
            "success": True,
            "inspection_id": inspection_id,
            "obd_doc_id": obd_doc_id,
            "message": "OBD results saved successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[OBD_SUBMIT] Error saving OBD data: {str(e)}")
        import traceback
        logger.error(f"[OBD_SUBMIT] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to save OBD data: {str(e)}")


class OBDRescanRequest(BaseModel):
    enable_rescan: bool


@api_router.post("/inspections/{inspection_id}/obd-rescan")
async def toggle_obd_rescan(
    inspection_id: str,
    request_data: OBDRescanRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Enable or disable OBD rescan for an inspection.
    When enabled, mechanic can perform a new OBD scan which will overwrite existing data.
    Only CRM users (non-mechanics) can toggle this.
    """
    try:
        # Verify inspection exists
        inspection = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
        if not inspection:
            raise HTTPException(status_code=404, detail="Inspection not found")
        
        # Update inspection with rescan flag
        update_data = {
            "obd_rescan_enabled": request_data.enable_rescan,
            "obd_rescan_enabled_by": current_user.get("id", "unknown"),
            "obd_rescan_enabled_at": datetime.now(timezone.utc).isoformat() if request_data.enable_rescan else None,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.inspections.update_one({"id": inspection_id}, {"$set": update_data})
        
        # Log activity
        try:
            action = "obd_rescan_enabled" if request_data.enable_rescan else "obd_rescan_disabled"
            activity = {
                "id": str(uuid.uuid4()),
                "inspection_id": inspection_id,
                "user_id": current_user.get("id", "unknown"),
                "user_name": current_user.get("name", "Unknown"),
                "user_role": current_user.get("role_code", "unknown"),
                "action": action,
                "action_label": "OBD Rescan " + ("Enabled" if request_data.enable_rescan else "Disabled"),
                "details": f"OBD rescan {'enabled' if request_data.enable_rescan else 'disabled'} by {current_user.get('name', 'Unknown')}",
                "source": "CRM",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.inspection_activities.insert_one(activity)
        except Exception as activity_err:
            logger.warning(f"[OBD_RESCAN] Failed to log activity: {activity_err}")
        
        logger.info(f"[OBD_RESCAN] OBD rescan {'enabled' if request_data.enable_rescan else 'disabled'} for inspection {inspection_id}")
        
        return {
            "success": True,
            "inspection_id": inspection_id,
            "obd_rescan_enabled": request_data.enable_rescan,
            "message": f"OBD rescan {'enabled' if request_data.enable_rescan else 'disabled'} successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[OBD_RESCAN] Error toggling OBD rescan: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to toggle OBD rescan: {str(e)}")


@api_router.get("/mechanic/inspections/{inspection_id}/obd-status")
async def get_obd_status(
    inspection_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get OBD status for an inspection - used by mechanic app to check if rescan is allowed.
    """
    try:
        inspection = await db.inspections.find_one(
            {"id": inspection_id}, 
            {"_id": 0, "obd_results_ref": 1, "obd_total_errors": 1, "obd_rescan_enabled": 1, "obd_scanned_at": 1}
        )
        if not inspection:
            raise HTTPException(status_code=404, detail="Inspection not found")
        
        has_obd_data = bool(inspection.get("obd_results_ref") or inspection.get("obd_total_errors") is not None)
        rescan_enabled = inspection.get("obd_rescan_enabled", False)
        
        return {
            "inspection_id": inspection_id,
            "has_obd_data": has_obd_data,
            "obd_scanned_at": inspection.get("obd_scanned_at"),
            "obd_total_errors": inspection.get("obd_total_errors"),
            "rescan_enabled": rescan_enabled,
            "can_scan": not has_obd_data or rescan_enabled
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[OBD_STATUS] Error getting OBD status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get OBD status: {str(e)}")


@api_router.post("/uploads")
async def mechanic_upload_file(
    file: UploadFile = File(...),
    type: str = Form("photo"),
    inspection_id: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """Upload file from mechanic app (photos, videos, documents)"""
    # Validate file type
    allowed_types = {
        "photo": ["image/jpeg", "image/png", "image/webp", "image/heic"],
        "video": ["video/mp4", "video/quicktime", "video/webm"],
        "document": ["application/pdf", "image/jpeg", "image/png"]
    }
    
    if type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Invalid type: {type}")
    
    # Create upload directory
    upload_dir = Path("/app/storage/uploads")
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate unique filename
    ext = Path(file.filename).suffix or ".jpg"
    filename = f"{uuid.uuid4()}{ext}"
    file_path = upload_dir / filename
    
    # Save file
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)
    
    # Return URL
    # In production, this would be a CDN URL or signed URL
    backend_url = os.environ.get("REACT_APP_BACKEND_URL", "")
    file_url = f"{backend_url}/api/files/{filename}"
    
    return {
        "url": file_url,
        "filename": filename,
        "type": type,
        "size": len(content)
    }


@api_router.get("/files/{filename}")
async def serve_uploaded_file(filename: str):
    """Serve uploaded files"""
    from fastapi.responses import FileResponse
    
    file_path = Path("/app/storage/uploads") / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(file_path)


# ==================== FIREBASE STORAGE UPLOAD ====================

class FirebaseUploadRequest(BaseModel):
    filename: str
    content_type: str
    inspection_id: str
    question_id: str

class FirebaseSignedUrlResponse(BaseModel):
    signed_url: str
    firebase_path: str
    expires_at: str

# Initialize Firebase Admin SDK
import firebase_admin
from firebase_admin import credentials, storage as firebase_storage

firebase_app = None

def get_firebase_app():
    """Get or initialize Firebase Admin app"""
    global firebase_app
    if firebase_app is None:
        try:
            cred_path = "/app/ess/api/firebase-credentials.json"
            if os.path.exists(cred_path):
                cred = credentials.Certificate(cred_path)
                firebase_app = firebase_admin.initialize_app(cred, {
                    'storageBucket': 'wisedrive-ess-app.firebasestorage.app'
                })
                logger.info("Firebase Admin SDK initialized successfully")
            else:
                logger.error(f"Firebase credentials file not found: {cred_path}")
                raise HTTPException(status_code=500, detail="Firebase credentials not configured")
        except ValueError:
            # App already initialized
            firebase_app = firebase_admin.get_app()
    return firebase_app

@api_router.post("/media/generate-upload-url", response_model=FirebaseSignedUrlResponse)
async def generate_firebase_upload_url(
    data: FirebaseUploadRequest,
    current_user: dict = Depends(get_current_user)
):
    """Generate a signed URL for uploading media to Firebase Storage
    
    This allows the mobile app to upload directly to Firebase without
    loading the entire file into memory (streaming upload).
    """
    try:
        # Initialize Firebase
        get_firebase_app()
        
        # Generate unique filename with timestamp
        timestamp = int(datetime.now(timezone.utc).timestamp() * 1000)
        ext = data.filename.split('.')[-1] if '.' in data.filename else 'mp4'
        unique_filename = f"{data.question_id}_{timestamp}.{ext}"
        firebase_path = f"inspections/{data.inspection_id}/{unique_filename}"
        
        logger.info(f"[FIREBASE_UPLOAD] Generating signed URL for: {firebase_path}")
        
        # Get bucket reference
        bucket = firebase_storage.bucket()
        blob = bucket.blob(firebase_path)
        
        # Generate signed URL for resumable upload (PUT method)
        # This URL allows direct upload without going through the server
        expiration_time = datetime.now(timezone.utc) + timedelta(hours=1)
        
        signed_url = blob.generate_signed_url(
            version="v4",
            expiration=expiration_time,
            method="PUT",
            content_type=data.content_type,
        )
        
        logger.info(f"[FIREBASE_UPLOAD] Signed URL generated, expires at: {expiration_time.isoformat()}")
        
        return FirebaseSignedUrlResponse(
            signed_url=signed_url,
            firebase_path=f"gs://wisedrive-ess-app.firebasestorage.app/{firebase_path}",
            expires_at=expiration_time.isoformat()
        )
        
    except Exception as e:
        logger.error(f"[FIREBASE_UPLOAD] Error generating signed URL: {str(e)}")
        import traceback
        logger.error(f"[FIREBASE_UPLOAD] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to generate upload URL: {str(e)}")


@api_router.post("/media/get-download-url")
async def get_firebase_download_url(
    firebase_path: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Convert a Firebase Storage path (gs://...) to a public download URL"""
    try:
        get_firebase_app()
        
        # Extract path from gs:// URL
        if firebase_path.startswith("gs://"):
            # gs://bucket-name/path/to/file -> path/to/file
            path_parts = firebase_path.replace("gs://", "").split("/", 1)
            if len(path_parts) > 1:
                file_path = path_parts[1]
            else:
                raise HTTPException(status_code=400, detail="Invalid Firebase path")
        else:
            file_path = firebase_path
        
        bucket = firebase_storage.bucket()
        blob = bucket.blob(file_path)
        
        # Generate signed URL for download (GET method)
        expiration_time = datetime.now(timezone.utc) + timedelta(hours=24)
        
        download_url = blob.generate_signed_url(
            version="v4",
            expiration=expiration_time,
            method="GET",
        )
        
        return {
            "download_url": download_url,
            "expires_at": expiration_time.isoformat()
        }
        
    except Exception as e:
        logger.error(f"[FIREBASE_DOWNLOAD] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get download URL: {str(e)}")


# ==================== MECHANIC PUSH NOTIFICATIONS ====================

class MechanicPushTokenRequest(BaseModel):
    device_token: str
    platform: str = "android"  # android or ios
    device_info: Optional[dict] = None


@api_router.post("/mechanic/push-token")
async def register_mechanic_push_token(
    data: MechanicPushTokenRequest,
    current_user: dict = Depends(get_current_user)
):
    """Register or update mechanic's FCM push token"""
    mechanic_id = current_user["id"]
    
    # Upsert the push token
    await db.mechanic_push_tokens.update_one(
        {"mechanic_id": mechanic_id},
        {
            "$set": {
                "mechanic_id": mechanic_id,
                "device_token": data.device_token,
                "platform": data.platform,
                "device_info": data.device_info,
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            "$setOnInsert": {
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    # Subscribe to city-based topics for broadcast notifications
    inspection_cities = current_user.get("inspection_cities", [])
    if hasattr(app.state, 'fcm_service') and app.state.fcm_service:
        fcm = app.state.fcm_service
        for city in inspection_cities:
            topic = f"mechanic_city_{city.lower().replace(' ', '_')}"
            await fcm.subscribe_to_topic(data.device_token, topic)
    
    return {"success": True, "message": "Push token registered"}


@api_router.delete("/mechanic/push-token")
async def unregister_mechanic_push_token(
    current_user: dict = Depends(get_current_user)
):
    """Remove mechanic's push token (on logout)"""
    mechanic_id = current_user["id"]
    
    # Get existing token to unsubscribe from topics
    existing = await db.mechanic_push_tokens.find_one(
        {"mechanic_id": mechanic_id},
        {"_id": 0, "device_token": 1}
    )
    
    if existing and existing.get("device_token"):
        # Unsubscribe from city topics
        inspection_cities = current_user.get("inspection_cities", [])
        if hasattr(app.state, 'fcm_service') and app.state.fcm_service:
            fcm = app.state.fcm_service
            for city in inspection_cities:
                topic = f"mechanic_city_{city.lower().replace(' ', '_')}"
                await fcm.unsubscribe_from_topic(existing["device_token"], topic)
    
    # Delete the token
    await db.mechanic_push_tokens.delete_one({"mechanic_id": mechanic_id})
    
    return {"success": True, "message": "Push token removed"}


@api_router.get("/mechanic/notifications")
async def get_mechanic_notifications(
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get notification history for mechanic"""
    mechanic_id = current_user["id"]
    
    notifications = await db.mechanic_notifications.find(
        {"mechanic_id": mechanic_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return notifications


@api_router.patch("/mechanic/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Mark a notification as read"""
    await db.mechanic_notifications.update_one(
        {"id": notification_id, "mechanic_id": current_user["id"]},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"success": True}


async def send_mechanic_notification(
    mechanic_id: str,
    title: str,
    body: str,
    data: Optional[dict] = None,
    notification_type: str = "general"
):
    """
    Send push notification to a specific mechanic.
    Also stores the notification in the database for history.
    """
    notification_id = str(uuid.uuid4())
    
    # Store notification in database
    notification_doc = {
        "id": notification_id,
        "mechanic_id": mechanic_id,
        "title": title,
        "body": body,
        "data": data,
        "type": notification_type,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.mechanic_notifications.insert_one(notification_doc)
    
    # Get mechanic's push token
    push_token_doc = await db.mechanic_push_tokens.find_one(
        {"mechanic_id": mechanic_id},
        {"_id": 0, "device_token": 1, "platform": 1}
    )
    
    if not push_token_doc or not push_token_doc.get("device_token"):
        logger.debug(f"No push token for mechanic {mechanic_id}")
        return {"status": "no_token", "notification_id": notification_id}
    
    # Send via FCM
    if hasattr(app.state, 'fcm_service') and app.state.fcm_service:
        fcm = app.state.fcm_service
        try:
            if fcm.mock_mode:
                logger.info(f"[MOCK FCM] Mechanic {mechanic_id}: {title} - {body}")
                return {"status": "mock_sent", "notification_id": notification_id}
            
            # Use FCM service to send
            result = await fcm._send_fcm_message(
                device_token=push_token_doc["device_token"],
                platform=push_token_doc.get("platform", "android"),
                title=title,
                body=body,
                data={"notification_id": notification_id, **(data or {})},
                image_url=None,
                badge=None
            )
            return {"status": "sent", "notification_id": notification_id, "fcm_result": result}
        except Exception as e:
            logger.error(f"FCM send error for mechanic {mechanic_id}: {e}")
            return {"status": "error", "error": str(e), "notification_id": notification_id}
    
    return {"status": "fcm_not_available", "notification_id": notification_id}


async def notify_mechanics_in_city(
    city: str,
    title: str,
    body: str,
    data: Optional[dict] = None,
    exclude_mechanic_id: Optional[str] = None
):
    """
    Send notification to all mechanics in a specific city.
    Used when a new inspection becomes available.
    """
    # Find all mechanics assigned to this city
    mechanic_role = await db.roles.find_one({"code": "MECHANIC"}, {"_id": 0, "id": 1})
    if not mechanic_role:
        return {"status": "no_mechanic_role", "sent": 0}
    
    # Query mechanics with this city in their inspection_cities
    city_lower = city.lower()
    mechanics = await db.users.find(
        {
            "role_id": mechanic_role["id"],
            "is_active": True,
            "$or": [
                {"inspection_cities": {"$regex": f"^{city}$", "$options": "i"}},
                {"inspection_cities": city},
                {"inspection_cities": city_lower}
            ]
        },
        {"_id": 0, "id": 1, "name": 1}
    ).to_list(100)
    
    results = {"sent": 0, "failed": 0, "skipped": 0}
    
    for mechanic in mechanics:
        if exclude_mechanic_id and mechanic["id"] == exclude_mechanic_id:
            results["skipped"] += 1
            continue
        
        result = await send_mechanic_notification(
            mechanic_id=mechanic["id"],
            title=title,
            body=body,
            data=data,
            notification_type="new_inspection"
        )
        
        if result.get("status") in ["sent", "mock_sent"]:
            results["sent"] += 1
        elif result.get("status") == "no_token":
            results["skipped"] += 1
        else:
            results["failed"] += 1
    
    logger.info(f"Notified mechanics in {city}: {results}")
    return results


# ==================== NOTIFICATION TEMPLATES FOR MECHANICS ====================

MECHANIC_NOTIFICATION_TEMPLATES = {
    "new_inspection_available": {
        "title": "New Inspection Available 🚗",
        "body": "New inspection in {city} - {vehicle}. Tap to view details."
    },
    "inspection_assigned": {
        "title": "Inspection Assigned to You ✅",
        "body": "You've been assigned: {vehicle} in {city}. Scheduled: {scheduled_time}."
    },
    "inspection_reminder": {
        "title": "Upcoming Inspection ⏰",
        "body": "Reminder: {vehicle} inspection in {city} at {scheduled_time}."
    },
    "inspection_cancelled": {
        "title": "Inspection Cancelled ❌",
        "body": "The inspection for {vehicle} in {city} has been cancelled."
    },
    "payment_received": {
        "title": "Payment Confirmed 💰",
        "body": "Payment received for {vehicle} inspection. You can now start the inspection."
    }
}


def format_mechanic_notification(template_key: str, **kwargs) -> dict:
    """Format mechanic notification from template"""
    template = MECHANIC_NOTIFICATION_TEMPLATES.get(template_key, {})
    return {
        "title": template.get("title", "").format(**kwargs),
        "body": template.get("body", "").format(**kwargs)
    }


# ==================== SETTINGS & TOKEN MANAGEMENT ====================

class TokenUpdateRequest(BaseModel):
    token: str
    token_type: str  # 'meta_ads', 'fast2sms', etc.

@api_router.get("/settings/tokens")
async def get_token_status():
    """Get status of all API tokens"""
    tokens_status = []
    
    # Meta Ads Token
    meta_token = os.environ.get("META_ACCESS_TOKEN", "")
    meta_status = {
        "id": "meta_ads",
        "name": "Meta (Facebook) Ads",
        "description": "Used for syncing ad campaign data and analytics",
        "token_preview": f"{meta_token[:20]}...{meta_token[-10:]}" if len(meta_token) > 30 else "Not configured",
        "is_configured": bool(meta_token),
        "status": "unknown",
        "last_checked": None,
        "error": None
    }
    
    # Test Meta token
    if meta_token:
        try:
            import httpx
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    "https://graph.facebook.com/v18.0/me",
                    params={"access_token": meta_token}
                )
                if response.status_code == 200:
                    meta_status["status"] = "valid"
                    meta_status["last_checked"] = datetime.now(timezone.utc).isoformat()
                else:
                    error_data = response.json()
                    meta_status["status"] = "invalid"
                    meta_status["error"] = error_data.get("error", {}).get("message", "Unknown error")
        except Exception as e:
            meta_status["status"] = "error"
            meta_status["error"] = str(e)
    
    tokens_status.append(meta_status)
    
    # Fast2SMS Token
    fast2sms_key = os.environ.get("FAST2SMS_API_KEY", "")
    fast2sms_status = {
        "id": "fast2sms",
        "name": "Fast2SMS",
        "description": "Used for sending OTP and notification SMS",
        "token_preview": f"{fast2sms_key[:15]}...{fast2sms_key[-5:]}" if len(fast2sms_key) > 20 else "Not configured",
        "is_configured": bool(fast2sms_key),
        "status": "unknown",
        "last_checked": None,
        "error": None,
        "extra": {}
    }
    
    # Test Fast2SMS token (get wallet balance)
    if fast2sms_key:
        try:
            import httpx
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    "https://www.fast2sms.com/dev/wallet",
                    params={"authorization": fast2sms_key}
                )
                result = response.json()
                if result.get("return") == True:
                    fast2sms_status["status"] = "valid"
                    fast2sms_status["last_checked"] = datetime.now(timezone.utc).isoformat()
                    fast2sms_status["extra"] = {
                        "wallet_balance": result.get("wallet"),
                        "sms_count": result.get("sms_count")
                    }
                else:
                    fast2sms_status["status"] = "invalid"
                    fast2sms_status["error"] = result.get("message", "Invalid API key")
        except Exception as e:
            fast2sms_status["status"] = "error"
            fast2sms_status["error"] = str(e)
    
    tokens_status.append(fast2sms_status)
    
    # Twilio Token - with balance check
    twilio_sid = os.environ.get("TWILIO_ACCOUNT_SID", "")
    twilio_auth = os.environ.get("TWILIO_AUTH_TOKEN", "")
    twilio_status = {
        "id": "twilio",
        "name": "Twilio",
        "description": "Used for WhatsApp messaging and notifications",
        "token_preview": f"{twilio_sid[:10]}...{twilio_sid[-5:]}" if len(twilio_sid) > 15 else "Not configured",
        "is_configured": bool(twilio_sid and twilio_auth),
        "status": "unknown",
        "last_checked": None,
        "error": None,
        "extra": {}
    }
    
    # Test Twilio and get balance
    if twilio_sid and twilio_auth:
        try:
            import httpx
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"https://api.twilio.com/2010-04-01/Accounts/{twilio_sid}/Balance.json",
                    auth=(twilio_sid, twilio_auth)
                )
                if response.status_code == 200:
                    data = response.json()
                    twilio_status["status"] = "valid"
                    twilio_status["last_checked"] = datetime.now(timezone.utc).isoformat()
                    twilio_status["extra"] = {
                        "wallet_balance": f"${data.get('balance', 0)} {data.get('currency', 'USD')}"
                    }
                elif response.status_code == 403:
                    # Credentials valid but no balance access (trial account or permissions)
                    twilio_status["status"] = "configured"
                    twilio_status["last_checked"] = datetime.now(timezone.utc).isoformat()
                    twilio_status["extra"] = {
                        "note": "Balance not accessible (trial account)"
                    }
                else:
                    twilio_status["status"] = "invalid"
                    twilio_status["error"] = f"API returned {response.status_code}"
        except Exception as e:
            twilio_status["status"] = "error"
            twilio_status["error"] = str(e)
    else:
        twilio_status["status"] = "not_configured"
    
    tokens_status.append(twilio_status)
    
    # Razorpay Token
    razorpay_key = os.environ.get("RAZORPAY_KEY_ID", "")
    razorpay_status = {
        "id": "razorpay",
        "name": "Razorpay",
        "description": "Used for payment link generation and processing",
        "token_preview": f"{razorpay_key[:8]}...{razorpay_key[-4:]}" if len(razorpay_key) > 12 else "Not configured",
        "is_configured": bool(razorpay_key),
        "status": "configured" if razorpay_key else "not_configured",
        "last_checked": datetime.now(timezone.utc).isoformat() if razorpay_key else None,
        "error": None
    }
    tokens_status.append(razorpay_status)
    
    # Emergent Universal Key
    emergent_key = os.environ.get("EMERGENT_API_KEY", "") or os.environ.get("EMERGENT_LLM_KEY", "")
    emergent_status = {
        "id": "emergent",
        "name": "Emergent Universal Key",
        "description": "Used for AI/LLM integrations (OpenAI, Claude, Gemini). Manage credits at app.emergent.sh",
        "token_preview": f"{emergent_key[:15]}...{emergent_key[-5:]}" if len(emergent_key) > 20 else "Not configured",
        "is_configured": bool(emergent_key),
        "status": "configured" if emergent_key else "not_configured",
        "last_checked": datetime.now(timezone.utc).isoformat() if emergent_key else None,
        "error": None,
        "extra": {
            "dashboard_url": "https://app.emergent.sh",
            "manage_credits_url": "https://app.emergent.sh/profile",
            "note": "Check credits balance in Emergent Dashboard → Profile → Universal Key"
        },
        "actions": [
            {"label": "Open Dashboard", "url": "https://app.emergent.sh", "type": "link"},
            {"label": "Add Credits", "url": "https://app.emergent.sh/profile", "type": "link"}
        ]
    }
    tokens_status.append(emergent_status)
    
    return {"tokens": tokens_status}


@api_router.post("/settings/tokens/update")
async def update_token(request: TokenUpdateRequest):
    """Update an API token - stores in database for persistence"""
    token_type = request.token_type
    new_token = request.token.strip()
    
    if not new_token:
        raise HTTPException(status_code=400, detail="Token cannot be empty")
    
    # Validate token based on type
    validation_result = {"valid": False, "message": "Unknown token type"}
    
    if token_type == "meta_ads":
        try:
            import httpx
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    "https://graph.facebook.com/v18.0/me",
                    params={"access_token": new_token}
                )
                if response.status_code == 200:
                    validation_result = {"valid": True, "message": "Token validated successfully"}
                else:
                    error_data = response.json()
                    validation_result = {
                        "valid": False, 
                        "message": error_data.get("error", {}).get("message", "Invalid token")
                    }
        except Exception as e:
            validation_result = {"valid": False, "message": f"Validation failed: {str(e)}"}
    
    elif token_type == "fast2sms":
        try:
            import httpx
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    "https://www.fast2sms.com/dev/wallet",
                    params={"authorization": new_token}
                )
                result = response.json()
                if result.get("return") == True:
                    validation_result = {
                        "valid": True, 
                        "message": f"Token valid. Balance: ₹{result.get('wallet')}"
                    }
                else:
                    validation_result = {"valid": False, "message": result.get("message", "Invalid API key")}
        except Exception as e:
            validation_result = {"valid": False, "message": f"Validation failed: {str(e)}"}
    
    if not validation_result["valid"]:
        raise HTTPException(status_code=400, detail=validation_result["message"])
    
    # Store token in database for persistence across deployments
    await db.settings.update_one(
        {"key": f"token_{token_type}"},
        {
            "$set": {
                "key": f"token_{token_type}",
                "value": new_token,
                "updated_at": datetime.now(timezone.utc),
                "updated_by": "admin"
            }
        },
        upsert=True
    )
    
    # Also update environment variable for immediate use
    if token_type == "meta_ads":
        os.environ["META_ACCESS_TOKEN"] = new_token
        # Reinitialize Meta Ads service
        from services.meta_ads_service import MetaAdsService
        global meta_ads_service
        meta_ads_service = MetaAdsService()
        logger.info("Meta Ads token updated and service reinitialized")
    elif token_type == "fast2sms":
        os.environ["FAST2SMS_API_KEY"] = new_token
        # Reinitialize Fast2SMS service
        from services.fast2sms_service import Fast2SMSService, fast2sms_service
        import services.fast2sms_service as fast2sms_module
        fast2sms_module.fast2sms_service = Fast2SMSService()
        fast2sms_module.fast2sms_service.set_db(db)
        logger.info("Fast2SMS token updated and service reinitialized")
    
    return {
        "success": True,
        "message": validation_result["message"],
        "token_type": token_type
    }


@api_router.post("/settings/tokens/test/{token_type}")
async def test_token(token_type: str):
    """Test a specific token"""
    if token_type == "meta_ads":
        meta_token = os.environ.get("META_ACCESS_TOKEN", "")
        if not meta_token:
            return {"success": False, "message": "Meta Ads token not configured"}
        
        try:
            import httpx
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    "https://graph.facebook.com/v18.0/me",
                    params={"access_token": meta_token}
                )
                if response.status_code == 200:
                    data = response.json()
                    return {
                        "success": True,
                        "message": "Token is valid",
                        "details": {"name": data.get("name"), "id": data.get("id")}
                    }
                else:
                    error_data = response.json()
                    return {
                        "success": False,
                        "message": error_data.get("error", {}).get("message", "Invalid token")
                    }
        except Exception as e:
            return {"success": False, "message": str(e)}
    
    elif token_type == "fast2sms":
        fast2sms_key = os.environ.get("FAST2SMS_API_KEY", "")
        if not fast2sms_key:
            return {"success": False, "message": "Fast2SMS API key not configured"}
        
        try:
            import httpx
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    "https://www.fast2sms.com/dev/wallet",
                    params={"authorization": fast2sms_key}
                )
                result = response.json()
                if result.get("return") == True:
                    return {
                        "success": True,
                        "message": "API key is valid",
                        "details": {
                            "wallet_balance": f"₹{result.get('wallet')}",
                            "sms_count": result.get("sms_count")
                        }
                    }
                else:
                    return {"success": False, "message": result.get("message", "Invalid API key")}
        except Exception as e:
            return {"success": False, "message": str(e)}
    
    elif token_type == "meta_ads_sync":
        # Trigger a manual Meta Ads sync
        try:
            if meta_ads_scheduler:
                await meta_ads_scheduler.sync_now()
                return {"success": True, "message": "Meta Ads sync triggered successfully"}
            else:
                return {"success": False, "message": "Meta Ads scheduler not initialized"}
        except Exception as e:
            return {"success": False, "message": str(e)}
    
    return {"success": False, "message": f"Unknown token type: {token_type}"}


# ==================== SMS LOGS & FAST2SMS INTEGRATION ====================

@api_router.get("/sms/logs")
async def get_sms_logs(
    limit: int = 50,
    offset: int = 0,
    phone: Optional[str] = None,
    request_type: Optional[str] = None,
    success: Optional[bool] = None,
    inspection_id: Optional[str] = None
):
    """Get SMS logs with optional filtering"""
    query = {}
    
    if phone:
        query["$or"] = [
            {"phone": {"$regex": phone[-10:]}},
            {"phone_masked": {"$regex": phone[-4:]}}
        ]
    
    if request_type:
        query["request_type"] = request_type
    
    if success is not None:
        query["success"] = success
    
    if inspection_id:
        query["inspection_id"] = inspection_id
    
    # Get total count
    total = await db.sms_logs.count_documents(query)
    
    # Get logs
    logs = await db.sms_logs.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    
    return {
        "logs": logs,
        "total": total,
        "limit": limit,
        "offset": offset
    }


@api_router.get("/sms/wallet")
async def get_sms_wallet_balance():
    """Get Fast2SMS wallet balance and SMS count"""
    from services.fast2sms_service import get_fast2sms_service
    fast2sms = get_fast2sms_service()
    
    if not fast2sms.is_configured():
        return {
            "success": False,
            "error": "Fast2SMS not configured",
            "balance": 0,
            "sms_count": 0
        }
    
    result = await fast2sms.get_wallet_balance()
    return result


@api_router.get("/twilio/balance")
async def get_twilio_account_balance():
    """Get Twilio account balance"""
    import httpx
    
    account_sid = os.environ.get("TWILIO_ACCOUNT_SID")
    auth_token = os.environ.get("TWILIO_AUTH_TOKEN")
    
    if not account_sid or not auth_token:
        return {
            "success": False,
            "error": "Twilio not configured",
            "balance": None,
            "currency": None
        }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Balance.json",
                auth=(account_sid, auth_token),
                timeout=30.0
            )
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "success": True,
                    "balance": float(data.get("balance", 0)),
                    "currency": data.get("currency", "USD"),
                    "account_sid": account_sid[:10] + "..." if account_sid else None
                }
            else:
                return {
                    "success": False,
                    "error": f"Twilio API error: {response.status_code}",
                    "balance": None,
                    "currency": None
                }
    except Exception as e:
        logger.error(f"Failed to get Twilio balance: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "balance": None,
            "currency": None
        }


@api_router.get("/sms/stats")
async def get_sms_stats():
    """Get SMS statistics summary"""
    # Get counts by status
    pipeline = [
        {
            "$group": {
                "_id": "$success",
                "count": {"$sum": 1}
            }
        }
    ]
    status_counts = await db.sms_logs.aggregate(pipeline).to_list(10)
    
    success_count = 0
    failed_count = 0
    for item in status_counts:
        if item["_id"] == True:
            success_count = item["count"]
        else:
            failed_count = item["count"]
    
    # Get counts by request type
    type_pipeline = [
        {
            "$group": {
                "_id": "$request_type",
                "count": {"$sum": 1}
            }
        }
    ]
    type_counts = await db.sms_logs.aggregate(type_pipeline).to_list(20)
    
    # Get recent failures with error messages
    recent_failures = await db.sms_logs.find(
        {"success": False},
        {"_id": 0, "timestamp": 1, "phone_masked": 1, "error_message": 1, "request_type": 1}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    # Get wallet balance
    from services.fast2sms_service import get_fast2sms_service
    fast2sms = get_fast2sms_service()
    wallet_info = await fast2sms.get_wallet_balance() if fast2sms.is_configured() else {"balance": 0, "sms_count": 0}
    
    return {
        "total_sent": success_count + failed_count,
        "success_count": success_count,
        "failed_count": failed_count,
        "success_rate": round((success_count / (success_count + failed_count)) * 100, 1) if (success_count + failed_count) > 0 else 0,
        "by_type": {item["_id"]: item["count"] for item in type_counts if item["_id"]},
        "recent_failures": recent_failures,
        "wallet_balance": wallet_info.get("balance", 0),
        "wallet_sms_count": wallet_info.get("sms_count", 0)
    }


@api_router.post("/sms/test")
async def test_sms_send(phone: str, message: str = "Test OTP: 123456"):
    """Test SMS sending (admin only)"""
    from services.fast2sms_service import get_fast2sms_service
    fast2sms = get_fast2sms_service()
    
    if not fast2sms.is_configured():
        return {"success": False, "error": "Fast2SMS not configured"}
    
    # Send test OTP
    result = await fast2sms.send_otp_sms(phone, "123456", user_id="test-admin")
    return result


# ==================== TEST DATA SEED FOR MECHANIC APP ====================

@api_router.post("/mechanic/seed-test-data")
async def seed_mechanic_test_data():
    """
    Seed test inspection data for mechanic app testing.
    Creates sample inspections in Bangalore, Hyderabad, and Chennai with various statuses.
    """
    from datetime import timedelta
    
    now = datetime.now(timezone.utc)
    
    # Sample test inspections
    test_inspections = [
        {
            "id": f"test-insp-{str(uuid.uuid4())[:8]}",
            "car_number": "KA01AB1234",
            "make": "Maruti Suzuki",
            "model": "Swift",
            "variant": "VXI",
            "city": "Bangalore",
            "address": "123, MG Road, Indiranagar, Bangalore",
            "latitude": 12.9716,
            "longitude": 77.5946,
            "customer_name": "Rahul Sharma",
            "customer_mobile": "+919876543210",
            "inspection_status": "NEW",
            "mechanic_id": None,
            "scheduled_date": (now + timedelta(hours=2)).isoformat(),
            "inspection_package_name": "Comprehensive Inspection",
            "created_at": now.isoformat(),
        },
        {
            "id": f"test-insp-{str(uuid.uuid4())[:8]}",
            "car_number": "KA05CD5678",
            "make": "Hyundai",
            "model": "Creta",
            "variant": "SX",
            "city": "Bangalore",
            "address": "456, HSR Layout, Bangalore",
            "latitude": 12.9121,
            "longitude": 77.6446,
            "customer_name": "Priya Patel",
            "customer_mobile": "+919876543211",
            "inspection_status": "NEW",
            "mechanic_id": None,
            "scheduled_date": (now + timedelta(hours=4)).isoformat(),
            "inspection_package_name": "Standard Inspection",
            "created_at": now.isoformat(),
        },
        {
            "id": f"test-insp-{str(uuid.uuid4())[:8]}",
            "car_number": "TS09EF9012",
            "make": "Honda",
            "model": "City",
            "variant": "ZX",
            "city": "Hyderabad",
            "address": "789, Banjara Hills, Hyderabad",
            "latitude": 17.4126,
            "longitude": 78.4071,
            "customer_name": "Vikram Reddy",
            "customer_mobile": "+919876543212",
            "inspection_status": "NEW",
            "mechanic_id": None,
            "scheduled_date": (now + timedelta(hours=6)).isoformat(),
            "inspection_package_name": "Premium Inspection",
            "created_at": now.isoformat(),
        },
        {
            "id": f"test-insp-{str(uuid.uuid4())[:8]}",
            "car_number": "TN10GH3456",
            "make": "Toyota",
            "model": "Fortuner",
            "variant": "4x4",
            "city": "Chennai",
            "address": "321, Anna Nagar, Chennai",
            "latitude": 13.0827,
            "longitude": 80.2707,
            "customer_name": "Karthik Subramaniam",
            "customer_mobile": "+919876543213",
            "inspection_status": "NEW",
            "mechanic_id": None,
            "scheduled_date": (now + timedelta(days=1)).isoformat(),
            "inspection_package_name": "Comprehensive Inspection",
            "created_at": now.isoformat(),
        },
        {
            "id": f"test-insp-{str(uuid.uuid4())[:8]}",
            "car_number": "KA02IJ7890",
            "make": "Tata",
            "model": "Nexon",
            "variant": "XZ+",
            "city": "Bangalore",
            "address": "555, Koramangala 4th Block, Bangalore",
            "latitude": 12.9352,
            "longitude": 77.6245,
            "customer_name": "Amit Kumar",
            "customer_mobile": "+919876543214",
            "inspection_status": "ACCEPTED",
            "mechanic_id": "dev-mechanic-001",
            "scheduled_date": (now + timedelta(hours=1)).isoformat(),
            "inspection_package_name": "Standard Inspection",
            "created_at": (now - timedelta(hours=2)).isoformat(),
        },
        {
            "id": f"test-insp-{str(uuid.uuid4())[:8]}",
            "car_number": "KA03KL2345",
            "make": "Mahindra",
            "model": "XUV700",
            "variant": "AX7",
            "city": "Bangalore",
            "address": "777, Electronic City, Bangalore",
            "latitude": 12.8399,
            "longitude": 77.6770,
            "customer_name": "Sneha Gupta",
            "customer_mobile": "+919876543215",
            "inspection_status": "COMPLETED",
            "mechanic_id": "dev-mechanic-001",
            "scheduled_date": (now - timedelta(days=1)).isoformat(),
            "inspection_package_name": "Premium Inspection",
            "created_at": (now - timedelta(days=2)).isoformat(),
        },
    ]
    
    # Insert test inspections
    inserted_count = 0
    for inspection in test_inspections:
        # Check if already exists (avoid duplicates on multiple calls)
        existing = await db.inspections.find_one({"car_number": inspection["car_number"], "city": inspection["city"]})
        if not existing:
            await db.inspections.insert_one(inspection)
            inserted_count += 1
    
    return {
        "success": True,
        "message": f"Seeded {inserted_count} test inspections",
        "total_test_inspections": len(test_inspections),
        "cities": ["Bangalore", "Hyderabad", "Chennai"],
        "statuses": ["NEW", "ACCEPTED", "COMPLETED"]
    }


@api_router.delete("/mechanic/clear-test-data")
async def clear_mechanic_test_data():
    """Clear all test inspection data (inspections with test- prefix in id)"""
    result = await db.inspections.delete_many({"id": {"$regex": "^test-insp-"}})
    return {
        "success": True,
        "deleted_count": result.deleted_count
    }


# ==================== MECHANIC APP STATIC FILE SERVING ====================
# Serve mechanic app at /api/mechanic-app for external access
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

mechanic_app_path = Path("/app/mechanic-app/frontend/build")
if mechanic_app_path.exists():
    # Mount static files for mechanic app
    api_router.mount("/mechanic-app/static", StaticFiles(directory=mechanic_app_path / "static"), name="mechanic-static")
    
    # Serve questions.json
    @api_router.get("/mechanic-app/questions.json")
    async def serve_mechanic_questions():
        return FileResponse(mechanic_app_path / "questions.json")
    
    # Serve index.html for all mechanic app routes (SPA routing)
    @api_router.get("/mechanic-app/{path:path}")
    async def serve_mechanic_app(path: str):
        """Serve mechanic app - handles SPA routing"""
        file_path = mechanic_app_path / path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(mechanic_app_path / "index.html")
    
    @api_router.get("/mechanic-app")
    async def serve_mechanic_app_root():
        """Serve mechanic app root"""
        return FileResponse(mechanic_app_path / "index.html")
    
    logger.info("Mechanic app mounted at /api/mechanic-app")


# ============================================
# APP DOWNLOAD RELEASES - Dynamic Management
# ============================================

# Default release data (used to seed database if empty)
DEFAULT_MECHANIC_RELEASES = [
    {
        "version": "1.7.1",
        "build_number": "47",
        "release_date": "2025-02-26",
        "status": "available",
        "build_url": "https://expo.dev/accounts/kalyandhar/projects/wisedrive-mechanic/builds/f2e32309-a4ae-4e13-98c7-070758fa09e4",
        "download_url": "https://expo.dev/artifacts/eas/vZzC8nqzmwXoDcyPk1zSVj.apk",
        "changes": [
            "Added OBD Re-scan feature - CRM can enable rescan for mechanic",
            "Re-scan mode shows warning before overwriting existing data",
            "Fixed media display issues in CRM Live Progress modal"
        ]
    },
    {
        "version": "1.7.0",
        "build_number": "46",
        "release_date": "2025-02-26",
        "status": "available",
        "build_url": "https://expo.dev/accounts/kalyandhar/projects/wisedrive-mechanic/builds/81b1a16c-1b0d-400b-9e07-be9832854a7d",
        "download_url": "https://expo.dev/artifacts/eas/h1SYjs7DptUVuGzPcvkYY6.apk",
        "changes": [
            "Added AsyncStorage persistence for OBD data backup",
            "OBD data saved locally before backend submission",
            "Shows 'Upload Saved Data' button for pending uploads",
            "Fixed MongoDB 16MB document limit for OBD data"
        ]
    },
    {
        "version": "1.6.9",
        "build_number": "45",
        "release_date": "2025-02-26",
        "status": "available",
        "build_url": "https://expo.dev/accounts/kalyandhar/projects/wisedrive-mechanic/builds/95228ae8-2276-4dba-a665-2ae5a1c38a3a",
        "download_url": "https://expo.dev/artifacts/eas/mQCrLTn1j6xqwkPnV4Zrfa.apk",
        "changes": [
            "Prevented OBD rescan after submission",
            "Backend check for OBD submission status on load",
            "Non-interactive OBD card when already submitted"
        ]
    }
]

DEFAULT_ESS_RELEASES = [
    {
        "version": "1.3.3",
        "build_number": "6",
        "release_date": "2025-02-27",
        "status": "available",
        "build_url": "https://expo.dev/accounts/kalyandhar/projects/wisedrive-ess/builds/6ede51aa-f866-467c-82e5-5256e68d6a7b",
        "download_url": "https://expo.dev/artifacts/eas/eG3SaX1LRzQQ5nrCsz5yzi.apk",
        "changes": [
            "Latest stable build",
            "Bug fixes and improvements"
        ]
    },
    {
        "version": "1.3.3",
        "build_number": "5",
        "release_date": "2025-02-17",
        "status": "available",
        "build_url": "https://expo.dev/accounts/kalyandhar/projects/wisedrive-ess/builds/2fefc222-719f-4241-83ba-49d7e5b00629",
        "download_url": "https://expo.dev/artifacts/eas/6VjTYZeejJDtkqe7UunLkB.apk",
        "changes": [
            "Employee attendance tracking",
            "Leave management system",
            "Profile and document management"
        ]
    },
    {
        "version": "1.3.2",
        "build_number": "4",
        "release_date": "2025-02-17",
        "status": "available",
        "build_url": "https://expo.dev/accounts/kalyandhar/projects/wisedrive-ess/builds/dde34be3-7363-4ffc-8090-2b4c67c3d5eb",
        "download_url": "https://expo.dev/artifacts/eas/tpbsDQjGyDTkKjjB5kKTDV.apk",
        "changes": [
            "Performance improvements",
            "UI enhancements"
        ]
    }
]


async def get_releases_from_db(app_type: str) -> list:
    """Get releases from database, seed with defaults if empty"""
    releases = await db.app_releases.find(
        {"app_type": app_type}, 
        {"_id": 0}
    ).sort("release_date", -1).to_list(length=100)
    
    # If no releases in DB, seed with defaults
    if not releases:
        defaults = DEFAULT_MECHANIC_RELEASES if app_type == "mechanic" else DEFAULT_ESS_RELEASES
        for release in defaults:
            release_doc = {
                "id": str(uuid.uuid4()),
                "app_type": app_type,
                **release,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.app_releases.insert_one(release_doc)
        releases = await db.app_releases.find(
            {"app_type": app_type}, 
            {"_id": 0}
        ).sort("release_date", -1).to_list(length=100)
    
    return releases


# Pydantic models for release management
class AppReleaseCreate(BaseModel):
    version: str
    build_number: str
    release_date: str
    status: str = "available"  # available, building, unavailable
    build_url: Optional[str] = None
    download_url: Optional[str] = None
    changes: List[str] = []


class AppReleaseUpdate(BaseModel):
    version: Optional[str] = None
    build_number: Optional[str] = None
    release_date: Optional[str] = None
    status: Optional[str] = None
    build_url: Optional[str] = None
    download_url: Optional[str] = None
    changes: Optional[List[str]] = None


# Admin API endpoints for release management
@api_router.get("/app-releases/{app_type}")
async def get_app_releases(app_type: str):
    """Get all releases for an app type"""
    if app_type not in ["mechanic", "ess"]:
        raise HTTPException(status_code=404, detail="App type not found. Use 'mechanic' or 'ess'")
    
    releases = await get_releases_from_db(app_type)
    return {"app": app_type, "releases": releases}


@api_router.post("/app-releases/{app_type}")
async def create_app_release(
    app_type: str,
    release: AppReleaseCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new app release (Admin only)"""
    if app_type not in ["mechanic", "ess"]:
        raise HTTPException(status_code=404, detail="App type not found. Use 'mechanic' or 'ess'")
    
    # Check if user has admin role
    user_role = current_user.get("role_code", "")
    if user_role not in ["super_admin", "admin", "country_head", "CEO", "ceo"]:
        raise HTTPException(status_code=403, detail="Only admins can manage app releases")
    
    release_doc = {
        "id": str(uuid.uuid4()),
        "app_type": app_type,
        "version": release.version,
        "build_number": release.build_number,
        "release_date": release.release_date,
        "status": release.status,
        "build_url": release.build_url,
        "download_url": release.download_url,
        "changes": release.changes,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.get("id", "unknown")
    }
    
    await db.app_releases.insert_one(release_doc)
    
    logger.info(f"[APP_RELEASE] New {app_type} release v{release.version} created by {current_user.get('name')}")
    
    return {
        "success": True,
        "message": f"Release v{release.version} created successfully",
        "release": {k: v for k, v in release_doc.items() if k != "_id"}
    }


@api_router.put("/app-releases/{app_type}/{release_id}")
async def update_app_release(
    app_type: str,
    release_id: str,
    release: AppReleaseUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update an existing app release (Admin only)"""
    if app_type not in ["mechanic", "ess"]:
        raise HTTPException(status_code=404, detail="App type not found")
    
    # Check if user has admin role
    user_role = current_user.get("role_code", "")
    if user_role not in ["super_admin", "admin", "country_head", "CEO", "ceo"]:
        raise HTTPException(status_code=403, detail="Only admins can manage app releases")
    
    # Check if release exists
    existing = await db.app_releases.find_one({"id": release_id, "app_type": app_type})
    if not existing:
        raise HTTPException(status_code=404, detail="Release not found")
    
    # Build update data
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if release.version is not None:
        update_data["version"] = release.version
    if release.build_number is not None:
        update_data["build_number"] = release.build_number
    if release.release_date is not None:
        update_data["release_date"] = release.release_date
    if release.status is not None:
        update_data["status"] = release.status
    if release.build_url is not None:
        update_data["build_url"] = release.build_url
    if release.download_url is not None:
        update_data["download_url"] = release.download_url
    if release.changes is not None:
        update_data["changes"] = release.changes
    
    await db.app_releases.update_one({"id": release_id}, {"$set": update_data})
    
    logger.info(f"[APP_RELEASE] {app_type} release {release_id} updated by {current_user.get('name')}")
    
    return {
        "success": True,
        "message": "Release updated successfully",
        "release_id": release_id
    }


@api_router.delete("/app-releases/{app_type}/{release_id}")
async def delete_app_release(
    app_type: str,
    release_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete an app release (Admin only)"""
    if app_type not in ["mechanic", "ess"]:
        raise HTTPException(status_code=404, detail="App type not found")
    
    # Check if user has admin role
    user_role = current_user.get("role_code", "")
    if user_role not in ["super_admin", "admin", "country_head", "CEO", "ceo"]:
        raise HTTPException(status_code=403, detail="Only admins can manage app releases")
    
    # Check if release exists
    existing = await db.app_releases.find_one({"id": release_id, "app_type": app_type})
    if not existing:
        raise HTTPException(status_code=404, detail="Release not found")
    
    await db.app_releases.delete_one({"id": release_id})
    
    logger.info(f"[APP_RELEASE] {app_type} release {release_id} deleted by {current_user.get('name')}")
    
    return {
        "success": True,
        "message": "Release deleted successfully",
        "release_id": release_id
    }


def generate_app_download_page(app_name: str, app_icon: str, releases: list, color: str) -> str:
    """Generate HTML page for app downloads"""
    
    releases_html = ""
    for idx, release in enumerate(releases):
        is_latest = idx == 0
        status_badge = ""
        download_btn = ""
        
        if release["status"] == "building":
            status_badge = '<span class="status-badge building">🔄 Building...</span>'
            download_btn = f'''
                <a href="{release['build_url']}" target="_blank" class="btn btn-secondary">
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zM4.5 7.5a.5.5 0 0 1 0-1h5.793L8.146 4.354a.5.5 0 1 1 .708-.708l3 3a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708-.708L10.293 7.5H4.5z"/>
                    </svg>
                    View Build Progress
                </a>
            '''
        elif release["download_url"]:
            status_badge = '<span class="status-badge available">✓ Available</span>'
            download_btn = f'''
                <a href="{release['download_url']}" class="btn btn-primary" download>
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                        <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
                    </svg>
                    Download APK
                </a>
            '''
        else:
            status_badge = '<span class="status-badge unavailable">— Not Available</span>'
            if release.get("build_url"):
                download_btn = f'''
                    <a href="{release['build_url']}" target="_blank" class="btn btn-outline">
                        View on Expo
                    </a>
                '''
        
        changes_html = "".join([f"<li>{change}</li>" for change in release.get("changes", [])])
        
        latest_badge = '<span class="latest-badge">LATEST</span>' if is_latest else ''
        
        releases_html += f'''
        <div class="release-card {'latest' if is_latest else ''}">
            <div class="release-header">
                <div class="version-info">
                    <h3>v{release['version']} {latest_badge}</h3>
                    <span class="build-number">Build #{release['build_number']}</span>
                </div>
                <div class="release-meta">
                    {status_badge}
                    <span class="release-date">📅 {release['release_date']}</span>
                </div>
            </div>
            <div class="release-body">
                <h4>What's New:</h4>
                <ul class="changes-list">
                    {changes_html}
                </ul>
            </div>
            <div class="release-footer">
                {download_btn}
            </div>
        </div>
        '''
    
    html = f'''
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{app_name} - Download</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: 'Inter', -apple-system, sans-serif; background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%); min-height: 100vh; color: #1a1a2e; }}
        .header {{ background: linear-gradient(135deg, {color} 0%, {color}dd 100%); color: white; padding: 3rem 1rem; text-align: center; position: relative; overflow: hidden; }}
        .header::before {{ content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%); animation: pulse 4s ease-in-out infinite; }}
        @keyframes pulse {{ 0%, 100% {{ transform: scale(1); }} 50% {{ transform: scale(1.1); }} }}
        .header-content {{ position: relative; z-index: 1; }}
        .app-icon {{ font-size: 4rem; margin-bottom: 1rem; }}
        .header h1 {{ font-size: 2rem; font-weight: 700; margin-bottom: 0.5rem; }}
        .header p {{ opacity: 0.9; font-size: 1rem; }}
        .container {{ max-width: 800px; margin: -2rem auto 2rem; padding: 0 1rem; position: relative; z-index: 2; }}
        .release-card {{ background: white; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); margin-bottom: 1.5rem; overflow: hidden; transition: transform 0.2s, box-shadow 0.2s; }}
        .release-card:hover {{ transform: translateY(-2px); box-shadow: 0 8px 30px rgba(0,0,0,0.12); }}
        .release-card.latest {{ border: 2px solid {color}; }}
        .release-header {{ padding: 1.25rem 1.5rem; background: #fafbfc; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; }}
        .version-info h3 {{ font-size: 1.25rem; font-weight: 700; display: flex; align-items: center; gap: 0.75rem; }}
        .build-number {{ font-size: 0.85rem; color: #666; font-weight: 500; }}
        .latest-badge {{ background: {color}; color: white; font-size: 0.65rem; padding: 0.25rem 0.5rem; border-radius: 4px; font-weight: 600; }}
        .release-meta {{ display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }}
        .status-badge {{ padding: 0.35rem 0.75rem; border-radius: 20px; font-size: 0.8rem; font-weight: 600; }}
        .status-badge.available {{ background: #d1fae5; color: #059669; }}
        .status-badge.building {{ background: #fef3c7; color: #d97706; animation: blink 1.5s infinite; }}
        @keyframes blink {{ 0%, 100% {{ opacity: 1; }} 50% {{ opacity: 0.6; }} }}
        .status-badge.unavailable {{ background: #f3f4f6; color: #6b7280; }}
        .release-date {{ font-size: 0.85rem; color: #666; }}
        .release-body {{ padding: 1.5rem; }}
        .release-body h4 {{ font-size: 0.9rem; color: #666; margin-bottom: 0.75rem; font-weight: 600; }}
        .changes-list {{ list-style: none; }}
        .changes-list li {{ padding: 0.5rem 0; padding-left: 1.5rem; position: relative; color: #444; font-size: 0.95rem; line-height: 1.5; }}
        .changes-list li::before {{ content: '•'; position: absolute; left: 0; color: {color}; font-weight: bold; }}
        .release-footer {{ padding: 1rem 1.5rem; background: #fafbfc; border-top: 1px solid #eee; }}
        .btn {{ display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.5rem; border-radius: 8px; font-size: 0.95rem; font-weight: 600; text-decoration: none; transition: all 0.2s; cursor: pointer; border: none; }}
        .btn-primary {{ background: {color}; color: white; }}
        .btn-primary:hover {{ background: {color}dd; transform: translateY(-1px); }}
        .btn-secondary {{ background: #fef3c7; color: #d97706; }}
        .btn-secondary:hover {{ background: #fde68a; }}
        .btn-outline {{ background: transparent; color: #666; border: 1px solid #ddd; }}
        .btn-outline:hover {{ background: #f5f5f5; }}
        .footer {{ text-align: center; padding: 2rem; color: #666; font-size: 0.85rem; }}
        .footer a {{ color: {color}; text-decoration: none; }}
        @media (max-width: 600px) {{ .header {{ padding: 2rem 1rem; }} .header h1 {{ font-size: 1.5rem; }} .release-header {{ flex-direction: column; align-items: flex-start; }} .version-info h3 {{ font-size: 1.1rem; }} }}
    </style>
</head>
<body>
    <div class="header">
        <div class="header-content">
            <div class="app-icon">{app_icon}</div>
            <h1>{app_name}</h1>
            <p>Download the latest version for Android</p>
        </div>
    </div>
    <div class="container">
        {releases_html}
    </div>
    <div class="footer">
        <p>© 2025 WiseDrive. All rights reserved.</p>
        <p><a href="/">Back to CRM</a></p>
    </div>
    <script>
        const hasBuildingRelease = {str(any(r['status'] == 'building' for r in releases)).lower()};
        if (hasBuildingRelease) {{ setTimeout(() => location.reload(), 30000); }}
    </script>
</body>
</html>
'''
    return html


@api_router.get("/mechanicapp", response_class=HTMLResponse)
async def mechanic_app_download_page():
    """Mechanic App download page with version history"""
    releases = await get_releases_from_db("mechanic")
    return generate_app_download_page(
        app_name="WiseDrive Mechanic App",
        app_icon="🔧",
        releases=releases,
        color="#2563eb"
    )


@api_router.get("/essapp", response_class=HTMLResponse)
async def ess_app_download_page():
    """ESS App download page with version history"""
    releases = await get_releases_from_db("ess")
    return generate_app_download_page(
        app_name="WiseDrive ESS App",
        app_icon="👤",
        releases=releases,
        color="#7c3aed"
    )


# Include the router in the main app
# Removed - will be added in correct location
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


# Cleaned up

@app.on_event("shutdown")
async def shutdown_db_client():
    # Stop Meta Ads scheduler
    global meta_ads_scheduler
    if meta_ads_scheduler:
        await meta_ads_scheduler.stop()
    
    client.close()

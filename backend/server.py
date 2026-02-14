"""WiseDrive CRM V2 - Multi-tenant RBAC Backend"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request
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
from passlib.context import CryptContext

# Import V2 models
from models.user import (
    User, UserCreate, UserUpdate, UserBase, UserWithPermissions,
    Role, RoleCreate, Permission, RolePermission
)
from models.organization import Department, DepartmentCreate, Team, TeamCreate
from models.lead import Lead, LeadCreate, LeadUpdate, LeadReassignmentLog, LeadReassignRequest
from models.customer import Customer, CustomerCreate, CustomerUpdate
from models.inspection import Inspection, InspectionCreate, InspectionUpdate
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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET', 'wisedrive-crm-secret-key-2024')
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


@app.on_event("startup")
async def startup():
    global rbac_service, round_robin_service, audit_service
    rbac_service = RBACService(db)
    round_robin_service = RoundRobinService(db)
    audit_service = AuditService(db)
    logger.info("WiseDrive CRM V2 started")


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
    return pwd_context.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return pwd_context.verify(password, hashed)


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
        
        # Enrich with role and permissions
        if user.get("role_id"):
            role = await db.roles.find_one({"id": user["role_id"]}, {"_id": 0})
            if role:
                user["role_name"] = role.get("name")
                user["role_code"] = role.get("code")
                user["role_level"] = role.get("level")
        
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
            "team_id": user.get("team_id")
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
    status: Optional[str] = None,
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
    if status:
        query["status"] = status
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
    
    # Enrich with assigned_to name
    for lead in leads:
        if lead.get("assigned_to"):
            agent = await db.users.find_one({"id": lead["assigned_to"]}, {"_id": 0, "name": 1})
            if agent:
                lead["assigned_to_name"] = agent.get("name")
    
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
    
    # Check permission
    can_reassign = await rbac_service.can_reassign_lead(
        current_user["id"],
        lead.get("team_id")
    )
    if not can_reassign:
        raise HTTPException(status_code=403, detail="Not authorized to reassign leads")
    
    # Perform reassignment
    await round_robin_service.assign_lead(
        lead_id=lead_id,
        country_id=lead["country_id"],
        team_id=lead.get("team_id"),
        assigner_id=current_user["id"],
        manual_agent_id=reassign_data.new_agent_id,
        reason=reassign_data.reason
    )
    
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
    
    employees = await db.users.find(query, {"_id": 0, "hashed_password": 0}).sort("created_at", -1).to_list(1000)
    
    # Enrich with role, country, department info
    for emp in employees:
        if emp.get("role_id"):
            role = await db.roles.find_one({"id": emp["role_id"]}, {"_id": 0, "name": 1, "code": 1})
            if role:
                emp["role_name"] = role.get("name")
                emp["role_code"] = role.get("code")
        
        if emp.get("country_id"):
            country = await db.countries.find_one({"id": emp["country_id"]}, {"_id": 0, "name": 1, "currency": 1})
            if country:
                emp["country_name"] = country.get("name")
                emp["currency"] = country.get("currency")
        
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
    
    return employees


@api_router.get("/hr/employees/{employee_id}")
async def get_hr_employee(employee_id: str, current_user: dict = Depends(get_current_user)):
    """Get single employee with all details"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER", "COUNTRY_HEAD"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    emp = await db.users.find_one({"id": employee_id}, {"_id": 0, "hashed_password": 0})
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
    
    # Check if role is mechanic - no CRM access
    if emp_dict.get("role_id"):
        role = await db.roles.find_one({"id": emp_dict["role_id"]}, {"_id": 0, "code": 1})
        if role and role.get("code") == "MECHANIC":
            emp_dict["has_crm_access"] = False
    
    await db.users.insert_one(emp_dict)
    emp_dict.pop("_id", None)
    emp_dict.pop("hashed_password", None)
    
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
        new_values=update_dict
    )
    
    emp = await db.users.find_one({"id": employee_id}, {"_id": 0, "hashed_password": 0})
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
    if salary_dict.get("employment_type") in ["full_time", "part_time"]:
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

@api_router.get("/hr/employees/{employee_id}/documents")
async def get_employee_documents(employee_id: str, current_user: dict = Depends(get_current_user)):
    """Get employee documents"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        if current_user.get("id") != employee_id:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    documents = await db.employee_documents.find(
        {"user_id": employee_id},
        {"_id": 0}
    ).to_list(50)
    
    return documents


@api_router.post("/hr/employees/{employee_id}/documents")
async def create_employee_document(employee_id: str, doc_data: DocumentCreate, current_user: dict = Depends(get_current_user)):
    """Add employee document"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    doc_dict = doc_data.model_dump()
    doc_dict["user_id"] = employee_id
    doc_dict["id"] = str(uuid.uuid4())
    doc_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.employee_documents.insert_one(doc_dict)
    doc_dict.pop("_id", None)
    
    # Log audit
    await audit_service.log(
        entity_type="employee",
        entity_id=employee_id,
        action="document_added",
        user_id=current_user["id"],
        new_values={"document_type": doc_dict["document_type"], "document_name": doc_dict["document_name"]}
    )
    
    return doc_dict


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
        status = att.get("status", "present")
        
        if status == "present":
            monthly_summary[month]["present"] += 1
        elif status == "absent":
            monthly_summary[month]["absent"] += 1
            monthly_summary[month]["leaves_taken"] += 1
        elif status == "half_day":
            monthly_summary[month]["half_day"] += 1
            monthly_summary[month]["leaves_taken"] += 0.5
        elif status == "on_leave":
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
    """Toggle lead assignment for employee"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    is_available = data.get("is_available_for_leads", True)
    reason = data.get("reason", "")
    
    await db.users.update_one(
        {"id": employee_id},
        {"$set": {
            "is_available_for_leads": is_available,
            "lead_assignment_paused_reason": reason if not is_available else None,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Log audit
    await audit_service.log(
        entity_type="employee",
        entity_id=employee_id,
        action="lead_assignment_toggle",
        user_id=current_user["id"],
        new_values={"is_available_for_leads": is_available, "reason": reason}
    )
    
    return {"is_available_for_leads": is_available}


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


# ==================== PUBLIC COUNTRIES (For Login) ====================

@api_router.get("/countries/login")
async def get_login_countries():
    """Get countries for login page - no auth required"""
    countries = await db.countries.find(
        {"is_active": True},
        {"_id": 0, "id": 1, "name": 1, "code": 1, "currency": 1}
    ).to_list(100)
    return countries


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
    status: Optional[str] = None,
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
    if status:
        query["status"] = status
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
    
    # Get employee details
    emp = await db.users.find_one({"id": payment["employee_id"]}, {"_id": 0})
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
    
    # Get country currency
    currency = "INR"
    currency_symbol = "₹"
    if payment.get("country_id"):
        country = await db.countries.find_one({"id": payment["country_id"]}, {"_id": 0, "currency": 1, "currency_symbol": 1})
        if country:
            currency = country.get("currency", "INR")
            currency_symbol = country.get("currency_symbol", "₹")
    
    # Get salary structure for detailed breakdown
    salary_structure = await db.salary_structures.find_one(
        {"user_id": payment["employee_id"], "effective_to": None},
        {"_id": 0}
    )
    
    is_mechanic = role_code_emp == "MECHANIC" or payment.get("payment_type") == "mechanic_payout"
    
    payslip_data = {
        # Company info
        "company_name": "WiseDrive Technologies",
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
        
        # For salary payments
        "is_mechanic": is_mechanic,
        "basic_salary": salary_structure.get("basic_salary", 0) if salary_structure else 0,
        "hra": salary_structure.get("hra", 0) if salary_structure else 0,
        "conveyance_allowance": salary_structure.get("conveyance_allowance", 0) if salary_structure else 0,
        "medical_allowance": salary_structure.get("medical_allowance", 0) if salary_structure else 0,
        "special_allowance": salary_structure.get("special_allowance", 0) if salary_structure else 0,
        "variable_pay": salary_structure.get("variable_pay", 0) if salary_structure else 0,
        "gross_salary": payment.get("gross_amount", 0),
        
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

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
    Role, RoleCreate, Permission, RolePermission, SalaryStructure
)
from models.organization import Country, CountryCreate, Department, DepartmentCreate, Team, TeamCreate
from models.lead import Lead, LeadCreate, LeadUpdate, LeadReassignmentLog, LeadReassignRequest
from models.customer import Customer, CustomerCreate, CustomerUpdate
from models.inspection import Inspection, InspectionCreate, InspectionUpdate
from models.audit import AuditLog

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
    
    query = {"is_active": True}
    if role_code != "CEO" and role_code != "HR_MANAGER":
        query["country_id"] = current_user.get("country_id")
    
    users = await db.users.find(query, {"_id": 0, "hashed_password": 0}).to_list(1000)
    
    # Transform to V1 format
    for user in users:
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


# ==================== HR / SALARY ROUTES ====================

class SalaryCreate(BaseModel):
    user_id: str
    ctc: float = 0
    fixed_pay: float = 0
    variable_pay: float = 0
    commission_percentage: float = 0
    per_inspection_payout: float = 0
    incentive_structure: Optional[dict] = None
    currency: str = "INR"
    effective_from: Optional[str] = None


class SalaryUpdate(BaseModel):
    ctc: Optional[float] = None
    fixed_pay: Optional[float] = None
    variable_pay: Optional[float] = None
    commission_percentage: Optional[float] = None
    per_inspection_payout: Optional[float] = None
    incentive_structure: Optional[dict] = None
    effective_from: Optional[str] = None
    effective_to: Optional[str] = None


@api_router.get("/salaries")
async def get_salaries(
    user_id: Optional[str] = None,
    country_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get salary structures - HR and CEO only"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized to view salaries")
    
    query = {}
    if user_id:
        query["user_id"] = user_id
    
    salaries = await db.salary_structures.find(query, {"_id": 0}).to_list(1000)
    
    # Enrich with user info
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


@api_router.get("/salaries/{user_id}")
async def get_user_salary(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get salary for a specific user"""
    role_code = current_user.get("role_code", "")
    
    # Check permission
    if role_code not in ["CEO", "HR_MANAGER"]:
        # Others can only view their own salary
        if current_user.get("id") != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to view this salary")
    
    salary = await db.salary_structures.find_one(
        {"user_id": user_id, "effective_to": None},  # Get current active salary
        {"_id": 0}
    )
    
    if not salary:
        return None
    
    # Enrich with user info
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "name": 1, "email": 1})
    if user:
        salary["user_name"] = user.get("name")
        salary["user_email"] = user.get("email")
    
    return salary


@api_router.post("/salaries")
async def create_salary(salary_data: SalaryCreate, current_user: dict = Depends(get_current_user)):
    """Create salary structure - HR only"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized to create salaries")
    
    # Check if user exists
    user = await db.users.find_one({"id": salary_data.user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Close any existing active salary
    await db.salary_structures.update_many(
        {"user_id": salary_data.user_id, "effective_to": None},
        {"$set": {"effective_to": datetime.now(timezone.utc).isoformat()}}
    )
    
    salary_dict = salary_data.model_dump()
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
    
    await db.salary_structures.insert_one(salary_dict)
    
    # Remove MongoDB _id before returning
    salary_dict.pop("_id", None)
    
    # Log audit
    await audit_service.log(
        entity_type="salary",
        entity_id=salary_dict["id"],
        action="create",
        user_id=current_user["id"],
        new_values=salary_dict
    )
    
    return salary_dict


@api_router.put("/salaries/{salary_id}")
async def update_salary(salary_id: str, salary_data: SalaryUpdate, current_user: dict = Depends(get_current_user)):
    """Update salary structure"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized to update salaries")
    
    existing = await db.salary_structures.find_one({"id": salary_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Salary structure not found")
    
    update_dict = {k: v for k, v in salary_data.model_dump().items() if v is not None}
    
    await db.salary_structures.update_one({"id": salary_id}, {"$set": update_dict})
    
    # Log audit
    await audit_service.log(
        entity_type="salary",
        entity_id=salary_id,
        action="update",
        user_id=current_user["id"],
        old_values=existing,
        new_values=update_dict
    )
    
    salary = await db.salary_structures.find_one({"id": salary_id}, {"_id": 0})
    return salary


# ==================== AUDIT LOG ROUTES ====================

@api_router.get("/audit-logs")
async def get_audit_logs(
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    action: Optional[str] = None,
    user_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """Get audit logs - CEO, HR, and Country Head can view"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER", "COUNTRY_HEAD"]:
        raise HTTPException(status_code=403, detail="Not authorized to view audit logs")
    
    query = {}
    
    if entity_type:
        query["entity_type"] = entity_type
    if entity_id:
        query["entity_id"] = entity_id
    if action:
        query["action"] = action
    if user_id:
        query["user_id"] = user_id
    if start_date:
        query["timestamp"] = {"$gte": start_date}
    if end_date:
        if "timestamp" in query:
            query["timestamp"]["$lte"] = end_date
        else:
            query["timestamp"] = {"$lte": end_date}
    
    logs = await db.audit_logs.find(query, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    
    return logs


@api_router.get("/audit-logs/entity/{entity_type}/{entity_id}")
async def get_entity_audit_logs(
    entity_type: str,
    entity_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get audit history for a specific entity"""
    logs = await db.audit_logs.find(
        {"entity_type": entity_type, "entity_id": entity_id},
        {"_id": 0}
    ).sort("timestamp", -1).to_list(50)
    
    return logs


@api_router.get("/audit-logs/stats")
async def get_audit_stats(current_user: dict = Depends(get_current_user)):
    """Get audit log statistics"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "HR_MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get counts by entity type
    pipeline = [
        {"$group": {"_id": "$entity_type", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    entity_stats = await db.audit_logs.aggregate(pipeline).to_list(20)
    
    # Get counts by action
    pipeline = [
        {"$group": {"_id": "$action", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    action_stats = await db.audit_logs.aggregate(pipeline).to_list(20)
    
    # Get recent activity count (last 24 hours)
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    recent_count = await db.audit_logs.count_documents({"timestamp": {"$gte": yesterday}})
    
    return {
        "by_entity": {item["_id"]: item["count"] for item in entity_stats if item["_id"]},
        "by_action": {item["_id"]: item["count"] for item in action_stats if item["_id"]},
        "recent_24h": recent_count,
        "total": await db.audit_logs.count_documents({})
    }


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
        "audit_logs", "salary_structures"
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

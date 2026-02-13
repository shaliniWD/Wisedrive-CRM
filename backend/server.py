from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET', 'wisedrive-crm-secret-key-2024')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

# Security
security = HTTPBearer()

# Create the main app
app = FastAPI(title="WiseDrive CRM API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: str = "employee"  # admin, employee

class UserCreate(UserBase):
    password: str

class User(UserBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

class LeadBase(BaseModel):
    name: str
    mobile: str
    city: str
    source: str = "WEBSITE"
    assigned_to: Optional[str] = None
    status: str = "NEW"
    reminder_date: Optional[str] = None
    reminder_time: Optional[str] = None
    notes: Optional[str] = None

class LeadCreate(LeadBase):
    pass

class Lead(LeadBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    payment_link: Optional[str] = None

class CustomerBase(BaseModel):
    name: str
    mobile: str
    city: str
    payment_status: str = "PENDING"
    notes: Optional[str] = None

class CustomerCreate(CustomerBase):
    pass

class Customer(CustomerBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ==================== TRANSACTION MODELS ====================

class TransactionBase(BaseModel):
    customer_id: str
    transaction_type: str  # Comprehensive, Gold, Platinum, Silver
    order_id: str
    amount: float
    payment_date: Optional[str] = None
    payment_status: str = "PENDING"
    car_number: Optional[str] = None
    car_make: Optional[str] = None
    car_model: Optional[str] = None
    car_year: Optional[str] = None

class TransactionCreate(TransactionBase):
    pass

class Transaction(TransactionBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class InspectionBase(BaseModel):
    customer_name: str
    customer_mobile: str
    address: str
    city: str
    payment_status: str = "PENDING"
    inspection_status: str = "SCHEDULED"
    mechanic_name: Optional[str] = None
    car_number: Optional[str] = None
    car_details: Optional[str] = None
    scheduled_date: Optional[str] = None
    scheduled_time: Optional[str] = None
    notes: Optional[str] = None

class InspectionCreate(InspectionBase):
    pass

class Inspection(InspectionBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    report_url: Optional[str] = None

class EmployeeBase(BaseModel):
    name: str
    email: EmailStr
    assigned_cities: List[str] = []
    is_active: bool = True
    role: str = "employee"

class EmployeeCreate(EmployeeBase):
    password: str

class Employee(EmployeeBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DashboardStats(BaseModel):
    total_leads: int
    total_customers: int
    total_inspections: int
    total_employees: int
    leads_today: int
    inspections_today: int
    pending_payments: int
    completed_inspections: int

# ==================== DIGITAL AD MODELS ====================

class DigitalAdBase(BaseModel):
    ad_id: str
    ad_name: str
    city: str
    language: str
    campaign_type: str
    source: str
    ad_amount: Optional[float] = None
    is_active: bool = True

class DigitalAdCreate(DigitalAdBase):
    pass

class DigitalAd(DigitalAdBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ==================== GARAGE EMPLOYEE MODELS ====================

class GarageEmployeeBase(BaseModel):
    grg_owner_name: str
    grg_employee_name: str
    grg_name: str
    city: str
    preferred_language: str
    phone_number: str
    is_active: bool = True

class GarageEmployeeCreate(GarageEmployeeBase):
    pass

class GarageEmployee(GarageEmployeeBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_dict = user_data.model_dump()
    password = user_dict.pop("password")
    user_dict["password_hash"] = hash_password(password)
    user_obj = User(**user_dict)
    doc = user_obj.model_dump()
    doc["password_hash"] = user_dict["password_hash"]
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.users.insert_one(doc)
    
    access_token = create_access_token({"sub": user_obj.id, "email": user_obj.email})
    return Token(
        access_token=access_token,
        user={"id": user_obj.id, "email": user_obj.email, "name": user_obj.name, "role": user_obj.role}
    )

@api_router.post("/auth/login", response_model=Token)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(credentials.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="Account is disabled")
    
    access_token = create_access_token({"sub": user["id"], "email": user["email"]})
    return Token(
        access_token=access_token,
        user={"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"]}
    )

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

# ==================== LEADS ROUTES ====================

@api_router.get("/leads", response_model=List[Lead])
async def get_leads(
    search: Optional[str] = None,
    lead_status: Optional[str] = None,
    city: Optional[str] = None,
    source: Optional[str] = None,
    assigned_to: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
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
    if start_date:
        query["created_at"] = {"$gte": start_date}
    if end_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = end_date
        else:
            query["created_at"] = {"$lte": end_date}
    
    leads = await db.leads.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for lead in leads:
        if isinstance(lead.get('created_at'), str):
            lead['created_at'] = datetime.fromisoformat(lead['created_at'].replace('Z', '+00:00'))
    return leads

@api_router.post("/leads", response_model=Lead)
async def create_lead(lead_data: LeadCreate, current_user: dict = Depends(get_current_user)):
    lead_obj = Lead(**lead_data.model_dump())
    doc = lead_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.leads.insert_one(doc)
    return lead_obj

@api_router.put("/leads/{lead_id}", response_model=Lead)
async def update_lead(lead_id: str, lead_data: LeadCreate, current_user: dict = Depends(get_current_user)):
    result = await db.leads.update_one(
        {"id": lead_id},
        {"$set": lead_data.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if isinstance(lead.get('created_at'), str):
        lead['created_at'] = datetime.fromisoformat(lead['created_at'].replace('Z', '+00:00'))
    return lead

@api_router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.leads.delete_one({"id": lead_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    return {"message": "Lead deleted"}

# ==================== CUSTOMERS ROUTES ====================

@api_router.get("/customers", response_model=List[Customer])
async def get_customers(
    search: Optional[str] = None,
    city: Optional[str] = None,
    payment_status: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"mobile": {"$regex": search, "$options": "i"}}
        ]
    if city:
        query["city"] = city
    if payment_status:
        query["payment_status"] = payment_status
    if start_date:
        query["created_at"] = {"$gte": start_date}
    if end_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = end_date
        else:
            query["created_at"] = {"$lte": end_date}
    
    customers = await db.customers.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for customer in customers:
        if isinstance(customer.get('created_at'), str):
            customer['created_at'] = datetime.fromisoformat(customer['created_at'].replace('Z', '+00:00'))
    return customers

@api_router.post("/customers", response_model=Customer)
async def create_customer(customer_data: CustomerCreate, current_user: dict = Depends(get_current_user)):
    customer_obj = Customer(**customer_data.model_dump())
    doc = customer_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.customers.insert_one(doc)
    return customer_obj

@api_router.put("/customers/{customer_id}", response_model=Customer)
async def update_customer(customer_id: str, customer_data: CustomerCreate, current_user: dict = Depends(get_current_user)):
    result = await db.customers.update_one(
        {"id": customer_id},
        {"$set": customer_data.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if isinstance(customer.get('created_at'), str):
        customer['created_at'] = datetime.fromisoformat(customer['created_at'].replace('Z', '+00:00'))
    return customer

@api_router.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.customers.delete_one({"id": customer_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"message": "Customer deleted"}

# ==================== INSPECTIONS ROUTES ====================

@api_router.get("/inspections", response_model=List[Inspection])
async def get_inspections(
    search: Optional[str] = None,
    city: Optional[str] = None,
    inspection_status: Optional[str] = None,
    payment_status: Optional[str] = None,
    is_scheduled: Optional[bool] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if search:
        query["$or"] = [
            {"customer_name": {"$regex": search, "$options": "i"}},
            {"customer_mobile": {"$regex": search, "$options": "i"}},
            {"car_number": {"$regex": search, "$options": "i"}}
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
    if start_date:
        query["created_at"] = {"$gte": start_date}
    if end_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = end_date
        else:
            query["created_at"] = {"$lte": end_date}
    
    inspections = await db.inspections.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for inspection in inspections:
        if isinstance(inspection.get('created_at'), str):
            inspection['created_at'] = datetime.fromisoformat(inspection['created_at'].replace('Z', '+00:00'))
    return inspections

@api_router.post("/inspections", response_model=Inspection)
async def create_inspection(inspection_data: InspectionCreate, current_user: dict = Depends(get_current_user)):
    inspection_obj = Inspection(**inspection_data.model_dump())
    doc = inspection_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.inspections.insert_one(doc)
    return inspection_obj

@api_router.put("/inspections/{inspection_id}", response_model=Inspection)
async def update_inspection(inspection_id: str, inspection_data: InspectionCreate, current_user: dict = Depends(get_current_user)):
    result = await db.inspections.update_one(
        {"id": inspection_id},
        {"$set": inspection_data.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Inspection not found")
    inspection = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
    if isinstance(inspection.get('created_at'), str):
        inspection['created_at'] = datetime.fromisoformat(inspection['created_at'].replace('Z', '+00:00'))
    return inspection

@api_router.delete("/inspections/{inspection_id}")
async def delete_inspection(inspection_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.inspections.delete_one({"id": inspection_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Inspection not found")
    return {"message": "Inspection deleted"}

# ==================== EMPLOYEES ROUTES ====================

@api_router.get("/employees", response_model=List[Employee])
async def get_employees(current_user: dict = Depends(get_current_user)):
    employees = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    for emp in employees:
        if isinstance(emp.get('created_at'), str):
            emp['created_at'] = datetime.fromisoformat(emp['created_at'].replace('Z', '+00:00'))
        emp['assigned_cities'] = emp.get('assigned_cities', [])
    return employees

@api_router.post("/employees", response_model=Employee)
async def create_employee(employee_data: EmployeeCreate, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create employees")
    
    existing = await db.users.find_one({"email": employee_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    emp_dict = employee_data.model_dump()
    password = emp_dict.pop("password")
    emp_dict["password_hash"] = hash_password(password)
    emp_obj = Employee(**emp_dict)
    doc = emp_obj.model_dump()
    doc["password_hash"] = emp_dict["password_hash"]
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.users.insert_one(doc)
    return emp_obj

@api_router.put("/employees/{employee_id}", response_model=Employee)
async def update_employee(employee_id: str, employee_data: EmployeeBase, current_user: dict = Depends(get_current_user)):
    result = await db.users.update_one(
        {"id": employee_id},
        {"$set": employee_data.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    employee = await db.users.find_one({"id": employee_id}, {"_id": 0, "password_hash": 0})
    if isinstance(employee.get('created_at'), str):
        employee['created_at'] = datetime.fromisoformat(employee['created_at'].replace('Z', '+00:00'))
    employee['assigned_cities'] = employee.get('assigned_cities', [])
    return employee

@api_router.patch("/employees/{employee_id}/toggle-status")
async def toggle_employee_status(employee_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can toggle employee status")
    
    employee = await db.users.find_one({"id": employee_id})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    new_status = not employee.get("is_active", True)
    await db.users.update_one({"id": employee_id}, {"$set": {"is_active": new_status}})
    return {"is_active": new_status}

@api_router.patch("/employees/{employee_id}/assign-city")
async def assign_city_to_employee(employee_id: str, city: str, current_user: dict = Depends(get_current_user)):
    employee = await db.users.find_one({"id": employee_id})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    cities = employee.get("assigned_cities", [])
    if city not in cities:
        cities.append(city)
    await db.users.update_one({"id": employee_id}, {"$set": {"assigned_cities": cities}})
    return {"assigned_cities": cities}

# ==================== DIGITAL ADS ROUTES ====================

@api_router.get("/digital-ads", response_model=List[DigitalAd])
async def get_digital_ads(current_user: dict = Depends(get_current_user)):
    ads = await db.digital_ads.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for ad in ads:
        if isinstance(ad.get('created_at'), str):
            ad['created_at'] = datetime.fromisoformat(ad['created_at'].replace('Z', '+00:00'))
    return ads

@api_router.post("/digital-ads", response_model=DigitalAd)
async def create_digital_ad(ad_data: DigitalAdCreate, current_user: dict = Depends(get_current_user)):
    ad_obj = DigitalAd(**ad_data.model_dump())
    doc = ad_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.digital_ads.insert_one(doc)
    return ad_obj

@api_router.put("/digital-ads/{ad_id}")
async def update_digital_ad(ad_id: str, ad_data: DigitalAdCreate, current_user: dict = Depends(get_current_user)):
    result = await db.digital_ads.update_one(
        {"id": ad_id},
        {"$set": ad_data.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ad not found")
    return {"message": "Ad updated"}

@api_router.patch("/digital-ads/{ad_id}/toggle-status")
async def toggle_ad_status(ad_id: str, current_user: dict = Depends(get_current_user)):
    ad = await db.digital_ads.find_one({"id": ad_id})
    if not ad:
        raise HTTPException(status_code=404, detail="Ad not found")
    
    new_status = not ad.get("is_active", True)
    await db.digital_ads.update_one({"id": ad_id}, {"$set": {"is_active": new_status}})
    return {"is_active": new_status}

@api_router.delete("/digital-ads/{ad_id}")
async def delete_digital_ad(ad_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.digital_ads.delete_one({"id": ad_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Ad not found")
    return {"message": "Ad deleted"}

# ==================== TRANSACTIONS ROUTES ====================

@api_router.get("/transactions/{customer_id}", response_model=List[Transaction])
async def get_customer_transactions(customer_id: str, current_user: dict = Depends(get_current_user)):
    transactions = await db.transactions.find({"customer_id": customer_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for txn in transactions:
        if isinstance(txn.get('created_at'), str):
            txn['created_at'] = datetime.fromisoformat(txn['created_at'].replace('Z', '+00:00'))
    return transactions

@api_router.post("/transactions", response_model=Transaction)
async def create_transaction(txn_data: TransactionCreate, current_user: dict = Depends(get_current_user)):
    txn_obj = Transaction(**txn_data.model_dump())
    doc = txn_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.transactions.insert_one(doc)
    return txn_obj

@api_router.get("/customers/{customer_id}")
async def get_customer_by_id(customer_id: str, current_user: dict = Depends(get_current_user)):
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    if isinstance(customer.get('created_at'), str):
        customer['created_at'] = datetime.fromisoformat(customer['created_at'].replace('Z', '+00:00'))
    return customer

# ==================== GARAGE EMPLOYEES ROUTES ====================

@api_router.get("/garage-employees", response_model=List[GarageEmployee])
async def get_garage_employees(current_user: dict = Depends(get_current_user)):
    employees = await db.garage_employees.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for emp in employees:
        if isinstance(emp.get('created_at'), str):
            emp['created_at'] = datetime.fromisoformat(emp['created_at'].replace('Z', '+00:00'))
    return employees

@api_router.post("/garage-employees", response_model=GarageEmployee)
async def create_garage_employee(emp_data: GarageEmployeeCreate, current_user: dict = Depends(get_current_user)):
    emp_obj = GarageEmployee(**emp_data.model_dump())
    doc = emp_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.garage_employees.insert_one(doc)
    return emp_obj

@api_router.put("/garage-employees/{emp_id}")
async def update_garage_employee(emp_id: str, emp_data: GarageEmployeeCreate, current_user: dict = Depends(get_current_user)):
    result = await db.garage_employees.update_one(
        {"id": emp_id},
        {"$set": emp_data.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Garage employee not found")
    return {"message": "Garage employee updated"}

@api_router.patch("/garage-employees/{emp_id}/toggle-status")
async def toggle_garage_employee_status(emp_id: str, current_user: dict = Depends(get_current_user)):
    emp = await db.garage_employees.find_one({"id": emp_id})
    if not emp:
        raise HTTPException(status_code=404, detail="Garage employee not found")
    
    new_status = not emp.get("is_active", True)
    await db.garage_employees.update_one({"id": emp_id}, {"$set": {"is_active": new_status}})
    return {"is_active": new_status}

@api_router.delete("/garage-employees/{emp_id}")
async def delete_garage_employee(emp_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.garage_employees.delete_one({"id": emp_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Garage employee not found")
    return {"message": "Garage employee deleted"}

# ==================== DASHBOARD ROUTES ====================

@api_router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    total_leads = await db.leads.count_documents({})
    total_customers = await db.customers.count_documents({})
    total_inspections = await db.inspections.count_documents({})
    total_employees = await db.users.count_documents({})
    
    leads_today = await db.leads.count_documents({
        "created_at": {"$regex": f"^{today}"}
    })
    inspections_today = await db.inspections.count_documents({
        "scheduled_date": today
    })
    pending_payments = await db.customers.count_documents({"payment_status": "PENDING"})
    completed_inspections = await db.inspections.count_documents({"inspection_status": "COMPLETED"})
    
    return DashboardStats(
        total_leads=total_leads,
        total_customers=total_customers,
        total_inspections=total_inspections,
        total_employees=total_employees,
        leads_today=leads_today,
        inspections_today=inspections_today,
        pending_payments=pending_payments,
        completed_inspections=completed_inspections
    )

# ==================== UTILITY ROUTES ====================

@api_router.get("/cities")
async def get_cities():
    return ["Bangalore", "Hyderabad", "Chennai", "Mumbai", "Delhi", "Pune", "Kolkata", "Others"]

@api_router.get("/lead-sources")
async def get_lead_sources():
    return ["FACEBOOK", "GOOGLE", "WEBSITE", "REFERRAL", "WALK_IN", "OTHERS"]

@api_router.get("/lead-statuses")
async def get_lead_statuses():
    return ["NEW", "CONTACTED", "INTERESTED", "NOT_INTERESTED", "CONVERTED", "RNR", "OUT_OF_SERVICE_AREA"]

@api_router.get("/")
async def root():
    return {"message": "WiseDrive CRM API"}

# ==================== SEED DATA ====================

@api_router.post("/seed")
async def seed_data():
    """Seed initial data for testing"""
    
    # Create admin user
    admin_exists = await db.users.find_one({"email": "admin@wisedrive.com"})
    if not admin_exists:
        admin = {
            "id": str(uuid.uuid4()),
            "email": "admin@wisedrive.com",
            "name": "Admin User",
            "role": "admin",
            "is_active": True,
            "assigned_cities": ["Bangalore", "Hyderabad", "Chennai", "Mumbai"],
            "password_hash": hash_password("admin123"),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(admin)
    
    # Create sample employees
    employees_data = [
        {"name": "Bhavya Reddy M", "email": "bhavya@wisedrive.com", "cities": ["Bangalore", "Hyderabad"]},
        {"name": "Vijay Bhaskar", "email": "vijay@wisedrive.com", "cities": ["Hyderabad"]},
        {"name": "Sneha Kumari", "email": "sneha@wisedrive.com", "cities": ["Mumbai", "Pune"]},
        {"name": "V Sai Bharath", "email": "sai@wisedrive.com", "cities": ["Bangalore"]},
        {"name": "Sridhar Venkatesalu", "email": "sridhar@wisedrive.com", "cities": ["Chennai"]},
    ]
    
    for emp in employees_data:
        exists = await db.users.find_one({"email": emp["email"]})
        if not exists:
            user = {
                "id": str(uuid.uuid4()),
                "email": emp["email"],
                "name": emp["name"],
                "role": "employee",
                "is_active": True,
                "assigned_cities": emp["cities"],
                "password_hash": hash_password("employee123"),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.users.insert_one(user)
    
    # Create sample leads
    cities = ["Bangalore", "Hyderabad", "Chennai", "Mumbai", "Others"]
    sources = ["FACEBOOK", "GOOGLE", "WEBSITE", "REFERRAL"]
    statuses = ["NEW", "CONTACTED", "INTERESTED", "RNR", "OUT_OF_SERVICE_AREA"]
    
    leads_count = await db.leads.count_documents({})
    if leads_count < 10:
        import random
        for i in range(20):
            lead = {
                "id": str(uuid.uuid4()),
                "name": f"Lead {i+1}",
                "mobile": f"91900000{i:04d}",
                "city": random.choice(cities),
                "source": random.choice(sources),
                "status": random.choice(statuses),
                "assigned_to": random.choice(employees_data)["name"] if random.random() > 0.3 else None,
                "reminder_date": "2026-02-14",
                "reminder_time": "17:00",
                "notes": None,
                "payment_link": f"12023769376950{i:04d}" if random.random() > 0.5 else None,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.leads.insert_one(lead)
    
    # Create sample customers
    customers_count = await db.customers.count_documents({})
    if customers_count < 10:
        import random
        payment_statuses = ["Completed", "PENDING"]
        for i in range(15):
            customer = {
                "id": str(uuid.uuid4()),
                "name": f"Customer {i+1}",
                "mobile": f"91916411{i:04d}",
                "city": random.choice(cities),
                "payment_status": random.choice(payment_statuses),
                "notes": None,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.customers.insert_one(customer)
    
    # Create sample inspections
    inspections_count = await db.inspections.count_documents({})
    if inspections_count < 10:
        import random
        inspection_statuses = ["COMPLETED", "SCHEDULED", "REQUEST_NEWSLOT", "IN_PROGRESS"]
        mechanics = ["V Sai Bharath", "Sridhar Venkatesalu", "Kaliul Rahaman", "Abidali Ali Ansari"]
        for i in range(15):
            inspection = {
                "id": str(uuid.uuid4()),
                "customer_name": f"Inspection Customer {i+1}",
                "customer_mobile": f"91812325{i:04d}",
                "address": f"Address {i+1}",
                "city": random.choice(cities),
                "payment_status": "Completed" if random.random() > 0.3 else "PENDING",
                "inspection_status": random.choice(inspection_statuses),
                "mechanic_name": random.choice(mechanics) if random.random() > 0.2 else None,
                "car_number": f"KA0{random.randint(1,5)}NC{random.randint(1000,9999)}",
                "car_details": f"Tr# ORD{random.randint(1000000,9999999)}",
                "scheduled_date": "2026-02-13" if random.random() > 0.3 else None,
                "scheduled_time": f"{random.randint(10,18)}:00:00",
                "notes": None,
                "report_url": f"/reports/inspection_{i}.pdf" if random.random() > 0.5 else None,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.inspections.insert_one(inspection)
    
    # Create sample digital ads
    ads_count = await db.digital_ads.count_documents({})
    if ads_count < 5:
        import random
        ad_data = [
            {"ad_id": "120216584515320302", "ad_name": "Pune Hindi", "city": "Pune", "language": "Hindi", "campaign_type": "Instagram", "source": "Facebook", "ad_amount": 5000},
            {"ad_id": "120216584515340302", "ad_name": "Pune Hindi 6", "city": "Pune", "language": "Hindi", "campaign_type": "Instagram", "source": "Facebook", "ad_amount": 3500},
            {"ad_id": "120216584515350302", "ad_name": "Pune Hindi 5", "city": "Pune", "language": "Hindi", "campaign_type": "Instagram", "source": "Facebook", "ad_amount": 4200},
            {"ad_id": "120216584515360302", "ad_name": "Delhi Hindi 4", "city": "Delhi", "language": "Hindi", "campaign_type": "Instagram", "source": "Facebook", "ad_amount": 6000},
            {"ad_id": "120216584515370302", "ad_name": "Bangalore English", "city": "Bangalore", "language": "English", "campaign_type": "Google", "source": "Google Ads", "ad_amount": 8000},
            {"ad_id": "120216584515380302", "ad_name": "Mumbai Marathi", "city": "Mumbai", "language": "Marathi", "campaign_type": "Instagram", "source": "Facebook", "ad_amount": 4500},
        ]
        for ad in ad_data:
            ad_doc = {
                "id": str(uuid.uuid4()),
                **ad,
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.digital_ads.insert_one(ad_doc)
    
    # Create sample garage employees
    grg_count = await db.garage_employees.count_documents({})
    if grg_count < 5:
        grg_data = [
            {"grg_owner_name": "Rajesh Kumar", "grg_employee_name": "Suresh Mechanic", "grg_name": "Kumar Auto Works", "city": "Bangalore", "preferred_language": "Kannada", "phone_number": "9876543210"},
            {"grg_owner_name": "Vijay Sharma", "grg_employee_name": "Ramu Technician", "grg_name": "Sharma Motors", "city": "Hyderabad", "preferred_language": "Telugu", "phone_number": "9876543211"},
            {"grg_owner_name": "Mohammed Ali", "grg_employee_name": "Kaliul Rahaman", "grg_name": "Ali Auto Service", "city": "Chennai", "preferred_language": "Tamil", "phone_number": "9876543212"},
            {"grg_owner_name": "Pradeep Nair", "grg_employee_name": "DONOTUSE_TEST", "grg_name": "Nair Garage", "city": "Mumbai", "preferred_language": "Hindi", "phone_number": "9876543213"},
            {"grg_owner_name": "Amit Patel", "grg_employee_name": "Ramesh Worker", "grg_name": "Patel Auto Zone", "city": "Pune", "preferred_language": "Marathi", "phone_number": "9876543214"},
            {"grg_owner_name": "Sanjay Gupta", "grg_employee_name": "Vinod Kumar", "grg_name": "Gupta Service Center", "city": "Delhi", "preferred_language": "Hindi", "phone_number": "9876543215"},
        ]
        for grg in grg_data:
            grg_doc = {
                "id": str(uuid.uuid4()),
                **grg,
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.garage_employees.insert_one(grg_doc)
    
    return {"message": "Data seeded successfully"}

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

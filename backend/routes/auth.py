"""
Authentication Routes Module
Handles login, token management, and user authentication

This module is designed to be integrated with the main server.py file.
Usage in server.py:
    from routes.auth import create_auth_router
    auth_router = create_auth_router(db, SECRET_KEY, rbac_service)
    app.include_router(auth_router, prefix="/api")
"""
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt


# Security bearer token handler
security = HTTPBearer()

# Constants
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24


# ==================== PYDANTIC MODELS ====================

class UserLogin(BaseModel):
    email: EmailStr
    password: str
    country_id: Optional[str] = None


class TokenUser(BaseModel):
    id: str
    email: str
    name: str
    role: str
    role_code: str
    country_id: Optional[str] = None
    country_name: Optional[str] = None
    department_id: Optional[str] = None
    team_id: Optional[str] = None
    visible_tabs: List[str] = []


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: TokenUser


# ==================== ROUTER FACTORY ====================

def create_auth_router(db, secret_key: str, rbac_service=None):
    """
    Factory function to create auth router with injected dependencies.
    
    Args:
        db: MongoDB database instance
        secret_key: JWT secret key
        rbac_service: RBAC service for permissions (optional)
    
    Returns:
        APIRouter: Configured auth router
    """
    router = APIRouter(prefix="/auth", tags=["Authentication"])
    
    # ==================== HELPER FUNCTIONS ====================
    
    def verify_password(password: str, hashed: str) -> bool:
        """Verify password against bcrypt hash"""
        if not hashed:
            return False
        try:
            return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
        except Exception:
            return False
    
    def create_access_token(data: dict) -> str:
        """Create JWT access token"""
        to_encode = data.copy()
        expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
        to_encode.update({"exp": expire})
        return jwt.encode(to_encode, secret_key, algorithm=ALGORITHM)
    
    async def get_current_user_internal(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
        """Get current user from JWT token with full V2 data"""
        try:
            payload = jwt.decode(credentials.credentials, secret_key, algorithms=[ALGORITHM])
            user_id = payload.get("sub")
            if user_id is None:
                raise HTTPException(status_code=401, detail="Invalid token")
            
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
            
            # Get permissions and visible tabs from RBAC service
            if rbac_service:
                permissions = await rbac_service.get_user_permissions(user_id)
                user["permissions"] = permissions
                
                visible_tabs = await rbac_service.get_visible_tabs(user_id)
                user["visible_tabs"] = visible_tabs
            else:
                user["permissions"] = []
                user["visible_tabs"] = []
            
            return user
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token expired")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Invalid token")
    
    # ==================== AUTH ROUTES ====================
    
    @router.get("/countries")
    async def get_login_countries():
        """Get all active countries for login selection - public endpoint"""
        countries = await db.countries.find(
            {"is_active": True}, 
            {"_id": 0, "id": 1, "name": 1, "code": 1}
        ).to_list(100)
        return countries
    
    @router.post("/login", response_model=Token)
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
        visible_tabs = []
        if rbac_service:
            visible_tabs = await rbac_service.get_visible_tabs(user["id"])
        
        return Token(
            access_token=access_token,
            user=TokenUser(
                id=user["id"],
                email=user["email"],
                name=user["name"],
                role=role_name,
                role_code=role_code,
                country_id=user.get("country_id"),
                country_name=country_name,
                department_id=user.get("department_id"),
                team_id=user.get("team_id"),
                visible_tabs=visible_tabs
            )
        )
    
    @router.get("/me")
    async def get_me(current_user: dict = Depends(get_current_user_internal)):
        """Get current user with full permissions"""
        return current_user
    
    @router.post("/refresh-token")
    async def refresh_token(current_user: dict = Depends(get_current_user_internal)):
        """Refresh access token - returns new token with extended expiry"""
        # Create new token with current user's data
        access_token = create_access_token({"sub": current_user["id"], "email": current_user["email"]})
        
        return {
            "access_token": access_token,
            "token_type": "bearer"
        }
    
    # Store get_current_user on router for external access
    router.get_current_user = get_current_user_internal
    
    return router


# ==================== LEGACY SUPPORT ====================
# For backward compatibility with existing code that imports from this module

router = APIRouter(prefix="/auth", tags=["Authentication"])
db = None
SECRET_KEY = None
rbac_service = None

def init_auth_routes(database, secret_key, rbac=None):
    """Legacy initialization function - use create_auth_router instead"""
    global db, SECRET_KEY, rbac_service
    db = database
    SECRET_KEY = secret_key
    rbac_service = rbac

# Placeholder for get_current_user - will be set when router is created
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Placeholder - actual implementation created by create_auth_router"""
    raise HTTPException(status_code=500, detail="Auth not initialized")

"""
Authentication Routes
Handles login, token management, and user authentication
"""
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import os

router = APIRouter(prefix="/auth", tags=["Authentication"])

# These will be injected from main server
db = None
SECRET_KEY = None
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24
security = HTTPBearer()


def init_auth_routes(database, secret_key):
    """Initialize auth routes with database and secret key"""
    global db, SECRET_KEY
    db = database
    SECRET_KEY = secret_key


class UserLogin(BaseModel):
    email: EmailStr
    password: str
    country_id: Optional[str] = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


def create_access_token(data: dict, expires_delta: timedelta = None):
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Validate JWT token and return current user"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise credentials_exception
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user is None:
        raise credentials_exception
    
    # Add permissions to user
    if user.get("role_id"):
        role = await db.roles.find_one({"id": user["role_id"]}, {"_id": 0})
        if role:
            user["role_code"] = role.get("code", "")
            user["role_name"] = role.get("name", "")
            user["permissions"] = role.get("permissions", [])
            user["visible_tabs"] = role.get("visible_tabs", [])
    
    return user


@router.get("/countries")
async def get_login_countries():
    """Get list of countries for login dropdown"""
    countries = await db.countries.find({}, {"_id": 0, "id": 1, "name": 1, "code": 1}).to_list(100)
    return countries


@router.post("/login", response_model=Token)
async def login(credentials: UserLogin):
    """Login endpoint - returns JWT token"""
    # Build query based on country_id
    query = {"email": credentials.email}
    if credentials.country_id:
        query["country_id"] = credentials.country_id
    
    user = await db.users.find_one(query, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Check if user is active
    if not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="Account is deactivated")
    
    # Verify password
    stored_hash = user.get("password_hash", "")
    
    # Handle different hash formats
    try:
        if stored_hash.startswith("$2"):
            # bcrypt hash
            if not bcrypt.checkpw(credentials.password.encode('utf-8'), stored_hash.encode('utf-8')):
                raise HTTPException(status_code=401, detail="Invalid email or password")
        else:
            # Plain text (legacy) - auto-upgrade to bcrypt
            if stored_hash != credentials.password:
                raise HTTPException(status_code=401, detail="Invalid email or password")
            # Upgrade to bcrypt
            new_hash = bcrypt.hashpw(credentials.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": new_hash}})
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Get role info
    role_code = ""
    role_name = ""
    if user.get("role_id"):
        role = await db.roles.find_one({"id": user["role_id"]}, {"_id": 0})
        if role:
            role_code = role.get("code", "")
            role_name = role.get("name", "")
    
    # Get country info
    country_name = ""
    country_code = ""
    if user.get("country_id"):
        country = await db.countries.find_one({"id": user["country_id"]}, {"_id": 0})
        if country:
            country_name = country.get("name", "")
            country_code = country.get("code", "")
    
    # Create access token
    access_token = create_access_token(data={"sub": user["id"]})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "name": user.get("name", ""),
            "email": user["email"],
            "role_id": user.get("role_id", ""),
            "role_code": role_code,
            "role_name": role_name,
            "country_id": user.get("country_id", ""),
            "country_name": country_name,
            "country_code": country_code
        }
    }


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current user info with permissions"""
    # Get country info
    country_name = ""
    country_code = ""
    if current_user.get("country_id"):
        country = await db.countries.find_one({"id": current_user["country_id"]}, {"_id": 0})
        if country:
            country_name = country.get("name", "")
            country_code = country.get("code", "")
    
    return {
        **current_user,
        "country_name": country_name,
        "country_code": country_code
    }

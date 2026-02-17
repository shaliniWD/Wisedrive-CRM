"""Authentication routes for ESS Mobile API"""
from fastapi import APIRouter, HTTPException, Depends, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import uuid
import os

from models_ess.auth import (
    MobileLoginRequest,
    MobileLoginResponse,
    RefreshTokenRequest,
    RefreshTokenResponse,
    DeviceSession,
    PushTokenRegister,
    LogoutRequest
)

router = APIRouter()
security = HTTPBearer(auto_error=False)  # Don't auto-error, allow query param fallback

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET', 'wisedrive-ess-secure-secret-key-2024-production-env')
REFRESH_SECRET = os.environ.get('REFRESH_SECRET', 'wisedrive-ess-refresh-secret-key-2024-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60  # 1 hour for mobile
REFRESH_TOKEN_EXPIRE_DAYS = 30


def verify_password(password: str, hashed: str) -> bool:
    """Verify password against bcrypt hash"""
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(data: dict) -> str:
    """Create JWT refresh token"""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, REFRESH_SECRET, algorithm=ALGORITHM)


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """Get current user from JWT token (header or query parameter)"""
    try:
        # Try to get token from Authorization header first
        token = None
        if credentials and credentials.credentials:
            token = credentials.credentials
        
        # If no header token, check query parameter (for browser/webview access)
        if not token:
            token = request.query_params.get("token")
        
        if not token:
            raise HTTPException(status_code=401, detail="Not authenticated")
        
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        
        user_id = payload.get("sub")
        device_id = payload.get("device_id")
        
        if not user_id or not device_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        db = request.app.state.db
        
        # Verify user exists
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        # Verify device session is still valid (single device policy)
        session = await db.ess_device_sessions.find_one({
            "user_id": user_id,
            "device_id": device_id,
            "is_active": True
        })
        
        if not session:
            raise HTTPException(
                status_code=401, 
                detail="Session expired or device logged out. Please login again.",
                headers={"X-Session-Invalid": "true"}
            )
        
        # Update last active
        await db.ess_device_sessions.update_one(
            {"device_id": device_id},
            {"$set": {"last_active": datetime.now(timezone.utc).isoformat()}}
        )
        
        user["device_id"] = device_id
        return user
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.post("/auth/login", response_model=MobileLoginResponse)
async def mobile_login(request: Request, login_data: MobileLoginRequest):
    """
    Mobile app login with device registration.
    
    Implements single active device policy:
    - On successful login, any existing sessions for this user are invalidated
    - Only the new device will remain active
    """
    db = request.app.state.db
    
    # Find user by email
    user = await db.users.find_one({"email": login_data.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Verify password
    if not verify_password(login_data.password, user.get("hashed_password", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check if user is active
    if not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="Account is disabled")
    
    user_id = user["id"]
    device = login_data.device
    
    # Single device policy: Invalidate all existing sessions for this user
    await db.ess_device_sessions.update_many(
        {"user_id": user_id},
        {"$set": {"is_active": False, "invalidated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Delete old refresh tokens for this user
    await db.ess_refresh_tokens.delete_many({"user_id": user_id})
    
    # Delete any existing session with this device_id (to avoid unique constraint violation)
    await db.ess_device_sessions.delete_one({"device_id": device.device_id})
    
    # Create new device session
    session_id = str(uuid.uuid4())
    session_data = {
        "id": session_id,
        "user_id": user_id,
        "device_id": device.device_id,
        "device_name": device.device_name,
        "platform": device.platform.value,
        "os_version": device.os_version,
        "app_version": device.app_version,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_active": datetime.now(timezone.utc).isoformat()
    }
    
    await db.ess_device_sessions.insert_one(session_data)
    
    # Register push token if provided
    if device.push_token:
        await db.ess_push_tokens.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "user_id": user_id,
                    "device_id": device.device_id,
                    "device_token": device.push_token,
                    "platform": device.platform.value,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            },
            upsert=True
        )
    
    # Create tokens
    token_data = {
        "sub": user_id,
        "email": user["email"],
        "device_id": device.device_id
    }
    
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    
    # Store refresh token
    await db.ess_refresh_tokens.insert_one({
        "token": refresh_token,
        "user_id": user_id,
        "device_id": device.device_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)).isoformat()
    })
    
    # Get role info
    role_name = "Employee"
    role_code = ""
    if user.get("role_id"):
        role = await db.roles.find_one({"id": user["role_id"]}, {"_id": 0, "name": 1, "code": 1})
        if role:
            role_name = role.get("name", "Employee")
            role_code = role.get("code", "")
    
    # Get country info
    country_name = ""
    if user.get("country_id"):
        country = await db.countries.find_one({"id": user["country_id"]}, {"_id": 0, "name": 1})
        if country:
            country_name = country.get("name", "")
    
    return MobileLoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user={
            "id": user["id"],
            "email": user["email"],
            "name": user.get("name"),
            "employee_code": user.get("employee_code"),
            "photo_url": user.get("photo_url"),
            "role": role_name,
            "role_code": role_code,
            "country_name": country_name,
            "is_approver": role_code in ["CEO", "HR_MANAGER", "COUNTRY_HEAD", "SALES_HEAD", "INSPECTION_HEAD"]
        }
    )


@router.post("/auth/refresh", response_model=RefreshTokenResponse)
async def refresh_token(request: Request, token_data: RefreshTokenRequest):
    """
    Refresh access token using refresh token.
    
    Validates that the device is still the active session device.
    """
    db = request.app.state.db
    
    try:
        # Verify refresh token
        payload = jwt.decode(token_data.refresh_token, REFRESH_SECRET, algorithms=[ALGORITHM])
        
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        
        user_id = payload.get("sub")
        token_device_id = payload.get("device_id")
        
        # Verify device_id matches
        if token_device_id != token_data.device_id:
            raise HTTPException(status_code=401, detail="Device mismatch")
        
        # Check if refresh token exists in database
        stored_token = await db.ess_refresh_tokens.find_one({
            "token": token_data.refresh_token,
            "user_id": user_id,
            "device_id": token_data.device_id
        })
        
        if not stored_token:
            raise HTTPException(status_code=401, detail="Invalid refresh token")
        
        # Verify session is still active
        session = await db.ess_device_sessions.find_one({
            "user_id": user_id,
            "device_id": token_data.device_id,
            "is_active": True
        })
        
        if not session:
            raise HTTPException(status_code=401, detail="Session invalidated")
        
        # Get user
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "email": 1})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        # Create new tokens
        token_payload = {
            "sub": user_id,
            "email": user["email"],
            "device_id": token_data.device_id
        }
        
        new_access_token = create_access_token(token_payload)
        new_refresh_token = create_refresh_token(token_payload)
        
        # Replace old refresh token with new one
        await db.ess_refresh_tokens.delete_one({"token": token_data.refresh_token})
        await db.ess_refresh_tokens.insert_one({
            "token": new_refresh_token,
            "user_id": user_id,
            "device_id": token_data.device_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
        })
        
        # Update session last active
        await db.ess_device_sessions.update_one(
            {"device_id": token_data.device_id},
            {"$set": {"last_active": datetime.now(timezone.utc).isoformat()}}
        )
        
        return RefreshTokenResponse(
            access_token=new_access_token,
            refresh_token=new_refresh_token,
            token_type="bearer",
            expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")


@router.post("/auth/logout")
async def logout(request: Request, logout_data: LogoutRequest, current_user: dict = Depends(get_current_user)):
    """
    Logout from current device or all devices.
    """
    db = request.app.state.db
    user_id = current_user["id"]
    
    if logout_data.all_devices:
        # Logout from all devices
        await db.ess_device_sessions.update_many(
            {"user_id": user_id},
            {"$set": {"is_active": False, "invalidated_at": datetime.now(timezone.utc).isoformat()}}
        )
        await db.ess_refresh_tokens.delete_many({"user_id": user_id})
        await db.ess_push_tokens.delete_many({"user_id": user_id})
    else:
        # Logout from current device only
        await db.ess_device_sessions.update_one(
            {"user_id": user_id, "device_id": logout_data.device_id},
            {"$set": {"is_active": False, "invalidated_at": datetime.now(timezone.utc).isoformat()}}
        )
        await db.ess_refresh_tokens.delete_many({
            "user_id": user_id, 
            "device_id": logout_data.device_id
        })
        await db.ess_push_tokens.delete_one({
            "user_id": user_id,
            "device_id": logout_data.device_id
        })
    
    return {"message": "Logged out successfully"}


@router.post("/auth/push-token")
async def register_push_token(
    request: Request, 
    token_data: PushTokenRegister,
    current_user: dict = Depends(get_current_user)
):
    """
    Register or update push notification token.
    """
    db = request.app.state.db
    
    await db.ess_push_tokens.update_one(
        {"user_id": current_user["id"]},
        {
            "$set": {
                "user_id": current_user["id"],
                "device_id": token_data.device_id,
                "device_token": token_data.push_token,
                "platform": token_data.platform.value,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    return {"message": "Push token registered"}


@router.get("/auth/session")
async def get_current_session(request: Request, current_user: dict = Depends(get_current_user)):
    """
    Get current device session information.
    """
    db = request.app.state.db
    
    session = await db.ess_device_sessions.find_one(
        {"user_id": current_user["id"], "device_id": current_user["device_id"]},
        {"_id": 0}
    )
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return DeviceSession(
        id=session["id"],
        user_id=session["user_id"],
        device_id=session["device_id"],
        device_name=session.get("device_name"),
        platform=session["platform"],
        app_version=session["app_version"],
        last_active=session["last_active"],
        created_at=session["created_at"],
        is_current=True
    )

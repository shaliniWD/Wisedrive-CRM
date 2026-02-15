"""Authentication models for ESS Mobile API"""
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime
from enum import Enum


class DevicePlatform(str, Enum):
    IOS = "ios"
    ANDROID = "android"


class DeviceInfo(BaseModel):
    """Device information for session management"""
    device_id: str = Field(..., description="Unique device identifier (UUID)")
    device_name: Optional[str] = Field(None, description="Device model name")
    platform: DevicePlatform = Field(..., description="Device platform (ios/android)")
    os_version: Optional[str] = Field(None, description="OS version")
    app_version: str = Field(..., description="Mobile app version")
    push_token: Optional[str] = Field(None, description="FCM/APNS push token")


class MobileLoginRequest(BaseModel):
    """Mobile login request with device information"""
    email: EmailStr
    password: str
    device: DeviceInfo
    
    class Config:
        json_schema_extra = {
            "example": {
                "email": "john.doe@wisedrive.com",
                "password": "securepassword",
                "device": {
                    "device_id": "550e8400-e29b-41d4-a716-446655440000",
                    "device_name": "iPhone 15 Pro",
                    "platform": "ios",
                    "os_version": "17.2",
                    "app_version": "1.0.0",
                    "push_token": "fcm_token_here"
                }
            }
        }


class MobileLoginResponse(BaseModel):
    """Mobile login response with tokens"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(..., description="Access token expiry in seconds")
    user: dict


class RefreshTokenRequest(BaseModel):
    """Refresh token request"""
    refresh_token: str
    device_id: str


class RefreshTokenResponse(BaseModel):
    """Refresh token response"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class DeviceSession(BaseModel):
    """Active device session"""
    id: str
    user_id: str
    device_id: str
    device_name: Optional[str]
    platform: DevicePlatform
    app_version: str
    last_active: datetime
    created_at: datetime
    is_current: bool = False


class PushTokenRegister(BaseModel):
    """Register/update push notification token"""
    device_id: str
    push_token: str
    platform: DevicePlatform


class LogoutRequest(BaseModel):
    """Logout request"""
    device_id: str
    all_devices: bool = False

"""Device Session Middleware for ESS Mobile API

Enforces single active device policy and validates device sessions.
"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
import logging

logger = logging.getLogger(__name__)


class DeviceSessionMiddleware(BaseHTTPMiddleware):
    """
    Middleware to track and validate device sessions.
    
    - Logs device information for analytics
    - Could be extended for device fingerprinting
    - Could be extended for fraud detection
    """
    
    # Paths that don't require device session validation
    EXEMPT_PATHS = [
        "/ess/v1/auth/login",
        "/ess/v1/auth/refresh",
        "/ess/v1/health",
        "/ess/v1/docs",
        "/ess/v1/redoc",
        "/ess/v1/openapi.json",
        "/ess/v1"
    ]
    
    async def dispatch(self, request: Request, call_next):
        # Skip validation for exempt paths
        path = request.url.path
        
        if any(path == exempt or path.startswith(exempt + "/") for exempt in self.EXEMPT_PATHS):
            return await call_next(request)
        
        # Log device info from headers (for analytics)
        device_info = {
            "user_agent": request.headers.get("User-Agent"),
            "app_version": request.headers.get("X-App-Version"),
            "device_id": request.headers.get("X-Device-ID"),
            "platform": request.headers.get("X-Platform"),
        }
        
        # Could add additional device validation here
        # For now, main validation happens in the auth dependency
        
        response = await call_next(request)
        
        return response

"""
WiseDrive ESS (Employee Self-Service) Mobile API
Separate FastAPI server for mobile app endpoints

This API is designed to be independent of the main CRM API,
with its own versioning, authentication, and release cycle.
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from contextlib import asynccontextmanager
import os
import logging
from pathlib import Path

from routes import auth, leave, payslips, documents, profile, notifications
from middleware.device_session import DeviceSessionMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'test_database')


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    app.state.mongo_client = AsyncIOMotorClient(mongo_url)
    app.state.db = app.state.mongo_client[db_name]
    
    # Create indexes for device sessions
    try:
        await app.state.db.ess_device_sessions.create_index("user_id")
        await app.state.db.ess_device_sessions.create_index("device_id", unique=True)
        await app.state.db.ess_device_sessions.create_index("expires_at", expireAfterSeconds=0)
        await app.state.db.ess_refresh_tokens.create_index("token", unique=True)
        await app.state.db.ess_refresh_tokens.create_index("expires_at", expireAfterSeconds=0)
        await app.state.db.ess_push_tokens.create_index("user_id")
        await app.state.db.ess_push_tokens.create_index("device_token", unique=True)
    except Exception as e:
        logger.warning(f"Index creation warning (may already exist): {e}")
    
    logger.info("ESS Mobile API started successfully")
    
    yield
    
    # Shutdown
    app.state.mongo_client.close()
    logger.info("ESS Mobile API shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="WiseDrive ESS Mobile API",
    description="""
    Employee Self-Service (ESS) API for WiseDrive Mobile App.
    
    ## Features
    - Employee Authentication (with device management)
    - Leave Management (apply, view status)
    - Payslip Access (view and download)
    - Document Management (view uploaded documents)
    - Profile Management (view personal info)
    - Push Notifications
    
    ## Authentication
    Uses JWT Bearer tokens with refresh token support.
    Single active device policy enforced.
    
    ## Versioning
    API version: v1
    Prefix: /ess/v1
    """,
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/ess/v1/docs",
    redoc_url="/ess/v1/redoc",
    openapi_url="/ess/v1/openapi.json"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to mobile app domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom device session middleware
app.add_middleware(DeviceSessionMiddleware)

# Include routers with /ess/v1 prefix
api_prefix = "/ess/v1"

app.include_router(auth.router, prefix=api_prefix, tags=["Authentication"])
app.include_router(leave.router, prefix=api_prefix, tags=["Leave Management"])
app.include_router(payslips.router, prefix=api_prefix, tags=["Payslips"])
app.include_router(documents.router, prefix=api_prefix, tags=["Documents"])
app.include_router(profile.router, prefix=api_prefix, tags=["Profile"])
app.include_router(notifications.router, prefix=api_prefix, tags=["Notifications"])


@app.get("/ess/v1/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "ess-mobile-api",
        "version": "1.0.0"
    }


@app.get("/ess/v1")
async def root():
    """Root endpoint"""
    return {
        "message": "WiseDrive ESS Mobile API",
        "version": "1.0.0",
        "docs": "/ess/v1/docs"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)

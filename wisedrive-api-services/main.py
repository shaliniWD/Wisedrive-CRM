"""
Wisedrive API Services - Main Application
Entry point for the FastAPI application
"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings, Database

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format=settings.LOG_FORMAT
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management"""
    # Startup
    logger.info(f"Starting Wisedrive API Services ({settings.ENVIRONMENT.value})")
    
    await Database.connect(settings.MONGO_URL, settings.DB_NAME)
    
    yield
    
    # Shutdown
    await Database.disconnect()
    logger.info("Wisedrive API Services shutdown complete")


def create_app() -> FastAPI:
    """Application factory"""
    
    app = FastAPI(
        title=settings.API_TITLE,
        version=settings.API_VERSION,
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
        lifespan=lifespan
    )
    
    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Register routers
    # from controllers.auth import router as auth_router
    # from controllers.hr import router as hr_router
    # from controllers.crm import router as crm_router
    # from controllers.inspection import router as inspection_router
    # from controllers.obd import router as obd_router
    # from controllers.payment import router as payment_router
    # from controllers.report import router as report_router
    # from controllers.cardata import router as cardata_router
    # from controllers.media import router as media_router
    
    # app.include_router(auth_router, prefix=f"{settings.API_PREFIX}/auth", tags=["Authentication"])
    # app.include_router(hr_router, prefix=f"{settings.API_PREFIX}/hr", tags=["HR"])
    # app.include_router(crm_router, prefix=f"{settings.API_PREFIX}", tags=["CRM"])
    # app.include_router(inspection_router, prefix=f"{settings.API_PREFIX}/inspections", tags=["Inspections"])
    # app.include_router(obd_router, prefix=f"{settings.API_PREFIX}/obd", tags=["OBD"])
    # app.include_router(payment_router, prefix=f"{settings.API_PREFIX}/payments", tags=["Payments"])
    # app.include_router(report_router, prefix=f"{settings.API_PREFIX}/reports", tags=["Reports"])
    # app.include_router(cardata_router, prefix=f"{settings.API_PREFIX}/cardata", tags=["CarData"])
    # app.include_router(media_router, prefix=f"{settings.API_PREFIX}/media", tags=["Media"])
    
    # Health check endpoint
    @app.get("/health")
    async def health_check():
        return {
            "status": "healthy",
            "environment": settings.ENVIRONMENT.value,
            "version": settings.API_VERSION
        }
    
    return app


# Create app instance
app = create_app()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=settings.is_development
    )

"""
Wisedrive API Services - Configuration Module
Environment-specific settings with validation
"""
import os
from typing import Optional
from pydantic import BaseSettings, validator
from enum import Enum


class Environment(str, Enum):
    DEV = "dev"
    TEST = "test"
    PROD = "prod"


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # Environment
    ENVIRONMENT: Environment = Environment.DEV
    DEBUG: bool = False
    
    # API
    API_VERSION: str = "v1"
    API_TITLE: str = "Wisedrive Platform API"
    API_PREFIX: str = "/api"
    
    # Security
    SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Database
    MONGO_URL: str
    DB_NAME: str
    
    # CORS
    CORS_ORIGINS: str = "*"
    
    # External Services (loaded when needed)
    RAZORPAY_KEY_ID: Optional[str] = None
    RAZORPAY_KEY_SECRET: Optional[str] = None
    RAZORPAY_WEBHOOK_SECRET: Optional[str] = None
    
    INVINCIBLE_OCEAN_API_KEY: Optional[str] = None
    INVINCIBLE_OCEAN_BASE_URL: str = "https://api.invincibleocean.com"
    
    # CDN
    CDN_BUCKET: Optional[str] = None
    CDN_BASE_URL: Optional[str] = None
    
    # Rate Limiting
    RATE_LIMIT_STANDARD: int = 100  # per minute
    RATE_LIMIT_BULK: int = 10  # per minute
    RATE_LIMIT_UPLOAD: int = 20  # per minute
    
    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    
    @validator("ENVIRONMENT", pre=True)
    def validate_environment(cls, v):
        if isinstance(v, str):
            return Environment(v.lower())
        return v
    
    @property
    def cors_origins_list(self) -> list:
        """Parse CORS origins into a list"""
        if self.CORS_ORIGINS == "*":
            return ["*"]
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
    
    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == Environment.PROD
    
    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == Environment.DEV
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()


# Environment-specific database names
DB_NAMES = {
    Environment.DEV: "wisedrive_dev",
    Environment.TEST: "wisedrive_test",
    Environment.PROD: "wisedrive_prod",
}


# Environment-specific CDN buckets
CDN_BUCKETS = {
    Environment.DEV: "dev-assets",
    Environment.TEST: "test-assets",
    Environment.PROD: "prod-assets",
}

"""
Wisedrive API Services - Database Configuration
MongoDB connection management with async support
"""
import logging
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from typing import Optional

logger = logging.getLogger(__name__)


class Database:
    """MongoDB database connection manager"""
    
    client: Optional[AsyncIOMotorClient] = None
    db: Optional[AsyncIOMotorDatabase] = None
    
    @classmethod
    async def connect(cls, mongo_url: str, db_name: str):
        """Initialize database connection"""
        try:
            cls.client = AsyncIOMotorClient(mongo_url)
            cls.db = cls.client[db_name]
            
            # Verify connection
            await cls.client.admin.command('ping')
            logger.info(f"Connected to MongoDB database: {db_name}")
            
            # Create indexes
            await cls._create_indexes()
            
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            raise
    
    @classmethod
    async def disconnect(cls):
        """Close database connection"""
        if cls.client:
            cls.client.close()
            logger.info("Disconnected from MongoDB")
    
    @classmethod
    async def _create_indexes(cls):
        """Create database indexes for optimal performance"""
        if not cls.db:
            return
            
        # Users collection indexes
        await cls.db.users.create_index("email", unique=True)
        await cls.db.users.create_index("country_id")
        await cls.db.users.create_index("role_id")
        await cls.db.users.create_index("employment_status")
        
        # Leads collection indexes
        await cls.db.leads.create_index("country_id")
        await cls.db.leads.create_index("status")
        await cls.db.leads.create_index("assigned_to")
        await cls.db.leads.create_index("created_at")
        await cls.db.leads.create_index([("name", "text"), ("mobile", "text")])
        
        # Customers collection indexes
        await cls.db.customers.create_index("country_id")
        await cls.db.customers.create_index([("name", "text"), ("mobile", "text")])
        
        # Vehicles collection indexes
        await cls.db.vehicles.create_index("customer_id")
        await cls.db.vehicles.create_index("registration_number")
        await cls.db.vehicles.create_index("vin")
        
        # Inspections collection indexes
        await cls.db.inspections.create_index("country_id")
        await cls.db.inspections.create_index("vehicle_id")
        await cls.db.inspections.create_index("mechanic_id")
        await cls.db.inspections.create_index("status")
        await cls.db.inspections.create_index("scheduled_date")
        
        # OBD Sessions collection indexes
        await cls.db.obd_sessions.create_index("inspection_id")
        await cls.db.obd_sessions.create_index("vehicle_id")
        await cls.db.obd_sessions.create_index("vin")
        await cls.db.obd_sessions.create_index("scanned_at")
        
        # Payments collection indexes
        await cls.db.finance_payments.create_index("country_id")
        await cls.db.finance_payments.create_index("employee_id")
        await cls.db.finance_payments.create_index("status")
        await cls.db.finance_payments.create_index([("month", 1), ("year", 1)])
        
        # Audit logs indexes
        await cls.db.audit_logs.create_index("entity_type")
        await cls.db.audit_logs.create_index("entity_id")
        await cls.db.audit_logs.create_index("user_id")
        await cls.db.audit_logs.create_index("created_at")
        
        logger.info("Database indexes created/verified")
    
    @classmethod
    def get_db(cls) -> AsyncIOMotorDatabase:
        """Get database instance"""
        if not cls.db:
            raise RuntimeError("Database not initialized. Call connect() first.")
        return cls.db


# Convenience function for dependency injection
async def get_database() -> AsyncIOMotorDatabase:
    """FastAPI dependency for database access"""
    return Database.get_db()

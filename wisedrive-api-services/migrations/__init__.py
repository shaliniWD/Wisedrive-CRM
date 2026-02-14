"""
Wisedrive API Services - Database Migration Framework
Manages database schema changes with versioning and rollback support
"""
import os
import logging
from datetime import datetime, timezone
from typing import List, Optional
import json

logger = logging.getLogger(__name__)


class MigrationManager:
    """
    Database migration manager for MongoDB.
    
    Features:
    - Version tracking
    - Rollback support
    - Migration scripts in Python
    - Audit logging
    """
    
    MIGRATIONS_COLLECTION = "_migrations"
    
    def __init__(self, db):
        self.db = db
        self.migrations_dir = os.path.dirname(__file__)
    
    async def get_applied_migrations(self) -> List[str]:
        """Get list of applied migration versions"""
        migrations = await self.db[self.MIGRATIONS_COLLECTION].find(
            {}, {"_id": 0, "version": 1}
        ).sort("applied_at", 1).to_list(1000)
        
        return [m["version"] for m in migrations]
    
    async def apply_migration(self, version: str, description: str, up_fn, down_fn=None):
        """
        Apply a migration if not already applied.
        
        Args:
            version: Migration version (e.g., "001", "002")
            description: Human-readable description
            up_fn: Async function to apply migration
            down_fn: Optional async function to rollback
        """
        applied = await self.get_applied_migrations()
        
        if version in applied:
            logger.info(f"Migration {version} already applied, skipping")
            return False
        
        logger.info(f"Applying migration {version}: {description}")
        
        try:
            # Run migration
            await up_fn(self.db)
            
            # Record migration
            await self.db[self.MIGRATIONS_COLLECTION].insert_one({
                "version": version,
                "description": description,
                "applied_at": datetime.now(timezone.utc).isoformat(),
                "has_rollback": down_fn is not None
            })
            
            logger.info(f"Migration {version} applied successfully")
            return True
            
        except Exception as e:
            logger.error(f"Migration {version} failed: {e}")
            raise
    
    async def rollback_migration(self, version: str):
        """
        Rollback a specific migration.
        
        Note: Rollback should be implemented in the migration file.
        """
        migration = await self.db[self.MIGRATIONS_COLLECTION].find_one({"version": version})
        
        if not migration:
            raise ValueError(f"Migration {version} not found")
        
        if not migration.get("has_rollback"):
            raise ValueError(f"Migration {version} does not support rollback")
        
        logger.info(f"Rolling back migration {version}")
        
        # Remove migration record
        await self.db[self.MIGRATIONS_COLLECTION].delete_one({"version": version})
        
        logger.info(f"Migration {version} rolled back")
    
    async def get_status(self) -> dict:
        """Get migration status"""
        applied = await self.get_applied_migrations()
        
        # List migration files
        versions_dir = os.path.join(self.migrations_dir, "versions")
        available = []
        
        if os.path.exists(versions_dir):
            for f in sorted(os.listdir(versions_dir)):
                if f.endswith(".py") and not f.startswith("_"):
                    version = f.replace(".py", "")
                    available.append(version)
        
        pending = [v for v in available if v not in applied]
        
        return {
            "applied": applied,
            "pending": pending,
            "total_applied": len(applied),
            "total_pending": len(pending)
        }


# Migration definitions
MIGRATIONS = []


def migration(version: str, description: str):
    """Decorator to register a migration"""
    def decorator(cls):
        MIGRATIONS.append({
            "version": version,
            "description": description,
            "class": cls
        })
        return cls
    return decorator


# ==================== SAMPLE MIGRATIONS ====================

@migration("001", "Add employment_status field to users")
class Migration001:
    """Add employment_status field to users collection"""
    
    @staticmethod
    async def up(db):
        # Add employment_status field with default 'active'
        await db.users.update_many(
            {"employment_status": {"$exists": False}},
            {"$set": {"employment_status": "active"}}
        )
        
        # Create index
        await db.users.create_index("employment_status")
    
    @staticmethod
    async def down(db):
        # Remove employment_status field
        await db.users.update_many(
            {},
            {"$unset": {"employment_status": ""}}
        )


@migration("002", "Add role_ids array to users for multi-role support")
class Migration002:
    """Add role_ids array for multi-role support"""
    
    @staticmethod
    async def up(db):
        # For users without role_ids, create array from role_id
        users = await db.users.find(
            {"role_ids": {"$exists": False}},
            {"_id": 0, "id": 1, "role_id": 1}
        ).to_list(10000)
        
        for user in users:
            role_ids = [user["role_id"]] if user.get("role_id") else []
            await db.users.update_one(
                {"id": user["id"]},
                {"$set": {"role_ids": role_ids}}
            )
    
    @staticmethod
    async def down(db):
        # Remove role_ids field
        await db.users.update_many(
            {},
            {"$unset": {"role_ids": ""}}
        )


@migration("003", "Create obd_sessions collection with indexes")
class Migration003:
    """Create OBD sessions collection for OBD integration"""
    
    @staticmethod
    async def up(db):
        # Create indexes for obd_sessions
        await db.obd_sessions.create_index("inspection_id")
        await db.obd_sessions.create_index("vehicle_id")
        await db.obd_sessions.create_index("vin")
        await db.obd_sessions.create_index("scanned_at")
        await db.obd_sessions.create_index([("dtc_stored.code", 1)])
    
    @staticmethod
    async def down(db):
        # Drop collection
        await db.obd_sessions.drop()


@migration("004", "Add exit fields to users for exit/rejoin flow")
class Migration004:
    """Add exit_date, exit_reason, rejoin_date fields"""
    
    @staticmethod
    async def up(db):
        # These fields are optional, just ensure indexes exist
        await db.users.create_index("exit_date")
    
    @staticmethod
    async def down(db):
        await db.users.update_many(
            {},
            {"$unset": {
                "exit_date": "",
                "exit_reason": "",
                "exit_notes": "",
                "rejoin_date": ""
            }}
        )

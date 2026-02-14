"""
Wisedrive API Services - Base Repository
Generic repository pattern for MongoDB collections
"""
from typing import TypeVar, Generic, Optional, List, Dict, Any
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorDatabase, AsyncIOMotorCollection
import uuid

T = TypeVar('T')


class BaseRepository(Generic[T]):
    """
    Base repository providing common CRUD operations.
    All repositories should extend this class.
    """
    
    def __init__(self, db: AsyncIOMotorDatabase, collection_name: str):
        self.db = db
        self.collection: AsyncIOMotorCollection = db[collection_name]
        self.collection_name = collection_name
    
    async def find_by_id(self, id: str) -> Optional[Dict[str, Any]]:
        """Find document by ID"""
        return await self.collection.find_one(
            {"id": id}, 
            {"_id": 0}
        )
    
    async def find_one(self, query: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Find single document matching query"""
        return await self.collection.find_one(
            query, 
            {"_id": 0}
        )
    
    async def find_many(
        self, 
        query: Dict[str, Any], 
        sort: Optional[List[tuple]] = None,
        skip: int = 0,
        limit: int = 100,
        projection: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Find multiple documents with pagination"""
        cursor = self.collection.find(
            query, 
            projection or {"_id": 0}
        )
        
        if sort:
            cursor = cursor.sort(sort)
        
        cursor = cursor.skip(skip).limit(limit)
        
        return await cursor.to_list(length=limit)
    
    async def count(self, query: Dict[str, Any]) -> int:
        """Count documents matching query"""
        return await self.collection.count_documents(query)
    
    async def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create new document"""
        if "id" not in data:
            data["id"] = str(uuid.uuid4())
        
        if "created_at" not in data:
            data["created_at"] = datetime.now(timezone.utc).isoformat()
        
        await self.collection.insert_one(data)
        
        # Return without MongoDB _id
        return {k: v for k, v in data.items() if k != "_id"}
    
    async def update(self, id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update document by ID"""
        data["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        await self.collection.update_one(
            {"id": id},
            {"$set": data}
        )
        
        return await self.find_by_id(id)
    
    async def update_one(self, query: Dict[str, Any], update: Dict[str, Any]) -> bool:
        """Update single document matching query"""
        update["$set"] = update.get("$set", {})
        update["$set"]["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        result = await self.collection.update_one(query, update)
        return result.modified_count > 0
    
    async def update_many(self, query: Dict[str, Any], update: Dict[str, Any]) -> int:
        """Update multiple documents"""
        update["$set"] = update.get("$set", {})
        update["$set"]["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        result = await self.collection.update_many(query, update)
        return result.modified_count
    
    async def delete(self, id: str) -> bool:
        """Delete document by ID"""
        result = await self.collection.delete_one({"id": id})
        return result.deleted_count > 0
    
    async def delete_many(self, query: Dict[str, Any]) -> int:
        """Delete multiple documents"""
        result = await self.collection.delete_many(query)
        return result.deleted_count
    
    async def exists(self, query: Dict[str, Any]) -> bool:
        """Check if document exists"""
        count = await self.collection.count_documents(query, limit=1)
        return count > 0
    
    async def aggregate(self, pipeline: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Run aggregation pipeline"""
        cursor = self.collection.aggregate(pipeline)
        return await cursor.to_list(length=None)


# Specialized repositories for each entity
class UserRepository(BaseRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "users")
    
    async def find_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        return await self.find_one({"email": email})
    
    async def find_by_country(
        self, 
        country_id: str, 
        include_exited: bool = False
    ) -> List[Dict[str, Any]]:
        query = {"country_id": country_id}
        if not include_exited:
            query["employment_status"] = {"$ne": "exited"}
        return await self.find_many(query)


class LeadRepository(BaseRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "leads")
    
    async def find_by_status(
        self, 
        status: str, 
        country_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        query = {"status": status}
        if country_id:
            query["country_id"] = country_id
        return await self.find_many(query)
    
    async def find_by_assigned_to(self, user_id: str) -> List[Dict[str, Any]]:
        return await self.find_many({"assigned_to": user_id})


class CustomerRepository(BaseRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "customers")


class VehicleRepository(BaseRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "vehicles")
    
    async def find_by_registration(self, registration_number: str) -> Optional[Dict[str, Any]]:
        return await self.find_one({"registration_number": registration_number})
    
    async def find_by_vin(self, vin: str) -> Optional[Dict[str, Any]]:
        return await self.find_one({"vin": vin})
    
    async def find_by_customer(self, customer_id: str) -> List[Dict[str, Any]]:
        return await self.find_many({"customer_id": customer_id})


class InspectionRepository(BaseRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "inspections")
    
    async def find_by_mechanic(
        self, 
        mechanic_id: str, 
        status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        query = {"mechanic_id": mechanic_id}
        if status:
            query["status"] = status
        return await self.find_many(query)
    
    async def find_by_vehicle(self, vehicle_id: str) -> List[Dict[str, Any]]:
        return await self.find_many({"vehicle_id": vehicle_id})


class OBDSessionRepository(BaseRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "obd_sessions")
    
    async def find_by_inspection(self, inspection_id: str) -> Optional[Dict[str, Any]]:
        return await self.find_one({"inspection_id": inspection_id})
    
    async def find_by_vehicle(self, vehicle_id: str) -> List[Dict[str, Any]]:
        return await self.find_many(
            {"vehicle_id": vehicle_id},
            sort=[("scanned_at", -1)]
        )
    
    async def find_by_vin(self, vin: str) -> List[Dict[str, Any]]:
        return await self.find_many(
            {"vin": vin},
            sort=[("scanned_at", -1)]
        )


class PaymentRepository(BaseRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "finance_payments")
    
    async def find_by_employee(
        self, 
        employee_id: str, 
        year: Optional[int] = None,
        month: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        query = {"employee_id": employee_id}
        if year:
            query["year"] = year
        if month:
            query["month"] = month
        return await self.find_many(query)
    
    async def find_by_status(
        self, 
        status: str, 
        country_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        query = {"status": status}
        if country_id:
            query["country_id"] = country_id
        return await self.find_many(query)


class AuditLogRepository(BaseRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "audit_logs")
    
    async def log_action(
        self,
        entity_type: str,
        entity_id: str,
        action: str,
        user_id: str,
        changes: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Create an audit log entry"""
        return await self.create({
            "entity_type": entity_type,
            "entity_id": entity_id,
            "action": action,
            "user_id": user_id,
            "changes": changes,
            "metadata": metadata,
        })
    
    async def find_by_entity(
        self, 
        entity_type: str, 
        entity_id: str
    ) -> List[Dict[str, Any]]:
        return await self.find_many(
            {"entity_type": entity_type, "entity_id": entity_id},
            sort=[("created_at", -1)]
        )

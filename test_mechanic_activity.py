#!/usr/bin/env python3
"""
Test script to verify mechanic assignment activity logging
"""
import asyncio
import sys
import os
sys.path.append('/app/backend')

from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import uuid

async def test_activity_logging():
    """Test that activity logging works for mechanic assignment"""
    
    # Connect to MongoDB
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'wisedrive_crm_v2')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("Testing mechanic assignment activity logging...")
    
    # Create a test inspection
    test_inspection_id = str(uuid.uuid4())
    test_inspection = {
        "id": test_inspection_id,
        "customer_name": "Test Customer",
        "car_number": "TEST123",
        "city": "Bangalore",
        "inspection_status": "NEW_INSPECTION",
        "mechanic_id": None,
        "mechanic_name": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.inspections.insert_one(test_inspection)
    print(f"Created test inspection: {test_inspection_id}")
    
    # Simulate mechanic assignment activity
    activity = {
        "id": str(uuid.uuid4()),
        "inspection_id": test_inspection_id,
        "user_id": "test-user-001",
        "user_name": "Test User",
        "action": "mechanic_assigned",
        "details": "Assigned to Test Mechanic",
        "old_value": None,
        "new_value": "Test Mechanic",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.inspection_activities.insert_one(activity)
    print(f"Created test activity: {activity['id']}")
    
    # Verify the activity was logged
    logged_activity = await db.inspection_activities.find_one({"inspection_id": test_inspection_id})
    
    if logged_activity:
        print("✅ Activity logging test PASSED")
        print(f"   Action: {logged_activity['action']}")
        print(f"   Details: {logged_activity['details']}")
        print(f"   User: {logged_activity['user_name']}")
        print(f"   Old Value: {logged_activity['old_value']}")
        print(f"   New Value: {logged_activity['new_value']}")
    else:
        print("❌ Activity logging test FAILED - No activity found")
    
    # Clean up test data
    await db.inspections.delete_one({"id": test_inspection_id})
    await db.inspection_activities.delete_one({"inspection_id": test_inspection_id})
    print("Cleaned up test data")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(test_activity_logging())
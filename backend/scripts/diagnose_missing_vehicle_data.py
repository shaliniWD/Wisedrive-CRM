#!/usr/bin/env python3
"""
Script to identify inspections with missing vehicle data in the database.
Run with: python scripts/diagnose_missing_vehicle_data.py
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "wisedrive_crm")


async def diagnose_missing_vehicle_data():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("=" * 60)
    print("VEHICLE DATA DIAGNOSTIC REPORT")
    print(f"Database: {DB_NAME}")
    print(f"Time: {datetime.now().isoformat()}")
    print("=" * 60)
    
    # Get all inspections
    total_inspections = await db.inspections.count_documents({})
    print(f"\nTotal Inspections: {total_inspections}")
    
    # Find inspections with missing car_number
    missing_car_number = await db.inspections.count_documents({
        "$or": [
            {"car_number": {"$exists": False}},
            {"car_number": None},
            {"car_number": ""},
        ]
    })
    
    # Find inspections with missing car_make
    missing_car_make = await db.inspections.count_documents({
        "$or": [
            {"car_make": {"$exists": False}},
            {"car_make": None},
            {"car_make": ""},
        ]
    })
    
    # Find inspections with missing car_model
    missing_car_model = await db.inspections.count_documents({
        "$or": [
            {"car_model": {"$exists": False}},
            {"car_model": None},
            {"car_model": ""},
        ]
    })
    
    print(f"\n--- Missing Data Summary ---")
    if total_inspections > 0:
        print(f"Missing car_number: {missing_car_number} ({missing_car_number/total_inspections*100:.1f}%)")
        print(f"Missing car_make: {missing_car_make} ({missing_car_make/total_inspections*100:.1f}%)")
        print(f"Missing car_model: {missing_car_model} ({missing_car_model/total_inspections*100:.1f}%)")
    else:
        print("No inspections found in database")
    
    # Get detailed list of inspections with missing vehicle data
    missing_inspections = await db.inspections.find({
        "$or": [
            {"car_number": {"$in": [None, ""]}},
            {"car_number": {"$exists": False}},
        ]
    }, {
        "_id": 0,
        "id": 1,
        "customer_name": 1,
        "car_number": 1,
        "car_make": 1,
        "car_model": 1,
        "city": 1,
        "inspection_status": 1,
        "created_at": 1,
        "lead_id": 1
    }).sort("created_at", -1).to_list(100)
    
    print(f"\n--- Inspections with Missing Vehicle Number (Latest {len(missing_inspections)}) ---")
    for i, insp in enumerate(missing_inspections[:20], 1):
        print(f"\n{i}. Inspection ID: {insp.get('id', 'N/A')[:20]}...")
        print(f"   Customer: {insp.get('customer_name', 'N/A')}")
        print(f"   City: {insp.get('city', 'N/A')}")
        print(f"   Status: {insp.get('inspection_status', 'N/A')}")
        print(f"   car_number: '{insp.get('car_number', 'NOT SET')}'")
        print(f"   car_make: {insp.get('car_make', 'NOT SET')}")
        print(f"   car_model: {insp.get('car_model', 'NOT SET')}")
        print(f"   Created: {insp.get('created_at', 'N/A')}")
        print(f"   Lead ID: {insp.get('lead_id', 'N/A')}")
    
    # Check corresponding leads for vehicle data
    print(f"\n--- Checking Corresponding Leads ---")
    lead_ids = [insp.get("lead_id") for insp in missing_inspections if insp.get("lead_id")]
    if lead_ids:
        leads = await db.leads.find(
            {"id": {"$in": lead_ids}},
            {"_id": 0, "id": 1, "vehicle_number": 1, "vehicle_make": 1, "vehicle_model": 1, "name": 1}
        ).to_list(100)
        
        lead_map = {l["id"]: l for l in leads}
        
        leads_with_vehicle = 0
        leads_without_vehicle = 0
        
        for lead_id in lead_ids[:10]:
            lead = lead_map.get(lead_id)
            if lead:
                has_vehicle = bool(lead.get("vehicle_number"))
                if has_vehicle:
                    leads_with_vehicle += 1
                else:
                    leads_without_vehicle += 1
                print(f"\n   Lead: {lead.get('name', 'N/A')}")
                print(f"   - vehicle_number: '{lead.get('vehicle_number', 'NOT SET')}'")
                print(f"   - vehicle_make: {lead.get('vehicle_make', 'NOT SET')}")
                print(f"   - vehicle_model: {lead.get('vehicle_model', 'NOT SET')}")
        
        print(f"\n   Summary: {leads_with_vehicle} leads have vehicle data, {leads_without_vehicle} don't")
    
    # Check recent inspections (last 7 days) for pattern
    week_ago = (datetime.now() - timedelta(days=7)).isoformat()
    recent_missing = await db.inspections.count_documents({
        "created_at": {"$gte": week_ago},
        "$or": [
            {"car_number": {"$in": [None, ""]}},
            {"car_number": {"$exists": False}},
        ]
    })
    recent_total = await db.inspections.count_documents({
        "created_at": {"$gte": week_ago}
    })
    
    print(f"\n--- Recent Trend (Last 7 Days) ---")
    print(f"Recent inspections: {recent_total}")
    print(f"Recent with missing vehicle number: {recent_missing}")
    if recent_total > 0:
        print(f"Percentage missing: {recent_missing/recent_total*100:.1f}%")
    
    # City breakdown for missing data
    print(f"\n--- Missing Data by City ---")
    pipeline = [
        {
            "$match": {
                "$or": [
                    {"car_number": {"$in": [None, ""]}},
                    {"car_number": {"$exists": False}},
                ]
            }
        },
        {
            "$group": {
                "_id": "$city",
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"count": -1}}
    ]
    city_breakdown = await db.inspections.aggregate(pipeline).to_list(20)
    for item in city_breakdown:
        print(f"   {item['_id'] or 'NO CITY'}: {item['count']} inspections")
    
    client.close()
    print("\n" + "=" * 60)
    print("DIAGNOSTIC COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(diagnose_missing_vehicle_data())

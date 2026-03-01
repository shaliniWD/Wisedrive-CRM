"""
Script to clean up database records where city values don't match Cities Master.
Run this script once to normalize all city data.
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')

async def cleanup_invalid_cities():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Step 1: Get all valid cities and their aliases from Cities Master
    print("=== Fetching valid cities from Cities Master ===")
    cities_cursor = db.cities.find({"is_active": True}, {"_id": 0})
    cities = await cities_cursor.to_list(length=None)
    
    # Build a mapping of valid city names and aliases -> canonical city name
    valid_cities = set()
    city_alias_map = {}  # Maps alias/variant -> canonical city name
    
    for city in cities:
        name = city.get("name", "")
        valid_cities.add(name.lower())
        city_alias_map[name.lower()] = name
        
        # Add aliases
        for alias in city.get("aliases", []):
            city_alias_map[alias.lower()] = name
            valid_cities.add(alias.lower())
    
    print(f"Found {len(cities)} valid cities with {len(city_alias_map)} total mappings (including aliases)")
    print(f"Cities: {[c.get('name') for c in cities]}")
    
    # Step 2: Find and fix invalid cities in various collections
    collections_to_check = [
        ("leads", "city"),
        ("customers", "city"),
        ("inspections", "city"),
        ("employees", "city"),
        ("employees", "inspection_cities"),  # Array field
        ("employees", "assigned_cities"),    # Array field
        ("ad_city_mappings", "city"),
    ]
    
    total_fixed = 0
    total_cleared = 0
    
    for collection_name, field_name in collections_to_check:
        print(f"\n=== Checking {collection_name}.{field_name} ===")
        collection = db[collection_name]
        
        if field_name in ["inspection_cities", "assigned_cities"]:
            # Handle array fields
            cursor = collection.find({field_name: {"$exists": True, "$ne": []}})
            docs = await cursor.to_list(length=None)
            
            for doc in docs:
                doc_id = doc.get("id") or str(doc.get("_id"))
                current_cities = doc.get(field_name, [])
                
                new_cities = []
                for city in current_cities:
                    city_lower = city.lower() if city else ""
                    if city_lower in city_alias_map:
                        # Map alias to canonical name
                        canonical = city_alias_map[city_lower]
                        if canonical not in new_cities:
                            new_cities.append(canonical)
                    # Skip cities not in master
                
                if set(new_cities) != set(current_cities):
                    print(f"  - {collection_name} ID {doc_id}: {current_cities} -> {new_cities}")
                    await collection.update_one(
                        {"_id": doc["_id"]},
                        {"$set": {field_name: new_cities}}
                    )
                    total_fixed += 1
        else:
            # Handle single value fields
            cursor = collection.find({field_name: {"$exists": True, "$ne": None, "$ne": ""}})
            docs = await cursor.to_list(length=None)
            
            invalid_count = 0
            for doc in docs:
                doc_id = doc.get("id") or str(doc.get("_id"))
                current_city = doc.get(field_name, "")
                city_lower = current_city.lower() if current_city else ""
                
                if city_lower and city_lower not in city_alias_map:
                    # City not in master - clear it
                    print(f"  - INVALID: {collection_name} ID {doc_id}: '{current_city}' (will be cleared)")
                    await collection.update_one(
                        {"_id": doc["_id"]},
                        {"$set": {field_name: ""}}
                    )
                    invalid_count += 1
                    total_cleared += 1
                elif city_lower and city_alias_map.get(city_lower) != current_city:
                    # City is an alias - normalize to canonical name
                    canonical = city_alias_map[city_lower]
                    print(f"  - NORMALIZE: {collection_name} ID {doc_id}: '{current_city}' -> '{canonical}'")
                    await collection.update_one(
                        {"_id": doc["_id"]},
                        {"$set": {field_name: canonical}}
                    )
                    total_fixed += 1
            
            if invalid_count == 0:
                print(f"  All {len(docs)} records have valid cities")
    
    print(f"\n=== SUMMARY ===")
    print(f"Total records normalized (alias -> canonical): {total_fixed}")
    print(f"Total records cleared (invalid city): {total_cleared}")
    
    client.close()
    return {"fixed": total_fixed, "cleared": total_cleared}

if __name__ == "__main__":
    asyncio.run(cleanup_invalid_cities())

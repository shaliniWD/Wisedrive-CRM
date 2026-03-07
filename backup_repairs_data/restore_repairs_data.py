#!/usr/bin/env python3
"""
Restore Repairs Module Data Script
Run this script after redeployment to restore all repairs module data.

Usage:
    python3 restore_repairs_data.py

Requires:
    - MongoDB running on localhost:27017
    - JSON backup files in /app/backup_repairs_data/
"""

import json
import os
from pymongo import MongoClient

BACKUP_DIR = '/app/backup_repairs_data'
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'wisedrive_crm')

def load_json(filename):
    filepath = os.path.join(BACKUP_DIR, filename)
    if os.path.exists(filepath):
        with open(filepath, 'r') as f:
            return json.load(f)
    return []

def restore_collection(db, collection_name, data, id_field='id'):
    """Restore a collection, using upsert to avoid duplicates"""
    if not data:
        print(f"  ⚠️  No data to restore for {collection_name}")
        return 0
    
    collection = db[collection_name]
    count = 0
    
    for item in data:
        if id_field in item:
            # Upsert by ID to avoid duplicates
            result = collection.update_one(
                {id_field: item[id_field]},
                {'$set': item},
                upsert=True
            )
            if result.upserted_id or result.modified_count:
                count += 1
        else:
            # Insert if no ID field
            collection.insert_one(item)
            count += 1
    
    return count

def main():
    print("🔄 Connecting to MongoDB...")
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    
    print(f"📂 Loading backup files from {BACKUP_DIR}...")
    
    # 1. Restore Inspection Categories
    print("\n1️⃣  Restoring inspection_categories...")
    cats = load_json('inspection_categories.json')
    count = restore_collection(db, 'inspection_categories', cats)
    print(f"   ✅ Restored {count} inspection categories")
    
    # 2. Restore Q&A Categories
    print("\n2️⃣  Restoring inspection_qa_categories...")
    qa_cats = load_json('inspection_qa_categories.json')
    count = restore_collection(db, 'inspection_qa_categories', qa_cats)
    print(f"   ✅ Restored {count} Q&A categories")
    
    # 3. Restore Inspection Questions
    print("\n3️⃣  Restoring inspection_questions...")
    questions = load_json('inspection_questions.json')
    count = restore_collection(db, 'inspection_questions', questions, 'question_id')
    print(f"   ✅ Restored {count} inspection questions")
    
    # 4. Restore Repair Parts
    print("\n4️⃣  Restoring repair_parts...")
    parts = load_json('repair_parts.json')
    count = restore_collection(db, 'repair_parts', parts)
    print(f"   ✅ Restored {count} spare parts")
    
    # 5. Restore Repair Rules
    print("\n5️⃣  Restoring repair_rules...")
    rules = load_json('repair_rules.json')
    count = restore_collection(db, 'repair_rules', rules)
    print(f"   ✅ Restored {count} repair rules")
    
    # 6. Restore Report Publish History (if any)
    print("\n6️⃣  Restoring report_publish_history...")
    pub_history = load_json('report_publish_history.json')
    count = restore_collection(db, 'report_publish_history', pub_history)
    print(f"   ✅ Restored {count} publish history entries")
    
    print("\n" + "="*50)
    print("✅ All repairs module data restored successfully!")
    print("="*50)
    
    # Verify counts
    print("\n📊 Verification:")
    print(f"   - inspection_categories: {db.inspection_categories.count_documents({})}")
    print(f"   - inspection_qa_categories: {db.inspection_qa_categories.count_documents({})}")
    print(f"   - inspection_questions: {db.inspection_questions.count_documents({})}")
    print(f"   - repair_parts: {db.repair_parts.count_documents({})}")
    print(f"   - repair_rules: {db.repair_rules.count_documents({})}")
    print(f"   - report_publish_history: {db.report_publish_history.count_documents({})}")

if __name__ == '__main__':
    main()

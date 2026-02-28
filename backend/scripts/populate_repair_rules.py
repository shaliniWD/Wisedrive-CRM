#!/usr/bin/env python3
"""
Script to populate sample data for the Repairs Module:
1. Q&A Categories with inspection questions
2. Repair rules linking questions to parts
"""

import asyncio
import uuid
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "test_database"
COUNTRY_ID = "c49e1dc6-1450-40c2-9846-56b73369b2b1"
USER_ID = "7cf43310-c14c-45d0-aa2d-6eb99b04ea1b"

# Q&A Categories with questions for repair estimation
QA_CATEGORIES = [
    {
        "name": "Front Bumper Inspection",
        "description": "Inspection of front bumper condition",
        "icon": "car-front",
        "questions": [
            {
                "question": "How many dents are on the front bumper?",
                "answer_type": "multiple_choice",
                "options": ["No dents", "1-2 small dents", "3-4 dents", "5+ dents or severe damage"],
            },
            {
                "question": "Are there scratches on the front bumper?",
                "answer_type": "multiple_choice",
                "options": ["No scratches", "Minor scratches (can be buffed)", "Deep scratches", "Paint peeling"],
            },
            {
                "question": "Is the front bumper cracked?",
                "answer_type": "multiple_choice",
                "options": ["No cracks", "Hairline cracks", "Visible cracks", "Severely cracked/broken"],
            },
        ]
    },
    {
        "name": "Rear Bumper Inspection",
        "description": "Inspection of rear bumper condition",
        "icon": "car-rear",
        "questions": [
            {
                "question": "How many dents are on the rear bumper?",
                "answer_type": "multiple_choice",
                "options": ["No dents", "1-2 small dents", "3-4 dents", "5+ dents or severe damage"],
            },
            {
                "question": "Are there scratches on the rear bumper?",
                "answer_type": "multiple_choice",
                "options": ["No scratches", "Minor scratches", "Deep scratches", "Paint peeling"],
            },
            {
                "question": "Is the rear bumper cracked?",
                "answer_type": "multiple_choice",
                "options": ["No cracks", "Hairline cracks", "Visible cracks", "Severely cracked/broken"],
            },
        ]
    },
    {
        "name": "Front Fender Inspection",
        "description": "Inspection of front fenders (left & right)",
        "icon": "layers",
        "questions": [
            {
                "question": "What is the condition of the front right fender?",
                "answer_type": "multiple_choice",
                "options": ["Good - No damage", "Minor dent/scratch", "Moderate damage", "Severe damage - needs replacement"],
            },
            {
                "question": "What is the condition of the front left fender?",
                "answer_type": "multiple_choice",
                "options": ["Good - No damage", "Minor dent/scratch", "Moderate damage", "Severe damage - needs replacement"],
            },
            {
                "question": "Is there rust on the front fenders?",
                "answer_type": "multiple_choice",
                "options": ["No rust", "Surface rust (can be treated)", "Rust through (needs panel work)"],
            },
        ]
    },
    {
        "name": "Door Panel Inspection",
        "description": "Inspection of all door panels",
        "icon": "door-open",
        "questions": [
            {
                "question": "Front Right Door condition?",
                "answer_type": "multiple_choice",
                "options": ["Good - No damage", "Minor dent/scratch", "Moderate damage", "Severe damage"],
            },
            {
                "question": "Front Left Door condition?",
                "answer_type": "multiple_choice",
                "options": ["Good - No damage", "Minor dent/scratch", "Moderate damage", "Severe damage"],
            },
            {
                "question": "Rear Right Door condition?",
                "answer_type": "multiple_choice",
                "options": ["Good - No damage", "Minor dent/scratch", "Moderate damage", "Severe damage"],
            },
            {
                "question": "Rear Left Door condition?",
                "answer_type": "multiple_choice",
                "options": ["Good - No damage", "Minor dent/scratch", "Moderate damage", "Severe damage"],
            },
        ]
    },
    {
        "name": "Hood & Trunk Inspection",
        "description": "Inspection of bonnet/hood and boot/trunk",
        "icon": "rectangle-vertical",
        "questions": [
            {
                "question": "What is the condition of the hood/bonnet?",
                "answer_type": "multiple_choice",
                "options": ["Good - No damage", "Minor dent/scratch", "Moderate damage", "Severe damage"],
            },
            {
                "question": "What is the condition of the trunk/boot lid?",
                "answer_type": "multiple_choice",
                "options": ["Good - No damage", "Minor dent/scratch", "Moderate damage", "Severe damage"],
            },
            {
                "question": "Is there hail damage on the roof panel?",
                "answer_type": "multiple_choice",
                "options": ["No damage", "Light hail marks", "Moderate hail damage", "Severe hail damage"],
            },
        ]
    },
    {
        "name": "Headlight & Taillight Inspection",
        "description": "Inspection of all lights",
        "icon": "lightbulb",
        "questions": [
            {
                "question": "Right headlight condition?",
                "answer_type": "multiple_choice",
                "options": ["Working & Clear", "Foggy/Yellowed (needs restoration)", "Cracked", "Broken/Not working"],
            },
            {
                "question": "Left headlight condition?",
                "answer_type": "multiple_choice",
                "options": ["Working & Clear", "Foggy/Yellowed (needs restoration)", "Cracked", "Broken/Not working"],
            },
            {
                "question": "Right taillight condition?",
                "answer_type": "multiple_choice",
                "options": ["Working & Clear", "Cracked", "Broken/Not working"],
            },
            {
                "question": "Left taillight condition?",
                "answer_type": "multiple_choice",
                "options": ["Working & Clear", "Cracked", "Broken/Not working"],
            },
        ]
    },
    {
        "name": "Windshield & Glass Inspection",
        "description": "Inspection of all glass components",
        "icon": "square",
        "questions": [
            {
                "question": "Front windshield condition?",
                "answer_type": "multiple_choice",
                "options": ["Clear - No damage", "Small chip (repairable)", "Crack (needs replacement)", "Severely damaged"],
            },
            {
                "question": "Rear windshield condition?",
                "answer_type": "multiple_choice",
                "options": ["Clear - No damage", "Small chip", "Cracked", "Severely damaged"],
            },
            {
                "question": "Right side ORVM (mirror) condition?",
                "answer_type": "multiple_choice",
                "options": ["Working properly", "Glass cracked/broken", "Motor not working", "Entire assembly damaged"],
            },
            {
                "question": "Left side ORVM (mirror) condition?",
                "answer_type": "multiple_choice",
                "options": ["Working properly", "Glass cracked/broken", "Motor not working", "Entire assembly damaged"],
            },
        ]
    },
    {
        "name": "Tyre & Wheel Inspection",
        "description": "Inspection of tyres and wheels",
        "icon": "circle",
        "questions": [
            {
                "question": "Front Right Tyre condition?",
                "answer_type": "multiple_choice",
                "options": ["Good tread (>4mm)", "Moderate wear (2-4mm)", "Low tread (<2mm)", "Needs immediate replacement"],
            },
            {
                "question": "Front Left Tyre condition?",
                "answer_type": "multiple_choice",
                "options": ["Good tread (>4mm)", "Moderate wear (2-4mm)", "Low tread (<2mm)", "Needs immediate replacement"],
            },
            {
                "question": "Rear Right Tyre condition?",
                "answer_type": "multiple_choice",
                "options": ["Good tread (>4mm)", "Moderate wear (2-4mm)", "Low tread (<2mm)", "Needs immediate replacement"],
            },
            {
                "question": "Rear Left Tyre condition?",
                "answer_type": "multiple_choice",
                "options": ["Good tread (>4mm)", "Moderate wear (2-4mm)", "Low tread (<2mm)", "Needs immediate replacement"],
            },
            {
                "question": "Are there any damaged alloy wheels?",
                "answer_type": "multiple_choice",
                "options": ["All wheels in good condition", "Minor curb rash", "Bent/cracked wheel", "Multiple wheels damaged"],
            },
        ]
    },
    {
        "name": "Brake System Inspection",
        "description": "Inspection of brake components",
        "icon": "octagon",
        "questions": [
            {
                "question": "Front brake pad condition?",
                "answer_type": "multiple_choice",
                "options": ["Good (>50% remaining)", "Moderate wear (25-50%)", "Low (<25% - replace soon)", "Needs immediate replacement"],
            },
            {
                "question": "Rear brake pad condition?",
                "answer_type": "multiple_choice",
                "options": ["Good (>50% remaining)", "Moderate wear (25-50%)", "Low (<25% - replace soon)", "Needs immediate replacement"],
            },
            {
                "question": "Front brake disc condition?",
                "answer_type": "multiple_choice",
                "options": ["Good condition", "Slight scoring (can be resurfaced)", "Warped/grooved (needs replacement)", "Severely damaged"],
            },
        ]
    },
    {
        "name": "Electrical & Battery Inspection",
        "description": "Inspection of electrical components",
        "icon": "zap",
        "questions": [
            {
                "question": "Battery condition?",
                "answer_type": "multiple_choice",
                "options": ["Good - holding charge", "Weak - may need replacement soon", "Dead - needs replacement"],
            },
            {
                "question": "Starter motor condition?",
                "answer_type": "multiple_choice",
                "options": ["Starting smoothly", "Slow cranking", "Intermittent issues", "Not working"],
            },
        ]
    },
    {
        "name": "AC & Cooling Inspection",
        "description": "Inspection of AC and cooling system",
        "icon": "snowflake",
        "questions": [
            {
                "question": "AC cooling performance?",
                "answer_type": "multiple_choice",
                "options": ["Cooling well", "Reduced cooling", "Not cooling at all"],
            },
            {
                "question": "Is there any coolant leak from radiator?",
                "answer_type": "multiple_choice",
                "options": ["No leaks", "Minor seepage", "Active leak - needs attention"],
            },
        ]
    },
    {
        "name": "Exhaust System Inspection",
        "description": "Inspection of exhaust components",
        "icon": "wind",
        "questions": [
            {
                "question": "Silencer/Muffler condition?",
                "answer_type": "multiple_choice",
                "options": ["Good - no noise", "Slight rattle", "Loud exhaust noise", "Damaged/rusted through"],
            },
        ]
    },
    {
        "name": "Engine Oil & Service Inspection",
        "description": "Inspection of engine oil and service requirements",
        "icon": "droplet",
        "questions": [
            {
                "question": "Engine oil condition?",
                "answer_type": "multiple_choice",
                "options": ["Clean - recently changed", "Moderate - due for change soon", "Dirty - needs immediate change"],
            },
        ]
    },
]

async def get_repair_parts(db):
    """Fetch all repair parts and create a lookup by name"""
    parts = await db.repair_parts.find({}, {"_id": 0}).to_list(100)
    return {p["name"]: p for p in parts}

async def create_qa_categories(db):
    """Create Q&A categories with embedded questions"""
    created_categories = []
    
    for cat_data in QA_CATEGORIES:
        category_id = str(uuid.uuid4())
        questions = []
        
        for i, q_data in enumerate(cat_data.get("questions", [])):
            question_id = str(uuid.uuid4())
            questions.append({
                "id": question_id,
                "question": q_data["question"],
                "answer_type": q_data.get("answer_type", "multiple_choice"),
                "options": q_data.get("options", []),
                "order": i,
                "is_mandatory": True,
            })
        
        category = {
            "id": category_id,
            "name": cat_data["name"],
            "description": cat_data.get("description", ""),
            "icon": cat_data.get("icon", "clipboard"),
            "questions": questions,
            "order": len(created_categories),
            "is_active": True,
            "country_id": COUNTRY_ID,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": USER_ID,
        }
        
        # Insert into inspection_qa_categories
        await db.inspection_qa_categories.insert_one(category)
        created_categories.append(category)
        print(f"✓ Created category: {cat_data['name']} with {len(questions)} questions")
    
    return created_categories

async def create_repair_rules(db, categories, parts_lookup):
    """Create repair rules linking questions to parts"""
    
    # Define rule mappings: (category_name_contains, question_contains, part_name, rules)
    # Each rule: (condition_type, condition_value, action_type)
    RULE_MAPPINGS = [
        # Front Bumper rules
        ("Front Bumper", "dents", "Front Bumper", [
            ("EQUALS", "1-2 small dents", "REPAIR"),
            ("EQUALS", "3-4 dents", "REPAIR"),
            ("EQUALS", "5+ dents or severe damage", "REPLACE"),
        ]),
        ("Front Bumper", "scratches", "Front Bumper", [
            ("EQUALS", "Deep scratches", "REPAIR"),
            ("EQUALS", "Paint peeling", "REPLACE"),
        ]),
        ("Front Bumper", "cracked", "Front Bumper", [
            ("EQUALS", "Hairline cracks", "REPAIR"),
            ("EQUALS", "Visible cracks", "REPAIR"),
            ("EQUALS", "Severely cracked/broken", "REPLACE"),
        ]),
        
        # Rear Bumper rules
        ("Rear Bumper", "dents", "Rear Bumper", [
            ("EQUALS", "1-2 small dents", "REPAIR"),
            ("EQUALS", "3-4 dents", "REPAIR"),
            ("EQUALS", "5+ dents or severe damage", "REPLACE"),
        ]),
        ("Rear Bumper", "scratches", "Rear Bumper", [
            ("EQUALS", "Deep scratches", "REPAIR"),
            ("EQUALS", "Paint peeling", "REPLACE"),
        ]),
        ("Rear Bumper", "cracked", "Rear Bumper", [
            ("EQUALS", "Visible cracks", "REPAIR"),
            ("EQUALS", "Severely cracked/broken", "REPLACE"),
        ]),
        
        # Front Fender rules
        ("Front Fender", "right fender", "Front Right Fender", [
            ("EQUALS", "Minor dent/scratch", "REPAIR"),
            ("EQUALS", "Moderate damage", "REPAIR"),
            ("EQUALS", "Severe damage - needs replacement", "REPLACE"),
        ]),
        ("Front Fender", "left fender", "Front Left Fender", [
            ("EQUALS", "Minor dent/scratch", "REPAIR"),
            ("EQUALS", "Moderate damage", "REPAIR"),
            ("EQUALS", "Severe damage - needs replacement", "REPLACE"),
        ]),
        
        # Door Panel rules
        ("Door Panel", "Front Right Door", "Front Right Door", [
            ("EQUALS", "Minor dent/scratch", "REPAIR"),
            ("EQUALS", "Moderate damage", "REPAIR"),
            ("EQUALS", "Severe damage", "REPLACE"),
        ]),
        ("Door Panel", "Front Left Door", "Front Left Door", [
            ("EQUALS", "Minor dent/scratch", "REPAIR"),
            ("EQUALS", "Moderate damage", "REPAIR"),
            ("EQUALS", "Severe damage", "REPLACE"),
        ]),
        ("Door Panel", "Rear Right Door", "Rear Right Door", [
            ("EQUALS", "Minor dent/scratch", "REPAIR"),
            ("EQUALS", "Moderate damage", "REPAIR"),
            ("EQUALS", "Severe damage", "REPLACE"),
        ]),
        ("Door Panel", "Rear Left Door", "Rear Left Door", [
            ("EQUALS", "Minor dent/scratch", "REPAIR"),
            ("EQUALS", "Moderate damage", "REPAIR"),
            ("EQUALS", "Severe damage", "REPLACE"),
        ]),
        
        # Hood & Trunk rules
        ("Hood & Trunk", "hood/bonnet", "Bonnet / Hood", [
            ("EQUALS", "Minor dent/scratch", "REPAIR"),
            ("EQUALS", "Moderate damage", "REPAIR"),
            ("EQUALS", "Severe damage", "REPLACE"),
        ]),
        ("Hood & Trunk", "trunk/boot", "Boot Lid / Trunk", [
            ("EQUALS", "Minor dent/scratch", "REPAIR"),
            ("EQUALS", "Moderate damage", "REPAIR"),
            ("EQUALS", "Severe damage", "REPLACE"),
        ]),
        ("Hood & Trunk", "roof panel", "Roof Panel", [
            ("EQUALS", "Light hail marks", "REPAIR"),
            ("EQUALS", "Moderate hail damage", "REPAIR"),
            ("EQUALS", "Severe hail damage", "REPLACE"),
        ]),
        
        # Headlight rules
        ("Headlight & Taillight", "Right headlight", "Headlight Assembly - Right", [
            ("EQUALS", "Foggy/Yellowed (needs restoration)", "REPAIR"),
            ("EQUALS", "Cracked", "REPLACE"),
            ("EQUALS", "Broken/Not working", "REPLACE"),
        ]),
        ("Headlight & Taillight", "Left headlight", "Headlight Assembly - Left", [
            ("EQUALS", "Foggy/Yellowed (needs restoration)", "REPAIR"),
            ("EQUALS", "Cracked", "REPLACE"),
            ("EQUALS", "Broken/Not working", "REPLACE"),
        ]),
        ("Headlight & Taillight", "Right taillight", "Taillight Assembly - Right", [
            ("EQUALS", "Cracked", "REPAIR"),
            ("EQUALS", "Broken/Not working", "REPLACE"),
        ]),
        ("Headlight & Taillight", "Left taillight", "Taillight Assembly - Left", [
            ("EQUALS", "Cracked", "REPAIR"),
            ("EQUALS", "Broken/Not working", "REPLACE"),
        ]),
        
        # Windshield rules
        ("Windshield & Glass", "Front windshield", "Windshield / Front Glass", [
            ("EQUALS", "Small chip (repairable)", "REPAIR"),
            ("EQUALS", "Crack (needs replacement)", "REPLACE"),
            ("EQUALS", "Severely damaged", "REPLACE"),
        ]),
        ("Windshield & Glass", "Rear windshield", "Rear Glass / Back Windshield", [
            ("EQUALS", "Small chip", "REPAIR"),
            ("EQUALS", "Cracked", "REPLACE"),
            ("EQUALS", "Severely damaged", "REPLACE"),
        ]),
        ("Windshield & Glass", "Right side ORVM", "Outside Rear View Mirror - Right", [
            ("EQUALS", "Glass cracked/broken", "REPAIR"),
            ("EQUALS", "Motor not working", "REPAIR"),
            ("EQUALS", "Entire assembly damaged", "REPLACE"),
        ]),
        ("Windshield & Glass", "Left side ORVM", "Outside Rear View Mirror - Left", [
            ("EQUALS", "Glass cracked/broken", "REPAIR"),
            ("EQUALS", "Motor not working", "REPAIR"),
            ("EQUALS", "Entire assembly damaged", "REPLACE"),
        ]),
        
        # Tyre rules
        ("Tyre & Wheel", "Tyre condition", "Tyre - Single", [
            ("CONTAINS", "Low tread", "REPLACE"),
            ("CONTAINS", "immediate replacement", "REPLACE"),
        ]),
        ("Tyre & Wheel", "alloy wheels", "Alloy Wheel - Single", [
            ("EQUALS", "Minor curb rash", "REPAIR"),
            ("EQUALS", "Bent/cracked wheel", "REPLACE"),
            ("EQUALS", "Multiple wheels damaged", "REPLACE"),
        ]),
        
        # Brake rules
        ("Brake System", "Front brake pad", "Brake Pads - Front Set", [
            ("CONTAINS", "Low", "REPLACE"),
            ("CONTAINS", "immediate replacement", "REPLACE"),
        ]),
        ("Brake System", "Rear brake pad", "Brake Pads - Rear Set", [
            ("CONTAINS", "Low", "REPLACE"),
            ("CONTAINS", "immediate replacement", "REPLACE"),
        ]),
        ("Brake System", "brake disc", "Brake Disc - Front Single", [
            ("EQUALS", "Slight scoring (can be resurfaced)", "REPAIR"),
            ("EQUALS", "Warped/grooved (needs replacement)", "REPLACE"),
            ("EQUALS", "Severely damaged", "REPLACE"),
        ]),
        
        # Electrical rules
        ("Electrical & Battery", "Battery", "Battery", [
            ("EQUALS", "Weak - may need replacement soon", "REPLACE"),
            ("EQUALS", "Dead - needs replacement", "REPLACE"),
        ]),
        ("Electrical & Battery", "Starter motor", "Starter Motor", [
            ("EQUALS", "Slow cranking", "REPAIR"),
            ("EQUALS", "Intermittent issues", "REPAIR"),
            ("EQUALS", "Not working", "REPLACE"),
        ]),
        
        # AC rules
        ("AC & Cooling", "AC cooling", "AC Compressor", [
            ("EQUALS", "Reduced cooling", "REPAIR"),
            ("EQUALS", "Not cooling at all", "REPLACE"),
        ]),
        ("AC & Cooling", "radiator", "Radiator", [
            ("EQUALS", "Minor seepage", "REPAIR"),
            ("EQUALS", "Active leak - needs attention", "REPLACE"),
        ]),
        
        # Exhaust rules
        ("Exhaust System", "Silencer", "Silencer / Muffler", [
            ("EQUALS", "Slight rattle", "REPAIR"),
            ("EQUALS", "Loud exhaust noise", "REPAIR"),
            ("EQUALS", "Damaged/rusted through", "REPLACE"),
        ]),
        
        # Engine oil rules
        ("Engine Oil", "Engine oil", "Engine Oil + Filter Service", [
            ("EQUALS", "Moderate - due for change soon", "REPLACE"),
            ("EQUALS", "Dirty - needs immediate change", "REPLACE"),
        ]),
    ]
    
    rules_created = 0
    
    for cat in categories:
        cat_name = cat["name"]
        for q in cat.get("questions", []):
            q_text = q["question"]
            q_id = q["id"]
            
            # Find matching rules
            for (cat_match, q_match, part_name, rules) in RULE_MAPPINGS:
                if cat_match.lower() in cat_name.lower() and q_match.lower() in q_text.lower():
                    part = parts_lookup.get(part_name)
                    if not part:
                        print(f"  ⚠ Part not found: {part_name}")
                        continue
                    
                    for (condition_type, condition_value, action_type) in rules:
                        rule_id = str(uuid.uuid4())
                        rule = {
                            "id": rule_id,
                            "question_id": q_id,
                            "question_text": q_text,
                            "category_id": cat["id"],
                            "category_name": cat_name,
                            "part_id": part["id"],
                            "part_name": part["name"],
                            "condition_type": condition_type,
                            "condition_value": condition_value,
                            "action_type": action_type,
                            "priority": 1 if action_type == "REPLACE" else 2,
                            "is_active": True,
                            "country_id": COUNTRY_ID,
                            "created_at": datetime.now(timezone.utc).isoformat(),
                            "created_by": USER_ID,
                        }
                        
                        await db.repair_rules.insert_one(rule)
                        rules_created += 1
    
    print(f"\n✓ Created {rules_created} repair rules")
    return rules_created

async def main():
    print("=" * 60)
    print("Populating Repairs Module Sample Data")
    print("=" * 60)
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Step 1: Get existing parts
    print("\n📦 Fetching existing repair parts...")
    parts_lookup = await get_repair_parts(db)
    print(f"   Found {len(parts_lookup)} parts")
    
    # Step 2: Clear existing Q&A categories (only the ones we create)
    print("\n🧹 Clearing old sample Q&A categories...")
    await db.inspection_qa_categories.delete_many({})
    await db.repair_rules.delete_many({})
    
    # Step 3: Create Q&A categories with questions
    print("\n📝 Creating Q&A categories with questions...")
    categories = await create_qa_categories(db)
    
    # Step 4: Create repair rules
    print("\n🔗 Creating repair rules...")
    await create_repair_rules(db, categories, parts_lookup)
    
    # Summary
    print("\n" + "=" * 60)
    print("✅ DONE! Sample data created successfully.")
    print("=" * 60)
    
    # Verify
    cat_count = await db.inspection_qa_categories.count_documents({})
    rule_count = await db.repair_rules.count_documents({})
    print(f"\n📊 Final counts:")
    print(f"   - Q&A Categories: {cat_count}")
    print(f"   - Repair Rules: {rule_count}")

if __name__ == "__main__":
    asyncio.run(main())

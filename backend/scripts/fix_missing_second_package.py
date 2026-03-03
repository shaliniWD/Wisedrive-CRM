"""
Script to diagnose and fix missing inspections from second package purchases.

This script should be run in the production environment to:
1. Find leads with multiple packages (multiple payment_ids)
2. Check if all expected inspections exist
3. Create missing inspections

Usage:
  python fix_missing_second_package.py --lead-mobile 7411891010 --dry-run
  python fix_missing_second_package.py --lead-mobile 7411891010 --fix
"""

import asyncio
import argparse
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import uuid
import os

# Database connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'wisedrive_crm')


async def diagnose_lead(db, mobile: str):
    """Diagnose a lead's package and inspection situation"""
    print(f"\n{'='*60}")
    print(f"Diagnosing lead with mobile: {mobile}")
    print(f"{'='*60}")
    
    # Find the lead
    lead = await db.leads.find_one({"mobile": mobile}, {"_id": 0})
    if not lead:
        print(f"❌ Lead not found with mobile {mobile}")
        return None
    
    lead_id = lead.get("id")
    print(f"\n📋 Lead: {lead.get('name')} (ID: {lead_id[:8]}...)")
    print(f"   Status: {lead.get('status')}")
    print(f"   Payment Status: {lead.get('payment_status')}")
    print(f"   Package: {lead.get('package_name')} ({lead.get('no_of_inspections', 1)} inspections)")
    print(f"   Razorpay Payment ID: {lead.get('razorpay_payment_id')}")
    
    # Find customer
    customer = await db.customers.find_one({"lead_id": lead_id}, {"_id": 0})
    if customer:
        print(f"\n👤 Customer: {customer.get('name')} (ID: {customer.get('id')[:8]}...)")
        additional_purchases = customer.get("additional_purchases", [])
        print(f"   Additional purchases: {len(additional_purchases)}")
        for i, purchase in enumerate(additional_purchases):
            print(f"   {i+1}. {purchase.get('package_name')} - Payment: {purchase.get('razorpay_payment_id')}")
    
    # Find all inspections for this customer/lead
    inspections = await db.inspections.find(
        {"$or": [{"lead_id": lead_id}, {"customer_id": customer.get("id") if customer else None}]},
        {"_id": 0}
    ).to_list(50)
    
    print(f"\n🔍 Inspections found: {len(inspections)}")
    
    # Group by payment_id
    payment_groups = {}
    for insp in inspections:
        payment_id = insp.get("razorpay_payment_id", "unknown")
        if payment_id not in payment_groups:
            payment_groups[payment_id] = []
        payment_groups[payment_id].append(insp)
    
    print(f"\n📦 Inspections grouped by payment:")
    for payment_id, group in payment_groups.items():
        print(f"   Payment {payment_id[:12]}...: {len(group)} inspection(s)")
        for insp in group:
            status = insp.get("inspection_status", "unknown")
            scheduled = "Scheduled" if insp.get("scheduled_date") else "Unscheduled"
            print(f"      - {insp.get('id')[:8]}... | {scheduled} | {status}")
    
    return {
        "lead": lead,
        "customer": customer,
        "inspections": inspections,
        "payment_groups": payment_groups
    }


async def find_missing_package_inspections(db, mobile: str):
    """Find if there are missing inspections from second package"""
    result = await diagnose_lead(db, mobile)
    if not result:
        return None
    
    lead = result["lead"]
    customer = result["customer"]
    
    # Check customer's additional purchases that don't have corresponding inspections
    missing_packages = []
    
    if customer:
        payment_ids_with_inspections = set(result["payment_groups"].keys())
        
        # Check main package
        main_payment_id = lead.get("razorpay_payment_id")
        if main_payment_id and main_payment_id not in payment_ids_with_inspections:
            missing_packages.append({
                "payment_id": main_payment_id,
                "package_name": lead.get("package_name"),
                "no_of_inspections": lead.get("no_of_inspections", 1)
            })
        
        # Check additional purchases
        for purchase in customer.get("additional_purchases", []):
            payment_id = purchase.get("razorpay_payment_id")
            if payment_id and payment_id not in payment_ids_with_inspections:
                missing_packages.append({
                    "payment_id": payment_id,
                    "package_name": purchase.get("package_name"),
                    "no_of_inspections": purchase.get("no_of_inspections", 1)
                })
    
    if missing_packages:
        print(f"\n⚠️  MISSING INSPECTIONS DETECTED:")
        for pkg in missing_packages:
            print(f"   - Payment {pkg['payment_id']}: {pkg['package_name']} needs {pkg.get('no_of_inspections', 1)} inspection(s)")
    else:
        print(f"\n✅ All packages have corresponding inspections")
    
    return missing_packages


async def create_missing_inspections(db, mobile: str, dry_run: bool = True):
    """Create missing inspections for a lead's second package"""
    result = await diagnose_lead(db, mobile)
    if not result:
        return
    
    lead = result["lead"]
    customer = result["customer"]
    
    if not customer:
        print("❌ Cannot create inspections - no customer record found")
        return
    
    # For the specific case of Test-5, we need to find the second package info
    additional_purchases = customer.get("additional_purchases", [])
    
    if not additional_purchases:
        print("ℹ️  No additional purchases found for this customer")
        print("    If you know the second package was paid, the webhook might not have recorded it.")
        return
    
    for purchase in additional_purchases:
        payment_id = purchase.get("razorpay_payment_id")
        
        # Check if inspections already exist for this payment
        existing = await db.inspections.find_one({"razorpay_payment_id": payment_id})
        if existing:
            print(f"✅ Inspections already exist for payment {payment_id}")
            continue
        
        no_of_inspections = purchase.get("no_of_inspections", 1)
        package_name = purchase.get("package_name", "Standard Inspection")
        amount = purchase.get("payment_amount", 0)
        
        print(f"\n🔧 Would create {no_of_inspections} inspection(s) for:")
        print(f"   Package: {package_name}")
        print(f"   Payment ID: {payment_id}")
        print(f"   Amount: ₹{amount}")
        
        if dry_run:
            print("\n   [DRY RUN - No changes made]")
            print("   Run with --fix to create the inspections")
        else:
            # Create the inspections
            for i in range(no_of_inspections):
                inspection = {
                    "id": str(uuid.uuid4()),
                    "country_id": lead.get("country_id", ""),
                    "customer_id": customer.get("id"),
                    "lead_id": lead.get("id"),
                    "order_id": f"ORD-{payment_id[-8:].upper()}" if payment_id else f"ORD-{str(uuid.uuid4())[:8].upper()}",
                    "customer_name": customer.get("name"),
                    "customer_mobile": customer.get("mobile"),
                    "car_number": "",
                    "city": lead.get("city"),
                    "package_id": purchase.get("package_id"),
                    "package_type": package_name,
                    "total_amount": amount / no_of_inspections,
                    "amount_paid": amount / no_of_inspections,
                    "balance_due": 0,
                    "payment_status": "FULLY_PAID",
                    "payment_date": purchase.get("purchased_at", datetime.now(timezone.utc).isoformat()),
                    "razorpay_payment_id": payment_id,
                    "inspection_status": "NEW_INSPECTION",
                    "scheduled_date": None,
                    "scheduled_time": None,
                    "slot_number": i + 1,
                    "inspections_available": 1,
                    "report_status": "pending",
                    "notes": f"Inspection {i+1} of {no_of_inspections} - Created manually to fix missing package",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "created_by": "fix_script"
                }
                
                await db.inspections.insert_one(inspection)
                print(f"   ✅ Created inspection {inspection['id'][:8]}...")
            
            print(f"\n✅ Successfully created {no_of_inspections} inspection(s)")


async def main():
    parser = argparse.ArgumentParser(description='Fix missing inspections from second package purchases')
    parser.add_argument('--lead-mobile', required=True, help='Mobile number of the lead')
    parser.add_argument('--dry-run', action='store_true', default=True, help='Show what would be done without making changes')
    parser.add_argument('--fix', action='store_true', help='Actually create the missing inspections')
    
    args = parser.parse_args()
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    try:
        if args.fix:
            await create_missing_inspections(db, args.lead_mobile, dry_run=False)
        else:
            await find_missing_package_inspections(db, args.lead_mobile)
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())

"""
Script to diagnose and fix customer data issues where:
1. Customer exists but shows 0 packages/₹0 paid
2. Inspections exist but aren't linked to customer
3. Payment was made but inspections weren't created

Usage:
  python fix_customer_inspections.py --mobile 7411891010 --diagnose
  python fix_customer_inspections.py --mobile 7411891010 --fix

This script will:
1. Find the customer by mobile number
2. Find the lead associated with the customer
3. Find any inspections by lead_id or customer_mobile
4. Link orphaned inspections to the customer
5. Create missing inspections if payments exist but inspections don't
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


async def diagnose_customer(db, mobile: str):
    """Comprehensive diagnosis of customer data"""
    print(f"\n{'='*70}")
    print(f"DIAGNOSING CUSTOMER: {mobile}")
    print(f"{'='*70}")
    
    # 1. Find customer
    customer = await db.customers.find_one({"mobile": mobile}, {"_id": 0})
    if not customer:
        print(f"\n❌ No customer found with mobile {mobile}")
        # Try to find lead instead
        lead = await db.leads.find_one({"mobile": mobile}, {"_id": 0})
        if lead:
            print(f"\n📋 Found LEAD instead:")
            print(f"   ID: {lead.get('id')}")
            print(f"   Name: {lead.get('name')}")
            print(f"   Status: {lead.get('status')}")
            print(f"   Payment Status: {lead.get('payment_status')}")
            print(f"   Package: {lead.get('package_name')} ({lead.get('no_of_inspections', 1)} inspections)")
            print(f"   Razorpay Payment ID: {lead.get('razorpay_payment_id')}")
            return {"lead": lead, "customer": None, "inspections": [], "issues": ["NO_CUSTOMER"]}
        else:
            print(f"\n❌ No lead found either!")
            return None
    
    customer_id = customer.get("id")
    lead_id = customer.get("lead_id")
    
    print(f"\n👤 CUSTOMER FOUND:")
    print(f"   ID: {customer_id}")
    print(f"   Name: {customer.get('name')}")
    print(f"   City: {customer.get('city')}")
    print(f"   Lead ID: {lead_id}")
    print(f"   Package: {customer.get('package_name')}")
    print(f"   Payment Amount: ₹{customer.get('payment_amount', 0)}")
    print(f"   Razorpay Payment ID: {customer.get('razorpay_payment_id')}")
    print(f"   Additional Purchases: {len(customer.get('additional_purchases', []))}")
    for i, p in enumerate(customer.get('additional_purchases', [])):
        print(f"      {i+1}. {p.get('package_name')} - ₹{p.get('payment_amount')} - Payment: {p.get('razorpay_payment_id')}")
    
    # 2. Find lead
    lead = None
    if lead_id:
        lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
        if lead:
            print(f"\n📋 ASSOCIATED LEAD:")
            print(f"   ID: {lead_id}")
            print(f"   Status: {lead.get('status')}")
            print(f"   Payment Status: {lead.get('payment_status')}")
            print(f"   Package: {lead.get('package_name')} ({lead.get('no_of_inspections', 1)} inspections)")
    
    # 3. Find inspections by customer_id
    inspections_by_customer = await db.inspections.find(
        {"customer_id": customer_id},
        {"_id": 0}
    ).to_list(50)
    
    print(f"\n🔍 INSPECTIONS BY CUSTOMER_ID: {len(inspections_by_customer)}")
    for insp in inspections_by_customer:
        print(f"   - {insp.get('id')[:8]}... | {insp.get('payment_status')} | ₹{insp.get('amount_paid', 0)} paid")
    
    # 4. Find inspections by lead_id
    inspections_by_lead = []
    if lead_id:
        inspections_by_lead = await db.inspections.find(
            {"lead_id": lead_id, "customer_id": {"$ne": customer_id}},
            {"_id": 0}
        ).to_list(50)
        
        print(f"\n🔍 INSPECTIONS BY LEAD_ID (not linked to customer): {len(inspections_by_lead)}")
        for insp in inspections_by_lead:
            print(f"   - {insp.get('id')[:8]}... | customer_id: {insp.get('customer_id', 'NONE')}")
    
    # 5. Find inspections by mobile (orphaned)
    inspections_by_mobile = await db.inspections.find(
        {"customer_mobile": mobile, "customer_id": {"$nin": [customer_id, None]}},
        {"_id": 0}
    ).to_list(50)
    
    print(f"\n🔍 INSPECTIONS BY MOBILE (different customer_id): {len(inspections_by_mobile)}")
    for insp in inspections_by_mobile:
        print(f"   - {insp.get('id')[:8]}... | customer_id: {insp.get('customer_id')}")
    
    # 6. Check for payment records without inspections
    all_payment_ids = set()
    if customer.get('razorpay_payment_id'):
        all_payment_ids.add(customer.get('razorpay_payment_id'))
    for p in customer.get('additional_purchases', []):
        if p.get('razorpay_payment_id'):
            all_payment_ids.add(p.get('razorpay_payment_id'))
    
    # Find which payment IDs have inspections
    inspections_with_payments = await db.inspections.find(
        {"razorpay_payment_id": {"$in": list(all_payment_ids)}},
        {"_id": 0, "razorpay_payment_id": 1}
    ).to_list(100)
    
    payment_ids_with_inspections = set(i.get('razorpay_payment_id') for i in inspections_with_payments)
    missing_payment_ids = all_payment_ids - payment_ids_with_inspections
    
    print(f"\n💳 PAYMENT ANALYSIS:")
    print(f"   Total payment IDs: {len(all_payment_ids)}")
    print(f"   Payment IDs with inspections: {len(payment_ids_with_inspections)}")
    print(f"   Missing inspections for payments: {len(missing_payment_ids)}")
    if missing_payment_ids:
        for pid in missing_payment_ids:
            print(f"      ❌ {pid}")
    
    # Identify issues
    issues = []
    if len(inspections_by_customer) == 0:
        issues.append("NO_INSPECTIONS_LINKED")
    if len(inspections_by_lead) > 0:
        issues.append("ORPHANED_INSPECTIONS_BY_LEAD")
    if len(inspections_by_mobile) > 0:
        issues.append("ORPHANED_INSPECTIONS_BY_MOBILE")
    if missing_payment_ids:
        issues.append("MISSING_INSPECTIONS_FOR_PAYMENTS")
    
    print(f"\n⚠️  ISSUES DETECTED: {issues if issues else 'None'}")
    
    return {
        "customer": customer,
        "lead": lead,
        "inspections_linked": inspections_by_customer,
        "inspections_orphaned_lead": inspections_by_lead,
        "inspections_orphaned_mobile": inspections_by_mobile,
        "missing_payment_ids": missing_payment_ids,
        "issues": issues
    }


async def fix_customer_inspections(db, mobile: str, dry_run: bool = True):
    """Fix customer inspection linkage issues"""
    diagnosis = await diagnose_customer(db, mobile)
    if not diagnosis:
        return
    
    customer = diagnosis.get("customer")
    if not customer:
        print("\n❌ Cannot fix - no customer record exists")
        return
    
    customer_id = customer.get("id")
    lead_id = customer.get("lead_id")
    issues = diagnosis.get("issues", [])
    
    if not issues:
        print("\n✅ No issues to fix!")
        return
    
    print(f"\n{'='*70}")
    print(f"FIXING ISSUES (dry_run={dry_run})")
    print(f"{'='*70}")
    
    # Fix 1: Link orphaned inspections by lead_id
    if "ORPHANED_INSPECTIONS_BY_LEAD" in issues:
        orphaned = diagnosis.get("inspections_orphaned_lead", [])
        print(f"\n🔧 Linking {len(orphaned)} orphaned inspections (by lead_id) to customer...")
        for insp in orphaned:
            insp_id = insp.get("id")
            if dry_run:
                print(f"   [DRY RUN] Would update inspection {insp_id[:8]}... with customer_id={customer_id[:8]}...")
            else:
                await db.inspections.update_one(
                    {"id": insp_id},
                    {"$set": {
                        "customer_id": customer_id,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                print(f"   ✅ Linked inspection {insp_id[:8]}...")
    
    # Fix 2: Link orphaned inspections by mobile
    if "ORPHANED_INSPECTIONS_BY_MOBILE" in issues:
        orphaned = diagnosis.get("inspections_orphaned_mobile", [])
        print(f"\n🔧 Linking {len(orphaned)} orphaned inspections (by mobile) to customer...")
        for insp in orphaned:
            insp_id = insp.get("id")
            if dry_run:
                print(f"   [DRY RUN] Would update inspection {insp_id[:8]}... with customer_id={customer_id[:8]}...")
            else:
                await db.inspections.update_one(
                    {"id": insp_id},
                    {"$set": {
                        "customer_id": customer_id,
                        "lead_id": lead_id,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                print(f"   ✅ Linked inspection {insp_id[:8]}...")
    
    # Fix 3: Create missing inspections for payments
    if "MISSING_INSPECTIONS_FOR_PAYMENTS" in issues:
        missing_payment_ids = diagnosis.get("missing_payment_ids", set())
        print(f"\n🔧 Creating inspections for {len(missing_payment_ids)} missing payment(s)...")
        
        # Build a map of payment_id to package info
        payment_info = {}
        if customer.get('razorpay_payment_id'):
            payment_info[customer['razorpay_payment_id']] = {
                'package_name': customer.get('package_name', 'Standard Inspection'),
                'no_of_inspections': customer.get('no_of_inspections', 1),
                'amount': customer.get('payment_amount', 0)
            }
        for p in customer.get('additional_purchases', []):
            if p.get('razorpay_payment_id'):
                payment_info[p['razorpay_payment_id']] = {
                    'package_name': p.get('package_name', 'Standard Inspection'),
                    'no_of_inspections': p.get('no_of_inspections', 1),
                    'amount': p.get('payment_amount', 0)
                }
        
        for payment_id in missing_payment_ids:
            pkg = payment_info.get(payment_id, {})
            no_of_inspections = pkg.get('no_of_inspections', 1)
            package_name = pkg.get('package_name', 'Standard Inspection')
            amount = pkg.get('amount', 0)
            
            print(f"\n   Payment {payment_id}:")
            print(f"      Package: {package_name}")
            print(f"      Inspections needed: {no_of_inspections}")
            print(f"      Amount: ₹{amount}")
            
            for i in range(no_of_inspections):
                inspection_id = str(uuid.uuid4())
                inspection = {
                    "id": inspection_id,
                    "customer_id": customer_id,
                    "lead_id": lead_id,
                    "order_id": f"ORD-{payment_id[-8:].upper()}",
                    "customer_name": customer.get("name"),
                    "customer_mobile": customer.get("mobile"),
                    "customer_email": customer.get("email"),
                    "city": customer.get("city"),
                    "city_id": customer.get("city_id"),
                    "car_number": "",
                    "package_id": customer.get("package_id"),
                    "package_type": package_name,
                    "total_amount": amount / no_of_inspections if no_of_inspections > 0 else amount,
                    "amount_paid": amount / no_of_inspections if no_of_inspections > 0 else amount,
                    "balance_due": 0,
                    "payment_status": "FULLY_PAID",
                    "payment_date": datetime.now(timezone.utc).isoformat(),
                    "razorpay_payment_id": payment_id,
                    "inspection_status": "NEW_INSPECTION",
                    "scheduled_date": None,
                    "scheduled_time": None,
                    "slot_number": i + 1,
                    "inspections_available": 1,
                    "report_status": "pending",
                    "notes": f"Inspection {i+1}/{no_of_inspections} - Created by fix script",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "created_by": "fix_script"
                }
                
                if dry_run:
                    print(f"      [DRY RUN] Would create inspection {inspection_id[:8]}...")
                else:
                    await db.inspections.insert_one(inspection)
                    print(f"      ✅ Created inspection {inspection_id[:8]}...")
    
    if dry_run:
        print(f"\n📝 This was a DRY RUN. Run with --fix to apply changes.")
    else:
        print(f"\n✅ All fixes applied successfully!")
        # Re-run diagnosis to confirm
        print("\n" + "="*70)
        print("VERIFICATION - Running diagnosis again...")
        await diagnose_customer(db, mobile)


async def main():
    parser = argparse.ArgumentParser(description='Fix customer inspection linkage issues')
    parser.add_argument('--mobile', required=True, help='Customer mobile number')
    parser.add_argument('--diagnose', action='store_true', help='Only diagnose, do not fix')
    parser.add_argument('--fix', action='store_true', help='Apply fixes (default is dry run)')
    
    args = parser.parse_args()
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    try:
        if args.diagnose:
            await diagnose_customer(db, args.mobile)
        elif args.fix:
            await fix_customer_inspections(db, args.mobile, dry_run=False)
        else:
            # Default: diagnose + dry run fix
            await fix_customer_inspections(db, args.mobile, dry_run=True)
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())

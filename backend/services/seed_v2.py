"""Database seeding for WiseDrive CRM V2"""
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone
import bcrypt
import uuid
import random


def hash_password(password: str) -> str:
    """Hash password using bcrypt directly"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


async def seed_v2_data(db: AsyncIOMotorDatabase):
    """Seed the database with initial data for V2 multi-country CRM"""
    
    # ==================== COUNTRIES ====================
    countries_data = [
        {"name": "India", "code": "IN", "currency": "INR", "currency_symbol": "₹", "phone_code": "+91", "timezone": "Asia/Kolkata"},
        {"name": "Malaysia", "code": "MY", "currency": "MYR", "currency_symbol": "RM", "phone_code": "+60", "timezone": "Asia/Kuala_Lumpur"},
        {"name": "Thailand", "code": "TH", "currency": "THB", "currency_symbol": "฿", "phone_code": "+66", "timezone": "Asia/Bangkok"},
        {"name": "Philippines", "code": "PH", "currency": "PHP", "currency_symbol": "₱", "phone_code": "+63", "timezone": "Asia/Manila"},
    ]
    
    countries = {}
    for c in countries_data:
        existing = await db.countries.find_one({"code": c["code"]})
        if not existing:
            country_id = str(uuid.uuid4())
            await db.countries.insert_one({
                "id": country_id,
                **c,
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            countries[c["code"]] = country_id
        else:
            # Update existing with new fields
            await db.countries.update_one(
                {"code": c["code"]},
                {"$set": {
                    "currency_symbol": c.get("currency_symbol", ""),
                    "phone_code": c.get("phone_code", "")
                }}
            )
            countries[c["code"]] = existing["id"]
    
    print(f"Countries seeded: {list(countries.keys())}")
    
    # ==================== DEPARTMENTS ====================
    departments_data = [
        {"name": "Executive", "code": "EXEC", "description": "Executive Leadership"},
        {"name": "Sales", "code": "SALES", "description": "Sales Department"},
        {"name": "Inspection", "code": "INSPECTION", "description": "Inspection Department"},
        {"name": "Human Resources", "code": "HR", "description": "HR Department"},
        {"name": "Finance", "code": "FINANCE", "description": "Finance Department"},
    ]
    
    departments = {}
    for d in departments_data:
        existing = await db.departments.find_one({"code": d["code"]})
        if not existing:
            dept_id = str(uuid.uuid4())
            await db.departments.insert_one({
                "id": dept_id,
                **d,
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            departments[d["code"]] = dept_id
        else:
            departments[d["code"]] = existing["id"]
    
    print(f"Departments seeded: {list(departments.keys())}")
    
    # ==================== ROLES ====================
    roles_data = [
        {"name": "CEO", "code": "CEO", "level": 1, "department_code": "EXEC", "description": "Chief Executive Officer - Global Super Admin"},
        {"name": "HR Manager", "code": "HR_MANAGER", "level": 2, "department_code": "HR", "description": "Human Resources Manager"},
        {"name": "Country Head", "code": "COUNTRY_HEAD", "level": 2, "department_code": "EXEC", "description": "Country Head - Full country access"},
        {"name": "Finance Manager", "code": "FINANCE_MANAGER", "level": 3, "department_code": "FINANCE", "description": "Finance Manager - Country-level finance access"},
        {"name": "Sales Head", "code": "SALES_HEAD", "level": 3, "department_code": "SALES", "description": "Head of Sales Department"},
        {"name": "Inspection Head", "code": "INSPECTION_HEAD", "level": 3, "department_code": "INSPECTION", "description": "Head of Inspection Department"},
        {"name": "Sales Lead", "code": "SALES_LEAD", "level": 4, "department_code": "SALES", "description": "Sales Team Leader"},
        {"name": "Inspection Lead", "code": "INSPECTION_LEAD", "level": 4, "department_code": "INSPECTION", "description": "Inspection Team Leader"},
        {"name": "Sales Executive", "code": "SALES_EXEC", "level": 5, "department_code": "SALES", "description": "Sales Executive"},
        {"name": "Inspection Coordinator", "code": "INSPECTION_COORD", "level": 5, "department_code": "INSPECTION", "description": "Inspection Coordinator"},
        {"name": "Report Reviewer", "code": "REPORT_REVIEWER", "level": 5, "department_code": "INSPECTION", "description": "Inspection Report Reviewer"},
        {"name": "Mechanic", "code": "MECHANIC", "level": 6, "department_code": "INSPECTION", "description": "Field Mechanic / Inspector"},
    ]
    
    roles = {}
    for r in roles_data:
        existing = await db.roles.find_one({"code": r["code"]})
        if not existing:
            role_id = str(uuid.uuid4())
            await db.roles.insert_one({
                "id": role_id,
                "name": r["name"],
                "code": r["code"],
                "level": r["level"],
                "department_id": departments.get(r["department_code"]),
                "is_system": True,
                "description": r["description"],
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            roles[r["code"]] = role_id
        else:
            roles[r["code"]] = existing["id"]
    
    print(f"Roles seeded: {list(roles.keys())}")
    
    # ==================== PERMISSIONS ====================
    resources = ["leads", "customers", "inspections", "reports", "users", "salary", "dashboard", "settings", "finance"]
    actions = ["view", "create", "edit", "delete", "reassign", "export", "approve"]
    
    permissions = {}
    for resource in resources:
        for action in actions:
            perm_name = f"{resource}.{action}"
            existing = await db.permissions.find_one({"name": perm_name})
            if not existing:
                perm_id = str(uuid.uuid4())
                await db.permissions.insert_one({
                    "id": perm_id,
                    "name": perm_name,
                    "resource": resource,
                    "action": action,
                    "description": f"{action.capitalize()} {resource}"
                })
                permissions[perm_name] = perm_id
            else:
                permissions[perm_name] = existing["id"]
    
    print(f"Permissions seeded: {len(permissions)} permissions")
    
    # ==================== ROLE PERMISSIONS ====================
    # Define permissions for each role with scope
    role_permission_map = {
        "CEO": {
            "leads.view": "all", "leads.create": "all", "leads.edit": "all", "leads.delete": "all", "leads.reassign": "all", "leads.export": "all",
            "customers.view": "all", "customers.create": "all", "customers.edit": "all", "customers.delete": "all",
            "inspections.view": "all", "inspections.create": "all", "inspections.edit": "all",
            "reports.view": "all", "reports.edit": "all",
            "users.view": "all", "users.create": "all", "users.edit": "all", "users.delete": "all",
            "salary.view": "all", "salary.edit": "all",
            "dashboard.view": "all",
            "settings.view": "all", "settings.edit": "all",
            "finance.view": "all", "finance.create": "all", "finance.edit": "all", "finance.approve": "all", "finance.export": "all",
        },
        "HR_MANAGER": {
            "users.view": "all", "users.create": "all", "users.edit": "all", "users.delete": "all",
            "salary.view": "all", "salary.edit": "all",
            "dashboard.view": "all",
        },
        "FINANCE_MANAGER": {
            "finance.view": "country", "finance.create": "country", "finance.edit": "country", "finance.export": "country",
            "users.view": "country",  # Can view employees to create payments
            "salary.view": "country",  # Can view salary structures
            "dashboard.view": "country",
        },
        "COUNTRY_HEAD": {
            "leads.view": "country", "leads.create": "country", "leads.edit": "country", "leads.export": "country",
            "customers.view": "country", "customers.create": "country", "customers.edit": "country",
            "inspections.view": "country", "inspections.create": "country", "inspections.edit": "country",
            "reports.view": "country",
            "users.view": "country",
            "salary.view": "country",
            "dashboard.view": "country",
            "settings.view": "country",
            "finance.view": "country", "finance.edit": "country", "finance.approve": "country", "finance.export": "country",
        },
        "SALES_HEAD": {
            "leads.view": "country", "leads.create": "country", "leads.edit": "country", "leads.reassign": "country", "leads.export": "country",
            "customers.view": "country", "customers.create": "country", "customers.edit": "country",
            "users.view": "team",
            "salary.view": "team",
            "dashboard.view": "country",
        },
        "SALES_LEAD": {
            "leads.view": "team", "leads.create": "team", "leads.edit": "team", "leads.reassign": "team",
            "customers.view": "team", "customers.create": "team", "customers.edit": "team",
            "dashboard.view": "team",
        },
        "SALES_EXEC": {
            "leads.view": "own", "leads.create": "own", "leads.edit": "own",
            "customers.view": "own", "customers.create": "own",
            "dashboard.view": "own",
        },
        "INSPECTION_HEAD": {
            "inspections.view": "country", "inspections.create": "country", "inspections.edit": "country",
            "reports.view": "country", "reports.edit": "country",
            "customers.view": "country",
            "users.view": "team",
            "salary.view": "team",
            "dashboard.view": "country",
        },
        "INSPECTION_LEAD": {
            "inspections.view": "country", "inspections.create": "country", "inspections.edit": "country",
            "reports.view": "country",
            "customers.view": "country",
            "dashboard.view": "team",
        },
        "INSPECTION_COORD": {
            "inspections.view": "own", "inspections.edit": "own",
            "customers.view": "own",
            "dashboard.view": "own",
        },
        "REPORT_REVIEWER": {
            "inspections.view": "own",
            "reports.view": "own", "reports.edit": "own",
            "dashboard.view": "own",
        },
        "MECHANIC": {
            "inspections.view": "own",
            "reports.view": "own",
            "dashboard.view": "own",
        },
    }
    
    # Clear existing role permissions and recreate
    await db.role_permissions.delete_many({})
    
    for role_code, perms in role_permission_map.items():
        role_id = roles.get(role_code)
        if not role_id:
            continue
        
        for perm_name, scope in perms.items():
            perm_id = permissions.get(perm_name)
            if not perm_id:
                continue
            
            await db.role_permissions.insert_one({
                "id": str(uuid.uuid4()),
                "role_id": role_id,
                "permission_id": perm_id,
                "scope": scope,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
    
    print("Role permissions seeded")
    
    # ==================== TEAMS ====================
    teams_data = [
        {"name": "Sales Team Alpha", "country_code": "IN", "department_code": "SALES"},
        {"name": "Sales Team Beta", "country_code": "IN", "department_code": "SALES"},
        {"name": "Inspection Team Alpha", "country_code": "IN", "department_code": "INSPECTION"},
        {"name": "Sales Team MY", "country_code": "MY", "department_code": "SALES"},
        {"name": "Inspection Team MY", "country_code": "MY", "department_code": "INSPECTION"},
    ]
    
    teams = {}
    for t in teams_data:
        existing = await db.teams.find_one({"name": t["name"]})
        if not existing:
            team_id = str(uuid.uuid4())
            await db.teams.insert_one({
                "id": team_id,
                "name": t["name"],
                "country_id": countries.get(t["country_code"]),
                "department_id": departments.get(t["department_code"]),
                "team_lead_id": None,
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            teams[t["name"]] = team_id
        else:
            teams[t["name"]] = existing["id"]
    
    print(f"Teams seeded: {list(teams.keys())}")
    
    # ==================== USERS ====================
    # Clear existing users and create fresh
    await db.users.delete_many({})
    
    users_data = [
        # CEO
        {"email": "ceo@wisedrive.com", "name": "Rajesh Kumar", "role_code": "CEO", "country_code": "IN", "team_name": None},
        # HR
        {"email": "hr@wisedrive.com", "name": "Priya Sharma", "role_code": "HR_MANAGER", "country_code": "IN", "team_name": None},
        # India - Country Head
        {"email": "countryhead.in@wisedrive.com", "name": "Vikram Singh", "role_code": "COUNTRY_HEAD", "country_code": "IN", "team_name": None},
        # India - Finance Manager
        {"email": "finance.in@wisedrive.com", "name": "Anita Desai", "role_code": "FINANCE_MANAGER", "country_code": "IN", "team_name": None},
        # India - Sales
        {"email": "saleshead.in@wisedrive.com", "name": "Arun Kumar", "role_code": "SALES_HEAD", "country_code": "IN", "team_name": None},
        {"email": "saleslead1.in@wisedrive.com", "name": "Rahul Verma", "role_code": "SALES_LEAD", "country_code": "IN", "team_name": "Sales Team Alpha"},
        {"email": "salesexec1.in@wisedrive.com", "name": "Sneha Reddy", "role_code": "SALES_EXEC", "country_code": "IN", "team_name": "Sales Team Alpha"},
        {"email": "salesexec2.in@wisedrive.com", "name": "Amit Patel", "role_code": "SALES_EXEC", "country_code": "IN", "team_name": "Sales Team Alpha"},
        {"email": "salesexec3.in@wisedrive.com", "name": "Divya Krishnan", "role_code": "SALES_EXEC", "country_code": "IN", "team_name": "Sales Team Beta"},
        # India - Inspection
        {"email": "insphead.in@wisedrive.com", "name": "Suresh Babu", "role_code": "INSPECTION_HEAD", "country_code": "IN", "team_name": None},
        {"email": "insplead.in@wisedrive.com", "name": "Karthik M", "role_code": "INSPECTION_LEAD", "country_code": "IN", "team_name": "Inspection Team Alpha"},
        {"email": "inspcoord1.in@wisedrive.com", "name": "Meera Nair", "role_code": "INSPECTION_COORD", "country_code": "IN", "team_name": "Inspection Team Alpha"},
        {"email": "reviewer1.in@wisedrive.com", "name": "Ajay Kumar", "role_code": "REPORT_REVIEWER", "country_code": "IN", "team_name": "Inspection Team Alpha"},
        {"email": "mechanic1.in@wisedrive.com", "name": "Raju Mechanic", "role_code": "MECHANIC", "country_code": "IN", "team_name": "Inspection Team Alpha"},
        {"email": "mechanic2.in@wisedrive.com", "name": "Venkat Inspector", "role_code": "MECHANIC", "country_code": "IN", "team_name": "Inspection Team Alpha"},
        # Malaysia
        {"email": "countryhead.my@wisedrive.com", "name": "Ahmad Tan", "role_code": "COUNTRY_HEAD", "country_code": "MY", "team_name": None},
        {"email": "finance.my@wisedrive.com", "name": "Lim Wei Chen", "role_code": "FINANCE_MANAGER", "country_code": "MY", "team_name": None},
        {"email": "saleshead.my@wisedrive.com", "name": "Lee Wei", "role_code": "SALES_HEAD", "country_code": "MY", "team_name": None},
        {"email": "salesexec1.my@wisedrive.com", "name": "Siti Aminah", "role_code": "SALES_EXEC", "country_code": "MY", "team_name": "Sales Team MY"},
    ]
    
    users = {}
    for u in users_data:
        user_id = str(uuid.uuid4())
        team_id = teams.get(u["team_name"]) if u["team_name"] else None
        
        await db.users.insert_one({
            "id": user_id,
            "email": u["email"],
            "name": u["name"],
            "phone": f"+91{random.randint(9000000000, 9999999999)}",
            "hashed_password": pwd_context.hash("password123"),
            "country_id": countries.get(u["country_code"]),
            "department_id": departments.get(
                "EXEC" if u["role_code"] in ["CEO", "COUNTRY_HEAD"] else 
                "HR" if u["role_code"] == "HR_MANAGER" else
                "FINANCE" if u["role_code"] == "FINANCE_MANAGER" else
                "SALES" if "SALES" in u["role_code"] else "INSPECTION"
            ),
            "role_id": roles.get(u["role_code"]),
            "team_id": team_id,
            "reports_to": None,
            "employment_type": "fulltime",
            "is_active": True,
            "is_available_for_assignment": u["role_code"] == "SALES_EXEC",
            "has_crm_access": u["role_code"] != "MECHANIC",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        })
        users[u["email"]] = user_id
    
    print(f"Users seeded: {len(users)} users")
    
    # ==================== SAMPLE LEADS (India) ====================
    await db.leads.delete_many({})
    
    cities = ["Bangalore", "Hyderabad", "Chennai", "Mumbai", "Delhi", "Pune"]
    sources = ["WEBSITE", "FACEBOOK", "INSTAGRAM", "REFERRAL", "GOOGLE"]
    statuses = ["NEW", "CONTACTED", "INTERESTED", "RNR", "CONVERTED", "LOST"]
    
    india_sales_execs = [
        users.get("salesexec1.in@wisedrive.com"),
        users.get("salesexec2.in@wisedrive.com"),
        users.get("salesexec3.in@wisedrive.com")
    ]
    
    for i in range(30):
        source = random.choice(sources)
        has_reminder = random.random() > 0.5
        has_payment = random.random() > 0.7
        
        await db.leads.insert_one({
            "id": str(uuid.uuid4()),
            "country_id": countries["IN"],
            "name": f"Lead Customer {i+1}",
            "mobile": f"91{random.randint(7000000000, 9999999999)}",
            "email": f"lead{i+1}@example.com",
            "city": random.choice(cities),
            "source": source,
            "ad_id": f"1202169{random.randint(10000000, 99999999)}" if source in ["FACEBOOK", "INSTAGRAM"] else None,
            "status": random.choice(statuses),
            "assigned_to": random.choice(india_sales_execs),
            "team_id": teams.get("Sales Team Alpha"),
            "is_locked": False,
            "service_type": random.choice(["INSPECTION", "WARRANTY", "SERVICE"]),
            "reminder_date": "2026-02-15" if has_reminder else None,
            "reminder_time": random.choice(["09:00", "11:00", "14:00", "16:00"]) if has_reminder else None,
            "reminder_reason": random.choice(["FOLLOW_UP", "CALL_BACK", "RNR"]) if has_reminder else None,
            "notes": "Interested in inspection" if has_reminder else None,
            "payment_link": f"https://rzp.io/l/WD{random.randint(100000, 999999)}" if has_payment else None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "created_by": random.choice(india_sales_execs)
        })
    
    # Malaysia leads
    my_exec = users.get("salesexec1.my@wisedrive.com")
    for i in range(10):
        await db.leads.insert_one({
            "id": str(uuid.uuid4()),
            "country_id": countries["MY"],
            "name": f"MY Lead {i+1}",
            "mobile": f"60{random.randint(100000000, 199999999)}",
            "city": random.choice(["Kuala Lumpur", "Penang", "Johor Bahru"]),
            "source": random.choice(sources),
            "status": random.choice(statuses),
            "assigned_to": my_exec,
            "team_id": teams.get("Sales Team MY"),
            "is_locked": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    print("Leads seeded: 40 leads (30 IN, 10 MY)")
    
    # ==================== SAMPLE CUSTOMERS ====================
    await db.customers.delete_many({})
    
    for i in range(15):
        await db.customers.insert_one({
            "id": str(uuid.uuid4()),
            "country_id": countries["IN"],
            "name": f"Customer {i+1}",
            "mobile": f"91{random.randint(7000000000, 9999999999)}",
            "city": random.choice(cities),
            "payment_status": random.choice(["Completed", "PENDING"]),
            "total_amount_paid": random.choice([999, 1499, 2499, 2999]),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    print("Customers seeded: 15 customers")
    
    # ==================== SAMPLE INSPECTIONS ====================
    await db.inspections.delete_many({})
    
    mechanics = [users.get("mechanic1.in@wisedrive.com"), users.get("mechanic2.in@wisedrive.com")]
    coordinators = [users.get("inspcoord1.in@wisedrive.com")]
    reviewers = [users.get("reviewer1.in@wisedrive.com")]
    package_types = ["Basic", "Silver", "Gold", "Platinum", "Comprehensive"]
    customer_names = ["Amaran", "Priya", "Rahul", "Sneha", "Vikram", "Anjali", "Karthik", "Divya"]
    
    for i in range(20):
        is_scheduled = random.random() > 0.4
        total = random.choice([999, 1299, 1499, 1999, 2499])
        paid = total if random.random() > 0.3 else random.randint(0, total)
        
        await db.inspections.insert_one({
            "id": str(uuid.uuid4()),
            "country_id": countries["IN"],
            "order_id": f"ORD{random.randint(1000000, 9999999)}",
            "customer_name": random.choice(customer_names),
            "customer_mobile": f"91{random.randint(7000000000, 9999999999)}",
            "car_number": f"KA0{random.randint(1, 5)}NC{random.randint(1000, 9999)}",
            "car_make": random.choice(["Maruti", "Honda", "Hyundai", "Toyota"]),
            "car_model": random.choice(["Swift", "City", "Creta", "Innova"]),
            "car_year": str(random.randint(2018, 2024)),
            "city": random.choice(cities),
            "package_type": random.choice(package_types),
            "total_amount": total,
            "amount_paid": paid,
            "pending_amount": total - paid,
            "payment_status": "Completed" if paid == total else "PENDING",
            "payment_type": "Full" if paid == total else "Partial",
            "payment_date": f"2026-02-{random.randint(1, 13)}",
            "inspection_status": random.choice(["SCHEDULED", "COMPLETED", "IN_PROGRESS"]) if is_scheduled else None,
            "scheduled_date": "2026-02-15" if is_scheduled else None,
            "scheduled_time": f"{random.randint(9, 17)}:00" if is_scheduled else None,
            "mechanic_id": random.choice(mechanics) if is_scheduled else None,
            "coordinator_id": random.choice(coordinators) if is_scheduled else None,
            "inspections_available": random.randint(1, 3),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    print("Inspections seeded: 20 inspections")
    
    # ==================== ROUND ROBIN STATE ====================
    await db.round_robin_state.delete_many({})
    
    # Initialize round robin for India Sales Team Alpha
    await db.round_robin_state.insert_one({
        "id": str(uuid.uuid4()),
        "country_id": countries["IN"],
        "team_id": teams.get("Sales Team Alpha"),
        "last_assigned_user_id": india_sales_execs[0],
        "updated_at": datetime.now(timezone.utc).isoformat()
    })
    
    print("Round robin state initialized")
    
    return {
        "countries": len(countries),
        "departments": len(departments),
        "roles": len(roles),
        "permissions": len(permissions),
        "teams": len(teams),
        "users": len(users),
        "leads": 40,
        "customers": 15,
        "inspections": 20
    }

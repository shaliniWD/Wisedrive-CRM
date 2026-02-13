# WiseDrive CRM V2 - Database Schema

## MongoDB Collections

### 1. countries
```json
{
  "_id": ObjectId,
  "id": "uuid",
  "name": "India",
  "code": "IN",
  "currency": "INR",
  "timezone": "Asia/Kolkata",
  "is_active": true,
  "created_at": ISODate,
  "updated_at": ISODate
}
```

### 2. departments
```json
{
  "_id": ObjectId,
  "id": "uuid",
  "name": "Sales",
  "code": "SALES",
  "description": "Sales Department",
  "is_active": true,
  "created_at": ISODate
}
```

### 3. roles
```json
{
  "_id": ObjectId,
  "id": "uuid",
  "name": "Sales Executive",
  "code": "SALES_EXEC",
  "level": 5,
  "department_id": "uuid",
  "is_system": true,
  "description": "Front-line sales agent",
  "created_at": ISODate
}
```

### 4. permissions
```json
{
  "_id": ObjectId,
  "id": "uuid",
  "name": "leads.view",
  "resource": "leads",
  "action": "view",
  "description": "View leads"
}
```

### 5. role_permissions
```json
{
  "_id": ObjectId,
  "id": "uuid",
  "role_id": "uuid",
  "permission_id": "uuid",
  "scope": "country",  // all, country, team, own
  "created_at": ISODate
}
```

### 6. teams
```json
{
  "_id": ObjectId,
  "id": "uuid",
  "name": "Sales Team Alpha",
  "country_id": "uuid",
  "department_id": "uuid",
  "team_lead_id": "uuid",
  "is_active": true,
  "created_at": ISODate
}
```

### 7. users
```json
{
  "_id": ObjectId,
  "id": "uuid",
  "email": "user@wisedrive.com",
  "hashed_password": "...",
  "name": "John Doe",
  "phone": "+919876543210",
  "country_id": "uuid",
  "department_id": "uuid",
  "role_id": "uuid",
  "team_id": "uuid|null",
  "reports_to": "uuid|null",
  "employment_type": "fulltime",  // fulltime, freelancer, contract
  "is_active": true,
  "is_available_for_assignment": true,
  "profile_image": "url|null",
  "created_at": ISODate,
  "updated_at": ISODate,
  "created_by": "uuid",
  "last_login": ISODate
}
```

### 8. salary_structures
```json
{
  "_id": ObjectId,
  "id": "uuid",
  "user_id": "uuid",
  "ctc": 600000,
  "fixed_pay": 40000,
  "variable_pay": 10000,
  "commission_percentage": 2.5,
  "per_inspection_payout": 500,
  "incentive_structure": {
    "target_leads": 100,
    "bonus_per_conversion": 200
  },
  "currency": "INR",
  "effective_from": ISODate,
  "effective_to": ISODate|null,
  "created_by": "uuid",
  "created_at": ISODate
}
```

### 9. leads
```json
{
  "_id": ObjectId,
  "id": "uuid",
  "country_id": "uuid",
  "name": "Customer Name",
  "mobile": "+919876543210",
  "email": "customer@email.com",
  "city": "Bangalore",
  "source": "FACEBOOK",
  "ad_id": "120216912345678",
  "status": "NEW",
  "assigned_to": "uuid|null",
  "team_id": "uuid|null",
  "is_locked": false,
  "service_type": "INSPECTION",
  "reminder_date": "2026-02-14",
  "reminder_time": "10:00",
  "reminder_reason": "FOLLOW_UP",
  "notes": "Customer interested",
  "payment_link": "https://rzp.io/l/...",
  "payment_link_sent_at": ISODate|null,
  "converted_at": ISODate|null,
  "customer_id": "uuid|null",
  "created_at": ISODate,
  "updated_at": ISODate,
  "created_by": "uuid",
  "updated_by": "uuid"
}
```

### 10. lead_reassignment_logs
```json
{
  "_id": ObjectId,
  "id": "uuid",
  "lead_id": "uuid",
  "old_agent_id": "uuid|null",
  "new_agent_id": "uuid",
  "reassigned_by": "uuid",
  "reason": "Agent on leave",
  "reassignment_type": "manual",  // manual, round_robin, system
  "timestamp": ISODate
}
```

### 11. customers
```json
{
  "_id": ObjectId,
  "id": "uuid",
  "country_id": "uuid",
  "lead_id": "uuid|null",
  "name": "Customer Name",
  "mobile": "+919876543210",
  "email": "customer@email.com",
  "city": "Bangalore",
  "address": "Full address",
  "payment_status": "Completed",
  "total_amount_paid": 2999,
  "notes": "VIP customer",
  "created_at": ISODate,
  "updated_at": ISODate,
  "created_by": "uuid",
  "updated_by": "uuid"
}
```

### 12. inspections
```json
{
  "_id": ObjectId,
  "id": "uuid",
  "country_id": "uuid",
  "customer_id": "uuid",
  "order_id": "ORD1234567",
  "customer_name": "Customer Name",
  "customer_mobile": "+919876543210",
  "car_number": "KA01AB1234",
  "car_make": "Maruti Suzuki",
  "car_model": "Swift VXI",
  "car_year": "2021",
  "car_color": "White",
  "fuel_type": "Petrol",
  "city": "Bangalore",
  "address": "123, Main Street",
  "location_lat": 12.9716,
  "location_lng": 77.5946,
  "package_type": "Gold",
  "total_amount": 1499,
  "amount_paid": 1499,
  "pending_amount": 0,
  "payment_status": "Completed",
  "payment_type": "Full",
  "payment_date": ISODate,
  "inspection_status": "SCHEDULED",
  "scheduled_date": "2026-02-14",
  "scheduled_time": "10:00",
  "mechanic_id": "uuid|null",
  "coordinator_id": "uuid|null",
  "report_reviewer_id": "uuid|null",
  "inspections_available": 1,
  "report_status": "pending",
  "report_url": "url|null",
  "notes": "Ground floor parking",
  "created_at": ISODate,
  "updated_at": ISODate,
  "created_by": "uuid",
  "updated_by": "uuid"
}
```

### 13. transactions
```json
{
  "_id": ObjectId,
  "id": "uuid",
  "country_id": "uuid",
  "customer_id": "uuid",
  "inspection_id": "uuid|null",
  "order_id": "ORD1234567",
  "transaction_type": "Gold",
  "amount": 1499,
  "payment_method": "Razorpay",
  "payment_status": "Completed",
  "payment_date": ISODate,
  "razorpay_payment_id": "pay_xxx",
  "razorpay_order_id": "order_xxx",
  "car_number": "KA01AB1234",
  "car_make": "Maruti",
  "car_model": "Swift",
  "car_year": "2021",
  "created_at": ISODate
}
```

### 14. audit_logs
```json
{
  "_id": ObjectId,
  "id": "uuid",
  "entity_type": "lead",
  "entity_id": "uuid",
  "action": "update",
  "old_values": { "status": "NEW" },
  "new_values": { "status": "CONTACTED" },
  "user_id": "uuid",
  "user_name": "John Doe",
  "user_role": "Sales Executive",
  "ip_address": "192.168.1.1",
  "user_agent": "Mozilla/5.0...",
  "timestamp": ISODate
}
```

### 15. round_robin_state
```json
{
  "_id": ObjectId,
  "id": "uuid",
  "country_id": "uuid",
  "team_id": "uuid|null",
  "last_assigned_user_id": "uuid",
  "updated_at": ISODate
}
```

### 16. digital_ads
```json
{
  "_id": ObjectId,
  "id": "uuid",
  "country_id": "uuid",
  "ad_id": "120216912345678",
  "ad_name": "Campaign Q1 2026",
  "city": "Bangalore",
  "language": "English",
  "campaign_type": "Lead Generation",
  "source": "Facebook",
  "ad_amount": 5000,
  "is_active": true,
  "created_at": ISODate
}
```

### 17. garage_employees
```json
{
  "_id": ObjectId,
  "id": "uuid",
  "country_id": "uuid",
  "owner_name": "Garage Owner",
  "employee_name": "Mechanic Name",
  "garage_name": "Quick Service Center",
  "city": "Bangalore",
  "preferred_language": "Kannada",
  "phone": "+919876543210",
  "is_active": true,
  "created_at": ISODate
}
```

## Indexes

### Essential Indexes
```javascript
// users
db.users.createIndex({ "email": 1 }, { unique: true })
db.users.createIndex({ "country_id": 1, "department_id": 1 })
db.users.createIndex({ "role_id": 1 })
db.users.createIndex({ "team_id": 1 })

// leads
db.leads.createIndex({ "country_id": 1, "assigned_to": 1 })
db.leads.createIndex({ "country_id": 1, "status": 1 })
db.leads.createIndex({ "country_id": 1, "created_at": -1 })
db.leads.createIndex({ "mobile": 1 })

// customers
db.customers.createIndex({ "country_id": 1 })
db.customers.createIndex({ "mobile": 1 })

// inspections
db.inspections.createIndex({ "country_id": 1, "scheduled_date": 1 })
db.inspections.createIndex({ "country_id": 1, "mechanic_id": 1 })
db.inspections.createIndex({ "country_id": 1, "inspection_status": 1 })

// audit_logs
db.audit_logs.createIndex({ "entity_type": 1, "entity_id": 1 })
db.audit_logs.createIndex({ "user_id": 1, "timestamp": -1 })

// role_permissions
db.role_permissions.createIndex({ "role_id": 1 })
```

## Default Data

### Countries
- India (IN) - Default
- Malaysia (MY)
- Thailand (TH)
- Philippines (PH)

### Departments
- Executive
- Sales
- Inspection
- HR

### Roles (with hierarchy level)
1. CEO (level: 1)
2. HR Manager (level: 2)
3. Country Head (level: 2)
4. Sales Head (level: 3)
5. Inspection Head (level: 3)
6. Sales Lead (level: 4)
7. Inspection Lead (level: 4)
8. Sales Executive (level: 5)
9. Inspection Coordinator (level: 5)
10. Report Reviewer (level: 5)
11. Mechanic (level: 6)

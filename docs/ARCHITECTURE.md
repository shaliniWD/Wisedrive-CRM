# WiseDrive CRM V2 - Architecture Document

## 1. ER DIAGRAM (Entity Relationship)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              ORGANIZATIONAL STRUCTURE                            │
└─────────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│  COUNTRIES   │       │ DEPARTMENTS  │       │    ROLES     │
├──────────────┤       ├──────────────┤       ├──────────────┤
│ id (PK)      │       │ id (PK)      │       │ id (PK)      │
│ name         │       │ name         │       │ name         │
│ code (IN,MY) │       │ description  │       │ level        │
│ currency     │       │ is_active    │       │ department_id│
│ timezone     │       └──────────────┘       │ is_system    │
│ is_active    │                              │ description  │
└──────────────┘                              └──────────────┘
       │                                             │
       │                                             │
       ▼                                             ▼
┌──────────────────────────────────────────────────────────────┐
│                         PERMISSIONS                           │
├──────────────────────────────────────────────────────────────┤
│ id (PK)                                                       │
│ name (e.g., "leads.view", "leads.edit", "leads.reassign")    │
│ resource (leads, customers, inspections, reports, etc.)       │
│ action (view, create, edit, delete, reassign, export)        │
│ description                                                   │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                     ROLE_PERMISSIONS                          │
├──────────────────────────────────────────────────────────────┤
│ id (PK)                                                       │
│ role_id (FK → roles)                                         │
│ permission_id (FK → permissions)                             │
│ scope (all, country, team, own)                              │
└──────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                                 USER MANAGEMENT                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                          USERS                                │
├──────────────────────────────────────────────────────────────┤
│ id (PK)                                                       │
│ email (unique)                                                │
│ hashed_password                                               │
│ name                                                          │
│ phone                                                         │
│ country_id (FK → countries)                                  │
│ department_id (FK → departments)                             │
│ role_id (FK → roles)                                         │
│ team_id (FK → teams, nullable)                               │
│ reports_to (FK → users, nullable)                            │
│ employment_type (fulltime, freelancer, contract)             │
│ is_active                                                     │
│ is_available_for_assignment (for round robin)                │
│ created_at                                                    │
│ updated_at                                                    │
│ created_by (FK → users)                                      │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                          TEAMS                                │
├──────────────────────────────────────────────────────────────┤
│ id (PK)                                                       │
│ name                                                          │
│ country_id (FK → countries)                                  │
│ department_id (FK → departments)                             │
│ team_lead_id (FK → users)                                    │
│ is_active                                                     │
│ created_at                                                    │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                      SALARY_STRUCTURE                         │
├──────────────────────────────────────────────────────────────┤
│ id (PK)                                                       │
│ user_id (FK → users)                                         │
│ ctc                                                           │
│ fixed_pay                                                     │
│ variable_pay                                                  │
│ commission_percentage                                         │
│ per_inspection_payout                                         │
│ incentive_structure (JSON)                                    │
│ currency                                                      │
│ effective_from                                                │
│ effective_to                                                  │
│ created_by (FK → users)                                      │
│ created_at                                                    │
└──────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                              BUSINESS ENTITIES                                   │
└─────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                          LEADS                                │
├──────────────────────────────────────────────────────────────┤
│ id (PK)                                                       │
│ country_id (FK → countries) [MANDATORY]                      │
│ name                                                          │
│ mobile                                                        │
│ email                                                         │
│ city                                                          │
│ source                                                        │
│ ad_id                                                         │
│ status                                                        │
│ assigned_to (FK → users)                                     │
│ team_id (FK → teams)                                         │
│ is_locked (prevents round robin override)                    │
│ reminder_date, reminder_time, reminder_reason                │
│ notes                                                         │
│ payment_link                                                  │
│ created_at                                                    │
│ updated_at                                                    │
│ created_by (FK → users)                                      │
│ updated_by (FK → users)                                      │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                   LEAD_REASSIGNMENT_LOG                       │
├──────────────────────────────────────────────────────────────┤
│ id (PK)                                                       │
│ lead_id (FK → leads)                                         │
│ old_agent_id (FK → users)                                    │
│ new_agent_id (FK → users)                                    │
│ reassigned_by (FK → users)                                   │
│ reason (MANDATORY)                                            │
│ reassignment_type (manual, round_robin, system)              │
│ timestamp                                                     │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                       CUSTOMERS                               │
├──────────────────────────────────────────────────────────────┤
│ id (PK)                                                       │
│ country_id (FK → countries) [MANDATORY]                      │
│ lead_id (FK → leads, nullable)                               │
│ name                                                          │
│ mobile                                                        │
│ email                                                         │
│ city                                                          │
│ payment_status                                                │
│ total_amount_paid                                             │
│ created_at                                                    │
│ updated_at                                                    │
│ created_by (FK → users)                                      │
│ updated_by (FK → users)                                      │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                      INSPECTIONS                              │
├──────────────────────────────────────────────────────────────┤
│ id (PK)                                                       │
│ country_id (FK → countries) [MANDATORY]                      │
│ customer_id (FK → customers)                                 │
│ order_id                                                      │
│ customer_name, customer_mobile                               │
│ car_number, car_make, car_model, car_year                    │
│ city, address, location_lat, location_lng                    │
│ package_type                                                  │
│ total_amount, amount_paid, pending_amount                    │
│ payment_status, payment_type                                 │
│ inspection_status                                             │
│ scheduled_date, scheduled_time                               │
│ mechanic_id (FK → users)                                     │
│ coordinator_id (FK → users)                                  │
│ report_reviewer_id (FK → users)                              │
│ report_status                                                 │
│ report_url                                                    │
│ created_at, updated_at                                        │
│ created_by, updated_by (FK → users)                          │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                     AUDIT_LOGS                                │
├──────────────────────────────────────────────────────────────┤
│ id (PK)                                                       │
│ entity_type (lead, customer, inspection, user, etc.)         │
│ entity_id                                                     │
│ action (create, update, delete, reassign, login, etc.)       │
│ old_values (JSON)                                             │
│ new_values (JSON)                                             │
│ user_id (FK → users)                                         │
│ ip_address                                                    │
│ user_agent                                                    │
│ timestamp                                                     │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                  ROUND_ROBIN_STATE                            │
├──────────────────────────────────────────────────────────────┤
│ id (PK)                                                       │
│ country_id (FK → countries)                                  │
│ team_id (FK → teams, nullable)                               │
│ last_assigned_user_id (FK → users)                           │
│ updated_at                                                    │
└──────────────────────────────────────────────────────────────┘
```

## 2. ROLE-PERMISSION MATRIX

| Permission | CEO | Country Head | Sales Head | Sales Lead | Sales Exec | Insp Head | Insp Lead | Insp Coord | Report Rev | Mechanic | HR |
|------------|-----|--------------|------------|------------|------------|-----------|-----------|------------|------------|----------|-----|
| **LEADS** |
| leads.view | ALL | COUNTRY | COUNTRY | TEAM | OWN | - | - | - | - | - | - |
| leads.create | ALL | COUNTRY | COUNTRY | TEAM | OWN | - | - | - | - | - | - |
| leads.edit | ALL | COUNTRY | COUNTRY | TEAM | OWN | - | - | - | - | - | - |
| leads.delete | ALL | - | - | - | - | - | - | - | - | - | - |
| leads.reassign | ALL | - | COUNTRY | TEAM | - | - | - | - | - | - | - |
| leads.export | ALL | COUNTRY | COUNTRY | - | - | - | - | - | - | - | - |
| **CUSTOMERS** |
| customers.view | ALL | COUNTRY | COUNTRY | TEAM | OWN | COUNTRY | COUNTRY | OWN | OWN | - | - |
| customers.create | ALL | COUNTRY | COUNTRY | TEAM | OWN | - | - | - | - | - | - |
| customers.edit | ALL | COUNTRY | COUNTRY | TEAM | OWN | - | - | - | - | - | - |
| **INSPECTIONS** |
| inspections.view | ALL | COUNTRY | - | - | - | COUNTRY | COUNTRY | OWN | OWN | OWN | - |
| inspections.create | ALL | COUNTRY | - | - | - | COUNTRY | COUNTRY | OWN | - | - | - |
| inspections.edit | ALL | COUNTRY | - | - | - | COUNTRY | COUNTRY | OWN | - | - | - |
| inspections.assign_mechanic | ALL | COUNTRY | - | - | - | COUNTRY | COUNTRY | OWN | - | - | - |
| **REPORTS** |
| reports.view | ALL | COUNTRY | - | - | - | COUNTRY | COUNTRY | OWN | OWN | OWN | - |
| reports.edit | ALL | - | - | - | - | - | - | - | OWN | - | - |
| reports.finalize | ALL | - | - | - | - | COUNTRY | - | - | OWN | - | - |
| **USERS/EMPLOYEES** |
| users.view | ALL | COUNTRY | TEAM | TEAM | - | TEAM | TEAM | - | - | - | ALL |
| users.create | ALL | - | - | - | - | - | - | - | - | - | ALL |
| users.edit | ALL | - | - | - | - | - | - | - | - | - | ALL |
| users.delete | ALL | - | - | - | - | - | - | - | - | - | ALL |
| **SALARY** |
| salary.view | ALL | COUNTRY | TEAM | - | - | TEAM | - | - | - | - | ALL |
| salary.edit | ALL | - | - | - | - | - | - | - | - | - | ALL |
| **DASHBOARD** |
| dashboard.view | ALL | COUNTRY | COUNTRY | TEAM | OWN | COUNTRY | TEAM | OWN | OWN | OWN | ALL |
| dashboard.financial | ALL | COUNTRY | COUNTRY | - | - | COUNTRY | - | - | - | - | - |
| **SETTINGS** |
| settings.view | ALL | COUNTRY | - | - | - | - | - | - | - | - | ALL |
| settings.edit | ALL | - | - | - | - | - | - | - | - | - | ALL |

### Scope Definitions:
- **ALL**: Access to all data across all countries
- **COUNTRY**: Access to data within assigned country only
- **TEAM**: Access to data within assigned team only
- **OWN**: Access to only own data/assigned items
- **-**: No access

## 3. TAB VISIBILITY BY ROLE

| Tab | CEO | Country Head | Sales Head | Sales Lead | Sales Exec | Insp Head | Insp Lead | Insp Coord | Report Rev | Mechanic | HR |
|-----|-----|--------------|------------|------------|------------|-----------|-----------|------------|------------|----------|-----|
| Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Leads | ✓ | ✓ | ✓ | ✓ | ✓ | - | - | - | - | - | - |
| Customers | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | - | - |
| Inspections | ✓ | ✓ | - | - | - | ✓ | ✓ | ✓ | ✓ | ✓ | - |
| Reports | ✓ | ✓ | - | - | - | ✓ | ✓ | ✓ | ✓ | ✓ | - |
| Mechanics | ✓ | ✓ | - | - | - | ✓ | ✓ | ✓ | - | - | - |
| Employees | ✓ | ✓ | ✓ | - | - | ✓ | - | - | - | - | ✓ |
| HR | ✓ | - | - | - | - | - | - | - | - | - | ✓ |
| Settings | ✓ | ✓ | - | - | - | - | - | - | - | - | ✓ |
| Finance | ✓ | ✓ | ✓ | - | - | ✓ | - | - | - | - | - |

## 4. BACKEND ARCHITECTURE

```
/app/backend/
├── server.py                 # Main FastAPI app entry point
├── config.py                 # Configuration management
├── database.py               # MongoDB connection & helpers
│
├── models/                   # Pydantic models
│   ├── __init__.py
│   ├── user.py              # User, Role, Permission models
│   ├── organization.py      # Country, Department, Team models
│   ├── lead.py              # Lead, LeadReassignmentLog models
│   ├── customer.py          # Customer models
│   ├── inspection.py        # Inspection models
│   └── audit.py             # AuditLog models
│
├── routes/                   # API route handlers
│   ├── __init__.py
│   ├── auth.py              # Authentication routes
│   ├── users.py             # User management routes
│   ├── roles.py             # Role & permission routes
│   ├── countries.py         # Country management routes
│   ├── leads.py             # Lead routes with RBAC
│   ├── customers.py         # Customer routes with RBAC
│   ├── inspections.py       # Inspection routes with RBAC
│   └── reports.py           # Report routes
│
├── services/                 # Business logic layer
│   ├── __init__.py
│   ├── rbac.py              # RBAC service (permission checking)
│   ├── round_robin.py       # Round robin assignment logic
│   ├── lead_service.py      # Lead business logic
│   ├── audit_service.py     # Audit logging service
│   └── salary_service.py    # Salary management
│
├── middleware/               # Custom middleware
│   ├── __init__.py
│   ├── auth.py              # JWT authentication middleware
│   ├── rbac.py              # RBAC middleware
│   └── audit.py             # Request/response audit
│
└── utils/                    # Utility functions
    ├── __init__.py
    ├── permissions.py       # Permission constants
    └── helpers.py           # General helpers
```

## 5. API ENDPOINTS STRUCTURE

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user with permissions

### Countries
- `GET /api/countries` - List countries (based on user access)
- `POST /api/countries` - Create country (CEO only)
- `PUT /api/countries/{id}` - Update country
- `GET /api/countries/{id}/stats` - Country statistics

### Users
- `GET /api/users` - List users (RBAC filtered)
- `POST /api/users` - Create user (HR only)
- `PUT /api/users/{id}` - Update user
- `GET /api/users/{id}/permissions` - Get user permissions

### Roles & Permissions
- `GET /api/roles` - List roles
- `POST /api/roles` - Create role
- `GET /api/roles/{id}/permissions` - Get role permissions
- `PUT /api/roles/{id}/permissions` - Update role permissions

### Leads
- `GET /api/leads` - List leads (RBAC filtered by country/team/own)
- `POST /api/leads` - Create lead
- `PUT /api/leads/{id}` - Update lead
- `POST /api/leads/{id}/reassign` - Reassign lead (permission checked)
- `GET /api/leads/stats` - Lead statistics

### Round Robin
- `GET /api/round-robin/next/{country_id}` - Get next agent
- `POST /api/round-robin/assign` - Auto-assign lead

## 6. RBAC IMPLEMENTATION APPROACH

```python
# Permission checking flow
async def check_permission(user_id, permission, resource_id=None):
    1. Get user's role
    2. Get role's permissions with scope
    3. Check if permission exists for role
    4. Apply scope filter:
       - ALL: Allow access
       - COUNTRY: Check user.country_id == resource.country_id
       - TEAM: Check user.team_id == resource.team_id
       - OWN: Check user.id == resource.assigned_to or created_by
    5. Return allowed/denied
```

## 7. ROUND ROBIN IMPLEMENTATION

```python
async def get_next_agent(country_id, team_id=None):
    1. Get all active sales agents in country/team
    2. Filter agents where is_available_for_assignment = True
    3. Get last assigned agent from round_robin_state
    4. Find next agent in circular order
    5. Update round_robin_state
    6. Return next agent
    
async def assign_lead(lead_id, manual_override=False):
    1. If manual_override, skip round robin
    2. Get lead's country
    3. Get next agent via round robin
    4. Assign lead to agent
    5. Log assignment in lead_reassignment_log
    6. Mark lead as locked if manually assigned
```

## 8. DATA ISOLATION RULES

1. **Country Isolation**: All queries MUST include country_id filter based on user's country
2. **Team Isolation**: Team-level roles only see their team's data
3. **Own Data**: Sales executives only see their assigned leads
4. **No Cross-Country Access**: Except for CEO role

## 9. AUDIT REQUIREMENTS

Every mutation must log:
- Entity type & ID
- Action performed
- Old values (for updates)
- New values
- User who performed action
- Timestamp
- IP address (if available)

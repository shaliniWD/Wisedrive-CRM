# WiseDrive CRM - Product Requirements Document

## Original Problem Statement
Recreate WiseDrive CRM (https://crm.wisedrive.com) design with a modern UI. Create a full CRM with all modules including:
- Full functional CRM with backend/database
- JWT-based custom auth (email/password)
- Light theme design

## V2 Architecture Implementation (Feb 13, 2026)

### Multi-Country, Multi-Tenant RBAC System
The CRM has been refactored from V1 monolithic architecture to V2 with:
- **Multi-Country Support**: India, Malaysia, Thailand, Philippines
- **Hierarchical Roles**: CEO, Country Head, Sales Head, Sales Lead, Sales Executive, Inspection Head, Inspection Lead, Inspection Coordinator, Report Reviewer, Mechanic, HR Manager
- **Permission-Based Access Control**: 48 permissions across resources with scopes (all, country, team, own)
- **Round-Robin Lead Assignment**: Automatic lead distribution within country/team
- **Audit Logging**: Track lead reassignments and critical actions

### Data Isolation Rules
1. **Country Isolation**: All queries filtered by user's country_id
2. **Team Isolation**: Team-level roles see only their team's data
3. **Own Data**: Sales executives see only their assigned leads
4. **CEO Exception**: Full access to all data across countries

## Architecture

### Backend (V2)
- **Framework**: FastAPI with Python
- **Database**: MongoDB
- **Authentication**: JWT-based with bcrypt password hashing
- **Structure**:
  - `/app/backend/models/` - Pydantic models (user, organization, lead, customer, inspection, audit, employee)
  - `/app/backend/services/` - Business logic (rbac, round_robin, audit, seed_v2)
  - `/app/backend/server.py` - Main FastAPI application with all routes

### Frontend
- **Framework**: React.js with Tailwind CSS, shadcn/ui components
- **State Management**: React Context API for auth
- **RBAC Integration**: 
  - Tab visibility based on user role
  - Permission-based feature access
  - Dynamic navigation

## What's Been Implemented

### HR Module V3 (Feb 14, 2026)
- [x] **Column Order Updated**: Employee, Role, Country, Weekly Off, Status, Salary Info, Audit, Actions
- [x] **Docs Column Removed** from employee table
- [x] **Audit Column Repositioned** - now before Actions column
- [x] **Weekly Off Day Tracking**: 
  - Weekly off day selector in employee modal (0=Sunday to 6=Saturday)
  - Round-robin excludes employees on their weekly off day
- [x] **Lead Assignment Control**:
  - `is_available_for_leads` toggle in employee modal
  - When unchecked, employee won't receive new leads via round-robin
  - Optional reason field when pausing lead assignment
- [x] **Attendance/Leave Tracking**:
  - Mark Today's Attendance buttons: Present, Absent, Half Day, On Leave
  - Month-wise leave summary table with Present, Absent, Half Day, On Leave, Total Leaves
  - Year filter for attendance history
  - Marking absent excludes from lead assignment for that day
- [x] **Salary Payments History**:
  - Year-filterable payment history in Salary tab
  - Shows Month, Gross, Net, Status for each payment
- [x] **Salary Info Column Display**:
  - Shows gross salary for permanent staff
  - Shows "price per inspection" for mechanics/freelancers
- [x] **Mechanic Salary Form**: Freelancer / Mechanic Compensation with Price Per Inspection and Commission %
- [x] **HR Manager Tab Visibility**: Only Admin tab visible (Settings, Leads, Customers, Inspections removed)
- [x] **Indian HR Full Access**: HR Manager can manage employees across all countries

### HR Module V2 (Feb 13, 2026)
- [x] Unified Employee tab (merged Employee, Garage Employee, HR/Salary, Audit Trail)
- [x] Comprehensive Employee modal with 5 tabs:
  - Details: Personal info, employment info, bank details, CRM access toggle
  - Salary: Dynamic form based on role (Full-time: Basic/HRA/Variable/PF/Tax/Net, Mechanic: Price Per Inspection)
  - Documents: Onboarding documents management with verification status
  - Attendance: Monthly attendance summary with Present/Absent/Half-Day/Leave
  - Audit: Per-employee audit trail with action history
- [x] Countries tab with currency management (symbol, phone code, employee count)
- [x] Employee creation with password and auto-generated employee code

### V2 Backend (Feb 13, 2026)
- [x] Multi-country data model (countries, departments, roles, teams)
- [x] 48 permissions with scopes (all, country, team, own)
- [x] Role-based permission mapping
- [x] RBAC service for permission checking
- [x] Round-robin lead assignment service (respects weekly off and availability)
- [x] Audit service for logging
- [x] RBAC-filtered API endpoints (leads, customers, inspections, dashboard)
- [x] Lead reassignment with mandatory reason
- [x] User enrichment (role_name, country_name, department_name, team_name)
- [x] Dashboard stats with RBAC filtering

### V2 Frontend (Feb 13, 2026)
- [x] AuthContext with permissions and visible tabs
- [x] RBAC-based navigation (TopNavbar)
- [x] User info display (name, role, country)
- [x] Leads page with assigned_to_name
- [x] Lead reassignment modal with reason requirement
- [x] V2 demo credentials on login page

### V1 Features (Preserved)
- [x] Customer Details Modal with transaction history
- [x] Edit Lead Modal
- [x] Assign Employee Modal (updated for V2)
- [x] Add Reminder Modal
- [x] Send Payment Link Modal (3-step flow with mock Vaahan API)
- [x] Pagination for data tables
- [x] Ad ID display for FACEBOOK/INSTAGRAM leads

## Role-Permission Matrix

| Permission | CEO | Country Head | Sales Head | Sales Exec | HR Manager |
|------------|-----|--------------|------------|------------|------------|
| leads.view | ALL | COUNTRY | COUNTRY | OWN | - |
| leads.edit | ALL | COUNTRY | COUNTRY | OWN | - |
| leads.reassign | ALL | - | COUNTRY | - | - |
| customers.view | ALL | COUNTRY | COUNTRY | OWN | - |
| inspections.view | ALL | COUNTRY | - | - | COUNTRY |
| users.view | ALL | COUNTRY | TEAM | - | ALL |
| salary.view | ALL | COUNTRY | TEAM | - | ALL |

## Tab Visibility by Role

| Tab | CEO | Sales Head | Sales Exec | HR Manager |
|-----|-----|------------|------------|------------|
| Dashboard | ✓ | ✓ | ✓ | - |
| Leads | ✓ | ✓ | ✓ | - |
| Customers | ✓ | ✓ | - | - |
| Inspections | ✓ | - | - | - |
| Admin | ✓ | ✓ | - | ✓ |
| Settings | ✓ | ✓ | - | ❌ |

## API Endpoints

### HR Module (V3 - New/Updated)
- `PATCH /api/hr/employees/{id}/weekly-off` - Update weekly off day
- `PATCH /api/hr/employees/{id}/lead-assignment` - Toggle lead availability
- `GET /api/hr/employees/{id}/leave-summary?year=` - Get month-wise leave summary
- `GET /api/hr/employees/{id}/salary-payments?year=` - Get salary payment history
- `POST /api/hr/employees/{id}/salary-payments` - Record salary payment
- `POST /api/hr/employees/{id}/attendance` - Mark attendance

### Authentication
- `POST /api/auth/login` - Login with email/password
- `GET /api/auth/me` - Get current user with permissions and visible_tabs

### V2 Organization
- `GET /api/countries` - List countries (filtered by access)
- `GET /api/departments` - List departments
- `GET /api/roles` - List roles
- `GET /api/teams` - List teams (filtered by country)

### V2 Users
- `GET /api/users` - List users (RBAC filtered)
- `GET /api/users/{id}` - Get user details
- `PATCH /api/users/{id}/toggle-status` - Toggle user active status
- `PATCH /api/users/{id}/toggle-assignment` - Toggle assignment availability

### Leads (RBAC)
- `GET /api/leads` - List leads (RBAC filtered)
- `POST /api/leads` - Create lead (auto round-robin assignment)
- `PUT /api/leads/{id}` - Update lead
- `POST /api/leads/{id}/reassign` - Reassign lead with reason
- `GET /api/leads/{id}/reassignment-history` - Get reassignment audit log

### Round Robin
- `GET /api/round-robin/next/{country_id}` - Get next agent (excludes weekly off and absent)
- `GET /api/round-robin/stats/{country_id}` - Assignment statistics

### Dashboard
- `GET /api/dashboard/stats` - Dashboard statistics (RBAC filtered)

## Test Credentials (V2)

| Role | Email | Password |
|------|-------|----------|
| CEO | ceo@wisedrive.com | password123 |
| Sales Executive (India) | salesexec1.in@wisedrive.com | password123 |
| HR Manager | hr@wisedrive.com | password123 |
| Country Head (India) | countryhead.in@wisedrive.com | password123 |
| Sales Head (India) | saleshead.in@wisedrive.com | password123 |

## Seeded Data (V2)

- **Countries**: 4 (India, Malaysia, Thailand, Philippines)
- **Departments**: 4 (Executive, Sales, Inspection, HR)
- **Roles**: 11 (CEO, HR Manager, Country Head, etc.)
- **Permissions**: 48 (across all resources and actions)
- **Teams**: 5 (Sales Team Alpha/Beta, Inspection Teams)
- **Users**: 17 (across different roles and countries)
- **Leads**: 40 (30 India, 10 Malaysia)
- **Customers**: 15
- **Inspections**: 20

## Prioritized Backlog

### P0 - Complete
- [x] V2 Multi-tenant RBAC architecture
- [x] Role-based permission system
- [x] Round-robin lead assignment (with availability checks)
- [x] RBAC-filtered API endpoints
- [x] Dashboard stats with proper filtering
- [x] Comprehensive HR Module V3 (weekly off, leave tracking, salary history, lead assignment control)
- [x] Countries management with currency
- [x] Per-employee audit trail

### P1 - High Priority (Next)
- [ ] Lead Assignment Flow: Complete integration with team selection UI
- [ ] Export data to CSV/Excel functionality
- [ ] Inspection assignment to mechanics

### P2 - Medium Priority
- [ ] Multi-currency support
- [ ] Finance tab implementation
- [ ] Dashboard charts and graphs
- [ ] Report generation and download

### P3 - Future
- [ ] Twilio integration for WhatsApp -> CRM lead creation
- [ ] Razorpay payment integration
- [ ] Vaahan API for real car lookup
- [ ] Google Maps for location services
- [ ] Real-time updates via WebSockets

## Technical Notes

### MongoDB Collections (V2)
- countries, departments, roles, permissions, role_permissions
- teams, users, salary_structures, salary_payments
- leads, lead_reassignment_logs
- customers, inspections, transactions
- audit_logs, round_robin_state
- digital_ads, garage_employees
- employee_attendance, employee_documents

### RBAC Scope Definitions
- **ALL**: Access to all data across all countries
- **COUNTRY**: Access to data within assigned country only
- **TEAM**: Access to data within assigned team only
- **OWN**: Access to only own data/assigned items

### Mocked APIs
- **Vaahan Car Lookup**: Returns mock car data in payment modal

## Last Updated
February 14, 2026 - HR Module V3 Complete with Weekly Off, Leave Tracking, Salary History, and Lead Assignment Control

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
- **Hierarchical Roles**: CEO, Country Head, Finance Manager, Sales Head, Sales Lead, Sales Executive, Inspection Head, Inspection Lead, Inspection Coordinator, Report Reviewer, Mechanic, HR Manager
- **Permission-Based Access Control**: 63 permissions across resources with scopes (all, country, team, own)
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
  - `/app/backend/models/` - Pydantic models (user, organization, lead, customer, inspection, audit, employee, finance)
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

### Finance Module (Feb 14, 2026) ✅ NEW
- [x] **New Finance Manager Role**: Country-level access to finance data
- [x] **Finance Tab**: Exclusive to Finance Manager, Country Head, and CEO
- [x] **Payment Types**: Salary payments and Mechanic/Freelancer payouts
- [x] **Payment Workflow**:
  - Pending → Submitted → Approved/Rejected → Paid
  - Finance Manager creates payments and submits for approval
  - Country Manager approves/rejects payments
  - Approved payments can be marked as paid with payment mode and reference
- [x] **Payment Modes**: Bank Transfer, NEFT, RTGS, IMPS, UPI, Cheque, Cash
- [x] **Payslip PDF Generation**:
  - Company header with logo
  - Employee details (name, ID, department, designation)
  - Bank details (account number, IFSC, PAN)
  - Earnings breakdown (Basic, HRA, Allowances, Gross)
  - Deductions breakdown (PF, Tax, Other, Total)
  - Net Pay prominently displayed
  - Download/Print to PDF functionality
- [x] **Payment Proof**: File upload and transaction reference support
- [x] **Summary Dashboard**:
  - Total Employees, Total Paid, Pending Approvals
  - Payment Status Breakdown (Pending, Submitted, Approved, Paid, Rejected)
  - Monthly Trend (Last 6 months)
- [x] **Country Manager Approval View**: Dedicated tab for pending approvals

### HR Module V3 (Feb 14, 2026)
- [x] Column Order Updated: Employee, Role, Country, Weekly Off, Status, Salary Info, Audit, Actions
- [x] Docs Column Removed from employee table
- [x] Audit Column Repositioned - now before Actions column
- [x] Weekly Off Day Tracking with round-robin exclusion
- [x] Lead Assignment Control toggle
- [x] Attendance/Leave Tracking with month-wise summary
- [x] Salary Payments History with year filter
- [x] Salary Info Column Display (gross for permanent, price per inspection for mechanics)
- [x] HR Manager Tab Visibility: Only Admin tab visible

### HR Module V2 (Feb 13, 2026)
- [x] Unified Employee tab with multi-tab modal (Details, Salary, Documents, Attendance, Audit)
- [x] Dynamic salary forms based on role
- [x] Countries tab with currency management
- [x] Employee creation with auto-generated employee code

### V2 Backend (Feb 13, 2026)
- [x] Multi-country data model
- [x] 63 permissions with scopes
- [x] Role-based permission mapping
- [x] RBAC service for permission checking
- [x] Round-robin lead assignment service
- [x] Audit service for logging

## Role-Permission Matrix

| Permission | CEO | Country Head | Finance Manager | HR Manager | Sales Exec |
|------------|-----|--------------|-----------------|------------|------------|
| finance.view | ALL | COUNTRY | COUNTRY | - | - |
| finance.create | ALL | - | COUNTRY | - | - |
| finance.edit | ALL | COUNTRY | COUNTRY | - | - |
| finance.approve | ALL | COUNTRY | - | - | - |
| leads.view | ALL | COUNTRY | - | - | OWN |
| users.view | ALL | COUNTRY | COUNTRY | ALL | - |

## Tab Visibility by Role

| Tab | CEO | Country Head | Finance Manager | HR Manager | Sales Exec |
|-----|-----|--------------|-----------------|------------|------------|
| Dashboard | ✓ | ✓ | - | - | ✓ |
| Leads | ✓ | ✓ | - | - | ✓ |
| Customers | ✓ | ✓ | - | - | - |
| Inspections | ✓ | ✓ | - | - | - |
| Admin | ✓ | ✓ | - | ✓ | - |
| Finance | ✓ | ✓ | ✓ | - | - |
| Settings | ✓ | ✓ | - | - | - |

## API Endpoints

### Finance Module (New)
- `GET /api/finance/payments` - List payments (filtered by country)
- `POST /api/finance/payments` - Create payment
- `PUT /api/finance/payments/{id}` - Update payment
- `DELETE /api/finance/payments/{id}` - Delete pending payment
- `PATCH /api/finance/payments/{id}/submit` - Submit for approval
- `PATCH /api/finance/payments/{id}/approve` - Approve/Reject (Country Manager)
- `PATCH /api/finance/payments/{id}/mark-paid` - Mark as paid
- `GET /api/finance/payments/{id}/payslip` - Generate payslip data
- `GET /api/finance/summary` - Dashboard summary
- `GET /api/finance/employees` - Employees for payment
- `GET /api/finance/payment-modes` - Available payment modes
- `POST /api/finance/payments/{id}/proofs` - Upload payment proof
- `GET /api/finance/payments/{id}/proofs` - Get payment proofs

### HR Module
- `PATCH /api/hr/employees/{id}/weekly-off` - Update weekly off day
- `PATCH /api/hr/employees/{id}/lead-assignment` - Toggle lead availability
- `GET /api/hr/employees/{id}/leave-summary?year=` - Month-wise leave summary
- `GET /api/hr/employees/{id}/salary-payments?year=` - Salary payment history

## Test Credentials (V2)

| Role | Email | Password |
|------|-------|----------|
| CEO | ceo@wisedrive.com | password123 |
| Country Head (India) | countryhead.in@wisedrive.com | password123 |
| Finance Manager (India) | finance.in@wisedrive.com | password123 |
| Finance Manager (Malaysia) | finance.my@wisedrive.com | password123 |
| HR Manager | hr@wisedrive.com | password123 |
| Sales Executive (India) | salesexec1.in@wisedrive.com | password123 |

## Seeded Data (V2)

- **Countries**: 4 (India, Malaysia, Thailand, Philippines)
- **Departments**: 5 (Executive, Sales, Inspection, HR, Finance)
- **Roles**: 12 (including new Finance Manager)
- **Permissions**: 63 (including finance.view, finance.create, finance.edit, finance.approve)
- **Teams**: 5
- **Users**: 19 (including Finance Managers for India and Malaysia)

## Prioritized Backlog

### P0 - Complete ✅
- [x] V2 Multi-tenant RBAC architecture
- [x] Role-based permission system
- [x] Round-robin lead assignment
- [x] Comprehensive HR Module V3
- [x] **Finance Module with approval workflow**
- [x] **Payslip PDF generation**
- [x] **Finance Manager role**

### P1 - High Priority (Next)
- [ ] Payment proof file upload UI (backend ready)
- [ ] Lead Assignment Flow with team selection UI
- [ ] Export data to CSV/Excel functionality

### P2 - Medium Priority
- [ ] Multi-currency support in Finance
- [ ] Dashboard charts and graphs
- [ ] Report generation and download

### P3 - Future
- [ ] Twilio integration for WhatsApp -> CRM lead creation
- [ ] Razorpay payment integration
- [ ] Vaahan API for real car lookup
- [ ] Google Maps for location services

## Technical Notes

### MongoDB Collections (V2)
- countries, departments, roles, permissions, role_permissions
- teams, users, salary_structures, salary_payments
- leads, lead_reassignment_logs
- customers, inspections, transactions
- audit_logs, round_robin_state
- **finance_payments, payment_proofs** (NEW)

### Payment Status Flow
```
PENDING → SUBMITTED → APPROVED → PAID
                   ↘ REJECTED
```

### Mocked APIs
- **Vaahan Car Lookup**: Returns mock car data in payment modal

## Last Updated
February 14, 2026 - Comprehensive Finance Module Complete with Payment Workflow, Payslip PDF Generation, and Finance Manager Role

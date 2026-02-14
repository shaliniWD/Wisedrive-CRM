# WiseDrive CRM - Product Requirements Document

## Original Problem Statement
Recreate WiseDrive CRM (https://crm.wisedrive.com) design with a modern UI. Create a full CRM with all modules including:
- Full functional CRM with backend/database
- JWT-based custom auth (email/password)
- Light theme design

## What's Been Implemented

### CRM V4 Features (Feb 14, 2026) ✅ LATEST
- [x] **Multi-Role Support for Employees**:
  - Employees can be assigned multiple roles via checkbox selection
  - Backend stores `role_ids` array in addition to primary `role_id`
  - `/api/auth/me` returns `roles` array with all assigned roles
  - RBAC service aggregates permissions from all assigned roles
  - Frontend: RoleBadges component shows multiple role badges
  - Frontend: Add Employee modal with multi-role checkbox selection

- [x] **Inline Lead Status Update**:
  - StatusDropdown component in LeadsPage.jsx
  - Click on status badge → dropdown with all status options
  - `PATCH /api/leads/{lead_id}/status` endpoint for quick updates
  - Valid statuses: NEW, HOT, CONTACTED, INTERESTED, NOT_INTERESTED, CONVERTED, RNR, RCB_WHATSAPP, FOLLOWUP, OUT_OF_SERVICE_AREA, LOST

- [x] **Admin Page RBAC Configuration UI**:
  - New "Roles & Access" tab showing all roles with permissions
  - Displays page access permissions (View/Edit) for each role
  - Edit button for each role to modify permissions

- [x] **Employee Exit/Rejoin Flow**:
  - Exit modal with Exit Date, Exit Reason dropdown, Notes
  - `employment_status` field: 'active' or 'exited'
  - Exited employees preserved for audit purposes
  - Rejoin functionality to reactivate employees
  - Status badges: Active (green), Exited (red)

- [x] **Leads Page Enhancements**:
  - Hot Leads summary card (shows count of HOT status leads)
  - Clickable status badges with dropdown for inline editing
  - Discount & Inspection Schedule fields in payment modal
  - Summary cards: New Leads (Today), Hot Leads, RCB WhatsApp, Follow Up, Payment Link Sent

### Full UI/UX Redesign (Feb 14, 2026) ✅
- [x] **Login Page**: Split-screen design with gradient left panel (blue-900 to blue-700), white form card on right, demo credentials section, feature pills
  - Added Country selection dropdown at top of form (Feb 14, 2026)
  - Public /api/auth/countries endpoint for dropdown (India, Malaysia, Thailand, Philippines)
- [x] **Dashboard Page**: Modern summary cards with gradient icons, Quick Actions section with hover effects, Recent Activity feed, Performance Overview with progress bars, colored stats row
- [x] **Leads Page**: Redesigned with action-oriented summary cards, search/filter section, modern table with status badges, pagination (Feb 14, 2026 - Update)
  - Summary Cards: New Leads (Today), RCB WhatsApp, Follow Up, Payment Link Sent
  - Clickable cards for quick filtering with highlight indicator
  - Payment Link column with View/Copy buttons when link exists
  - Ad ID displays below Source in table
  - Reduced padding for wider table display
- [x] **Customers Page**: Summary cards, search/filter section, modern table with avatar initials, status badges, pagination
- [x] **Inspections Page**: Summary cards, Unscheduled/Scheduled tabs with different table layouts, status badges with icons
- [x] **Admin Page**: Summary cards, Employees/Countries tabs, employee table with role badges and status indicators, countries table with currency symbols
- [x] **TopNavbar**: No logo, Dashboard as first tab, gradient background (blue-900 to blue-800), navigation links, user avatar, logout button (Feb 14, 2026 - Update)
- [x] **Settings Page**: New page with AD ID Mapping tab (Feb 14, 2026 - NEW)
  - AD ID Mapping table with columns: Ad ID, Ad Name, City, Language, Campaign Type, Source, Active, Action
  - Create Ad modal with fields: Ad Id, Ad Amount, City, Language, Campaign, Source
  - Active toggle and action buttons (Edit, Amount, Delete)
  - **NOTE: Uses localStorage mock - not connected to backend API**

**Design Language Applied:**
- Gradient buttons (blue-600 to blue-700) with shadow
- Rounded cards (xl border-radius) with hover effects
- Status badges with colored backgrounds and borders
- Clean tables with hover effects
- Consistent typography and spacing

### Finance Module Enhanced (Feb 14, 2026) ✅
- [x] **9 Payment Types**:
  - 💰 Salary Payout
  - 🔧 Mechanic Payment
  - 🎯 Incentive Payment
  - 🏢 Vendor Payment (B2B)
  - 📋 Admin Expenses
  - ⚙️ Operational Expenses
  - 📜 Statutory Payments (B2B)
  - ⚖️ Legal Payments (B2B)
  - 📦 Other Payments

- [x] **B2B Payment Fields** (Vendor, Statutory, Legal):
  - Vendor / Payee Name
  - Invoice Number
  - Actual Amount
  - GST % with dropdown (0%, 5%, 12%, 18%, 28%)
  - GST Amount (auto-calculated)
  - TDS % with dropdown (0%, 1%, 2%, 5%, 10%)
  - TDS Deducted (auto-calculated)
  - Final Payout

- [x] **Non-B2B Payment Fields** (Salary, Mechanic, Admin, Operational, Incentive, Other):
  - Employee selector
  - Amount Payable
  - Deductions
  - Final Payout

- [x] **Modern Payslip Design**:
  - WiseDrive logo in header (blue gradient)
  - Employee/Vendor details section
  - Bank details section
  - Earnings breakdown table
  - Deductions in red
  - **Final Payout Amount** prominently displayed
  - Download PDF button
  - Footer: "©WiseDrive Technologies Private Limited"

- [x] **Payment Proof Upload UI**:
  - Drag-drop upload area
  - Supports JPG, PNG, PDF up to 5MB
  - View and delete uploaded proofs
  - Proof count badge on payment row

### Finance Module V1 (Feb 14, 2026) ✅
- [x] Finance Manager role with country-level access
- [x] Payment workflow: Pending → Submitted → Approved → Paid
- [x] Country Manager approval workflow
- [x] Payment modes: Bank Transfer, NEFT, RTGS, IMPS, UPI, Cheque, Cash
- [x] Summary dashboard with monthly trend

### HR Module V3 (Feb 14, 2026) ✅
- [x] Column order: Employee, Role, Country, Weekly Off, Status, Salary Info, Audit, Actions
- [x] Weekly Off Day tracking with round-robin exclusion
- [x] Lead Assignment Control toggle
- [x] Attendance/Leave tracking with month-wise summary
- [x] Salary Info: gross for permanent, price per inspection for mechanics
- [x] **Salary Structure with Deductions (V4 Restored)**:
  - Earnings: Basic Salary, HRA, Variable Pay, Conveyance, Medical, Special Allowance
  - Deductions: PF (Employee), Professional Tax, Income Tax (TDS), Other Deductions
  - Gross Salary vs Net Salary (Take Home) calculation
- [x] **Quick Leave Actions (V4 Restored)**:
  - Mark Today as Leave button
  - Mark Tomorrow as Leave button
- [x] **Monthly Leave Summary (V4 Restored)**:
  - Year selector (2024, 2025, 2026)
  - Present Days, Leaves Taken, Half Days, Working Days counts
  - Monthly breakdown table
- [x] **Documents Management (V4 Restored)**:
  - Upload form: Document Type (Aadhar, PAN, etc.), Name, URL
  - Document list with View/Delete actions
  - Verified/Pending status badges

### V2 Architecture (Feb 13, 2026) ✅
- [x] Multi-country support: India, Malaysia, Thailand, Philippines
- [x] 12 Roles: CEO, Country Head, Finance Manager, HR Manager, Sales Head, etc.
- [x] 63 permissions with scopes (all, country, team, own)
- [x] Round-robin lead assignment
- [x] Audit logging

## Role-Permission Matrix

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

### CRM V4 Endpoints (New)
- `PATCH /api/leads/{lead_id}/status` - Inline status update for leads
- `GET /api/auth/me` - Returns user with `roles` array for multi-role support
- `GET /api/hr/employees` - Returns employees with `roles` array
- `PUT /api/hr/employees/{id}` - Update employee with `role_ids` array and `employment_status`

### Finance Module (Enhanced)
- `GET /api/finance/payments` - List payments (filter by payment_type)
- `POST /api/finance/payments` - Create payment (B2B or employee)
- `GET /api/finance/payments/{id}/payslip` - Generate payslip (B2B or employee)
- `POST /api/finance/payments/{id}/proofs` - Upload proof
- `GET /api/finance/payments/{id}/proofs` - Get proofs
- `DELETE /api/finance/payments/{id}/proofs/{proof_id}` - Delete proof

### Payment Types Configuration
- **B2B Types** (need vendor_name, GST, TDS): `vendor`, `statutory`, `legal`
- **Employee Types** (need employee_id): `salary`, `mechanic_payout`, `incentive`, `admin_expense`, `operational`, `other`

## Test Credentials

| Role | Email | Password |
|------|-------|----------|
| CEO | ceo@wisedrive.com | password123 |
| Country Head (India) | countryhead.in@wisedrive.com | password123 |
| Finance Manager (India) | finance.in@wisedrive.com | password123 |
| Finance Manager (Malaysia) | finance.my@wisedrive.com | password123 |
| HR Manager | hr@wisedrive.com | password123 |

## Seeded Data

- **Countries**: 4 (India, Malaysia, Thailand, Philippines)
- **Departments**: 5 (Executive, Sales, Inspection, HR, Finance)
- **Roles**: 12 (including Finance Manager)
- **Users**: 19 (including Finance Managers for India and Malaysia)

## Prioritized Backlog

### P0 - Complete ✅
- [x] V2 Multi-tenant RBAC architecture
- [x] Comprehensive HR Module V3
- [x] Finance Module with 9 payment types
- [x] B2B payment fields (GST/TDS)
- [x] Modern payslip with company logo
- [x] Payment proof upload UI
- [x] Full UI/UX Redesign (all pages match FinancePage style)
- [x] Multi-role support for employees
- [x] Inline lead status update
- [x] Admin page RBAC configuration UI
- [x] Employee exit/rejoin flow
- [x] Hot Leads summary card
- [x] **HR Module Consolidation** - Admin tab merged into HR Module (Feb 14, 2026)
  - 6 tabs: Employees, Attendance, Payroll, Leave, Roles, Countries
  - Employee detail modal with sub-tabs (Details, Salary, Attendance, Documents)
  - /admin redirects to /hr

### P1 - High Priority (Next)
- [ ] Bulk payment creation for monthly salary processing
- [ ] Link salary structure to automatic payment creation
- [ ] Export payments to CSV/Excel
- [ ] Lead Assignment Flow with team selection UI

### P2 - Medium Priority
- [ ] Multi-currency support in Finance
- [ ] Dashboard charts and graphs
- [ ] Report generation

### P3 - Future
- [ ] Twilio WhatsApp integration
- [ ] Razorpay payment integration
- [ ] Vaahan API for car lookup
- [ ] Google Maps integration

## Technical Notes

### MongoDB Collections
- finance_payments (with payment_type, B2B fields)
- payment_proofs (file uploads)

### B2B Payment Flow
```
Vendor Payment → Finance Manager creates with GST/TDS → Submit for Approval → Country Manager approves → Mark as Paid with proof
```

## Last Updated
February 14, 2026 - **HR Module Enterprise Readiness Complete**: All 4 mandatory fixes implemented and verified:
1. Employee fields (joining_date, DOB, address, emergency_contact, reporting_manager, payroll_active)
2. Bank details encryption (AES-256 via Fernet)
3. Document RBAC (sensitive docs restricted by role)
4. Storage strategy (S3 configurable via STORAGE_TYPE)
Fixed security bug: bank_account_number_encrypted no longer exposed in API.

## Platform Architecture v5.0

### Phase 1: API Contract Design ✅ COMPLETE
Created `/app/wisedrive-api-contracts/` repository with:
- **OpenAPI 3.0 Specification** (`openapi/wisedrive-api-v1.yaml`)
  - 50+ API endpoints defined
  - All entities covered: Employee, Lead, Customer, Vehicle, Inspection, OBD, Payment, Report, CarData
  - Authentication flows
  - Razorpay integration endpoints
  - Invincible Ocean integration endpoints
  
- **JSON Schemas** (`schemas/`)
  - Common enums (LeadStatus, PaymentType, DTCCategory, etc.)
  - Entity schemas (Employee, Inspection, OBDSession)
  
- **Documentation** (`docs/`)
  - API Architecture design
  - Versioning policy
  - Dependency mapping
  
- **SDK Generation** (configured)
  - TypeScript SDK for web apps
  - Python SDK for backend
  - Kotlin SDK for Android
  - Swift SDK for iOS

### Phase 2: Backend Architecture ✅ COMPLETE
Created `/app/wisedrive-api-services/` with modular structure:

**Directory Structure:**
```
wisedrive-api-services/
├── config/              # Settings, database configuration
│   ├── settings.py      # Environment-specific settings (DEV/TEST/PROD)
│   └── database.py      # MongoDB connection with indexes
├── controllers/         # HTTP layer (FastAPI routers)
│   └── obd/            # OBD endpoints defined
├── services/           # Business logic layer
│   └── obd/            # OBD service with DTC processing
├── repositories/       # Data access layer
│   └── base.py         # Generic repository + specialized repos
├── middleware/         # Request/response middleware
│   ├── auth.py         # JWT authentication
│   └── rbac.py         # Role-based access control
├── integrations/       # External service wrappers
│   ├── razorpay/       # Payment gateway (server-side only)
│   ├── invincible_ocean/ # Car data API with caching
│   └── obd/            # OBD SDK wrapper
├── migrations/         # Database migration framework
│   └── __init__.py     # Version-tracked migrations
└── main.py             # FastAPI application factory
```

**Key Components:**
- **Settings**: Environment-aware configuration (DEV/TEST/PROD)
- **Repositories**: BaseRepository with generic CRUD + specialized (User, Lead, OBD, etc.)
- **RBAC Middleware**: Multi-role permission checking with data scopes
- **Migration Framework**: Version-tracked schema changes with rollback
- **Integration Wrappers**: Razorpay (signature verification), Invincible Ocean (caching), OBD (VIN validation)

## Phase 3 Confirmation Answers

| Question | Answer | Details |
|----------|--------|---------|
| **1. Namespace isolation** | ✅ Separate namespaces | `wd-dev`, `wd-test`, `wd-prod` with NetworkPolicies blocking cross-namespace |
| **2. Auto DB backup before PROD migration** | ✅ YES - Mandatory | Init container creates backup, migration only runs after backup succeeds |
| **3. HPA enabled** | ✅ YES | CPU (70%), Memory (80%), Request rate metrics |
| **4. Max pod scaling limit** | ✅ Defined | api-services: 3-10 pods, crm-web: 2-6 pods |
| **5. Rate limiting at gateway** | ✅ YES - NGINX Ingress | 100 rps default, endpoint-specific limits |

See: `docs/infrastructure/KUBERNETES_CONFIGURATION.md` for full configuration.

### Phase 3: Infrastructure Setup ✅ COMPLETE
Created comprehensive infrastructure documentation in `/app/wisedrive-api-services/docs/`:

**1. Environment Isolation** (`infrastructure/ENVIRONMENT_ISOLATION.md`)
- DEV/TEST/PROD completely isolated
- Separate MongoDB clusters per environment
- Separate CDN buckets per environment
- Environment-specific secrets (injected at runtime)
- No shared credentials

**2. Git Branching Strategy** (`infrastructure/GIT_BRANCHING_STRATEGY.md`)
- `develop` → DEV, `staging` → TEST, `main` → PROD
- Protected branches: main, staging
- Production deployment requires owner approval
- No direct commits to main
- Feature/bugfix/hotfix branch patterns

**3. Database Migration Governance** (`infrastructure/DATABASE_MIGRATION_GOVERNANCE.md`)
- Version-tracked migrations with rollback
- Auto-run on DEV/TEST, manual with approval for PROD
- Pre-flight safety checks
- Backup before migration
- Validation after migration

**4. CI/CD Pipeline** (`ci-cd/CI_CD_PIPELINE.md`)
- Contract validation in pipeline
- Breaking change detection
- Dependent repo notification via webhooks
- SDK auto-publish
- Automatic rollback on failure

**5. Deployment Architecture** (`deployment/DEPLOYMENT_ARCHITECTURE.md`)
- Server specs: API (3 pods, 1 vCPU, 1GB each in PROD)
- Backup: Continuous PITR + Daily + Weekly
- Monitoring: ELK stack + Grafana
- Zero-downtime rolling deployments
- Rollback plan documented

**Environment Config Files:**
- `config/environments/.env.dev`
- `config/environments/.env.test`
- `config/environments/.env.prod`

### Phase 4: HR Module Phase 1 ✅ COMPLETE (Feb 14, 2026)
Implemented comprehensive HR Module with Attendance Tracking, Payroll Management, and Leave Management.

**HR Module Consolidation (Feb 14, 2026):**
- Admin tab fully merged into HR Module
- 6 unified tabs: Employees, Attendance, Payroll, Leave, Roles, Countries
- AdminPage.jsx accepts `initialTab` and `embedded` props for reuse
- HRComponents.jsx: AttendanceDashboard, PayrollDashboard, LeaveManagement
- /admin route redirects to /hr
- All original Admin functionality preserved:
  - Employee management with detail modal (Details, Salary, Attendance, Documents sub-tabs)
  - Role management with preset roles and custom roles
  - Country configuration with currency symbols and phone codes

**Payroll Batch Governance (Feb 14, 2026):**
- NEW manual-controlled payroll workflow (no automatic cron)
- Batch lifecycle: DRAFT → CONFIRMED → CLOSED
- Preview payroll before creating batch (no DB save)
- Editable grid in DRAFT with columns: Employee, Gross, PF, PT, TDS, ESI, Attendance, Other, Net
- Statutory deductions stored as separate fields (PF, PT, TDS, ESI, Other)
- Attendance deduction formula: (Gross / Working Days) × Unapproved Absent Days
- Approved leaves do NOT deduct salary
- Records become immutable after batch is CONFIRMED
- Payslips generated only after CONFIRMED status
- Payment marking transitions CONFIRMED → CLOSED
- Audit logging for all batch operations
- Country-specific payroll (different statutory rules per country)

**Attendance Tracking:**
- Session-based tracking: login/logout timestamps, activity heartbeat every 2 min
- Server-side inactivity enforcement: auto-logout after 10 min + token blacklisting with TTL
- Midnight session handling: splits sessions crossing midnight into separate daily records
- Daily attendance calculation at 00:30 AM: ≥9 hrs = PRESENT, <9 hrs = PENDING, 0 = ABSENT
- HR override workflow for PENDING attendance records
- Active sessions dashboard with Force Logout capability
- Monthly attendance export capability

**Payroll & Payslip:**
- Monthly payroll generation from salary structure
- Attendance-based deductions: (Gross / Working Days) × Unapproved Absent Days
- Payroll records are IMMUTABLE after generation
- Adjustments via separate `payroll_adjustments` collection
- Finance Manager payment marking with required transaction reference
- Server-side PDF payslip generation using ReportLab
- Storage: Local for DEV, S3-compatible for TEST/PROD (configurable)

**Leave Management v1:**
- Leave types: Casual Leave (12/year), Sick Leave (12/year)
- Leave balance tracking with automatic deduction on approval
- Leave request workflow: Apply → Pending → Approved/Rejected
- Manager/HR approval capability
- Team leave summary with on-leave-today and upcoming leaves

**RBAC Enforcement:**
- HR/CEO only: Generate payroll, Force logout, Override attendance, Run daily calculation
- Finance/CEO only: Mark payments as paid
- Manager/HR: Approve/Reject leave requests
- All employees: View own data, Apply for leave

**New Files:**
- `/app/backend/models/attendance.py` - Session, AttendanceRecord models
- `/app/backend/models/payroll.py` - PayrollRecord, PayrollAdjustment models
- `/app/backend/models/leave.py` - LeaveRequest, LeaveBalance models
- `/app/backend/services/attendance_service.py` - Attendance calculation, session management
- `/app/backend/services/payroll_service.py` - Payroll generation, payment marking, payslip PDF
- `/app/backend/services/leave_service.py` - Leave requests, balance tracking, approvals
- `/app/backend/services/storage_service.py` - Local/S3 storage abstraction for payslips
- `/app/frontend/src/pages/HRModulePage.jsx` - HR Module UI with 3 tabs

**New API Endpoints:**
- `/api/hr/session/*` - Session management (start, heartbeat, end)
- `/api/hr/sessions/active` - Active sessions list
- `/api/hr/attendance/*` - Attendance records, summary, approvals, override
- `/api/hr/payroll/*` - Payroll records, generation, payment marking, payslip
- `/api/hr/leave/*` - Leave requests, balance, approvals

### Phase 5: Finance Module - NEXT
### Phase 6: External Integrations (Razorpay, Invincible Ocean) - PENDING

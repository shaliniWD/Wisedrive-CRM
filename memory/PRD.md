# WiseDrive CRM - Product Requirements Document

## Original Problem Statement
Recreate WiseDrive CRM (https://crm.wisedrive.com) design with a modern UI. Create a full CRM with all modules including:
- Full functional CRM with backend/database
- JWT-based custom auth (email/password)
- Light theme design

## What's Been Implemented

### Employee Lifecycle & UI Fix V8 (Feb 15, 2025) ✅ LATEST
- [x] **Employee Modal Overflow Fix**:
  - Fixed modal overflow issue - now properly contained within viewport
  - Added flex layout with proper scrolling on all tabs
  - Header and tab list fixed, content area scrolls independently
  - All tabs (Details, Salary, Attendance, Payslips, Documents, Leads) scroll properly

- [x] **Complete Employee Lifecycle Tested**:
  - Create employee with ALL fields (name, email, photo, country, role, department, weekly off, etc.)
  - Salary setup with full deductions (basic, HRA, allowances, PF, PT, TDS, ESI)
  - Attendance management with calendar view and status updates
  - Payslip upload and download functionality
  - Document management (ID proofs, offer letters, etc.)
  - Leads management tab with city assignment and toggle

- [x] **CEO Login Fix**:
  - Updated seed data to use `kalyan@wisedrive.com` for CEO user
  - CEO login now works correctly

### HR Module Enhancements V7 (Feb 15, 2025) ✅
- [x] **Payroll Column Restructure**:
  - New columns: Working Days, Actual Working Days (info modal), Gross Salary (info modal), Incentive (+green), OT Pay (+green), Other Deductions (-red), Net Salary
  - Info modal on Actual Working Days shows: LOP days, leaves taken, entitlement, calculation breakdown
  - Info modal on Gross Salary shows: Pro-rating formula and calculation

- [x] **New Working Days Calculation**:
  - Working Days = Days in Month - Public Holidays
  - 7-day work week (NO Saturday/Sunday exclusion)
  - Organization works all days except public holidays
  - Each employee gets 1 weekly off (configured per employee)

- [x] **Leave Entitlements at Role Level**:
  - New fields: `eligible_sick_leaves_per_month`, `eligible_casual_leaves_per_month`
  - Configurable per role (e.g., CEO: 3 sick + 2 casual, others: 2 sick + 1 casual)
  - Role modal updated with leave entitlement fields
  - PUT /api/roles/{id} endpoint for updating role settings

- [x] **New Salary Calculation Formula**:
  - Actual Working Days = Working Days - LOP Days - Leaves Beyond Entitlement
  - Pro-rated Gross = (Monthly Gross / Working Days) × Actual Working Days
  - Net = Pro-rated Gross + Incentive + OT Pay - Statutory - Other Deductions

- [x] **Bug Fix - Weekly Off Day Update**:
  - Fixed: weekly_off_day now properly updates when editing existing employee
  - Changed model type from Optional[str] to Optional[int]

- [x] **Tight Integration**:
  - Holiday Calendar → Attendance Calendar → Payroll
  - Leave entitlements (role-based) → Payroll calculation
  - Weekly Off per employee → Attendance display
  - OT tracking → Payroll calculation

### HR Module Enhancements V6 (Dec 15, 2025) ✅
- [x] **Holiday Calendar Feature**:
  - New "Holiday Calendar" tab in HR Module
  - Country-specific organization holidays
  - Add/Delete holidays with date, name, and reason
  - Year and country filters
  - Holidays reflected in Attendance Calendar as "H" status

- [x] **Overtime Tracking**:
  - New "Overtime pay per day" field in Employee modal
  - HR can mark days as "Overtime" in attendance calendar
  - Overtime (O) status option in day-edit modal
  - Overtime days and pay tracked in payroll

- [x] **Payroll Preview Enhancements**:
  - Default LOP Days to 0 (not auto-calculated from absences)
  - New editable "Incentive Amount" column
  - New editable "OT Days" column
  - "OT Pay" calculated automatically (OT Days × OT Rate/Day)
  - Summary cards show: Gross, Incentives, OT Pay, Deductions, Net

- [x] **New Salary Calculation**:
  - Formula: Net = Gross + Incentive + OT Pay - Statutory - LOP Deduction - Other Deductions
  - Backend updated to save incentive_amount, overtime_days, overtime_pay to payroll records
  - Batch totals include total_incentive and total_overtime_pay

- [x] **Payroll Month Filter**:
  - New month dropdown filter in Payroll Batches view
  - Filter batches by specific month (January-December)
  - "All Months" option to show all batches

- [x] **Attendance Calendar Legend Update**:
  - Weekly Off (W) - Employee's designated weekly off day
  - Org Holiday (H) - Organization holidays from Holiday Calendar
  - Overtime (O) - Days marked as overtime by HR

### HR Module Enhancements V5 (Dec 14, 2025) ✅
- [x] **NumericInput Bug Fix**:
  - Fixed number jumping issue in payroll preview
  - Added debounce mechanism to prevent premature parent updates
  - Users can now type multiple digits without values jumping

- [x] **LOP (Loss of Pay) Tracking**:
  - New `lop_days` field in attendance summaries
  - Attendance overrides support LOP/Absent status
  - LOP days calculated from `attendance_overrides` collection
  - LOP count shown in attendance calendar summary column (red badge)

- [x] **HR Attendance Edit Modal**:
  - HR Manager can click any day cell to open edit modal
  - Status options: Present, Absent/LOP, Half Day, Leave (Approved), Holiday
  - Notes field for additional context
  - Backend: `POST /api/hr/attendance/update-day` endpoint
  - RBAC: Only CEO and HR_MANAGER can edit attendance

- [x] **Attendance Date Restrictions**:
  - Month dropdown limited to current and past months
  - Year dropdown limited to current and past years
  - Future day cells grayed out and non-clickable
  - Backend rejects updates for future dates

- [x] **City Master for Countries**:
  - Countries now have `cities` array field
  - Country modal includes city management section
  - Add cities via input + button or Enter key
  - Remove cities via X button on tags
  - Cities used in Leads Management employee assignment

- [x] **LOP in Payroll Display**:
  - Renamed "Absent Days" → "LOP Days" throughout
  - Renamed "Attendance Deduction" → "LOP Deduction"
  - Payslip PDF shows "LOP Deduction (X days)"
  - Clearer salary deduction reasoning

- [x] **Payslips Tab in Employee Modal**:
  - New "Payslips" tab in employee detail modal
  - Auto-generated after payroll batch confirmation
  - Shows: Period, Gross, Deductions, Net, Status
  - Download PDF button for each payslip
  - Backend: `GET /api/hr/payroll/employee/{id}/payslips` endpoint

- [x] **Hidden Emergent Badge**:
  - Emergent badge hidden via CSS `display: none !important`
  - Badge element exists but not visible in production

### Attendance Calendar Rework (Dec 14, 2025) ✅
- [x] **New Calendar-Based Attendance View**:
  - Completely replaced session-based attendance logic with employee-wise calendar view
  - Consolidated view showing all employees with leave status for each day of the month
  - Color-coded status indicators:
    - Green (✓): Working day
    - Gray (-): Weekend/Holiday
    - Blue (L): Approved Leave
    - Amber (P): Pending Leave
  - Employee search filter with debounced input
  - Country, Month, and Year filter dropdowns
  - Summary column showing working days (W), approved leaves (L), pending leaves (P)
  - Employee photos/initials with name and employee code
  - Responsive horizontal scrolling for many days

- [x] **Safe Production Sync Endpoint**:
  - New `POST /api/admin/sync-users` endpoint (non-destructive)
  - Only adds missing users without deleting existing data
  - Returns created and skipped user counts
  - Can be run multiple times safely (idempotent)
  - Ensures required users exist: CEO, HR Manager, Finance Manager, Sales, Mechanic

### CRM V4 Features (Feb 14, 2026) ✅
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

### HR Module V5 (Dec 14, 2025 - New)
- `POST /api/hr/attendance/update-day` - HR can update attendance status for any employee/day
  - Body: `{ employee_id, date, status, notes }`
  - Statuses: `present`, `lop`/`absent`, `half_day`, `leave_approved`, `holiday`
  - RBAC: CEO, HR_MANAGER only
  
- `GET /api/hr/payroll/employee/{id}/payslips` - Get employee's payslips for modal
  - Returns: List of confirmed payroll records with payslip info
  - RBAC: CEO, HR_MANAGER, FINANCE_MANAGER, COUNTRY_HEAD

### Attendance Calendar (Dec 14, 2025 - New)
- `GET /api/hr/attendance/calendar` - Consolidated calendar view of all employees with leave statuses
  - Query params: `month`, `year`, `country_id`, `search`
  - Returns: `employees[]` with `days{}` containing status for each day
  - Includes: `lop_days`, `half_days` in summary
  - RBAC: CEO, HR_MANAGER, COUNTRY_HEAD only

### Admin Sync (Dec 14, 2025 - New)
- `POST /api/admin/sync-users` - Safe sync that adds missing users without deleting (non-destructive)
  - Returns: `created_count`, `created_users[]`, `skipped_count`, `skipped_users[]`
  - Idempotent: Can be run multiple times safely

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
| CEO | kalyan@wisedrive.com | password123 |
| HR Manager | hr@wisedrive.com | password123 |
| Finance Manager | finance@wisedrive.com | password123 |
| Sales Executive | john.sales@wisedrive.com | password123 |
| Mechanic | mike.mechanic@wisedrive.com | password123 |

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
- [x] **5 New HR Features** (Feb 14, 2026)
  - Employee photo URL field with preview display in table
  - Dynamic "On Leave" status for employees with approved leaves
  - Quick leave action buttons (CalendarPlus, List icons)
  - Freelancer role with pink badge and hr-only access
  - "On Leave Today" dashboard card with expandable list

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
February 14, 2026 - **Deployment Bug Fixes**:
1. **bcrypt/passlib Compatibility Fix:**
   - Removed passlib dependency (incompatible with bcrypt 4.1+)
   - Switched to using bcrypt directly for password hashing
   - Updated `hash_password()` and `verify_password()` in server.py
   - Updated `seed_v2.py` to use bcrypt directly

2. **JWT Key Length Fix:**
   - Increased default JWT_SECRET from 29 bytes to 52 bytes
   - Eliminates `InsecureKeyLengthWarning` in production

3. **Files Modified:**
   - `/app/backend/server.py` - bcrypt import, password functions, JWT secret
   - `/app/backend/services/seed_v2.py` - bcrypt import, hash_password function
   - `/app/backend/requirements.txt` - removed passlib

Previous (Feb 14, 2026): Password Management & Numeric Input Bug Fix v2

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
- Attendance-based deductions: (Gross / Working Days) × Absent Days
- Payroll records are IMMUTABLE after generation
- Adjustments via separate `payroll_adjustments` collection
- Finance Manager payment marking with required transaction reference
- Server-side PDF payslip generation using ReportLab
- Storage: Local for DEV, S3-compatible for TEST/PROD (configurable)

**Payroll Preview V2 UI/UX (Feb 14, 2026):** ✅
- Working Days: Editable input in header (removed from table column), changes trigger batch-wide recalculation
- Absent Days: Column renamed from "Attendance Days", editable per employee, formula: Present Days = Working Days - Absent Days
- Other Deductions: Plain editable numeric input (no steppers)
- Validation: Absent Days >= 0 and <= Working Days
- Real-time recalculation of Attendance Deduction and Net Salary
- Net Salary = Gross - Statutory - (Absent_Days/Working_Days × Gross) - Other

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

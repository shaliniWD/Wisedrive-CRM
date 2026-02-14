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
February 14, 2026 - **Phase 1 Complete: API Contract Design** for Wisedrive Platform Architecture v5.0

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

### Phase 3: Infrastructure Setup - NEXT
### Phase 4: OBD Integration - PENDING
### Phase 5: External Integrations - PENDING

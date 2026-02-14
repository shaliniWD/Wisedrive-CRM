# WiseDrive CRM - Product Requirements Document

## Original Problem Statement
Recreate WiseDrive CRM (https://crm.wisedrive.com) design with a modern UI. Create a full CRM with all modules including:
- Full functional CRM with backend/database
- JWT-based custom auth (email/password)
- Light theme design

## What's Been Implemented

### Full UI/UX Redesign (Feb 14, 2026) ✅ LATEST
- [x] **Login Page**: Split-screen design with gradient left panel (blue-900 to blue-700), white form card on right, demo credentials section, feature pills
- [x] **Dashboard Page**: Modern summary cards with gradient icons, Quick Actions section with hover effects, Recent Activity feed, Performance Overview with progress bars, colored stats row
- [x] **Leads Page**: Redesigned with summary cards, search/filter section, modern table with status badges, pagination (Feb 14, 2026 - Update)
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

### P1 - High Priority (Next)
- [ ] Bulk payment creation for monthly salary processing
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
February 14, 2026 - Finance Module Enhanced with 9 Payment Types, B2B GST/TDS Fields, Modern Payslip Design with Company Logo

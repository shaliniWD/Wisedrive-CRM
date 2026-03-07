# WiseDrive CRM - Product Requirements Document

## Original Problem Statement
The application is a full-stack CRM for vehicle loans and inspections. Key features include:
- Lead management from Meta Ads
- Vehicle inspection scheduling and reporting
- Loan application processing
- Customer management
- Credit report integration (CIBIL, Equifax, Experian via Surepass)
- Bank statement analysis for loan eligibility

## Core Architecture
- **Frontend:** React with Shadcn/UI components
- **Backend:** FastAPI with MongoDB
- **Database:** MongoDB (production dump restored)
- **External APIs:** Surepass (credit reports), Meta Ads, Razorpay, Firebase, Gemini AI (bank statement analysis)

## What's Been Implemented

### Bank Statement Analysis (Mar 2026)
- ✅ AI-powered bank statement analysis using Gemini 2.5 Flash
- ✅ Support for password-protected PDFs (via pikepdf library)
- ✅ Extracts: Bank name, Account number, ABB, Min/Max balance, Credits/Debits, Salary patterns, Bounces
- ✅ Backend endpoint: POST `/api/loan-leads/analyze-bank-statement-url`
- ✅ Lead-specific endpoint: POST `/api/loan-leads/{lead_id}/profile/analyze-bank-statement`
- ✅ Frontend: Password input field for encrypted PDFs in CustomerProfileModal
- ✅ Results stored in customer_profiles collection

### Credit Report UI (Dec 2025)
- ✅ Customer Details modal: 3 tabs (Customer Info, Vehicles, Documents)
- ✅ Customer Info tab: First Name, Last Name, PAN, DOB, Mobile, Email, Gender, PIN Code
- ✅ Credit Reports column: "Get Report" button + score badge
- ✅ Removed OTP flow - direct bureau fetch via Surepass API
- ✅ 3 bureau support: CIBIL, Equifax, Experian
- ✅ Cached reports loading from database
- ✅ "Fetch Again" dropdown for manual refresh
- ✅ PDF view button

### Credit Report Integration (Dec 2025)
- ✅ CIBIL JSON & PDF endpoints
- ✅ Equifax JSON & PDF endpoints  
- ✅ Experian JSON & PDF endpoints
- ✅ Report storage in `credit_reports` collection
- ✅ History lookup by PAN
- ✅ Loan lead credit score linking
- ✅ **CRIF Integration Removed** (Dec 2025) - Removed at user request

### CustomerDetailsModal Redesign (Dec 2025)
- ✅ Complete UI redesign with modern Shadcn components
- ✅ Customer Info tab: View/Edit mode with First Name, Last Name, PAN, Gender, Mobile, Email
- ✅ Vehicles tab: Add vehicle, Edit loan requirements (valuation, loan amount, EMI, tenure), Vaahan refresh, Delete vehicle
- ✅ Documents tab: Shows 13 document requirements with Upload/View/Delete buttons
- ✅ Quick stats cards showing vehicle count, document count, credit score
- ✅ Fixed API calls: `loansApi.update`, `loansApi.removeVehicle`

### Bug Fixes (Mar 2026)
- ✅ Lead reassignment bug fixed (role_code handling)
- ✅ Second payment/inspection creation bug fixed (webhook idempotency)
- ✅ Customer data sync (phone, city) fixed
- ✅ **Duplicate inspection bug fixed** - Webhook now handles both `payment.captured` and `payment_link.paid` events without creating duplicates
- ✅ **Multi-slot package restoration** - Fixed cleanup script to preserve legitimate multi-inspection packages
- ✅ **Inspections sorting fixed** - Scheduled inspections now sorted by `scheduled_date` + `scheduled_time` descending
- ✅ **Data cleanup for +919830035928** - Fixed from 10 incorrect inspections to 5 correct ones
- ✅ **CRM-Mechanic App Integration Fixed** - Mechanics now only see inspections assigned to them. Unassigned inspections no longer appear in mechanic app.
- ✅ **Unassignment Logic Enhanced** - When mechanic is unassigned, status resets to NEW_INSPECTION (if was ASSIGNED/ACCEPTED/REJECTED) and inspection returns to CRM pool

### Bug Fixes (Dec 2025)
- ✅ Lead city auto-detection (case-insensitive AD ID lookup)
- ✅ Inspection city language fix (English from Google Places API)
- ✅ Customer data repair API enhanced
- ✅ Test-5 customer modal display fix

### Bug Fixes (Mar 7, 2026)
- ✅ **MCQ Answers Display in Q&A Details** - Fixed issue where sub_answer_1 (Dent severity) and sub_answer_2 (Scratch severity) were not displaying in LiveProgressModal Q&A Details tab for photo questions. Now shows as colored badges below photos.
- ✅ **Auto-Repair Detection System** - Implemented complete flow: Mechanic app → Inspections Q&A → Answers → Rules → Repairs display
  - Created 60 new repair rules with `sub_answer_type` field (30 for dent, 30 for scratch)
  - Rules match on severity values: "1-2", "3-4", "4+"
  - Frontend updated to check sub_answer_1/sub_answer_2 for rule matching
  - Repairs tab now shows 40+ auto-detected repairs with correct pricing
- ✅ **Simplified Repair Rules UI** - Streamlined the Conditions & Actions section:
  - "If answer is" dropdown now shows exact answer options from Q&A page (grouped by Dent/Scratch)
  - Removed the "value" text input (selecting exact answers instead)
  - "Then charge" dropdown shows: Repair (Part Cost Only), Labor (Labor Cost Only), Both (Part + Labor), Inspect Further
  - Backend API updated to return sub_options_1 and sub_options_2 from questions
  - Pricing logic updated to handle new action types correctly
- ✅ **Grouped Rules View in Repairs Module** - Reorganized Question Rules table:
  - Rules grouped by **Q&A Categories** (e.g., "Exterior Inspection", "Battery Health Checkup", "Engine Health and Diagnosis", "Air Condition System Check")
  - Within each category, rules grouped by **Question**
  - Each rule displays: Part name, exact answer value, action type (REPAIR/REPLACE/LABOR), status
  - Expand/collapse functionality for categories and questions
  - Search works for category name, part name, question text, and condition value
  - Renamed "Category" to "Component" in Spare Parts section
  - ✅ **VERIFIED (Mar 7, 2026)** - 156 rules across 7+ Q&A categories, tested with testing agent (100% pass rate)
- ✅ **Create Rule Modal Category Filter** - Enhanced rule creation flow (Mar 7, 2026):
  - Added "Inspection Q&A Category" dropdown between Repair Part and Linked Question
  - Category dropdown shows all 23 Q&A categories alphabetically
  - Linked Question dropdown disabled until category is selected
  - Shows "X questions available in this category" helper text
  - Questions filtered by selected category for easier discovery
  - ✅ **VERIFIED** - All 8 features tested and passed (100% success rate)
- ✅ **Save to Master Functionality** - Write-back flow for repairs (Mar 7, 2026):
  - Users can add new custom parts in LiveProgressModal Repairs tab
  - "Save to Master" button appears for unsaved entries
  - New parts are created in spare parts master with pricing
  - Price modifications can be saved back with brand-specific overrides
  - "Custom pricing (not saved to master)" warning for manual overrides
  - ✅ **VERIFIED** - All 15 steps tested and passed (100% success rate)
- ✅ **Report Tab in LiveProgressModal** - Publish & History feature (Mar 7, 2026):
  - New "Report" tab added with Preview Report and Publish Report buttons
  - Preview opens report in new browser tab
  - Publish sends WhatsApp notification to customer with report link
  - **Internal Audit Log** (NOT visible to customers):
    - Renamed from "Publish History" to "Internal Audit Log"
    - Shows 🔒 "Internal Only" warning badge
    - Logs all publishes with timestamps, user, comments
    - Comprehensive change detection: 30+ fields tracked including Customer info, Vehicle details, Conditions, Insurance, RTO, etc.
    - Stores raw old/new values for audit compliance
    - User comments are internal-only notes
  - Stats section shows: Total Publishes count, Last Published date, Status
  - ✅ **VERIFIED** - Backend: 14/14 tests, Frontend: 12/12 features (100% pass rate)
- ✅ **Authenticated Preview Report Page** - CRM Internal Only (Mar 7, 2026):
  - New `/preview-report/:id` route - requires CRM authentication
  - Shows "🔒 INTERNAL PREVIEW" banner with "Back to CRM" button
  - Maps all fields from LiveProgressModal to report format (30+ fields)
  - Field mapping documented in `/app/inspection-report/FIELD_MAPPING.md`
  - Sections: Header, Hero, Assessment Summary, Vehicle Details, Key Info, RTO, OBD, Q&A Details
  - Connected to "Preview Report" button in LiveProgressModal (NOT publish yet)
  - ✅ **VERIFIED** - Report loads with authentication, shows all mapped fields
- ✅ **Preview Report Q&A & OBD Data Display Fix** (Mar 7, 2026):
  - Fixed issue where Q&A categories and OBD data were not displaying on preview report page
  - Added `transformCategoriesToReportFormat()` function to convert backend Q&A format to frontend card format
  - Added `transformObdToReportFormat()` function to convert raw OBD codes to systems/faults format
  - Page now fetches from both `/api/inspections/:id/report` AND `/api/inspections/:id/live-progress`
  - Q&A section shows all 11 categories with expandable cards, ratings, and 53+ checkpoints
  - OBD section correctly displays "No Diagnostic Errors" or fault codes when present
  - ✅ **VERIFIED** - All 6 test cases passed (100% success rate, testing_agent_v3_fork iteration_95)

## Pending Issues (Priority Order)

### P0 - Critical
1. ~~**Lead Reassignment Bug**~~ - FIXED (Mar 2026)
2. ~~**Second Payment Not Creating Inspections**~~ - FIXED (Dec 2025)
3. ~~**MCQ Answers Not Displaying**~~ - FIXED (Mar 7, 2026)
4. ~~**Auto-Repair Detection Not Working**~~ - FIXED (Mar 7, 2026)
5. ~~**Repair Rules Grouping by Q&A Categories**~~ - FIXED & VERIFIED (Mar 7, 2026)

### P1 - High  
1. **Loan Eligibility Frontend** - Backend API ready, need UI integration
2. **Bengaluru Migration** - Awaiting user verification on production
3. **Data Quality Repair** - Need batch repair scripts for historical records

### P2 - Medium
4. **Video Upload** - Critical inspection feature broken
5. **Duplicate Record Cleanup** - Data quality improvement

## Upcoming Tasks
1. Build Loan Eligibility UI in LoansPage
2. PDF export/download button for credit reports
3. Refactor large components (InspectionsPage, LoansPage)
4. Create Charge Types Master page
5. Server.py webhook refactoring
6. Delete old CreditScoreModal.jsx (superseded by CreditRiskDashboard.jsx)

## Technical Debt
- `server.py` - Still contains webhook logic, needs extraction to routes
- `InspectionsPage.jsx` - Over 3,000 lines
- `LoansPage.jsx` - Over 4,000 lines
- `CreditScoreModal.jsx` - ~~Over 1,200 lines~~ REPLACED by CreditRiskDashboard.jsx (Mar 2026)

## Development Guidelines

### ⚠️ CRITICAL: Pre-Deployment Testing Protocol
**Ensure thorough testing of ALL backend changes in preview environment before requesting deployment to production.** This reduces iterations and improves efficiency.

**Testing Checklist Before Deployment:**
1. Verify syntax: `python3 -m py_compile /app/backend/server.py`
2. Test endpoints via curl in preview environment
3. Verify all response fields are correct types (especially strings vs integers)
4. Test with real user scenarios (e.g., mechanic login → fetch inspections)
5. Use debug endpoints to inspect raw data if issues occur

**Why This Matters:**
- Each deployment takes 5-7 minutes
- APK builds take 10 minutes  
- Testing takes 5 minutes
- **Total per iteration: ~22 minutes** → Minimize iterations by thorough preview testing

### Credit Risk Dashboard (Mar 2026)
- ✅ Comprehensive credit risk assessment dashboard replacing old CreditScoreModal
- ✅ Professional UI with Score Gauge visualization
- ✅ Risk assessment badges (LOW/MODERATE/HIGH/CRITICAL)
- ✅ Red Flags section for critical risk indicators (written-off accounts, suit filed, DPD > 90)
- ✅ Multi-bureau support: CIBIL, Equifax, Experian, CRIF
- ✅ Tabbed interface: Overview, Accounts, DPD Analysis, Enquiries, Profile
- ✅ Payment history heatmap visualization
- ✅ Account-level DPD tracking and risk metrics
- ✅ Backend parsers enhanced with written-off count, negative accounts, DPD > 90 tracking
- ✅ Component: `/app/frontend/src/components/loans/CreditRiskDashboard.jsx`

### Recommended Purchase Price (RPP) Feature (Mar 2026)
- ✅ Web scraping service for car prices from: OLX, Spinny, Cars24, CarWale, CarDekho
- ✅ New API endpoint: `POST /api/inspections/{id}/fetch-rpp`
- ✅ Fetches market prices based on: Make, Model, Year, Fuel Type, Transmission, KMs Driven
- ✅ Calculates recommended purchase price (5-10% below market average)
- ✅ Stores results in `market_price_research` field on inspection
- ✅ Frontend: RPP section in LiveProgressModal with "Fetch Market Prices" button
- ✅ Website-wise price breakdown with color-coded cards (CarDekho=orange, CarWale=blue, Cars24=yellow, Spinny=purple, OLX=green)
- ✅ Fallback to depreciation model when web scraping fails
- ✅ Service: `/app/backend/services/car_price_scraper.py`

### Mechanic App UX Improvements (Mar 2026)
- ✅ APK v1.9.2 built with Q&A screen UX fixes
- ✅ Removed automatic navigation back after saving answers
- ✅ Save button disabled during save operation
- ✅ Save button only appears when there are unsaved changes

### Vaahan API Integration (Mar 2026)
- ✅ Complete vehicle RTO data integration via Invincible Ocean Vaahan API
- ✅ Backend endpoint: `POST /api/inspections/{id}/fetch-vaahan-data`
- ✅ Local DB caching to reduce API calls (checks `vehicles` collection first)
- ✅ Force refresh option to bypass cache
- ✅ Auto-fetches when opening Live Progress Modal (if car_number exists and no vaahan_data)
- ✅ Frontend: Vehicle & RTO tab in LiveProgressModal with comprehensive display
- ✅ Data displayed: Engine Number, Chassis Number, Make, Model, Year, Color
- ✅ Technical specs: Engine CC, Cylinders, Seating Capacity, Weight, Wheelbase, Emissions
- ✅ Registration: Mfg Date, Reg Date, RC Expiry, RTO Authority, Owner Count
- ✅ Insurance: Company, Policy Number, Valid Upto, Status (Active/Expired)
- ✅ Finance: Hypothecation status, Financer name, Blacklist status
- ✅ PUCC: Number and validity
- ✅ "Vaahan API Verified" banner with ACTIVE/INACTIVE status indicator
- ✅ All fields editable with save functionality
- ✅ Service: `/app/backend/services/vaahan_service.py`
- ✅ Credentials: VAAHAN_CLIENT_ID and VAAHAN_SECRET_KEY in backend/.env

### AI Analysis & Editable Ratings (Mar 2026)
- ✅ Editable category ratings (0-10) in Q&A Details tab
- ✅ Ratings auto-populate "Condition Ratings" section in AI Analysis tab
- ✅ Condition mapping: 0-3 = Poor, 4-6 = Average, 7-10 = Good
- ✅ Categories: Engine, Exterior, Interior, Transmission

### Inspections Page UI Refactor (Mar 2026)
- ✅ Merged "Edit" and "Mechanic" columns into "MECHANIC & EDIT" column
- ✅ Combined modal with compact 2-column layout (no scrolling)

## API Endpoints

### Recommended Purchase Price (RPP)
```
POST /api/inspections/{id}/fetch-rpp  - Fetch market prices from OLX, Spinny, Cars24, CarWale, CarDekho
```

### Vaahan API (Vehicle RTO Data)
```
POST /api/inspections/{id}/fetch-vaahan-data  - Fetch vehicle details from Vaahan API (with local DB caching)
  - Query param: force_refresh=true to bypass cache
  - Returns: vaahan_data with engine_number, chassis_number, owner details, insurance, finance status
```

### Bank Statement Analysis
```
POST /api/loan-leads/analyze-bank-statement-url  - Analyze PDF from URL (with password support)
POST /api/loan-leads/{lead_id}/profile/analyze-bank-statement - Analyze uploaded document
```

### Credit Reports
```
POST /api/credit-report/cibil        - CIBIL JSON
POST /api/credit-report/cibil/pdf    - CIBIL PDF
POST /api/credit-report/equifax      - Equifax JSON  
POST /api/credit-report/equifax/pdf  - Equifax PDF
POST /api/credit-report/experian     - Experian JSON
POST /api/credit-report/experian/pdf - Experian PDF
POST /api/credit-report/crif         - CRIF Commercial JSON
POST /api/credit-report/crif/pdf     - CRIF Commercial PDF
GET  /api/credit-report/check-status - Service status
GET  /api/credit-report/history/{pan} - PAN history
GET  /api/credit-report/{report_id}  - Get specific report
GET  /api/credit-report/latest/{pan} - Get all cached reports for PAN
```

## 3rd Party Integrations
- **Surepass:** Credit reports (production token)
- **Gemini AI:** Bank statement analysis (via Emergent LLM Key)
- **Firebase:** Media storage
- **Meta Ads:** Lead sync
- **Razorpay:** Payments
- **Twilio:** WhatsApp messaging
- **Vaahan API (Invincible Ocean):** Vehicle RTO data (chassis, engine, insurance, finance status)

## Production Database
```
MONGO_URL: mongodb+srv://autocrm-stage:d689l8clqs2c73cm8mg0@customer-apps.c5ddpr.mongodb.net/?appName=vehicle-inspect-39&maxPoolSize=5&retryWrites=true&timeoutMS=10000&w=majority
DB_NAME: autocrm-stage-test_database
```
**Note:** Preview environment uses local MongoDB. Use the above credentials to access production data for debugging.

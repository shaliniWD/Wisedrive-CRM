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

## Pending Issues (Priority Order)

### P0 - Critical
1. ~~**Lead Reassignment Bug**~~ - FIXED (Mar 2026)
2. ~~**Second Payment Not Creating Inspections**~~ - FIXED (Dec 2025)
3. ~~**MCQ Answers Not Displaying**~~ - FIXED (Mar 7, 2026)

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

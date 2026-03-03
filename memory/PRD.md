# WiseDrive CRM - Product Requirements Document

## Original Problem Statement
The application is a full-stack CRM for vehicle loans and inspections. Key features include:
- Lead management from Meta Ads
- Vehicle inspection scheduling and reporting
- Loan application processing
- Customer management
- Credit report integration (CIBIL, Equifax, Experian, CRIF via Surepass)
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
- ✅ 4 bureau support: CIBIL, Equifax, Experian, CRIF
- ✅ Cached reports loading from database
- ✅ "Fetch Again" dropdown for manual refresh
- ✅ PDF view button

### Credit Report Integration (Dec 2025)
- ✅ CIBIL JSON & PDF endpoints
- ✅ Equifax JSON & PDF endpoints  
- ✅ Experian JSON & PDF endpoints
- ✅ CRIF Commercial JSON & PDF endpoints (scope blocked by Surepass)
- ✅ Report storage in `credit_reports` collection
- ✅ History lookup by PAN
- ✅ Loan lead credit score linking

### Bug Fixes (Mar 2026)
- ✅ Lead reassignment bug fixed (role_code handling)
- ✅ Second payment/inspection creation bug fixed (webhook idempotency)
- ✅ Customer data sync (phone, city) fixed
- ✅ **Duplicate inspection bug fixed** - Webhook now handles both `payment.captured` and `payment_link.paid` events without creating duplicates
- ✅ **Multi-slot package restoration** - Fixed cleanup script to preserve legitimate multi-inspection packages
- ✅ **Inspections sorting fixed** - Scheduled inspections now sorted by `scheduled_date` + `scheduled_time` descending
- ✅ **Data cleanup for +919830035928** - Fixed from 10 incorrect inspections to 5 correct ones

### Bug Fixes (Dec 2025)
- ✅ Lead city auto-detection (case-insensitive AD ID lookup)
- ✅ Inspection city language fix (English from Google Places API)
- ✅ Customer data repair API enhanced
- ✅ Test-5 customer modal display fix

## Pending Issues (Priority Order)

### P0 - Critical
1. ~~**Lead Reassignment Bug**~~ - FIXED (Mar 2026)
2. ~~**Second Payment Not Creating Inspections**~~ - FIXED (Dec 2025)

### P1 - High  
1. **Loan Eligibility Frontend** - Backend API ready, need UI integration
2. **Bengaluru Migration** - Awaiting user verification on production
3. **Data Quality Repair** - Need batch repair scripts for historical records

### P2 - Medium
4. **CRIF Scope** - Blocked by Surepass (needs scope enabled by provider)
5. **Video Upload** - Critical inspection feature broken
6. **Duplicate Record Cleanup** - Data quality improvement

## Upcoming Tasks
1. Build Loan Eligibility UI in LoansPage
2. PDF export/download button for credit reports
3. Refactor large components (InspectionsPage, LoansPage, CreditScoreModal)
4. Create Charge Types Master page
5. Server.py webhook refactoring

## Technical Debt
- `server.py` - Still contains webhook logic, needs extraction to routes
- `InspectionsPage.jsx` - Over 3,000 lines
- `LoansPage.jsx` - Over 4,000 lines
- `CreditScoreModal.jsx` - Over 1,200 lines

## API Endpoints

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

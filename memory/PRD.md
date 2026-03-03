# WiseDrive CRM - Product Requirements Document

## Original Problem Statement
The application is a full-stack CRM for vehicle loans and inspections. Key features include:
- Lead management from Meta Ads
- Vehicle inspection scheduling and reporting
- Loan application processing
- Customer management
- Credit report integration (CIBIL, Equifax, Experian, CRIF via Surepass)

## Core Architecture
- **Frontend:** React with Shadcn/UI components
- **Backend:** FastAPI with MongoDB
- **Database:** MongoDB (production dump restored)
- **External APIs:** Surepass (credit reports), Meta Ads, Razorpay, Firebase

## What's Been Implemented

### Credit Report Integration (Dec 2025)
- ✅ CIBIL JSON & PDF endpoints
- ✅ Equifax JSON & PDF endpoints  
- ✅ Experian JSON & PDF endpoints
- ✅ CRIF Commercial JSON & PDF endpoints (scope blocked by Surepass)
- ✅ Report storage in `credit_reports` collection
- ✅ History lookup by PAN
- ✅ Loan lead credit score linking

### Bug Fixes (Dec 2025)
- ✅ Lead city auto-detection (case-insensitive AD ID lookup)
- ✅ Inspection city language fix (English from Google Places API)
- ✅ Customer data repair API enhanced
- ✅ Test-5 customer modal display fix

## Pending Issues (Priority Order)

### P0 - Critical
1. **Lead Reassignment Bug** - Role lookup failing, shows empty `role_code`

### P1 - High  
2. **Credit Report Frontend UI** - No UI to trigger/view reports
3. **Loan Eligibility Frontend** - Backend ready, no UI
4. **Bengaluru Migration** - Awaiting user verification

### P2 - Medium
5. **Equifax Scope** - Blocked by Surepass verification
6. **CRIF Scope** - Blocked by Surepass (needs scope enabled)
7. **Video Upload** - Critical inspection feature broken
8. **Duplicate Record Cleanup** - Data quality

## Upcoming Tasks
1. Build Credit Report UI in Loans/Customer page
2. PDF export/download for credit reports
3. Refactor large components
4. Create Charge Types Master page

## Technical Debt
- `server.py` - Still very large, needs webhook extraction
- `InspectionsPage.jsx` - Over 3,000 lines
- `LoansPage.jsx` - Over 4,000 lines

## API Endpoints (Credit Reports)
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
```

## 3rd Party Integrations
- **Surepass:** Credit reports (production token)
- **Firebase:** Media storage
- **Meta Ads:** Lead sync
- **Razorpay:** Payments
- **Twilio:** WhatsApp messaging

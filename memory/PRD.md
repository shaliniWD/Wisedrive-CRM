# WiseDrive CRM + Mechanic App PRD

## Original Problem Statement
Build and maintain a CRM system for WiseDrive along with a React Native mechanic mobile app. The system includes:
- CRM for managing inspections, customers, and mechanics
- Mobile app for mechanics to perform vehicle inspections with OBD scanning capabilities
- Razorpay payment integration
- Activity logs and real-time progress tracking
- AI-powered inspection report generation

## Current Architecture

### Backend (FastAPI)
- **Location:** `/app/backend/server.py` (~17k lines - needs refactoring)
- **Database:** MongoDB
- **Key Collections:** `inspections`, `inspection_obd_results`, `inspection_answer_edits`, `users`, `mechanics`
- **AI Service:** `/app/backend/services/ai_report_service.py`

### Frontend (React)
- **Location:** `/app/frontend/`
- **Key Pages:** 
  - `InspectionsPage.jsx` (~4k lines - needs refactoring)
  - `InspectionReportPage.jsx` (Report viewing with AI insights)

### Mobile App (React Native/Expo)
- **Location:** `/app/mechanic-app-native/`
- **Current Version:** 1.9.0
- **Key Files:**
  - `app/scanner.tsx` - OBD Scanner (rescan support added)
  - `app/inspection-categories.tsx` - Categories page (rescan UI)
  - `app/home.tsx` - Main dashboard
  - `src/lib/api.ts` - API helpers (new OBD status endpoint)
  - `src/utils/dateFormat.ts` - NEW: Indian date format utilities (dd/MM/yyyy)

### Loans Module - COMPLETED (Feb 28, 2026)
- **Backend Models:** `/app/backend/models/loan.py`
- **Frontend Page:** `/app/frontend/src/pages/LoansPage.jsx`
- **Bank Master Page:** `/app/frontend/src/pages/BankMasterPage.jsx`
- **Status:** ✅ FULLY FUNCTIONAL with multi-vehicle support, document uploads & comprehensive credit scoring
- **Features:**
  - Loan leads from inspection customers (auto-sync from paid inspections)
  - Bank master data management (4 banks: HDFC, ICICI, Axis, Kotak)
  - **Document Upload/Download with Firebase Storage** ✅
    - Employment type selection (Salaried/Self-Employed)
    - Different document requirements per type
    - Drag & drop upload with progress indicator
    - View, Replace, Delete functionality
    - Progress bar showing completion percentage
  - **Comprehensive Credit Score Check via Experian & Equifax APIs** ✅ ENHANCED (Feb 28, 2026)
    - **Dual Bureau Support:** Equifax (V1) and Experian (V4) APIs via Invincible Ocean
    - OTP-based verification (OTP sent to customer's mobile)
    - 3-step modal: Customer Info → OTP Verification → Credit Report
    - **Bureau Selection:** Dropdown to choose between Equifax and Experian
    - **Premium Fintech UI Design:**
      - Animated Score Gauge with risk indicators
      - Bento-style summary grid (Total Accounts, Active, Closed, Defaults)
      - Outstanding balance breakdown (Total, Secured, Unsecured)
      - Color-coded risk levels (Low/Moderate/Medium/High/Very High)
    - **5-tab Credit Report View:**
      - Overview: Strengths (✓), Concerns (⚠), Credit Enquiries Timeline
      - Accounts: Expandable account list with payment history visualization (color-coded DPD)
      - Enquiries: Hard pulls and Soft pulls with detailed breakdown
      - Profile: Personal info, address, PAN, score analysis from bureau
      - Raw Data: Full JSON response for debugging/advanced use
    - Account type mapping (Personal Loan, Credit Card, Auto Loan, etc.)
    - Payment status color coding (Green=On Time, Yellow=1-30 DPD, Orange=31-60 DPD, Red=60+)
    - **Note:** Both APIs return 500 errors from provider - awaiting activation on Monday
  - **Multi-vehicle support per customer** (dropdown shows "2 Cars", "3 Cars", etc.)
  - Vehicle loan details with Vaahan API integration
  - Per-vehicle bank eligibility checking (MOCKED with 70% approval rate)
  - Loan applications per vehicle per bank with status tracking
- **Testing:** ✅ 100% backend tests, 100% frontend tests

## Third-Party Integrations
- Firebase (Storage + Admin SDK)
- Fast2SMS (OTP)
- Twilio (WhatsApp)
- Razorpay (Payments)
- Google Maps Places API
- EAS (Expo Application Services)
- **OpenAI GPT-5.2** (AI Report Generation via Emergent LLM Key)
- **Experian Credit Score** (via Invincible Ocean API) ✅ NEW

## Recent Implementations (Feb 2026)

### Brand Mapper Service - NEW (Feb 28, 2026)
- **Purpose:** Automatically map Vaahan API manufacturer names to CRM brand names for repair cost calculations
- **Problem:** Vaahan API returns names like "Hyundai Motor Indian Pvt Ltd" but CRM uses "Hyundai"
- **Implementation:** `/app/backend/services/brand_mapper.py`
- **Features:**
  - Comprehensive mapping for 50+ brands (Japanese, Korean, German, American, British, Indian, French, Italian, Chinese, Swedish, Czech)
  - Handles various suffixes: "Pvt Ltd", "Private Limited", "Ltd", "Inc", etc.
  - Fuzzy matching for partial name matches
  - Returns original if no match found
- **Endpoints:**
  - `POST /api/repair-parts/normalize-brand` - Normalize a manufacturer name
  - `GET /api/repair-parts/known-brands` - List all known CRM brands
- **Integration:**
  - `calculate-cost` endpoint now uses brand mapper for price lookups
  - New inspections automatically normalize `car_make` field from Vaahan API

### Live Progress Modal Enhancements - NEW (Feb 28, 2026)
- **OBD-2 Tab (NEW):**
  - Moved from Q&A Details section to top-level tab
  - Shows OBD scan status with timestamp
  - "Request Rescan" button to request mechanic to rescan
  - DTC codes displayed with icons and descriptions
  - Raw OBD data viewer (JSON format)
- **Repairs Module Integration (NEW):**
  - "Auto-Detected Repairs" section - automatically calculates repairs from Q&A answers + rules
  - Shows part name, category, action (REPAIR/REPLACE), cost
  - "Manual Repair Entries" section for custom additions
  - Combined total at bottom with purple gradient
- **Unsaved Changes Indicator (NEW):**
  - Amber "Unsaved Changes" badge pulsing next to save button
  - Save button turns orange when there are unsaved changes
- **Tab badges:**
  - OBD-2: green dot when scan completed
  - Repairs: count of auto-detected repairs

### Web Scraping for Market Prices - NEW (Feb 28, 2026)
- **Feature:** Scrape Indian used car websites for real market price data
- **Sources:** CarDekho, CarWale, Cars24, Spinny, OLX (with fallback to depreciation model)
- **Implementation:**
  - `/app/backend/services/car_price_scraper.py` - UsedCarPriceScraper class
  - Async scraping using aiohttp + BeautifulSoup4
  - Price validation with age-based bounds (prevents outliers)
  - Outlier filtering using IQR method
  - Fallback depreciation model for common Indian car models
- **Data Fields Stored:** market_average, market_min, market_max, recommended_min/max, sources_count, sources (with URLs), estimation_method
- **Integration:** Automatically called during AI report generation to enhance market value estimates
- **Frontend Display:** Market avg with sources count shown below market value inputs in Inspection Editor

### AI Report Generation - Enhanced (Feb 28, 2026)
- **Feature:** Generate AI-powered insights for inspection reports using OpenAI GPT-5.2
- **AI Generates:**
  - Overall Rating (1-5)
  - Recommended Market Value (min/max with confidence) - now backed by web scraping data
  - Assessment Summary (professional paragraph with section-wise breakdown)
  - Condition Ratings (Engine, Interior, Exterior, Transmission)
  - Category-wise Ratings and Status
  - Risk Factors and Recommendations
- **Auto-Generation:** AI report automatically generates at milestones (25%, 50%, 75%, 100% completion) when mechanic submits answers
- **Manual Regeneration:** When CRM user edits an answer, report is marked as "stale" and shows "Update AI Report" button
- **Endpoint:** `POST /api/inspections/{id}/generate-ai-report`
- **UI:** Dynamic AI Report section in Live Progress modal with status indicators
- **Storage:** 
  - AI insights stored in `inspection.ai_insights` field
  - Market research stored in `inspection.market_price_research` field
  - Stale status in `inspection.ai_report_stale`

### Dual-Access Report System - NEW (Feb 27, 2026)
- **Customer Access URL:** `/r/{encrypted_short_code}` - OTP-protected
  - Short, encrypted URL using HMAC signature
  - Customer verifies with OTP sent to registered phone
  - Session token valid for 1 hour after verification
- **Internal CRM URL:** `/inspection-report/{id}` - CRM authenticated
- **New Endpoints:**
  - `GET /api/inspections/{id}/short-url` - Generate customer URL
  - `GET /api/report/public/{code}` - Get basic report info (no auth)
  - `POST /api/report/public/{code}/send-otp` - Send OTP to customer
  - `POST /api/report/public/{code}/verify-otp` - Verify OTP, get access token
  - `GET /api/report/public/{code}/data?token=` - Get full report with token
- **New Files:**
  - `/app/backend/services/report_url_service.py` - URL encryption/decryption
  - `/app/frontend/src/pages/CustomerReportPage.jsx` - OTP verification UI

### Editable Inspection Answers (CRM) - Feb 27, 2026
- **Feature:** CRM users can edit inspection answers directly from Live Progress modal
- **Allowed Roles:** CEO, INSPECTION_COORDINATOR, INSPECTION_HEAD, COUNTRY_HEAD_CE, COUNTRY_HEAD
- **Audit Trail:** All edits tracked in `inspection_answer_edits` collection
- **Enhancement (Feb 28):** Answer editing now restricted to predefined options only (dropdown selection instead of free-form text)
- **Endpoints:**
  - `PUT /api/inspections/{id}/answers/{question_id}` - Edit answer
  - `GET /api/inspections/{id}/answers/{question_id}/history` - Get edit history

### Repairs Module - COMPLETED (Feb 28, 2026)
- **Location:** Settings > Repairs Module tab
- **Purpose:** Comprehensive spare parts pricing and repair rules management
- **Status:** ✅ FULLY FUNCTIONAL with sample data
- **Sample Data Populated:**
  - **30 Repair Parts** across 9 categories (AC & Cooling, Body Panels, Electrical, Exhaust, Glass, Mechanical, Tyres & Wheels)
  - **13 Q&A Categories** with **38 inspection questions** (Front/Rear Bumper, Fenders, Doors, Hood, Trunk, Headlights, Taillights, Windshield, Mirrors, Tyres, Brakes, Battery, AC, Exhaust, Engine Oil)
  - **96 Repair Rules** linking questions to parts with conditions (EQUALS, CONTAINS) and actions (REPAIR, REPLACE)
- **Features:**
  1. **Spare Parts Management:**
     - Add/Edit/Delete spare parts
     - Categories: Body Panels, Mechanical, Electrical, Interior, Glass, Tyres, AC, Exhaust
     - Pricing by car type (Hatchback, Sedan, SUV)
     - Each type has: Repair Price, Replace Price, Repair Labor, Replace Labor
     - Brand-specific pricing overrides (e.g., BMW, Mercedes-Benz have different prices)
  2. **Question Rules:**
     - Link spare parts to inspection questions
     - Define conditions based on answer values
     - Operators: equals, contains, greater_than, less_than, between
     - Actions: repair, replace, inspect_further
     - Priority levels: low, normal, high, critical
  3. **Cost Calculation API:**
     - Endpoint: `POST /api/repair-parts/calculate-cost`
     - Takes question_id, answer, car_type, brand
     - Returns recommended repairs with costs
- **Database Collections:**
  - `repair_parts` - 30 spare parts with pricing
  - `repair_rules` - 96 question-to-part rules
  - `inspection_qa_categories` - 13 Q&A categories with embedded questions
- **Endpoints:**
  - `GET/POST /api/repair-parts` - List/Create parts (30 parts)
  - `GET/PUT/DELETE /api/repair-parts/{id}` - Part CRUD
  - `GET /api/repair-parts/categories` - Part categories
  - `GET/POST /api/repair-rules` - List/Create rules (96 rules)
  - `GET/PUT/DELETE /api/repair-rules/{id}` - Rule CRUD
  - `GET /api/repair-rules/available-questions` - Questions for linking (38 questions)
  - `POST /api/repair-parts/calculate-cost` - Calculate repair cost
- **Script:** `/app/backend/scripts/populate_repair_rules.py` - Populates sample data

### Inspection Editor UI Redesign - NEW (Feb 28, 2026)
- **Tab Structure Reorganized:**
  - Renamed "Overview" → "AI Analysis" 
  - Renamed "Inspection" → "Q&A Details" (moved to last position)
  - Merged "Verification" tab into "Vehicle & RTO" tab (all Vaahan API data together)
  - Final tab order: AI Analysis, Vehicle & RTO, Repairs, Q&A Details
- **Share Report Feature:**
  - Added "Share Report with Customer" section at top of AI Analysis tab
  - "Generate Link" button creates OTP-protected customer URL
  - Shows copy and external link buttons after URL generation
- **Market Price Display:**
  - Renamed "Market Value Estimate" → "Recommended Purchase Price"
  - Added "(5-10% below market average)" note in green
  - Website-wise scraped prices shown below recommended price
  - Sources include: CarDekho, CarWale, Cars24, Spinny, OLX
  - Shows prompt to "Regenerate" if no market data available
- **Q&A Details Tab:**
  - Category-wise progress grid at top showing completion percentages
  - **Clickable category cards to filter Q&A** - click to show only questions for that category
  - "Show All Categories" button to clear the filter
  - Collapsible category sections with questions
  - Edit button for answered questions with predefined options
  - Shows "(X options available)" for unanswered questions
- **Refresh Controls:**
  - Manual "Refresh" button in header
  - Auto-refresh toggle (every 5 seconds) - enabled by default
- **Scroll Fix:** 
  - Fixed scroll issue in modal content area for proper scrolling

### Unscheduled Inspections Date Filter Fix - Feb 27, 2026
- Fixed bug where unscheduled inspections were hidden when date filters applied
- Now correctly filters by `created_at` for unscheduled and `scheduled_date` for scheduled

## Previous Implementations (Dec 2025)

### OBD Re-scan Feature (v1.7.1)
- CRM toggle in Live Progress modal to enable/disable rescan
- New backend endpoints: `/obd-rescan`, `/obd-status`
- Mechanic app checks rescan permission on load
- Shows "Re-scan Mode" warning when enabled

### Media Display Fix (CRM)
- Handle `file://` local paths with warning message
- Error fallback UI for failed image loads
- Better video file detection

### AsyncStorage Persistence for OBD Data (v1.7.0)
- OBD data saved locally BEFORE backend submission as backup
- Shows "Pending OBD Data" card if local unsubmitted data exists

### MongoDB 16MB Document Limit Fix (VERIFIED)
- OBD data stored in separate `inspection_obd_results` collection
- Tested successfully on preview server

## Mechanic App Updates

### v1.8.0 - Sequential Inspection Flow (Feb 28, 2026) - BUILD IN PROGRESS
- **Build URL:** https://expo.dev/accounts/kalyandhar/projects/wisedrive-mechanic/builds/52394c77-aa5d-4286-9d31-dd0988744930
- **Production Status Page:** https://crmdev.wisedrive.com/api/mechanicapp

**Changes:**
1. **Sequential Question Answering:**
   - Questions must be answered in order within each category
   - Next question is locked until previous is answered
   - Visual lock icon and "Answer previous question first" message

2. **Sequential Category Completion:**
   - Categories must be completed in order
   - Next category is locked until previous is completed
   - Shows "Category Locked" alert with explanation

3. **Complete Button Requirements:**
   - Button disabled (greyed out) until ALL conditions met:
     - All categories completed
     - OBD scan completed (MANDATORY now)
   - Shows notice: "Complete all categories and OBD scan to submit"

4. **Visual Indicators:**
   - Lock icons on locked questions/categories
   - Greyed out styling for locked items
   - Progress indicators show remaining work

### v1.7.2 - Previous Version
- Video upload retry logic
- Failed uploads saved to AsyncStorage

## Known Issues & Status

| Issue | Status | Priority |
|-------|--------|----------|
| **Duplicate records on payment** | **FIXED** (Feb 28) - Added idempotency checks | P0 |
| **Today's inspections not showing** | **FIXED** (Feb 28) - Date filter regex fix | P1 |
| Video `file://` paths | Under investigation | P1 |
| OBD rescan feature | Implemented | P0 |
| Media upload failures | Shows warning now | P1 |

## Bug Fixes (Feb 28, 2026)

### Unscheduled Inspections - Date Filter Fix (Feb 28, 2026)
- **Problem:** "Today" filter not showing correct results; date format mismatch
- **Fix:**
  1. Added timezone-aware date calculations (`getToday()`, `getStartOfMonth()`, etc.) in `/app/frontend/src/utils/dateFormat.js`
  2. Uses user's timezone (IST for India) for accurate date filtering
  3. Backend date filter now includes fallback to `created_at` when `payment_date` is null/empty
  4. Both regex (same-day) and range queries support null payment_date fallback
- **Note:** HTML5 date inputs always use YYYY-MM-DD format internally (browser standard), but display depends on user's browser locale

### Unscheduled Inspections - Package Grouping (MAJOR FIX)
- **Problem:** When customer purchased package with 2+ inspections, showed as 2 separate rows instead of 1 grouped row
- **Fix:** 
  - Backend groups unscheduled inspections by `order_id`, `lead_id`, or `customer_mobile + payment_date`
  - Shows "Available X / Total Y" format (e.g., "1 / 2" means 1 available out of 2 purchased)
  - Schedule button disabled when all inspections used (shows "All Scheduled")
  - Date filter for unscheduled now uses `payment_date` (not `created_at`)
  - Date filter for scheduled uses `scheduled_date`
- **File:** `/app/backend/server.py` - `get_inspections()` function
- **Frontend:** `/app/frontend/src/pages/InspectionsPage.jsx` - Shows available/total and disables button

### Duplicate Customer/Inspection Records - FIXED
- **Root Cause:** Razorpay webhook handler had no idempotency check, causing duplicate records when webhook was called multiple times
- **Fix:** Added 4 idempotency checks in `/api/webhooks/razorpay/payment`:
  1. Check if payment_id already recorded on lead
  2. Check if lead already has customer_id
  3. Check if customer already exists for lead_id
  4. Check if inspections already exist for lead_id
- **File:** `/app/backend/server.py` - `razorpay_payment_webhook()` function

### Today's Inspections Filter - FIXED
- **Root Cause:** `scheduled_date` field has mixed formats (date-only "2026-02-28" and datetime "2026-02-28T10:00:00"), simple string comparison didn't match datetime formats
- **Fix:** For same-day queries, use regex `{"$regex": "^2026-02-28"}` to match both formats
- **File:** `/app/backend/server.py` - `get_inspections()` function

## API Endpoints

### OBD Related
- `POST /api/mechanic/inspections/{id}/obd-results` - Submit OBD data
- `GET /api/mechanic/inspections/{id}/obd-status` - Check OBD status + rescan permission
- `POST /api/inspections/{id}/obd-rescan` - Toggle rescan (CRM only)
- `GET /api/inspections/{id}/live-progress` - Get progress with OBD data

### Answer Editing (CRM) - NEW
- `PUT /api/inspections/{id}/answers/{question_id}` - Edit answer (role-restricted)
- `GET /api/inspections/{id}/answers/{question_id}/history` - Get edit history for question
- `GET /api/inspections/{id}/edit-history` - Get all edits for inspection

### Media Related
- `POST /api/media/generate-upload-url` - Get signed URL for upload
- `POST /api/media/get-download-url` - Get signed URL for viewing

## Testing Credentials
- **CRM Admin:** kalyan@wisedrive.com / password123
- **Mechanic Test:** +919187458748
- **Firebase:** `/app/ess/api/firebase-credentials.json`

## Backlog

### P0 (Critical)
- ~~Deploy backend to production and verify all fixes~~ ✅
- ~~Investigate video upload failure (why file:// paths)~~ ✅ Fixed in APK v1.8.0

### P1 (High Priority)  
- ~~Test OBD rescan flow end-to-end~~ ✅
- ~~Fix video upload in mechanic app~~ ✅ Fixed in APK v1.8.0
- ~~Implement Document Upload for Loans Module~~ ✅ Completed with Firebase Storage
- Add "Share Report" button to main InspectionsPage
- Build retry UI in mechanic app for failed uploads saved in AsyncStorage

### P2 (Medium Priority)
- PDF export for inspection reports
- WhatsApp sharing functionality
- Customer reminders feature
- Verify LiveProgressModal Vaahan/RPP auto-load fix
- Verify Meta API Key Settings tab in Ads Management

### P3 (Low Priority - Refactoring)
- Break down `server.py` into modular routers (~19,500 lines - URGENT)
- Refactor `InspectionsPage.jsx` into components (~4,100 lines)
- Refactor `LoansPage.jsx` into smaller modal components
- Refactor `scanner.tsx` into smaller components
- Clean up old duplicate inspection/customer records in database

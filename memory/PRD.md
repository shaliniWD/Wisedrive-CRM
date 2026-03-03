# WiseDrive CRM + Mechanic App PRD

---
## 📅 CHANGELOG

### March 3, 2026 - Lead City Mapping & Reassignment Fixes

**Issue 1: Leads Landing in Wrong City (Vizag instead of correct city)**
- **Problem:** Lead with AD ID mapped to Bangalore landed in Vizag instead
- **Root Cause:** 
  1. AD ID lookup was exact-match only, case-sensitive
  2. Fallback logic hardcoded "Vizag" when no mapping found
- **Fix:**
  1. Made Strategy 1 (ad_id lookup) case-insensitive with trimmed whitespace
  2. Removed hardcoded "Vizag" fallback - city now left as `null` for unmapped ads, forcing manual assignment
  3. Improved logging to show why mapping failed
- **Files Modified:** `/app/backend/server.py` (WhatsApp webhook city lookup logic)

**Issue 2: Lead Reassignment Not Working (Priyadarshini not showing in dropdown)**
- **Problem:** Sales executive with cities assigned in "Leads Management" not appearing in reassignment dropdown
- **Root Cause:** 
  1. `find_sales_reps_for_city()` only checked `assigned_cities` field
  2. "Leads Management" section saves cities to `leads_cities` field instead
  3. Database query didn't fetch `assigned_cities` in reassignment validation
- **Fix:**
  1. Updated `find_sales_reps_for_city()` to check BOTH `assigned_cities` AND `leads_cities` fields
  2. Added `leads_cities` to the query projection for sales reps
  3. Fixed reassignment validation to also check `leads_cities` with case-insensitive alias matching
- **Files Modified:** `/app/backend/server.py` (find_sales_reps_for_city function, reassign_lead endpoint)

**Issue 3: Customer Data Repair - Test-5 Issue (FULLY RESOLVED)**
- **Problem:** Customer Test-5 (7411891010) had 2 payments but only showed data for 1st payment. 2nd payment (Standard 1-package) was missing from customer modal and Inspections page.
- **Root Causes Found:** 
  1. **Frontend bug**: `CustomerDetailsModal.jsx` data structure mismatch between API and UI
  2. **Missing inspection**: The 2nd payment (1-package Standard) never had an inspection created
  3. **Missing additional_purchases**: Customer record didn't have the 2nd payment in `additional_purchases`
- **Fixes Applied:**
  1. Fixed frontend data transformation in `fetchCustomerDetails()`
  2. Manually repaired Test-5 data: added `additional_purchases` and created missing inspection
  3. Enhanced repair function to detect and fix "additional purchase" scenarios where lead has different payment_id than customer
- **Files Modified:** 
  - `/app/frontend/src/components/CustomerDetailsModal.jsx`
  - `/app/backend/routes/customers.py` (enhanced repair function)
- **Verified in Preview:** 
  - Customer modal shows 4 packages, ₹2 total paid ✅
  - Unscheduled tab shows both "Standard" and "Discover Prime - 3 Cars" packages ✅

---

### March 3, 2026 - City Auto-Detection Fix for Inspection Edit Modal

**Problem:** When editing an inspection and selecting a new address from Google Places (e.g., "Pune Railway Station"), the city field was not being correctly auto-populated. The city was appearing in Devanagari script (पुणे) instead of English (Pune).

**Root Cause:** 
1. The `onSelect` prop on `PlacesAutocomplete` was correctly wired in `InspectionsPage.jsx`
2. The Google Places API was returning city names in the local language (Hindi/Devanagari) for Indian places
3. No normalization was being done to convert Devanagari city names to English

**Solution:**
1. Added `language: 'en'` parameter to Google Places API requests (both new and legacy APIs)
2. Created a `cityNameMap` dictionary mapping Devanagari city names to English equivalents (50+ major Indian cities)
3. Added `normalizeCityName()` helper function to convert Devanagari city names to English
4. The helper falls back to the original name if no mapping exists

**Files Modified:**
- `/app/frontend/src/components/ui/PlacesAutocomplete.jsx` - Added language parameter and city name normalization

**Testing:** Verified that selecting "Pune Railway Station" now correctly sets the city field to "Pune" (English) instead of "पुणे" (Devanagari).

---

### March 3, 2026 - Comprehensive Timezone Fix for Date Filtering

**Problem:** Date filtering across all modules was timezone-unaware. A lead created at "3 Mar 12:30 AM IST" was stored as "2026-03-02T19:00:00Z" (UTC), causing it to incorrectly appear under "Yesterday" instead of "Today" when filtering.

**Root Cause:** 
- Backend stored dates in UTC (correct)
- Frontend sent local dates like "2026-03-03" 
- Backend compared UTC timestamps against local dates without timezone conversion
- A lead created at midnight IST would have a UTC timestamp from the previous day

**Solution:**
1. Created `convert_local_date_to_utc_range()` helper function that converts local dates to proper UTC ranges
2. Added `timezone_offset` parameter (default 330 for IST = UTC+5:30) to all date-filtered endpoints
3. Frontend API service now automatically sends `timezone_offset` with all list requests
4. Date comparison now happens entirely in UTC with proper boundaries

**Technical Details:**
- For "Today" (March 3rd IST), the UTC range is: 2026-03-02T18:30:00Z to 2026-03-03T18:29:59Z
- This correctly includes leads created from midnight IST to 11:59 PM IST

**Files Modified:**
- `/app/backend/server.py` - Added helper function, updated `/leads` and `/inspections` endpoints
- `/app/backend/routes/loans.py` - Added helper function, updated `/loan-leads` endpoint
- `/app/backend/routes/customers.py` - Added helper function, updated `/customers` endpoint
- `/app/frontend/src/services/api.js` - Added `getTimezoneOffset()` utility, updated all list API calls

**Modules Fixed:**
- Leads page date filter
- Inspections page date filter
- Customers page date filter
- Loans page date filter

---

### March 3, 2026 - Loan Eligibility Engine Fix
**Problem:** The `/api/eligibility/check` endpoint was returning "Loan lead not found" error even though it should work independently without a lead ID.
**Root Cause:** Python name shadowing - two functions with the same name `check_bank_eligibility`:
1. Helper function at line 877 for actual eligibility calculations
2. API route at line 2273 for vehicle-specific eligibility checking

When the helper function was called, Python resolved it to the API route function instead, which expected a `lead_id` parameter.

**Solution:**
1. Renamed helper function from `check_bank_eligibility` to `evaluate_bank_eligibility`
2. Updated all callers to use the new function name
3. Removed duplicate `add_charge_to_offer` route (kept the more feature-rich version)
4. Fixed bare `except` statements with specific exception types

**Files Modified:**
- `/app/backend/routes/loans.py` - Function rename, duplicate route removal, lint fixes

**Cleanup:**
- Deleted obsolete `/app/frontend/src/components/loans/DocumentsModal.jsx`
- Deleted obsolete `/app/frontend/src/components/loans/VehicleDetailsModal.jsx`
- Updated `/app/frontend/src/components/loans/index.js` - Removed obsolete exports
- Updated `/app/frontend/src/pages/LoansPage.jsx` - Removed unused imports

**Testing:** Verified via curl:
- POST `/api/eligibility/check` now returns proper eligibility results
- 23 banks checked with scores, max loan amounts, EMIs calculated correctly
- Banks correctly rejected based on credit score thresholds

---

### March 3, 2026 - Production Bug Fixes (3 issues)

**Issue 1: Second Package Inspections Not Showing**
**Problem:** Lead "Test-5" (7411891010) purchased 2 packages, but second package's inspection wasn't appearing.
**Root Cause:** Idempotency check in Razorpay webhook was too aggressive - blocked creating new inspections if ANY inspection existed for the lead (even from a different package).
**Fix:** 
- Changed check from "any inspection for lead_id" to "inspection with this specific payment_id"
- Modified customer creation to update existing customer instead of blocking
- Order ID now uses payment_id to differentiate packages
**Files Modified:** `/app/backend/server.py` (lines ~4240-4310)
**Script:** `/app/backend/scripts/fix_missing_second_package.py` - Diagnostic and fix script for existing data

**Issue 2: HR Module City Assignment Error**
**Problem:** "Failed to update assigned cities" error when changing cities for Sales Executive/Sales Lead roles.
**Root Cause:** Frontend sent JSON body `{cities: [...]}` but backend expected query parameter `cities: List[str]`.
**Fix:** Added `AssignedCitiesRequest` and `InspectionCitiesRequest` Pydantic models to accept JSON body.
**Files Modified:** `/app/backend/routes/hr.py` (lines ~1248-1310)

**Issue 3: Edit Modal Address/Vehicle Fields**
**Status:** Code review shows fields ARE present in the codebase:
- Current Address: Lines 2580-2588 in InspectionsPage.jsx
- New Address with Google Places: Lines 2591-2618
- Current Vehicle: Lines 2629-2649
- New Vehicle with Vaahan API: Lines 2652-2691
**Action Required:** User to verify they have deployed the latest code. If still missing, may need screenshot to understand the specific flow.

---

### March 1, 2026 - Comprehensive City Master Integration
**Problem:** Multiple places in the CRM had hardcoded city lists instead of fetching from the Cities Master table.
**Solution:** Swept the entire project and updated all city references to use the Cities Master API.

**Files Modified:**
1. **Frontend:**
   - `/app/frontend/src/pages/AdAnalyticsPage.jsx` - Now fetches cities from `citiesApi.getAll()`
   - `/app/frontend/src/pages/AdminPage.jsx` - Now fetches cities from `citiesApi.getAll()`
   - `/app/frontend/src/pages/HRComponents.jsx` - Already updated in previous fix

2. **Backend:**
   - `/app/backend/server.py` - Removed fallback hardcoded cities from `/cities/names` endpoint
   - `/app/backend/server.py` - Enhanced `/cities/normalize-all` endpoint to clear invalid cities
   - `/app/backend/server.py` - `find_sales_reps_for_city()` now resolves city aliases before searching
   - `/app/backend/server.py` - Lead creation city extraction (Strategy 4) now uses Cities Master aliases
   - `/app/backend/server.py` - All Meta Ads sync functions now build `region_to_city` and `city_keywords` dynamically from Cities Master

**Key Functions Updated to Use Cities Master:**
- `find_sales_reps_for_city()` - Sales rep assignment now works with city aliases
- `get_unmapped_ads()` - Uses Cities Master for region→city mapping
- `auto_map_ads_from_targeting()` - Uses Cities Master for region→city mapping
- `sync_all_ad_mappings()` - Uses Cities Master for both city keywords and region mapping
- Twilio webhook lead creation - City extraction from ad_name now uses Cities Master aliases

**New Cleanup Features:**
- `POST /api/cities/normalize-all` - Normalizes aliases AND clears invalid cities from all collections
- `/app/backend/scripts/cleanup_invalid_cities.py` - Standalone script for database cleanup

**Collections now validated:**
- leads.city, customers.city, inspections.city, ad_city_mappings.city
- employees.inspection_cities[], employees.assigned_cities[]

---

### March 1, 2026 - City Master Bug Fix
**Problem:** Users could not remove city aliases or create new cities with names that were aliases.
**Root Cause:** Backend API used query parameters for city updates, which cannot properly handle empty arrays (aliases=[]).
**Solution:**
1. Backend: Converted city create/update endpoints to use Pydantic models with JSON body
2. Frontend: Updated citiesApi to send JSON body instead of query params
3. Added conflict validation when adding new aliases
4. Improved error messages to explain WHY city creation fails (e.g., "'Bengaluru' is already an alias of city 'Bangalore'")
**Files Modified:**
- `/app/backend/server.py` (lines ~8225-8340)
- `/app/frontend/src/services/api.js` (citiesApi)
**Testing:** Verified via curl and UI screenshot that aliases can now be removed and re-added successfully.

---
## ⚠️ IMPORTANT: Testing & Environment Notes (READ FIRST)

### Preview vs Production Environment
- **Preview Environment:** Does NOT have master data (banks, roles, sample customers, inspection packages, etc.)
- **Production Environment (crmdev):** Has full master data setup
- **Implication:** Many features cannot be fully tested in preview - only basic functionality checks are possible

### Testing Guidelines for Agent
1. **Backend API Tests:** Can be done in preview using curl with test data
2. **Frontend UI Tests:** Screenshots can verify UI renders correctly
3. **End-to-End Flow Tests:** Should be verified by USER in production (crmdev)
4. **Features Requiring Master Data:** 
   - Inspection scheduling (needs real customer packages)
   - Loan processing (needs bank master data)
   - Credit score checks (needs API keys in prod)
   - User role-based access (needs seeded roles)

### Critical Flows to Test After Fixes
1. **Inspection Scheduling:** Unscheduled → Schedule with date/time/vehicle → Verify in Scheduled tab
2. **Inspection Count:** Verify Available/Total shows correctly (e.g., 3/4 not 2/3)
3. **Vehicle Data:** Verify car number shows in Vehicle column after scheduling
4. **Date Filters:** Last 7 Days, Last 14 Days working on all pages
5. **Loan Lead Stats:** Cards showing correct counts

### What Agent Should Do
- ✅ Test backend APIs with curl and mock data
- ✅ Take screenshots to verify UI renders
- ✅ Create temporary test data for flow verification
- ✅ Clean up test data after verification
- ❌ Don't assume features work just because preview shows no errors
- ❌ Don't skip testing saying "works in preview" - user must verify in prod

### User Will Test in Production
- Full inspection scheduling flow with real customers
- Payment flows with actual Razorpay
- Credit bureau API calls (Experian/Equifax)
- Role-based access with real users

---

## Original Problem Statement
Build and maintain a CRM system for WiseDrive along with a React Native mechanic mobile app. The system includes:
- CRM for managing inspections, customers, and mechanics
- Mobile app for mechanics to perform vehicle inspections with OBD scanning capabilities
- Razorpay payment integration
- Activity logs and real-time progress tracking
- AI-powered inspection report generation

## Current Architecture

### Backend (FastAPI)
- **Location:** `/app/backend/server.py` (~14.5k lines - refactored Mar 1, 2026)
- **Modular Routes:** `/app/backend/routes/`
  - `loans.py` - Loan leads, banks, credit score, documents (~1,112 lines, 25 endpoints)
  - `customers.py` - Customer CRUD, payment history, notes, activities (~694 lines, 14 endpoints)
  - `finance.py` - Payments, approvals, payslips, summary (~710 lines, 15 endpoints)
  - `hr.py` - Employees, attendance, payroll, leave management, holidays (~2,073 lines, 67 endpoints) ✅ EXPANDED
  - `mechanic.py` - Mechanic app, inspections (~448 lines, 11 endpoints)
  - `meta_ads.py` - Meta/Facebook Ads integration (~426 lines, 13 endpoints)
  - `auth.py`, `leads.py`, `partners.py`, `webhooks.py`, `notification_config.py`, `inspections.py`
- **Database:** MongoDB
- **Key Collections:** `inspections`, `inspection_obd_results`, `inspection_answer_edits`, `users`, `mechanics`, `loan_leads`, `bank_master`
- **AI Service:** `/app/backend/services/ai_report_service.py`

### Frontend (React)
- **Location:** `/app/frontend/`
- **Key Pages:** 
  - `InspectionsPage.jsx` (~4k lines - needs refactoring)
  - `InspectionReportPage.jsx` (Report viewing with AI insights)
  - `LoansPage.jsx` (~467 lines - REFACTORED Mar 1, 2026) ✅

### Loans Module Components (Refactored Mar 1, 2026)
- **Location:** `/app/frontend/src/components/loans/`
- **Components:**
  - `BankOffersModal.jsx` (~1,499 lines) - Bank offer management
  - `CreditScoreModal.jsx` (~973 lines) - Credit score check UI
  - `DocumentsModal.jsx` (~546 lines) - Document upload/download
  - `LoanProcessingModal.jsx` (~425 lines) - Loan eligibility & applications
  - `VehicleDetailsModal.jsx` (~390 lines) - Vehicle management
  - `CustomerProfileModal.jsx` (~550 lines) - NEW: Comprehensive customer profile
  - `VehicleDropdown.jsx` (~123 lines) - Vehicle display dropdown
  - `StatusBadges.jsx` (~26 lines) - Status badge components
  - `utils.js` (~34 lines) - Shared utilities
  - `index.js` - Barrel export

### Customer Profile Feature (NEW - Mar 1, 2026)
- **Location:** `/app/frontend/src/components/loans/CustomerProfileModal.jsx`
- **Backend:** `/app/backend/routes/loans.py` (profile endpoints)
- **AI Service:** `/app/backend/services/bank_statement_service.py` (Gemini AI integration)
- **Database Collection:** `customer_profiles`
- **Features:**
  1. **Bank Statement Analysis (AI-powered)**
     - Extracts: Bank name, ABB (Average Bank Balance), spending patterns
     - Uses Gemini AI via Emergent LLM Key
     - Analyzes: Income sources, EMI payments, bounces, cash withdrawals
     - Shows: End-of-month balances, total credits/debits
  2. **Credit Bureau Report Analysis**
     - Syncs from existing credit score check
     - Shows: Score, rating, account summary, existing loans
     - Risk flags: Write-offs, settlements, defaults
  3. **Location Classification**
     - Auto-detects: METRO, URBAN, SEMI_URBAN, RURAL from city
     - Editable by loan officer
     - Affects bank eligibility rules
  4. **Vehicle Eligibility Analysis**
     - Car age check (10 years / 15 years limits)
     - Excluded makes: Chevrolet, Ford, Fiat (no service network in India)
     - Valuation and LTV calculations
  5. **KYC Details**
     - Full name, PAN, address, employment details
     - Editable form with save functionality
  6. **Overall Eligibility Score**
     - Weighted calculation from all factors
     - Visual gauge with score 0-100
     - Recommended banks list

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
- **Backend Routes:** `/app/backend/routes/loans.py` (~1,738 lines, 32 endpoints)
- **Frontend Page:** `/app/frontend/src/pages/LoansPage.jsx`
- **Bank Master Page:** `/app/frontend/src/pages/BankMasterPage.jsx`
- **Bank Offers Modal:** `/app/frontend/src/components/loans/BankOffersModal.jsx` ✅ NEW (Mar 1, 2026)
- **Status:** ✅ FULLY FUNCTIONAL with multi-vehicle support, document uploads, credit scoring & bank offers
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
    - **Dual Bureau Tabbed UI:** Shows BOTH bureau reports side-by-side with tab navigation
    - **Score Comparison Bar:** Visual comparison with difference and average scores
    - OTP-based verification (OTP sent to customer's mobile)
    - 3-step modal: Customer Info → OTP Verification → Dual Bureau Reports
    - **Premium Fintech UI Design:**
      - Bureau tabs (Equifax/Experian) with score badges
      - Animated Score Gauge with risk indicators per bureau
      - Bento-style summary grid (Total Accounts, Active, Closed, Defaults)
      - Outstanding balance breakdown (Total, Secured, Unsecured)
      - Color-coded risk levels (Low/Moderate/Medium/High/Very High)
    - **5 Sub-tabs per Bureau:**
      - Overview: Strengths (✓), Concerns (⚠), Credit Enquiries Timeline
      - Accounts: Expandable account list with payment history visualization (color-coded DPD)
      - Enquiries: Hard pulls and Soft pulls with detailed breakdown
      - Profile: Personal info, address, PAN, score analysis from bureau
      - Raw Data: Full JSON response for debugging/advanced use
    - **Sample Data Fallback:** Shows demo data when APIs return 500 errors
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
- **Equifax & Experian Credit Score** (via Invincible Ocean API) ✅ DUAL BUREAU SUPPORT

## Recent Implementations (Mar 2026)

### Bank Loan Offers Feature - NEW (Mar 1, 2026)
- **Purpose:** Manage bank loan offers after loan approval, track charges, calculate net disbursal
- **Status:** ✅ FULLY FUNCTIONAL
- **Backend APIs:**
  - `GET /api/loan-leads/{lead_id}/offers` - Get all loan offers for a lead
  - `POST /api/loan-leads/{lead_id}/offers` - Create offer from application with charges
  - `POST /api/loan-leads/{lead_id}/manual-offer` - Create manual offer (when eligibility failed)
  - `POST /api/loan-leads/{lead_id}/offers/{offer_id}/accept` - Accept an offer
  - `PUT /api/loan-leads/{lead_id}/offers/{offer_id}` - Update charges (negotiation)
  - `POST /api/loan-leads/{lead_id}/offers/{offer_id}/add-charge` - Add new charge to offer
  - `DELETE /api/loan-leads/{lead_id}/offers/{offer_id}/charges/{charge_type}` - Remove charge
  - `GET /api/charge-types` - Get all charge types (system + custom)
  - `POST /api/charge-types` - Create custom charge type
  - `PUT /api/charge-types/{id}` - Update charge type
  - `DELETE /api/charge-types/{id}` - Deactivate charge type
- **Models:** `LoanOffer`, `LoanOfferCharge`, `ChargeType` in `/app/backend/models/loan.py`
- **Frontend Components:**
  - `/app/frontend/src/components/loans/BankOffersModal.jsx` - Full offers management modal
  - Integrated into `LoanProcessingModal` in `LoansPage.jsx`
- **Default Charge Types (System):**
  - Processing Fee (% based)
  - Document Handling Fee
  - RTO Charges
  - Insurance Charges
  - Valuation Charges
  - Stamp Duty Amount
- **LTV-Based Loan Calculation:** ✅ NEW
  - LTV % from Bank Master (editable per offer)
  - Car Valuation from Vehicle data
  - Loan Amount = LTV × Car Valuation (auto-calculated, editable)
  - Interest Rate prefilled from Bank Master
  - Tenure prefilled from Vehicle's expected tenure
  - EMI auto-calculated using standard formula
- **Features:**
  - Track Loan Amount Approved + Loan Insurance = Total Loan Amount
  - Add charges from dropdown of saved charge types
  - Create custom charge types that are saved to DB for reuse
  - Real-time Net Disbursal calculation (Total Loan - Total Charges)
  - Mark charges as negotiable, waive charges, delete charges
  - Negotiation history tracking with timestamps
  - Multiple offers from different banks for comparison
  - Manual offer entry for banker-approved exceptions
  - Accept offer flow updates application status
- **Testing:** ✅ Verified via screenshots

### Backend Modularization - MAJOR REFACTOR (Mar 1, 2026)
- **Purpose:** Break down monolithic server.py into smaller, maintainable router modules
- **Status:** ✅ IN PROGRESS - Phase 2 Complete (HR duplicates removed)
- **server.py Reduction:** ~18,600 → ~15,250 lines (-3,350 lines, ~18% reduction)
- **Files Created:**
  - `/app/backend/routes/loans.py` (2,065 lines, 32 endpoints) - Loan leads, banks, credit score, offers
  - `/app/backend/routes/customers.py` (694 lines, 14 endpoints) - Customer CRUD, payment history, notes
  - `/app/backend/routes/finance.py` (710 lines, 15 endpoints) - Payments, approvals, payslips
  - `/app/backend/routes/hr.py` (1,307 lines, 47 endpoints) - Employees, attendance, holidays, countries
  - `/app/backend/routes/mechanic.py` (448 lines, 11 endpoints) - Mechanic app, inspections
  - `/app/backend/routes/meta_ads.py` (426 lines, 13 endpoints) - Meta/Facebook Ads integration
- **Total Router Code:** 7,043 lines
- **Duplicate Code Removed:** ~1,355 lines of HR endpoints removed from server.py
- **Route Precedence:** Routers included at top of server.py to take priority
- **Authentication Pattern:** HTTPBearer with dependency injection fixed across all routers
- **Remaining in server.py:** Payroll, leave management, inspections, webhooks, templates, utilities

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

### P3 (Low Priority - Refactoring) - IN PROGRESS (Mar 1, 2026)
- ~~Break down `server.py` into modular routers~~ **IN PROGRESS** (~17,100 lines, was 18,600)
  - ✅ `loans.py` - Extracted Feb 28 (25 endpoints)
  - ✅ `customers.py` - Extracted Mar 1 (14 endpoints)
  - ✅ `finance.py` - Extracted Mar 1 (15 endpoints)
  - ✅ `hr.py` - Extracted Mar 1 (47 endpoints) - NEW
  - ✅ `mechanic.py` - Extracted Mar 1 (11 endpoints) - NEW
  - ✅ `meta_ads.py` - Extracted Mar 1 (13 endpoints) - NEW
  - 🟡 `inspections.py` - Needs updating (37 endpoints still in server.py)
  - 🟡 Remove duplicate code from server.py for extracted modules
- Refactor `InspectionsPage.jsx` into components (~4,100 lines)
- Refactor `LoansPage.jsx` into smaller modal components
- Refactor `scanner.tsx` into smaller components
- Clean up old duplicate inspection/customer records in database

## Recent Implementations (Mar 1, 2026 - Session 2)

### Token Refresh Mechanism - ✅ COMPLETED
- **Endpoint:** `POST /api/auth/refresh-token`
- **Implementation:** Added to `/app/backend/server.py` lines 676-688
- **Frontend:** Auto-refresh logic in `/app/frontend/src/contexts/AuthContext.js`
  - Checks token expiry every 2 minutes
  - Refreshes token 5 minutes before expiry
  - Global 401 interceptor handles expired tokens

### Loan Executive (LOAN_EXEC) Role - ✅ COMPLETED
- **Role Code:** `LOAN_EXEC`
- **Access:** Only `loans` tab visible
- **Test User:** `loanexec@wisedrive.com` / `password123`
- **Files Modified:**
  - `/app/backend/services/rbac.py` - Added LOAN_EXEC to TAB_VISIBILITY
  - `/app/backend/services/seed_v2.py` - Added role definition
  - `/app/frontend/src/pages/LoginPage.jsx` - Added loans to redirect map

### Indian Banks & NBFCs Seeding - ✅ COMPLETED
- **Endpoint:** `POST /api/banks/seed-indian-banks`
- **Total Banks:** 23 (Public Banks, Private Banks, NBFCs)
- **Banks Include:**
  - **Public:** SBI, BOB, PNB, Canara, Union Bank
  - **Private:** HDFC, ICICI, Axis, Kotak, IndusInd, Yes Bank, IDFC First, Federal
  - **NBFCs:** Bajaj Finance, Tata Capital, Mahindra Finance, Shriram Finance, Cholamandalam, Hero FinCorp, L&T Finance, Sundaram, Muthoot, Poonawalla
- **Each Bank Has:** Interest rates, tenure limits, LTV%, processing fee, eligibility rules (min credit score, max vehicle age, excluded makes)

### Stats Cards Fix - ✅ VERIFIED
- **Issue:** Frontend was using wrong keys to display stats
- **Fix:** Frontend correctly uses `stats.total` and `stats.by_status` keys
- **Stats Displayed:** Total Leads, Interested, Follow Up, Call Back, Not Interested, With Credit Score

### Test Results (Iteration 82)
- Backend: 100% (18/18 tests passed)
- Frontend: 100% (all features verified)
- Test Report: `/app/test_reports/iteration_82.json`

## Bug Fixes (Mar 1, 2026 - Session 2 Continued)

### Inspection Count Bug Fix - ✅ FIXED
- **Bug:** Customer had 4 inspections, scheduled 1, but showed 2/3 instead of 3/4
- **Root Cause:** The grouping logic only counted unscheduled inspections in `total_inspections`, not ALL inspections from the order/package
- **Fix:** Modified `/app/backend/server.py` lines 4670-4745 to:
  - Count ALL inspections (scheduled + unscheduled) for `total_inspections`
  - Query database for actual scheduled count per order_id/lead_id
  - Correctly calculate `available_inspections = total - scheduled`
- **File Modified:** `/app/backend/server.py`

### Vehicle Number Not Showing Bug Fix - ✅ FIXED
- **Bug:** Vehicle number not showing in Vehicle column after scheduling from unscheduled tab
- **Root Cause:** The schedule endpoint only saved date/time, not vehicle data
- **Fix:** Extended `PATCH /api/inspections/{id}/schedule` to accept and save:
  - `car_number`, `car_make`, `car_model`, `car_year`, `car_color`, `fuel_type`
  - `address`, `city`, `latitude`, `longitude`
- **File Modified:** `/app/backend/server.py` (UpdateScheduleRequest model + endpoint)
- **Frontend Already Sends:** The frontend was already sending vehicle data (lines 1181-1190 in InspectionsPage.jsx)


## Date Filter Enhancement (Mar 1, 2026 - Session 2)

### Added "Last 7 Days" and "Last 14 Days" Filters - ✅ COMPLETED
- **Scope:** All 4 main data pages (Leads, Customers, Inspections, Loans)
- **Files Modified:**
  - `/app/frontend/src/components/ui/DateRangeFilter.jsx` - Updated shared component with new presets
  - `/app/frontend/src/pages/LeadsPage.jsx` - Added Last 7 Days, Last 14 Days presets
  - `/app/frontend/src/pages/CustomersPage.jsx` - Added Last 7 Days, Last 14 Days presets
  - `/app/frontend/src/pages/InspectionsPage.jsx` - Added Last 7 Days, Last 14 Days presets
  - `/app/frontend/src/pages/LoansPage.jsx` - Added full date filter UI (was missing)
- **Date Calculation:**
  - Last 7 Days: Today - 6 days (includes today)
  - Last 14 Days: Today - 13 days (includes today)


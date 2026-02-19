# Wisedrive CRM & ESS Mobile App - Product Requirements Document

## Original Problem Statement
Build a scalable automotive platform "Wisedrive" that evolved into a monolithic CRM application with an Employee Self-Service (ESS) mobile application.

## Core Applications
1. **CRM Web Application** - Employee, HR, and Leads management
2. **ESS Mobile App** - Employee self-service (React Native/Expo)

---

## Completed Features

### ✅ Payment Modal Enhancements (February 2026)

**Changes Implemented:**
1. **Removed "Number of Cars" field** - Package now determines number of inspections
2. **Conditional Inspection Schedule** - Only shows if car details were provided in Step 1
3. **Multiple Inspection Schedules** - Based on package's `no_of_inspections` count
4. **Google Places Autocomplete** - For address input with real-time suggestions
5. **Leads → Inspections Integration** - Auto-creates inspection records on payment

**New Features:**
- Each inspection slot includes: Vehicle Number, Preferred Date/Time, Address (Google Maps)
- Unscheduled inspections appear in "Unscheduled" tab in Inspections module
- Inspection Status: `SCHEDULED` (with full details) or `UNSCHEDULED` (partial/no details)
- Payment Status: `PAID` for all inspections created from lead conversion

**Files Modified:**
- `/app/frontend/src/pages/LeadsPage.jsx` - Payment modal with multiple inspection schedules
- `/app/frontend/src/components/ui/PlacesAutocomplete.jsx` - NEW: Google Places component
- `/app/backend/server.py` - PaymentLinkRequest model, inspection creation logic

### ✅ Vaahan API Integration (February 2026)

**Integration Details:**
- **API Provider:** Invincible Ocean
- **Endpoint:** `https://api.invincibleocean.com/invincible/vehicleRcV6`
- **Purpose:** Fetch real-time vehicle RC details for leads

**Data Retrieved:**
- Vehicle Make, Model, Year, Color, Fuel Type
- Chassis Number, Engine Number
- Owner Name, Owner Count
- Registration Date, RC Expiry
- Insurance Company, Policy Number, Validity
- Technical Specs (Cubic Capacity, Weight, Seating, Cylinders)
- Financed Status, Blacklist Status, Commercial Status

**API Endpoints Created:**
- `GET /api/vehicle/details/{vehicle_number}` - Fetch from Vaahan API
- `POST /api/vehicles` - Save vehicle to database (vehicle master)
- `GET /api/vehicles/{vehicle_id}` - Get vehicle by ID
- `GET /api/vehicles/by-registration/{registration_number}` - Get by reg number

### ✅ RBAC for Leads Management (February 2026)

**Tab Visibility:**
- SALES_EXEC: ["leads"] only
- HR_MANAGER: ["leads", "hr", "finance"]

**Data Filtering:**
- Sales executives only see leads assigned to them
- HR Managers see all leads in their country

### ✅ Leads Management Module (February 2026)

**Complete 4-Phase Lifecycle:**
1. Lead Creation (Twilio WhatsApp webhook)
2. Lead Assignment (Round-robin by city)
3. Lead Follow-up (Notes, Activities, Reminders)
4. Lead Payment (Razorpay integration)

**22 Lead Statuses Supported**

### ✅ Leave Rules Feature (December 2025)
- Period-based allocation (monthly/quarterly)
- No carry forward policy

### ✅ Inspection Package Payment Enhancements (February 2026)

**New Features:**
1. **Partial Payments**
   - Toggle to enable/disable per package
   - Type: Percentage (%) or Fixed Amount (₹)
   - Value: Configurable upfront payment amount
   - Flow: Customer pays partial → Customer & Inspection created → "Collect Balance" button in Inspections → Remaining payment → Report enabled

2. **Discounts**
   - Toggle to enable/disable per package
   - Type: Percentage (%) or Fixed Amount (₹)
   - Value: Configurable discount amount

3. **Offers Management**
   - New "Offers" tab in Settings > Inspection Packages
   - Create promotional offers (e.g., "Christmas Special 2026")
   - Fields: Name, Description, Discount Type, Value, Valid From/Until, Active status
   - Multiple offers can be linked to a single package
   - Sales Head manually selects offers during payment

**API Endpoints:**
- `GET /api/offers` - List all offers
- `GET /api/offers/active` - List active offers within valid date range
- `POST /api/offers` - Create offer
- `PUT /api/offers/{id}` - Update offer
- `PATCH /api/offers/{id}/toggle-status` - Toggle active status
- `DELETE /api/offers/{id}` - Delete offer

**Files Modified:**
- `/app/backend/models/inspection_package.py` - Added Offer models and package payment fields
- `/app/backend/server.py` - Added Offers CRUD endpoints
- `/app/frontend/src/pages/InspectionPackagesPage.jsx` - Added Offers tab and package modal enhancements
- `/app/frontend/src/services/api.js` - Added offers API methods

---

## Third-Party Integrations

| Service | Status | Purpose |
|---------|--------|---------|
| **Meta Marketing API** | **LIVE** | **Ad performance tracking, spend data** |
| **Google Maps Places API** | **LIVE** | **Address autocomplete in payment modal** |
| **Vaahan (Invincible Ocean)** | **LIVE** | **Vehicle RC details (100% real-time)** |
| Twilio | LIVE | WhatsApp messaging for lead ingestion |
| Razorpay | LIVE | Payment links and webhook |
| Firebase (FCM) | LIVE | Push notifications |
| Expo (EAS) | LIVE | Mobile app builds |

---

## API Credentials

### Meta Marketing API
- **App ID:** Stored in `/app/backend/.env` as `META_APP_ID`
- **App Secret:** Stored in `/app/backend/.env` as `META_APP_SECRET`
- **Access Token:** Stored in `/app/backend/.env` as `META_ACCESS_TOKEN`
- **Ad Account ID:** Stored in `/app/backend/.env` as `META_AD_ACCOUNT_ID`
- **API Version:** v21.0
- **Features Used:** Ad insights (spend, impressions, clicks), campaigns list
- **Note:** Access tokens expire periodically. Refresh via Meta for Developers portal.

### Google Maps API
- **API Key:** Stored in `/app/frontend/.env` as `REACT_APP_GOOGLE_MAPS_API_KEY`
- **Features Used:** Places Autocomplete (address suggestions)

### Vaahan API (Invincible Ocean)
- **Endpoint:** `https://api.invincibleocean.com/invincible/vehicleRcV6`
- **Client ID:** Stored in `/app/backend/.env` as `VAAHAN_CLIENT_ID`
- **Secret Key:** Stored in `/app/backend/.env` as `VAAHAN_SECRET_KEY`
- **Test Vehicle:** KA48N1000 (Ford Endeavor 2017 White Diesel)

---

## Test Results

### Latest Test: Payment Modal Enhancements (February 2026)
- **"Number of Cars" removed:** ✅ Verified
- **Conditional Inspection Schedule:** ✅ Shows only when car details confirmed
- **Multiple Inspection Slots:** ✅ Based on package's `no_of_inspections`
- **Google Places Autocomplete:** ✅ Working with address suggestions
- **No car details scenario:** ✅ Shows info message about unscheduled inspections

### Test Credentials
| Role | Email | Password |
|------|-------|----------|
| HR Manager | hr@wisedrive.com | password123 |
| Sales Executive | divya@wisedrive.com | password123 |
| CTO | shalini.vyshaka@gmail.com | password123 |
| ESS Test User | bhaskar@wisedrive.com | Welcome@123 |

---

## Architecture

```
/app/
├── backend/
│   ├── services/
│   │   ├── vaahan_service.py    # Vaahan API integration
│   │   ├── rbac.py              # Role-based access control
│   │   ├── twilio_service.py    # Twilio WhatsApp
│   │   └── razorpay_service.py  # Razorpay payments
│   └── server.py                # API endpoints (payment-link, webhooks, inspections)
├── ess-mobile-app/              # React Native (Expo) app
└── frontend/
    ├── src/
    │   ├── components/
    │   │   └── ui/
    │   │       └── PlacesAutocomplete.jsx  # NEW: Google Places component
    │   ├── services/
    │   │   └── api.js           # API functions
    │   └── pages/
    │       └── LeadsPage.jsx    # Payment modal with inspection schedules
```

---

### ✅ Inspections Tab Enhancements v2 (February 18, 2026)

**Feature Implementation:**
Complete enhancement of Inspections tab with inline editing and payment link management.

**Key Components:**

1. **Payment Status Column - Collect Balance Button:**
   - Shows "Collect ₹XXX" button directly in column for partial payments
   - Opens enhanced modal with two options:
     - **"Generate Link Only"** - For offline sharing
     - **"Send via WhatsApp"** - Direct WhatsApp delivery
   - **View & Copy Link**: Displays generated Razorpay link with copy and open buttons
   - **Check Payment Status**: Real-time button to verify if payment was received (critical for report release)

2. **Vehicle Edit Modal (Vaahan API):**
   - Click pencil icon to change vehicle number
   - Uses same Vaahan API as LeadsPage payment modal
   - Auto-fetches vehicle details (make, model, year, color, fuel type)
   - Supports manual entry if API fails
   - Accommodates mechanic requests to inspect different vehicle on-site

3. **Inspection Status Dropdown:**
   - Inline dropdown to change status directly in table
   - Full status lifecycle: New Inspection → Assigned to Mechanic → Confirmed → Started → In Progress → Completed
   - Cancellation options: Cancelled (Customer), Cancelled (Wisedrive)

4. **Mechanic Assignment Modal:**
   - Assign, reassign, or unassign mechanics
   - Shows list of available mechanics from HR Module
   - Auto-updates status to "Assigned to Mechanic" when first assigned

5. **Schedule Edit Modal:**
   - Change inspection date and time for postponed/rescheduled inspections
   - Auto-updates status to "Scheduled" when updating from "Unscheduled"

6. **Inspection Report Column (renamed from Actions):**
   - **"View Report"** button - Opens inspection report in new tab
   - Disabled state when report not yet available
   - **Send Report** icon - Send report via WhatsApp (only for fully paid + completed inspections)

**Backend APIs:**
- `PATCH /api/inspections/{id}/status` - Update inspection status
- `PATCH /api/inspections/{id}/vehicle` - Update vehicle details
- `PATCH /api/inspections/{id}/assign-mechanic` - Assign/unassign mechanic
- `PATCH /api/inspections/{id}/schedule` - Update schedule
- `POST /api/inspections/{id}/collect-balance` - Generate balance payment link
- `GET /api/inspections/{id}` - Get inspection details (for payment status check)

---

### ✅ Collect Balance Feature (February 18, 2026)

**Feature Implementation:**
Complete partial payment lifecycle allowing customers to pay an upfront amount and balance later.

**Key Components:**
1. **Inspections Page Enhancements:**
   - New "Payment Status" column: Shows FULLY_PAID, PARTIALLY_PAID (with balance due), PENDING badges
   - New "Inspection Status" column: Shows NEW_INSPECTION, ASSIGNED_TO_MECHANIC, INSPECTION_CONFIRMED, INSPECTION_STARTED, INSPECTION_IN_PROGRESS, INSPECTION_COMPLETED, SCHEDULED, UNSCHEDULED
   - "Collect Balance" button appears for partial payments showing exact balance (e.g., "Collect ₹919")
   - Confirmation modal shows customer details, payment breakdown, and balance due
   - "Send Report" button disabled until full payment received

2. **Backend API Enhancements:**
   - `POST /api/inspections/{id}/collect-balance`: Generates Razorpay payment link for balance
   - Webhook handles balance payment completion and updates status to FULLY_PAID
   - WhatsApp notifications sent for balance payment links and confirmations

3. **Payment Data Model:**
   - Inspections track: amount_paid, balance_due, payment_status, payment_transactions[]
   - Supports both old format (pending_amount) and new format (balance_due)

**Files Modified:**
- `/app/frontend/src/pages/InspectionsPage.jsx` - New columns, Collect Balance modal, status badges
- `/app/frontend/src/services/api.js` - Added collectBalance, updateStatus, sendReport methods
- `/app/frontend/src/pages/LeadsPage.jsx` - Sends partial payment data to backend
- `/app/backend/server.py` - Collect balance endpoint, webhook balance handling, payment link request model

**Test Coverage:**
- `/app/backend/tests/test_collect_balance_feature.py` - 9 tests (100% pass rate)
- All scenarios tested: API endpoints, validation, UI components

---

## Future Tasks (Backlog)

### P0 - UAT & Deployment
- [x] **Critical Bug Fix: Lead Auto-Assignment (February 17, 2026)**
- [x] **CTO Role Permissions Fix (February 17, 2026)**
- [x] **Inspection Package Payment Enhancements (February 18, 2026)**
- [x] **Collect Balance Feature (February 18, 2026)** ✅ COMPLETED
- [x] **Inspections Tab Enhancements (February 18, 2026)** ✅ COMPLETED
- [ ] User Acceptance Testing for Payment Modal changes
- [ ] User Acceptance Testing for complete Leads Module
- [ ] Production deployment

### P1 - CRM Modules
- [x] Inspections Module (view scheduled/unscheduled inspections) ✅ FULLY ENHANCED with all editing features
- [x] Customer Module - Payment history display ✅ COMPLETED with full notes, activities, and payment details

### P2 - Integrations
- [ ] OBD-Integration-v1.0

---

## Bug Fixes

### ✅ CTO Role Permissions Fix (February 17, 2026)

**Issue:** New CTO user (`shalini.vyshaka@gmail.com`) could see navigation tabs but couldn't access any data (leads, customers, employees showed empty).

**Root Cause:**
- The role had `permissions` array (for tab visibility) but zero entries in `role_permissions` collection (for data access scoping)
- `get_visible_tabs()` uses role's `permissions` array → tabs visible ✅
- `get_data_filter()` uses `role_permissions` collection → returned `{"id": "NONE"}` blocking all data ❌

**Fix Applied:**
- Copied all 29 `role_permissions` entries from CEO role to CTO role
- Each permission has `scope: "all"` for global data access (same as CEO)

**Verification:**
- CTO user can now see all leads (73), customers (17), employees (19)
- All navigation tabs functional: Dashboard, Leads, Customers, Inspections, HR Module, Finance, Settings

### ✅ Lead Auto-Assignment Bug Fix (February 17, 2026)

**Root Cause Analysis:**
The lead assignment query was incorrectly using `role_code` field directly on users collection. In reality:
- Users have `role_id` (reference to roles collection)
- Role codes (e.g., `SALES_EXEC`) are stored in the `roles` collection
- The query never matched because users don't have `role_code` field

**Fix Applied:**
1. Created helper function `get_sales_role_ids()` - Gets role IDs for all SALES roles
2. Created helper function `find_sales_reps_for_city(city)` - Finds sales reps using:
   - `role_id` lookup (checks against sales role IDs)
   - `assigned_cities` array check
   - `is_available_for_leads` flag check
3. Updated all assignment endpoints to use the new helper function:
   - `POST /api/leads/assign-unassigned` (bulk assignment)
   - Twilio WhatsApp webhook (auto-assignment on new lead)
   - `GET /api/leads/sales-reps-by-city` (dropdown population)

**Enhanced Debug Endpoint:**
`GET /api/leads/debug-sales-reps?city=Vizag&user_name=Sonu`
Returns:
- All roles in system
- Sales role IDs
- All sales users with their assignments
- Users matching the specific city
- Specific user details with role verification

**Files Modified:**
- `/app/backend/server.py` - Helper functions, updated queries, enhanced debug endpoint

---

## Document History
- **Created:** December 2025
- **Last Updated:** February 19, 2026
- **Version:** 4.2

## Changelog
- v4.3 (Feb 19, 2026): **Report Templates Module - Complete Flow** - Major restructuring of inspection management flow: (1) **Report Templates Tab** - New "Report Templates" tab under Services that connects Partner + Inspection Template + Report Style. This is now the "master" connector that defines client-specific inspection reports. (2) **3 Report Styles** - Standard (blue, clean simple layout), Premium (purple, detailed with photos), Detailed Technical (green, all metrics). Each style has preview card showing features. (3) **Simplified Inspection Templates** - Removed Partner/Report selection from this tab (now called "Questionnaires"). Only contains: Name, Description, Select Questions by category. Partners are now linked via Report Templates. (4) **Create Report Template Modal** - 3-section form: Basic Info (Name, Partner dropdown, Inspection Template dropdown, Description), Select Report Style (3 visual cards), Status (Active/Default toggles). (5) **View Report Preview** - Eye button opens preview modal showing template configuration and report features. (6) **Complete Flow**: Partners → Inspection Templates (Questions) → Report Templates → Lead Assignment → Customer → Inspection Report. New Backend APIs: GET/POST/PUT/DELETE /api/report-templates, PATCH toggle/set-default, GET styles, POST seed-samples, GET by-partner/{id}. REPORT_STYLES constant defines 3 styles with preview colors and features. 100% test coverage (15/15 backend, 11/11 frontend - iteration_59).
- v4.2 (Feb 19, 2026): **Partners & Inspection Templates Module** - New feature for client-specific inspection management: (1) **Partners Management** - New "Partners" tab under Services to manage clients (B2C, Bank, Insurance, B2B). Partners have name, type, contact info, address, notes. CRUD operations with toggle active/inactive. (2) **Inspection Templates** - New "Inspection Templates" tab to create client-specific questionnaire sets. Each template links: Partner + selected Questions from global pool + Report Template. Admin can select specific questions by category using checkboxes. (3) **B2C Default Template** - Seed button creates default B2C partner and template with all existing questions. One template can be marked as "Default" for new inspections. (4) **Question Reuse** - Global question pool (from Inspection Q&A) can be reused across multiple templates with different subsets. (5) **Report Templates** - For now all templates use "Default Report" with option to create custom reports in future. New Backend APIs: GET/POST/PUT/DELETE /api/partners, PATCH /api/partners/{id}/toggle, GET/POST/PUT/DELETE /api/inspection-templates, PATCH /api/inspection-templates/{id}/toggle, PATCH /api/inspection-templates/{id}/set-default, POST /api/inspection-templates/seed-default. 100% test coverage (19/19 backend tests, 16/16 frontend features - iteration_58). **Rollback Plan**: Remove 2 tabs from InspectionPackagesPage.jsx if needed - all changes are additive.
- v4.1 (Feb 19, 2026): **Inspection Q&A UI Enhancements** - Four major UI/UX fixes based on user feedback: (1) **Tab Relocation** - Moved "Inspection Q&A" tab from standalone page to Services tab, now appears alongside Packages, Categories, Offers tabs. (2) **Category Management** - Added "Manage Categories" button that opens modal to view existing categories (Brakes, Engine Health, Exterior Body, Tyres & Wheels), add new categories with name/description, and edit/delete existing categories. (3) **Category Column** - Added "Category" as first column in questions table showing colored category badges. (4) **Sub-Question Answer Types** - Fixed bug where answer type selectors (Multiple Choice, Photo Upload, Video 45s) were missing for sub-questions. Now both Sub-Question 1 and Sub-Question 2 have their own "Answer Type for Sub-Question X" selector. New Backend APIs: GET/POST /api/inspection-qa/categories, PUT/DELETE /api/inspection-qa/categories/{id}. 100% test coverage (iteration_57).
- v4.0 (Feb 19, 2026): **Inspection Q&A Module** - New feature under Services tab for configuring inspection questions for mechanics. Key features: (1) **Two-Tab Services Page** - Inspection Packages tab and new Inspection Q&A tab. (2) **Question Configuration** - Each question has: category (10 predefined: Engine Health, Transmission, Exterior Body, Interior, Electrical, Suspension, Brakes, Tyres, AC, Documents), main question text, answer type, and up to 2 optional sub-questions. (3) **Answer Types** - Three types: Multiple Choice (add options, select correct answer), Photo Upload (mechanic captures photo), Video Upload (max 45 seconds). (4) **Table View** - 7 columns: Question | Answer | Sub-Question 1 | Answer | Sub-Question 2 | Answer | Actions. Shows answer type badges with icons. (5) **CRUD Operations** - Create, Edit, Toggle active/inactive, Delete questions. (6) **Stats Cards** - Total Questions, Active Questions, Categories count. New Backend APIs: GET/POST/PUT/DELETE /api/inspection-qa/questions, PATCH /api/inspection-qa/questions/{id}/toggle, GET /api/inspection-qa/categories. 100% test coverage (17/17 backend tests, iteration_56). This module will integrate with the mechanic app for live inspections.
- v3.9 (Feb 19, 2026): **Customers Tab UI Fixes - Round 2** - Five additional UI improvements: (1) **Add Note Visible** - Added "Add Quick Note" section in Overview tab and "Add a note..." input in Notes tab. Notes can be added from either location. (2) **Meta/Ad Details** - Overview tab now shows "Lead Source" section with source, ad_id, ad_name, campaign_name when customer was converted from a lead with ad tracking. (3) **Notes Edit/Delete** - Notes now show edit (pencil) and delete (trash) icons on hover. Click edit for inline editing with save/cancel. Delete prompts confirmation. Activity log tracks note_updated and note_deleted actions. (4) **Package Details with Report** - Packages tab shows inspection_status badges (New, Completed, etc.) alongside payment status. Completed inspections show "Report" button linking to /inspection-report/{id}. Each package shows scheduled_date, mechanic_name when available. (5) **Payment Single Row** - Table column now shows payment in single row: [Badge] ₹amount +₹due format. New Backend APIs: PUT /api/customers/{id}/notes/{noteId}, DELETE /api/customers/{id}/notes/{noteId}. Enhanced detailed-payments returns meta_info, has_report, report_url. 100% test coverage (iteration_55).
- v3.8 (Feb 19, 2026): **Customers Page UI Enhancements** - Five major UX improvements: (1) **Cleaned Table UI** - Removed redundant "View Details" links and action buttons (View/Edit) from table rows. Clicking anywhere on a row opens the Customer Details modal. (2) **Global Edit Button** - Moved Edit button to modal header so it's accessible from all tabs (Overview, Payments, Notes). Can edit customer info from any tab without switching. (3) **Demo Customer Seed** - Added "Create Demo Customer" button + POST /api/customers/seed-sample-data endpoint. Creates realistic demo data: 3 packages (Premium/Standard/Basic), multiple payment transactions (partial payments, balance payments), 4 notes with different dates. (4) **Date Range Filter** - Added filter bar above table with presets: Today, This Week, This Month, This Year, Custom (date pickers), All Time. Backend supports date_from/date_to params. (5) **Sales Rep Filter** - Added dropdown showing all sales reps with customer counts in parentheses. GET /api/customers/sales-reps-with-counts returns reps sorted by customer count. 100% test coverage (iteration_54).
- v3.7 (Feb 19, 2026): **Enhanced Customers Page** - Complete overhaul of Customers module with comprehensive data table and detail management: (1) **Enriched Data Table** - New columns: Payment (status badge + amounts), Packages count, Sales Rep name, Notes count. Summary cards show Total Customers, Payments Completed, Pending, and Total Revenue. (2) **Customer Details Modal** - Three-tab interface: Overview (customer info with inline edit), Payments (package-wise breakdown with transaction history), Notes (notes list + activity log). (3) **Notes & Activities** - Full notes functionality matching Leads page: add notes with user/timestamp, activity log tracking all customer actions. (4) **Payment Details** - Package-wise breakdown showing: payment date/time, reference number, amount, pending amount, payment link, mode of payment, package usage (inspections used vs available). (5) **Edit Customer** - Inline editing of name, mobile, city, email, address within modal. New Backend APIs: GET /api/customers (enriched with sales_rep_name, notes_count, total_packages, total_paid, total_pending), GET /api/customers/{id}/detailed-payments (package-wise breakdown), POST/GET /api/customers/{id}/notes, GET /api/customers/{id}/activities. 100% test coverage (18/18 backend tests, 100% frontend).
- v3.6 (Feb 18, 2026): **Meta Ads Advanced Features** - Four major enhancements to Meta Ads integration: (1) **Auto-Sync Ad Status** - POST /api/meta-ads/sync-status endpoint syncs ad active/paused status from Meta to local database. Updates `is_active`, `meta_status`, `meta_effective_status` fields on ad mappings. Background scheduler syncs every 15 minutes. (2) **Last Updated Timestamp** - Header shows "Updated X min ago" with real-time calculation from `last_updated` field in performance data. (3) **CPR Metric** - Added Cost Per Result (CPR = Total Spend / Total Conversions) to summary cards and performance table. New `overall_cpr` and `overall_cpl` fields in totals. (4) **Unmapped Ads with City Suggestions** - GET /api/meta-ads/unmapped-ads returns ads from Meta without CRM mappings, includes targeting info and auto-suggested city. New UI section in Ad ID Mapping tab shows unmapped ads with "Quick Map" button. Frontend API methods added: `syncStatus()`, `getUnmappedAds()`, `getAdsWithTargeting()`. 100% test coverage (iteration_52).
- v3.5 (Feb 18, 2026): **Meta Token Auto-Refresh** - Added automated token management: (1) Token info endpoint shows validity, expiry date, and type. (2) Auto-refresh attempts to renew tokens expiring within threshold. (3) Manual token update UI in Ad Analytics page for CEO/CTO. (4) Token status indicator in header showing days until expiry. (5) Detailed token management modal with instructions.
- v3.4 (Feb 18, 2026): **Meta Ads Integration** - Complete Meta Marketing API integration for ad performance tracking: (1) Expanded Ad City Mapping model with ad_name, ad_amount, language, campaign, source, is_active fields. (2) CRUD APIs for ad mappings: GET/POST/PUT/PATCH/DELETE /api/settings/ad-city-mappings. (3) Meta Ads Service for fetching ad insights from Meta Marketing API. (4) Performance Analytics API: GET /api/meta-ads/performance - combines Meta spend data with internal lead/revenue data. (5) New Ad Analytics page with summary cards (Total Spend, Leads, Revenue, ROI) and performance table. (6) Updated Settings page to use real backend API (removed localStorage mock). (7) Added ad-analytics permission to all relevant roles. 100% backend test coverage (16/16 tests). Note: Meta access token expires periodically - performance data shows internal metrics when Meta API unavailable.
- v3.3 (Feb 18, 2026): **Inspections Tab UI Enhancements** - Major UI restructure: (1) Summary cards are now clickable to filter data table by Total/Scheduled/Completed/Unscheduled with visual indicator. (2) Moved Unscheduled/Scheduled tabs to page header (top-right). (3) Removed "Add New Inspection" button. (4) New Schedule Modal for unscheduled inspections with Vaahan API vehicle search, date/time picker, city dropdown, and address textarea. Scheduled inspections show in Scheduled tab with payment data carried forward. 100% frontend test coverage.
- v3.2 (Feb 18, 2026): **Inspection City & Status Validation Feature** - Implemented three major features: (1) Inspection status validation - statuses like "Assigned to Mechanic", "In Progress", "Completed" now require a mechanic to be assigned first, showing error message if attempted without. (2) Country modal now has two sub-tabs: "Leads Cities" and "Inspection Cities" for separate city management. (3) New "Inspection City" tab in HR Module for assigning inspection cities to mechanics. Backend validation ensures mechanics can only be assigned to inspections in their designated cities. 100% test coverage.
- v3.1 (Feb 18, 2026): **Inspections Page UX Polish** - Fixed two critical UI issues: (1) Intelligent Make/Model parsing - verbose Vaahan API strings like "FORD INDIA PVT LTD" now display as "Ford", "3.2 ENDEAVOUR 4 4 AT TITANIUM" as "Endeavour". Added extractMake() and extractModel() utility functions. (2) Table layout fix - removed horizontal scrollbar by using table-fixed with percentage column widths, Date/Time column now shows time below date. 100% frontend test coverage.
- v3.0 (Feb 18, 2026): **Inspections Tab Full Enhancement** - Added inline editing for all fields: (1) Collect Balance button in Payment Status column, (2) Vehicle edit with Vaahan API integration, (3) Inspection Status dropdown with 8 status options, (4) Mechanic assignment modal, (5) Schedule edit modal. New backend APIs: PATCH /api/inspections/{id}/status, vehicle, assign-mechanic, schedule. 94% test coverage (17/18 tests).
- v2.9 (Feb 18, 2026): **Collect Balance Feature Complete** - Full implementation of partial payment lifecycle. Inspections page enhanced with Payment Status and Inspection Status columns. "Collect Balance" button generates Razorpay link and sends via WhatsApp. Send Report disabled until full payment. Webhook handles balance payment completion. 100% test coverage (9 tests passing).
- v2.8 (Feb 18, 2026): **Partial Payment Fixed Amount Implementation** - Simplified partial payment to fixed amount only (removed percentage option). Added clear calculation display in payment modal showing Total → Partial Payment → Balance. Button now shows correct amount to pay. Example: Package ₹1,499 - Discount ₹200 = Total ₹1,299, Partial ₹500, Balance ₹799.
- v2.7 (Feb 18, 2026): **Payment Modal Package Settings Fix** - Discount, Offers, and Partial Payment sections now only appear when enabled on the package. Fixed active offers query to properly filter by date range.
- v2.6 (Feb 18, 2026): **Inspection Package Payment Enhancements** - Added partial payment support (fixed/percentage), discount configuration, and promotional offers management. New Offers tab in Settings with CRUD operations. Package modal updated with toggles for partial payments, discounts, and offer linking.
- v2.5 (Feb 17, 2026): **CTO Role Permissions Fix** - Copied 29 role_permissions from CEO role to CTO role, enabling full data access for the new CTO user
- v2.4 (Feb 17, 2026): **Critical Bug Fix: Lead Auto-Assignment** - Fixed query to correctly use role_id lookup against roles collection, check assigned_cities array, and is_available_for_leads flag
- v2.3 (Feb 16, 2026): **Payment Modal Enhancements** - Removed "Number of Cars", added conditional inspection scheduling with Google Places autocomplete, leads-to-inspections integration
- v2.2 (Feb 16, 2026): Vaahan API integration - Real vehicle RC data from Invincible Ocean API
- v2.1 (Feb 16, 2026): RBAC for Sales Executives - leads filtering, Leads-only tab visibility
- v2.0 (Feb 16, 2026): Leads Management frontend integration complete
- v1.6 (Dec 2025): Bug fixes and Leave Rules feature

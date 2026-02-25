# WiseDrive CRM - Product Requirements Document

## Latest Updates (Feb 25, 2026)

### CRM Inspections Table - Final UI Layout ✅
**Clean table with all essential columns and actions**

#### Table Columns (11 total):
| DATE/TIME | CUSTOMER | VEHICLE | PAYMENT | STATUS | MECHANIC | LOCATION | REPORT | EDIT | LIVE | NOTES |

#### Key Features:
1. **Payment Column Back**: Shows "Paid" (green) or "Due" (amber) badges - clickable for payment details

2. **Clickable Mechanic Name**: No icon - click on mechanic name or "+ Assign" to reassign

3. **Separate Live Column**: Play icon opens Live Inspection Progress modal (separate from Notes)

4. **Notes Column**: Opens drawer with 3 tabs:
   - **Notes** - Add/view inspection notes
   - **Activity** - View status changes and activity log
   - **OTP** - View mechanic login OTPs (for offline sharing)

5. **Simplified OTP Tab**: Shows only mechanic OTPs with large OTP code display for easy sharing

6. **Vehicle Search**: Uses Vaahan API integration to fetch vehicle details

---

### Inspection Status Management System (v2.4.5 / App v1.0.6)
**Comprehensive CRM-Mobile App status synchronization**

#### Status Flow:
1. **NEW_INSPECTION** - Created via leads payment modal or scheduled inspection modal
2. **ASSIGNED_TO_MECHANIC** - When mechanic is assigned (auto-updated)
3. **MECHANIC_ACCEPTED** - Mechanic accepts in mobile app
4. **MECHANIC_REJECTED** - Mechanic rejects in mobile app (unassigns mechanic)
5. **INSPECTION_STARTED** - Mechanic clicks "Start Inspection" after vehicle verification
6. **INSPECTION_COMPLETED** - All Q&A + OBD done, complete clicked
7. **INSPECTION_CANCELLED_WD** - Cancelled by WiseDrive
8. **INSPECTION_CANCELLED_CUS** - Cancelled by Customer
9. **RESCHEDULED** - Moved to another date/time

#### Activity Logging:
- All status changes are logged with: who, what, when, old value, new value, source (CRM/MECHANIC_APP), reason
- Activities viewable in inspection detail modal

#### Backend Changes:
- Updated `/mechanic/inspections/{id}/accept` - Sets MECHANIC_ACCEPTED + activity log
- Updated `/mechanic/inspections/{id}/reject` - Sets MECHANIC_REJECTED + activity log
- Added `/mechanic/inspections/{id}/start` - Sets INSPECTION_STARTED + activity log
- Updated `/mechanic/inspections/{id}/complete` - Sets INSPECTION_COMPLETED + activity log
- Updated `/inspections/{id}/status` - CRM override with optional reason parameter

#### Frontend Changes:
- Updated CRM InspectionsPage with new status options
- Status dropdown allows CRM users to override any status

#### Mobile App Changes:
- Verify-vehicle screen now calls `/start` endpoint after verification
- API updated with `startInspection()` method

---

### Previous Session Bug Fixes (v1.0.5)

1. **Category Order Fixed** - Categories now follow template order (category_order array)
2. **Modern UI for Categories** - Gradient progress card, color-coded cards, mini progress bars
3. **OTP Error Fixed** - Error only shows after verification fails, not while typing

---

### Earlier Bug Fixes (v1.0.3)

1. **Navigate Button Crash (P0)** - Fixed scope issue in InspectionCard
2. **Auto-Login Cache Issue (P0)** - Set allowBackup=false, added clearAllCache()
3. **Questionnaire Loading** - Partner template lookup fallback
4. **Car Details Loading** - Multiple property name variations returned

---

## Previous Updates (Feb 24, 2026)

### Bug Fixes Applied
1. **CRM Inspections Page White Screen** - Fixed React error #31 caused by city objects being rendered as strings. Changed API call from `/cities` to `/cities/names`.

2. **Mechanic App Date Filters Crashing** - Fixed infinite re-render loop caused by useCallback dependencies. Date filters now work correctly with explicit parameters.

3. **OTP Validation Intermittent Failure** - Moved OTP storage from in-memory to MongoDB (`mechanic_otps` collection) for persistence across multiple backend instances.

4. **Inspection Not Showing for Mechanic** - Enhanced mechanic inspection query to also match by `mechanic_name` as fallback for older records.

### New Features
1. **City Management UI** - Added to CRM Settings page under "City Master" tab
   - View all cities with states and aliases
   - Add new cities with optional aliases
   - Edit existing cities (name, state, aliases)
   - Activate/Deactivate cities
   - Search/filter cities
   - Stats dashboard showing active cities, total aliases, states count

2. **Employee Phone Number Validation** - Unique phone number enforcement
   - Create/Update employee endpoints now validate phone uniqueness
   - Clear error message showing which employee already has the number

3. **Twilio Balance in Settings** - Added Twilio account balance display
   - Shows balance alongside Fast2SMS in API Tokens tab
   - Handles trial accounts gracefully (shows "Balance not accessible")

### New APK Build
- **Download Link:** https://expo.dev/artifacts/eas/u3dg8YvBuCEGXumnsHoGeB.apk
- Contains all date filter fixes

### ⚠️ Mechanic App Issue
The mechanic app shows "Failed to load inspections" because it points to production server (`crmdev.wisedrive.com`) which hasn't been deployed with the latest backend code. **Deploy preview environment to production** to fix this.

## Original Problem Statement
Build a custom CRM for WiseDrive to manage leads from Meta (Facebook/Instagram) ads via WhatsApp, with flawless lead attribution and data integrity.

## Core Requirements
1. **Lead Attribution** - Capture Meta Ad ID (`ReferralSourceId`) for city mapping
2. **City Mapping** - Auto-assign cities based on Ad ID/Name mappings
3. **Ad Performance Sync** - Sync data from Meta Marketing API
4. **Authentication** - Manual token-paste flow for Meta API
5. **Debugging Tools** - Lead Investigator with Audit Trail

## User Personas
- **Admin/CEO** - Full access, lead management, analytics
- **Sales Team** - Lead follow-up, status updates, notes
- **Mechanics** - Mobile app for inspections (future)

---

## Completed Features (Feb 2026)

### Lead Attribution Engine ✅
- Twilio webhook captures `ReferralSourceId` as primary Ad ID
- Fallbacks: `ReferralCtwaClid` → auto-generated from ad_name
- City mapping from `ad_city_mappings` collection

### Lead Investigator & Audit Trail ✅
- Raw Twilio payload display
- Step-by-step processing log
- Debugging tool for attribution issues

### Meta Token Management ✅
- Manual token paste modal with Graph API Explorer guide
- Token status badge on Ad Analytics page
- Persistent storage in settings collection

### "Sync from Meta" Mappings ✅
- Auto-create ad-to-city mappings from Meta API
- "Remap All" for historical leads

### Questionnaire Category Reordering ✅
- Drag-and-drop with @dnd-kit library
- `category_order` array in inspection_templates

### Partner Assignment from Ad Mapping - Option C (Feb 22, 2026) ✅
- Extended Ad City Mappings with `partner_id` and `partner_name` fields
- Webhook assigns partner from ad_mapping if set, otherwise B2C Default
- Frontend: Partner dropdown in Create Ad form
- Frontend: Partner column in Ad Mappings table
- Complete flow: Ad Campaign → Ad Mapping → Lead gets Partner automatically

### Sales Executive Role Permissions (Feb 23, 2026) ✅
Tested and verified all 10 role-based permissions:
1. ✅ View only assigned leads
2. ✅ View only Leads Tab (sidebar restricted)
3. ✅ Edit lead details (name, mobile, notes)
4. ✅ Cannot reassign leads (button hidden)
5. ✅ Cannot change city (read-only field)
6. ✅ Admin buttons hidden (Assign Unassigned, Remap City, Investigate Lead)
7. ✅ Reminder functionality works
8. ✅ Status change works (any to any)
9. ✅ Notes and activity log works
10. ✅ Payment modal full functionality

### Leads Page 8-Point UI Fix (Feb 23, 2026) ✅
1. **Date filter above stat cards** - Date Range filter now positioned above stats
2. **Stat cards update with date filter** - Stats calculate from filtered leads
3. **Partner details removed from table** - City column shows only city name
4. **Source column simplified** - Shows source type + truncated Ad ID only (no ad_name)
5. **Notes column at end** - Column order: Date|Lead Details|City|Assigned|Reminder|Status|Source|Payment|Notes
6. **Reduced column gaps** - Lead Details 180px, City 90px
7. **Assigned column truncation** - Uses truncate class with max-w-[90px]
8. **City dropdown filtering** - Shows AD mapped cities + cities from leads

### Critical Bug Fix (Feb 23, 2026) ✅
- Fixed "Cannot access 'filteredLeads' before initialization" error
- Moved statsLeads calculation after filteredLeads declaration

### Global Loading Overlays (Feb 23, 2026) ✅
Added full-page loading overlays to all major pages for better UX during data fetching:
1. **Leads Page** - Shows "Loading leads..." during filter changes and initial load
2. **Customers Page** - Shows "Loading customers..." with blur backdrop
3. **Inspections Page** - Shows "Loading inspections..." during tab switches
4. **HR Module** - Shows "Loading attendance data..." for attendance dashboard
5. **Ads Management** - Shows "Loading..." for both performance and unmapped tabs
6. **Inspection Packages** - Shows "Loading packages..." during data fetch

All loaders use consistent design: white/80 backdrop with blur, centered spinner, descriptive text.

### Inspections Page Enhancements (Feb 23, 2026) ✅
1. **Mechanic Filtering by Inspection City** - Mechanics dropdown now filters by the inspection address city
   - Shows only mechanics who have that city in their `inspection_cities` array
   - Shows "Showing mechanics for: [City]" info badge
   - Shows warning if no mechanics available for the city
2. **Google Maps Address Integration** - Schedule Unscheduled modal now uses PlacesAutocomplete
   - Address field has Google Maps autocomplete
   - Extracts city from address components automatically
   - Updates both address and city fields on selection

### UI Enhancements (Feb 23, 2026) ✅
1. **Source Column Simplified** - Shows icon that opens Ad Info modal instead of inline AD ID
2. **Ad Info Modal** - Shows Source, AD ID, Ad Name, Campaign, Ad Set in a clean modal
3. **Cities View Quick Panel** - Popover showing cities assigned per sales executive
4. **Loading Overlay** - Full-page loader when initial data is loading
5. **Status Badge Fix** - Added `whitespace-nowrap` to prevent "RCB WhatsApp" from wrapping
6. **Employees API Fix** - Now returns actual `assigned_cities` array instead of just country

### Inspections Payment UI Enhancement (Feb 24, 2026) ✅
**Simplified Payment Column:**
- Shows only "Fully Paid" (green badge) or "Pending" (amber badge)
- Clickable badges with "Click for details" hint

**Payment Details Modal:**
- Customer info section with avatar, name, phone, package, vehicle
- Payment summary: Total Amount, Amount Paid, Pending Amount
- Status badge showing payment status
- **Collect Pending Payment section** (only shown when pending amount > 0):
  - Razorpay payment link generation
  - "Send via WhatsApp" button - creates and sends link automatically
  - "Generate Link" button - generates link to copy/share manually
  - Share options: Copy link, Open link, Share via WhatsApp

### Mechanic Filtering Fix (Feb 24, 2026) ✅
**Bug:** Mechanics with no cities assigned appeared in ALL city dropdowns
**Fix:** Changed filter from `mechanicCities.length === 0 || ...` to only `mechanicCities.includes(inspectionCity)`
**Location:** `/app/frontend/src/pages/InspectionsPage.jsx` lines 1806-1829

### Round-Robin Assignment Fix (Feb 23, 2026) ✅
**Root Cause:** Sales executives had no cities in their `assigned_cities` array
- Only Sneha Reddy had `assigned_cities: ['Vizag']`
- Amit Patel and Divya Krishnan had `assigned_cities: Not set`
- This meant leads from Bangalore, Chennai, Hyderabad, etc. were UNASSIGNED

**Fix Applied:**
1. Assigned ALL Indian cities to ALL sales executives
2. Reset round-robin counters to ensure fair distribution
3. Ran "Assign Unassigned" to distribute 18 unassigned leads

**Result:** Distribution improved from Sneha (37), others (18 each), Unassigned (18) → Sneha (47), Amit (24), Divya (24), Unassigned (0)

### Leads Filter Fixes (Feb 23, 2026) ✅
Fixed 3 critical issues reported by user:
1. **Employee filter switching** - Backend now filters by both UUID and name
2. **Date filter updates stats** - Backend accepts date_from/date_to params, stats reflect API-filtered data
3. **All Leads card added** - Purple card showing total leads count

### Refactoring Progress (Feb 23, 2026) ✅
**Backend:**
- Updated `/app/backend/routes/auth.py` with factory pattern (`create_auth_router`)
- Production-ready auth module with dependency injection
- Backward compatible with existing code

**Frontend:**
- Integrated `LeadStats` component into `LeadsPage.jsx`
- Integrated `LeadFilters` component into `LeadsPage.jsx`
- Updated `useLeads` hook with full feature parity to LeadsPage
- Reduced LeadsPage.jsx from 3,272 to 3,152 lines (120 lines)
- Stats cards now use extracted component with click-to-filter functionality
- Filters now use extracted component with role-based visibility

### Activity Log Scroll Height Fix (Feb 23, 2026) ✅
- **Problem:** Massive gray empty space between tabs and activity log content - content not starting at top
- **Root Cause:** 
  1. Radix UI TabsContent doesn't properly fill flex containers
  2. `flex-1` on TabsContent doesn't work because the component doesn't grow
  3. ScrollArea needs explicit height constraints to work properly
- **Fix:** 
  1. Wrapped both TabsContent elements in a `relative` container with `flex-1 min-h-0 overflow-hidden`
  2. Used `absolute inset-0` on each TabsContent to fill the entire container
  3. Content now starts IMMEDIATELY below tabs with no wasted space
- **Location:** `/app/frontend/src/pages/LeadsPage.jsx` - Notes & Activities tabs (lines ~2992-3056)
- **Result:** Both tabs now fill entire available height from tabs to bottom with internal scrolling

---

## Pending Issues

### P2: City Filter by User Role
- **Status:** Needs verification
- **Problem:** Country Manager should see only their country's cities, CEO sees all
- **Location:** `/app/frontend/src/pages/LeadsPage.jsx` - filteredCities logic

---

## Technical Architecture

### Backend
- **Framework:** FastAPI
- **Database:** MongoDB
- **Main file:** `/app/backend/server.py` (~13,890 lines - refactoring in progress)
- **Modular Routes:** `/app/backend/routes/`
  - `auth.py` - Authentication routes (UPDATED - factory pattern with `create_auth_router`)
  - `leads.py` - Lead management (template ready)
  - `partners.py` - Partner CRUD (template ready)
  - `webhooks.py` - Twilio webhooks (template ready)
  - `meta_ads.py` - Meta API integration (template ready)
  - `inspections.py` - Inspection management (template ready)

### Frontend
- **Framework:** React with Shadcn/UI
- **Main file:** `/app/frontend/src/pages/LeadsPage.jsx` (~3,197 lines - reduced from 3,272)
- **Extracted Components:** `/app/frontend/src/components/leads/`
  - `StatusDropdown.jsx` - Lead status dropdown (INTEGRATED)
  - `ActivityLog.jsx` - Activity history (INTEGRATED)
  - `LeadStats.jsx` - Stats cards with filtering (INTEGRATED - Feb 23)
  - `LeadFilters.jsx` - Filter UI (ready for integration)
- **Custom Hooks:** `/app/frontend/src/hooks/`
  - `useLeads.js` - Lead data management (ready for integration)
- **Dependencies:** @dnd-kit/core for drag-and-drop, date-fns-tz for timezone

### Key Collections
- `leads` - Lead data with ad_id, city, status
- `ad_city_mappings` - Ad ID/Name to city mappings
- `settings` - Meta API token storage
- `inspection_templates` - With category_order

### Key Endpoints
- `POST /api/webhooks/twilio/whatsapp` - Lead capture
- `POST /api/meta-ads/sync-ad-name-mappings` - Sync mappings
- `POST /api/leads/auto-remap-by-ad-id` - Bulk city fix
- `GET /api/meta-ads/token-info` - Token status

---

## Future Roadmap

### P0 - Technical Debt
- Refactor `server.py` into APIRouter modules
- Refactor `LeadsPage.jsx` into components

### P1 - Mechanic Mobile App
- Fix APK build process
- Implement questionnaire flow
- Add "Reject Reason" modal

### P2 - CRM Enhancements
- PDF export for inspection reports
- "Share via WhatsApp" feature
- Customer reminders

---

## Test Credentials
- **CRM:** kalyan@wisedrive.com / password123 (India)
- **Mechanic App:** 9611188788 / OTP: 123456

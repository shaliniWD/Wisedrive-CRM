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
| **Google Maps Places API** | **LIVE** | **Address autocomplete in payment modal** |
| **Vaahan (Invincible Ocean)** | **LIVE** | **Vehicle RC details (100% real-time)** |
| Twilio | LIVE | WhatsApp messaging for lead ingestion |
| Razorpay | LIVE | Payment links and webhook |
| Firebase (FCM) | LIVE | Push notifications |
| Expo (EAS) | LIVE | Mobile app builds |

---

## API Credentials

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

## Future Tasks (Backlog)

### P0 - UAT & Deployment
- [x] **Critical Bug Fix: Lead Auto-Assignment (February 17, 2026)**
- [x] **CTO Role Permissions Fix (February 17, 2026)**
- [x] **Inspection Package Payment Enhancements (February 18, 2026)**
- [ ] User Acceptance Testing for Payment Modal changes
- [ ] User Acceptance Testing for complete Leads Module
- [ ] Implement "Collect Balance" button in Inspections tab for remaining payment collection
- [ ] Production deployment

### P1 - CRM Modules
- [ ] Inspections Module (view scheduled/unscheduled inspections)
- [ ] Customer Module

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
- **Last Updated:** February 18, 2026
- **Version:** 2.6

## Changelog
- v2.6 (Feb 18, 2026): **Inspection Package Payment Enhancements** - Added partial payment support (fixed/percentage), discount configuration, and promotional offers management. New Offers tab in Settings with CRUD operations. Package modal updated with toggles for partial payments, discounts, and offer linking.
- v2.5 (Feb 17, 2026): **CTO Role Permissions Fix** - Copied 29 role_permissions from CEO role to CTO role, enabling full data access for the new CTO user
- v2.4 (Feb 17, 2026): **Critical Bug Fix: Lead Auto-Assignment** - Fixed query to correctly use role_id lookup against roles collection, check assigned_cities array, and is_available_for_leads flag
- v2.3 (Feb 16, 2026): **Payment Modal Enhancements** - Removed "Number of Cars", added conditional inspection scheduling with Google Places autocomplete, leads-to-inspections integration
- v2.2 (Feb 16, 2026): Vaahan API integration - Real vehicle RC data from Invincible Ocean API
- v2.1 (Feb 16, 2026): RBAC for Sales Executives - leads filtering, Leads-only tab visibility
- v2.0 (Feb 16, 2026): Leads Management frontend integration complete
- v1.6 (Dec 2025): Bug fixes and Leave Rules feature

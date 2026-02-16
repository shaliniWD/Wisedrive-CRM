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
- [ ] User Acceptance Testing for Payment Modal changes
- [ ] User Acceptance Testing for complete Leads Module
- [ ] Production deployment

### P1 - CRM Modules
- [ ] Inspections Module (view scheduled/unscheduled inspections)
- [ ] Customer Module

### P2 - Integrations
- [ ] OBD-Integration-v1.0

---

## Document History
- **Created:** December 2025
- **Last Updated:** February 16, 2026
- **Version:** 2.3

## Changelog
- v2.3 (Feb 16, 2026): **Payment Modal Enhancements** - Removed "Number of Cars", added conditional inspection scheduling with Google Places autocomplete, leads-to-inspections integration
- v2.2 (Feb 16, 2026): Vaahan API integration - Real vehicle RC data from Invincible Ocean API
- v2.1 (Feb 16, 2026): RBAC for Sales Executives - leads filtering, Leads-only tab visibility
- v2.0 (Feb 16, 2026): Leads Management frontend integration complete
- v1.6 (Dec 2025): Bug fixes and Leave Rules feature

# Wisedrive CRM & ESS Mobile App - Product Requirements Document

## Original Problem Statement
Build a scalable automotive platform "Wisedrive" that evolved into a monolithic CRM application with an Employee Self-Service (ESS) mobile application.

## Core Applications
1. **CRM Web Application** - Employee, HR, and Leads management
2. **ESS Mobile App** - Employee self-service (React Native/Expo)

---

## Completed Features

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
- Tax Valid Upto, Fitness
- Technical Specs (Cubic Capacity, Weight, Seating, Cylinders)
- Financed Status, Blacklist Status, Commercial Status

**API Endpoints Created:**
- `GET /api/vehicle/details/{vehicle_number}` - Fetch from Vaahan API
- `POST /api/vehicles` - Save vehicle to database (vehicle master)
- `GET /api/vehicles/{vehicle_id}` - Get vehicle by ID
- `GET /api/vehicles/by-registration/{registration_number}` - Get by reg number

**Frontend Integration:**
- Payment modal now uses real Vaahan API (not mocked)
- Shows comprehensive vehicle info with owner, insurance, RC expiry
- Saves vehicle to vehicle master when creating payment link

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
| **Vaahan (Invincible Ocean)** | **LIVE** | **Vehicle RC details (100% real-time)** |
| Twilio | LIVE | WhatsApp messaging for lead ingestion |
| Razorpay | LIVE | Payment links and webhook |
| Firebase (FCM) | LIVE | Push notifications |
| Expo (EAS) | LIVE | Mobile app builds |

---

## API Credentials

### Vaahan API (Invincible Ocean)
- **Endpoint:** `https://api.invincibleocean.com/invincible/vehicleRcV6`
- **Client ID:** Stored in `/app/backend/.env` as `VAAHAN_CLIENT_ID`
- **Secret Key:** Stored in `/app/backend/.env` as `VAAHAN_SECRET_KEY`
- **Test Vehicle:** KA48N1000 (Ford Endeavor 2017 White Diesel Automatic)

---

## Test Results

### Latest Test: Vaahan Integration (February 2026)
- **Backend:** Vehicle API endpoints working (100%)
- **Frontend:** Payment modal fetches real vehicle data (100%)
- **Test Vehicle:** KA48N1000 returns Ford Endeavor 2017 White Diesel

### Test Credentials
| Role | Email | Password |
|------|-------|----------|
| HR Manager | hr@wisedrive.com | password123 |
| Sales Executive | salesexec3.in@wisedrive.com | password123 |

---

## Architecture

```
/app/
├── backend/
│   ├── services/
│   │   ├── vaahan_service.py    # NEW: Vaahan API integration
│   │   ├── rbac.py              # Role-based access control
│   │   ├── twilio_service.py    # Twilio WhatsApp
│   │   └── razorpay_service.py  # Razorpay payments
│   └── server.py                # API endpoints including /api/vehicle/*
├── ess-mobile-app/              # React Native (Expo) app
└── frontend/
    ├── src/
    │   ├── services/
    │   │   └── api.js           # vehicleApi functions
    │   └── pages/
    │       └── LeadsPage.jsx    # Vaahan integration in payment modal
```

---

## Future Tasks (Backlog)

### P0 - UAT & Deployment
- [ ] User Acceptance Testing for complete Leads Module
- [ ] Production deployment

### P1 - CRM Modules
- [ ] Inspections Module
- [ ] Customer Module

### P2 - Integrations
- [ ] OBD-Integration-v1.0

---

## Document History
- **Created:** December 2025
- **Last Updated:** February 16, 2026
- **Version:** 2.2

## Changelog
- v2.2 (Feb 16, 2026): **Vaahan API integration** - Real vehicle RC data fetching from Invincible Ocean API, vehicle master database
- v2.1 (Feb 16, 2026): RBAC for Sales Executives - leads filtering by assigned_to, Leads-only tab visibility
- v2.0 (Feb 16, 2026): Leads Management frontend integration complete
- v1.6 (Dec 2025): Bug fixes and Leave Rules feature

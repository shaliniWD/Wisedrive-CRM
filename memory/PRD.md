# Wisedrive CRM & ESS Mobile App - Product Requirements Document

## Original Problem Statement
Build a scalable automotive platform "Wisedrive" that evolved into a monolithic CRM application with an Employee Self-Service (ESS) mobile application.

## Core Applications
1. **CRM Web Application** - Employee, HR, and Leads management
2. **ESS Mobile App** - Employee self-service (React Native/Expo)

## User Personas
- **CEO** - Full system access
- **HR Manager** - Employee, payroll, leave management, leads view
- **Sales Agents** - Leads management, payment links
- **Employees** - Self-service access via mobile app

---

## Completed Features

### ✅ Leads Management Module (December 2025)

**Phase 1 - Lead Creation via Twilio WhatsApp:**
- Webhook: `/api/webhooks/twilio/whatsapp`
- Receives Meta ad clicks, extracts ad_id, maps to city
- Creates lead with status "NEW LEAD"

**Phase 2 - Lead Management:**
- 22 lead statuses implemented (NEW LEAD, RNR, RNR1-3, FOLLOW UP, WHATSAPP FOLLOW UP, etc.)
- Round-robin assignment to sales reps by city
- Filtering by status, city, employee, search

**Phase 3 - Follow-up:**
- Lead notes with activity logging
- Reminder system with scheduled notifications
- Status change tracking in Activity Log

**Phase 4 - Payment (Razorpay):**
- Payment link creation: `/api/leads/{id}/payment-link`
- WhatsApp send via Twilio
- Webhook: `/api/webhooks/razorpay/payment`
- Auto-creates customer on payment confirmation

**Frontend UI (February 2026):**
- Summary cards (New Leads Today, Hot Leads, RCB WhatsApp, Follow Up, Payment Link Sent)
- Leads table with 9 columns: Date, Lead Details, City, Assigned, Reminder, Status, Notes, Source, Payment Link
- Inline status dropdown with all 22 statuses
- Notes drawer with Notes and Activity Log tabs
- Add Lead modal with all fields
- Payment Link modal with car details and package selection

### ✅ Leave Rules Feature (December 2025)
- Period-based leave allocation (monthly/quarterly)
- No carry forward policy
- CRM APIs to configure rules
- ESS mobile app updated with period-based balance display

### ✅ Bug Fixes (December 2025)
- Password reset issue fixed
- Documents sync between CRM and ESS fixed
- Salary tab persistence fixed
- Custom role access (RBAC) fixed
- HR Roles module bugs fixed (5 bugs)

---

## API Endpoints

### Leads API
- `GET /api/leads` - List leads with filters
- `POST /api/leads` - Create new lead
- `PUT /api/leads/{id}` - Update lead
- `PATCH /api/leads/{id}/status` - Inline status update
- `DELETE /api/leads/{id}` - Delete lead
- `GET /api/leads/statuses` - Get all 22 statuses
- `POST /api/leads/{id}/notes` - Add note
- `GET /api/leads/{id}/notes` - Get notes
- `GET /api/leads/{id}/activities` - Get activity log
- `POST /api/leads/{id}/payment-link` - Create Razorpay payment link
- `POST /api/leads/{id}/reassign` - Reassign lead to another agent

### Webhooks
- `POST /api/webhooks/twilio-whatsapp` - Twilio WhatsApp webhook
- `POST /api/webhooks/razorpay` - Razorpay payment webhook

---

## Test Results

### Latest Test: Iteration 43 (February 2026)
- **Backend:** 20/20 tests passed (100%)
- **Frontend:** All UI features verified (100%)
- **Test file:** `/app/backend/tests/test_lead_management.py`

### Test Credentials
- **CRM URL:** https://autoleads-app-1.preview.emergentagent.com
- **HR User:** hr@wisedrive.com / password123
- **Country:** India (IN)

---

## Third-Party Integrations

| Service | Status | Purpose |
|---------|--------|---------|
| Twilio | LIVE | WhatsApp messaging for lead ingestion |
| Razorpay | LIVE | Payment links and webhook |
| Firebase (FCM) | LIVE | Push notifications |
| Expo (EAS) | LIVE | Mobile app builds |
| Vaahan API | MOCKED | Car registration details lookup |

---

## Mobile App Builds

### Latest Build: v1.2.0 (with Leave Rules)
- **Android APK:** https://expo.dev/artifacts/eas/7W4cXsbCUAyC8bSdcbFL63.apk
- **iOS IPA:** https://expo.dev/artifacts/eas/3Z4u5m65Ykd7UteqTZa22V.ipa

---

## Future Tasks (Backlog)

### P1 - UAT & Deployment
- [ ] User Acceptance Testing for Leads Module
- [ ] Production deployment

### P2 - CRM Modules
- [ ] Inspections Module
- [ ] Customer Module

### P3 - Integrations
- [ ] OBD-Integration-v1.0
- [ ] Vaahan API (real integration)
- [ ] Invincible Ocean clients integration

### P4 - Enhancements
- [ ] Screen height adjustment verification (iOS vs Android)

---

## Architecture

```
/app/
├── backend/
│   ├── models/
│   │   ├── lead.py             # 22 lead statuses, Lead models
│   │   └── leave_rules.py      # Leave rules model
│   ├── routes_ess/
│   │   ├── leave.py            # ESS leave APIs with rules
│   │   └── documents.py        # ESS documents API
│   ├── services/
│   │   ├── rbac.py             # Role-based access control
│   │   ├── twilio_service.py   # Twilio WhatsApp integration
│   │   └── razorpay_service.py # Razorpay payment integration
│   └── server.py               # Main API server with Leads, Leave Rules
├── ess-mobile-app/             # React Native (Expo) app
└── frontend/
    ├── src/pages/
    │   ├── LeadsPage.jsx       # Leads management UI
    │   └── AdminPage.jsx       # HR module with employees, roles
    └── src/services/
        └── api.js              # API client functions
```

---

## Document History
- **Created:** December 2025
- **Last Updated:** February 16, 2026
- **Version:** 2.0

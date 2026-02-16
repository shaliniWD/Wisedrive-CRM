# Wisedrive CRM & ESS Mobile App - Product Requirements Document

## Original Problem Statement
Build a scalable automotive platform "Wisedrive" that evolved into a monolithic CRM application with an Employee Self-Service (ESS) mobile application.

## Core Applications
1. **CRM Web Application** - Employee, HR, and Leads management
2. **ESS Mobile App** - Employee self-service (React Native/Expo)

## User Personas
- **CEO** - Full system access
- **HR Manager** - Employee, payroll, leave management, leads view (all leads)
- **Sales Executives** - Leads management (only their assigned leads), payment links
- **Employees** - Self-service access via mobile app

---

## Completed Features

### ✅ Leads Management Module (February 2026)

**RBAC Implementation:**
- Sales Executives only see Leads tab (no Dashboard, HR Module, Finance)
- Sales Executives only see leads assigned to them (filtered by `assigned_to` field)
- HR Manager sees Leads, HR Module, Finance tabs
- HR Manager can see and manage all leads
- Summary cards show role-appropriate counts

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

**Frontend UI:**
- Summary cards (New Leads Today, Hot Leads, RCB WhatsApp, Follow Up, Payment Link Sent)
- Leads table with 9 columns: Date, Lead Details, City, Assigned, Reminder, Status, Notes, Source, Payment Link
- Inline status dropdown with all 22 statuses
- Notes drawer with Notes and Activity Log tabs
- Add Lead modal with all fields
- Payment Link modal with car details and package selection
- RBAC-aware Employee filter (dropdown for managers, static text for sales execs)
- Reassign button hidden for Sales Executives

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

## RBAC Configuration

### Tab Visibility by Role
| Role | Visible Tabs |
|------|-------------|
| CEO | leads, customers, inspections, reports, hr, settings, finance |
| HR_MANAGER | leads, hr, finance |
| FINANCE_MANAGER | finance, hr |
| COUNTRY_HEAD | leads, customers, inspections, reports, hr, settings, finance |
| SALES_HEAD | leads, customers, hr |
| SALES_LEAD | leads, customers, hr |
| **SALES_EXEC** | **leads** (ONLY) |
| INSPECTION_HEAD | customers, inspections, reports, hr |
| MECHANIC | hr |
| FREELANCER | hr |

### Data Scope for Leads
| Role | Leads Access |
|------|-------------|
| CEO | All leads (no filter) |
| HR_MANAGER | All leads in their country |
| SALES_EXEC | Only leads assigned to them (`assigned_to` = user_id) |

---

## API Endpoints

### Leads API
- `GET /api/leads` - List leads (RBAC filtered)
- `POST /api/leads` - Create new lead
- `PUT /api/leads/{id}` - Update lead
- `PATCH /api/leads/{id}/status` - Inline status update
- `DELETE /api/leads/{id}` - Delete lead
- `GET /api/leads/statuses` - Get all 22 statuses
- `POST /api/leads/{id}/notes` - Add note
- `GET /api/leads/{id}/notes` - Get notes
- `GET /api/leads/{id}/activities` - Get activity log
- `POST /api/leads/{id}/payment-link` - Create Razorpay payment link
- `POST /api/leads/{id}/reassign` - Reassign lead (blocked for SALES_EXEC)

### Auth API
- `POST /api/auth/login` - Returns `visible_tabs` in user object
- `GET /api/auth/me` - Returns full user with `visible_tabs` and `permissions`

---

## Test Results

### Latest Test: Iteration 44 (February 2026)
- **Backend:** 8/8 tests passed (100%)
- **Frontend:** All RBAC features verified (100%)
- **Test file:** `/app/backend/tests/test_rbac_leads.py`

### Test Credentials
| Role | Email | Password |
|------|-------|----------|
| Sales Executive | salesexec3.in@wisedrive.com | password123 |
| HR Manager | hr@wisedrive.com | password123 |

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

### P0 - UAT & Deployment
- [ ] User Acceptance Testing for Leads Module
- [ ] Production deployment

### P1 - CRM Modules
- [ ] Inspections Module
- [ ] Customer Module

### P2 - Integrations
- [ ] OBD-Integration-v1.0
- [ ] Vaahan API (real integration)
- [ ] Invincible Ocean clients integration

### P3 - Enhancements
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
│   │   ├── rbac.py             # Role-based access control (TAB_VISIBILITY, get_data_filter)
│   │   ├── twilio_service.py   # Twilio WhatsApp integration
│   │   └── razorpay_service.py # Razorpay payment integration
│   ├── tests/
│   │   └── test_rbac_leads.py  # RBAC test suite
│   └── server.py               # Main API server
├── ess-mobile-app/             # React Native (Expo) app
└── frontend/
    ├── src/
    │   ├── components/layout/
    │   │   └── TopNavbar.jsx   # RBAC-aware navigation
    │   ├── pages/
    │   │   └── LeadsPage.jsx   # RBAC-aware leads management
    │   ├── contexts/
    │   │   └── AuthContext.js  # User state with visibleTabs
    │   └── App.js              # SmartRedirect for tab routing
```

---

## Document History
- **Created:** December 2025
- **Last Updated:** February 16, 2026
- **Version:** 2.1

## Changelog
- v2.1 (Feb 16, 2026): Added RBAC for Sales Executives - leads filtering by assigned_to, Leads-only tab visibility, hidden reassign button
- v2.0 (Feb 16, 2026): Leads Management frontend integration complete
- v1.6 (Dec 2025): Bug fixes and Leave Rules feature

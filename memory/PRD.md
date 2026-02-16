# WiseDrive CRM + ESS Mobile App - Product Requirements Document

## Project Overview
WiseDrive is a scalable automotive platform with a CRM system and an Employee Self-Service (ESS) mobile application.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    crmdev.wisedrive.com                      │
│                    (Stable Custom Domain)                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
        ▼                           ▼
┌───────────────────┐     ┌───────────────────┐
│   CRM Frontend    │     │   ESS Mobile App  │
│   (React)         │     │   (React Native)  │
│   Port 3000       │     │   iOS + Android   │
└───────────────────┘     └───────────────────┘
        │                           │
        └─────────────┬─────────────┘
                      │
                      ▼
        ┌───────────────────────────┐
        │   FastAPI Backend         │
        │   /api/* (CRM routes)     │
        │   /api/ess/v1/* (Mobile)  │
        │   Port 8001               │
        └───────────────────────────┘
                      │
                      ▼
        ┌───────────────────────────┐
        │   MongoDB Database        │
        │   (Shared between CRM     │
        │    and Mobile App)        │
        └───────────────────────────┘
```

## Completed Features

### ESS Mobile App (Updated February 16, 2026)
- ✅ React Native (Expo) mobile application
- ✅ Authentication with JWT tokens and device sessions
- ✅ Employee Profile viewing (Personal, Bank, Salary tabs)
- ✅ **Salary Structure matching CRM exactly:**
  - Earnings: Basic Salary, HRA, Variable Pay/Incentives, Conveyance, Medical Allowance, Special Allowance
  - Deductions: PF (Employee), Professional Tax, Income Tax (TDS), Other Deductions
- ✅ Leave Management (apply, view balance, history)
- ✅ Payslips viewing with year filter
- ✅ Documents management
- ✅ Holiday Calendar
- ✅ Push Notifications (FCM integrated)
- ✅ **Professional Light Theme:**
  - Clean white background (#FFFFFF) with blue accents (#2563EB)
  - Modern minimalist UI
  - **Hub-based navigation from HomeScreen (no bottom tab bar)**
  - All screens have back buttons for navigation
- ✅ Pointing to stable domain: `crmdev.wisedrive.com`

### ESS API Routes (Integrated in Main Backend)
- ✅ `/api/ess/v1/auth/*` - Authentication (login, logout, refresh)
- ✅ `/api/ess/v1/profile/*` - Profile, salary (individual fields), attendance
- ✅ `/api/ess/v1/leave/*` - Leave management
- ✅ `/api/ess/v1/payslips/*` - Payslip viewing
- ✅ `/api/ess/v1/documents/*` - Document management
- ✅ `/api/ess/v1/holidays` - Holiday calendar
- ✅ `/api/ess/v1/notifications/*` - Push notifications

### CRM Features
- ✅ Multi-tenant RBAC system
- ✅ Employee management
- ✅ Attendance tracking
- ✅ Payroll management
- ✅ Leave management
- ✅ Notification Configuration UI for HR
- ✅ **Inspection Packages (NEW - February 16, 2026):**
  - Settings > Inspection Packages tab
  - Create/Edit/Delete inspection categories with check points, items, and benefits
  - Create/Edit/Delete packages that include multiple categories
  - Package pricing with currency support
  - Recommended badge for featured packages
  - Country-based filtering
  - Soft delete support (deactivate instead of hard delete)

### Integrations
- ✅ Firebase Cloud Messaging (FCM) for push notifications
- ✅ Expo Application Services (EAS) for mobile builds

## Key Files

### Mobile App
- `/app/ess-mobile-app/` - React Native Expo project
- `/app/ess-mobile-app/src/services/config.ts` - API endpoint config
- `/app/ess-mobile-app/src/context/AuthContext.tsx` - Auth with cache clearing
- `/app/ess-mobile-app/src/screens/HomeScreen.tsx` - Main navigation hub
- `/app/ess-mobile-app/src/screens/ProfileScreen.tsx` - Profile with salary structure
- `/app/ess-mobile-app/eas.json` - EAS build configuration

### Backend ESS Routes
- `/app/backend/routes_ess/auth.py` - Authentication
- `/app/backend/routes_ess/profile.py` - Profile, salary (individual fields), holidays
- `/app/backend/models_ess/profile.py` - SalarySummary model with all CRM fields
- `/app/backend/routes_ess/leave.py` - Leave management
- `/app/backend/routes_ess/payslips.py` - Payslips
- `/app/backend/routes_ess/documents.py` - Documents
- `/app/backend/routes_ess/notifications.py` - Notifications

### Firebase
- `/app/ess/api/firebase-credentials.json` - FCM service account

### Inspection Packages
- `/app/backend/models/inspection_package.py` - Data models for categories and packages
- `/app/backend/server.py` - API routes for inspection-categories and inspection-packages
- `/app/frontend/src/pages/InspectionPackagesPage.jsx` - Frontend component
- `/app/frontend/src/services/api.js` - `inspectionPackagesApi` endpoints

## Test Credentials
All users use password: `password123`

| Email | Role |
|-------|------|
| kalyan@wisedrive.com | CEO |
| hr@wisedrive.com | HR Manager |
| countryhead.in@wisedrive.com | Country Head |
| finance.in@wisedrive.com | Finance Manager |
| salesexec1.in@wisedrive.com | Sales Exec |

## Deployment Workflow

### CRM Changes Only
1. Make changes in CRM code
2. Click "Deploy" in Emergent
3. Mobile app automatically gets updated data (no rebuild needed)

### Mobile App Changes Only
1. Make changes in mobile app code
2. Run EAS build: `npx eas-cli build --platform all --profile preview`
3. Download and install new APK/IPA
4. CRM doesn't need redeployment

### Both Changes
1. Make changes in both
2. Deploy CRM first
3. Then build mobile app

## Future Tasks / Backlog

### P0 - Immediate (To Complete Project)
- [x] Build final APK/IPA with new design ✅ DONE
- [x] Salary structure matching CRM exactly ✅ DONE
- [x] Navigation restructuring (hub-based) ✅ DONE
- [x] Inspection Packages feature in Settings ✅ DONE (February 16, 2026)
- [ ] User acceptance testing on actual mobile devices (IN PROGRESS)

### P1 - High Priority
- [ ] Leads module in CRM (next up)
- [ ] Production Firebase setup (replace test credentials)
- [ ] App Store / Play Store submission preparation

### P2 - Medium Priority
- [ ] Implement Inspections module in CRM (record actual inspections using packages)
- [ ] Implement Customer module in CRM
- [ ] OBD Integration library integration

### P3 - Low Priority
- [ ] Razorpay payment integration
- [ ] Invincible Ocean client integration
- [ ] Microservices architecture migration

## Build Information

### Latest Mobile Builds (February 16, 2026)
- **Design:** ✅ Professional Light Theme (Blue/White)
- **Navigation:** ✅ Hub-based from HomeScreen (no bottom tabs)
- **Salary Structure:** ✅ Individual earnings/deductions matching CRM
- **API Endpoint:** https://crmdev.wisedrive.com/api (✅ Confirmed)
- **Theme:** Light (#FFFFFF background, #2563EB primary)

### Build Install Links (Scan QR or open on device)
- **Android:** https://expo.dev/accounts/kalyandhar/projects/wisedrive-ess/builds/3486573f-de79-4efe-b91b-b109f82b59bb
- **iOS:** https://expo.dev/accounts/kalyandhar/projects/wisedrive-ess/builds/9526e90e-069f-466a-9dc4-da5cb8a13209

### Expo Project
- **Account:** @kalyandhar
- **Project:** wisedrive-ess
- **Bundle ID:** com.wisedrive.ess

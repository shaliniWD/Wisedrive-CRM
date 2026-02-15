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

### ESS Mobile App (February 2026)
- ✅ React Native (Expo) mobile application
- ✅ Authentication with JWT tokens and device sessions
- ✅ Employee Profile viewing
- ✅ Leave Management (apply, view balance, history)
- ✅ Payslips viewing
- ✅ Documents management
- ✅ Holiday Calendar
- ✅ Push Notifications (FCM integrated)
- ✅ React Query cache clearing on logout
- ✅ Pointing to stable domain: `crmdev.wisedrive.com`
- ✅ **Premium Dark Theme Redesign (December 2025)**
  - Dark background (#0B1120) with blue accents (#3B82F6)
  - Modern minimalist UI with refined fonts and icons
  - Floating bottom tab navigation with gradients
  - Bento grid dashboard layout
  - Proper SafeAreaInsets handling for iOS/Android
  - All testID attributes for testing

### ESS API Routes (Integrated in Main Backend)
- ✅ `/api/ess/v1/auth/*` - Authentication (login, logout, refresh)
- ✅ `/api/ess/v1/profile/*` - Profile, salary, attendance
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

### Integrations
- ✅ Firebase Cloud Messaging (FCM) for push notifications
- ✅ Expo Application Services (EAS) for mobile builds

## Key Files

### Mobile App
- `/app/ess-mobile-app/` - React Native Expo project
- `/app/ess-mobile-app/src/services/config.ts` - API endpoint config
- `/app/ess-mobile-app/src/context/AuthContext.tsx` - Auth with cache clearing
- `/app/ess-mobile-app/eas.json` - EAS build configuration

### Backend ESS Routes
- `/app/backend/routes_ess/auth.py` - Authentication
- `/app/backend/routes_ess/profile.py` - Profile & holidays
- `/app/backend/routes_ess/leave.py` - Leave management
- `/app/backend/routes_ess/payslips.py` - Payslips
- `/app/backend/routes_ess/documents.py` - Documents
- `/app/backend/routes_ess/notifications.py` - Notifications

### Firebase
- `/app/ess/api/firebase-credentials.json` - FCM service account

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

### P1 - High Priority
- [ ] Production Firebase setup (replace test credentials)
- [ ] App Store / Play Store submission preparation
- [ ] User acceptance testing (UAT)

### P2 - Medium Priority
- [ ] Implement Leads module in CRM
- [ ] Implement Inspections module in CRM
- [ ] Implement Customer module in CRM
- [ ] OBD Integration library integration

### P3 - Low Priority
- [ ] Razorpay payment integration
- [ ] Invincible Ocean client integration
- [ ] Microservices architecture migration

## Build Information

### Latest Mobile Builds (February 15, 2026)
- **Android APK:** https://expo.dev/artifacts/eas/tpw3QaCnWueUXHeCVbkqio.apk
- **iOS IPA:** https://expo.dev/artifacts/eas/oP9RLSZQxB56RNQNYqB88r.ipa
- **API Endpoint:** https://crmdev.wisedrive.com/api

### Expo Project
- **Account:** @kalyandhar
- **Project:** wisedrive-ess
- **Bundle ID:** com.wisedrive.ess

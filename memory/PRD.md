# WiseDrive CRM & Mechanic App - Product Requirements

## Original Problem Statement
Build and maintain a CRM system for WiseDrive with an integrated React Native mechanic mobile app. The mechanic app allows field mechanics to perform vehicle inspections by answering configured questions (text, photo, video, multiple choice) and sub-questions.

## Current Status (v1.4.0) - 2026-02-26
**All critical bugs from v1.3.1 addressed:**
- Fixed profile version display (was hardcoded "1.0.0")
- Improved image compression (target <100KB per image)
- Fixed backend inspection_status bug (was setting "IN_PROGRESS" instead of "INSPECTION_STARTED")

## User Personas
1. **Admins**: Use CRM to manage inspections, configure questionnaires, track mechanics
2. **Mechanics**: Use mobile app to perform inspections, answer questions, capture photos/videos
3. **Customers**: Vehicle owners receiving inspection reports

## Core Requirements

### CRM (Web Application)
- Admin dashboard with inspection management
- Questionnaire builder with complex question types
- Live progress tracking of inspections
- Mechanic management
- Activity logging

### Mechanic App (React Native)
- OTP-based login for mechanics
- View assigned inspections
- Answer questions with multiple input types:
  - Multiple Choice
  - Photo capture
  - Video capture
  - Combined types (MCQ + Photo, MCQ + Video)
  - Sub-questions with independent answer types
- Offline capability (future)
- Real-time sync with backend

## What's Been Implemented

### Recent Fixes (v1.4.0) - 2026-02-26
- Profile now shows correct app version from app.json via expo-constants
- Image compression improved: 3-step compression targeting <100KB
- Backend fix: progress save now correctly sets inspection_status to "INSPECTION_STARTED"
- This ensures inspections show "Continue" instead of "Accept" after starting

### Build History
- v1.4.0: Profile version fix, image compression, status bug fix (current)
- v1.3.1: Aggressive image compression, API retry logic
- v1.3.0: Removed custom logger, added expo-image-manipulator, questionnaire caching
- v1.2.2: expo-clipboard fix
- v1.2.1: Category answer count refresh fix
- v1.2.0: "Save & Next" with AsyncStorage drafts
- v1.1.4: Debug logging system (removed in v1.3.0)

## Architecture

```
/app/
├── backend/
│   └── server.py           # FastAPI backend (v2.4.6)
├── frontend/
│   └── src/pages/          # React CRM pages
│       └── InspectionsPage.jsx
└── mechanic-app-native/
    ├── app.json            # Version: 1.4.0
    ├── app/
    │   ├── profile.tsx     # Shows version from Constants
    │   ├── home.tsx        # Inspection list with status logic
    │   └── category/[...params].tsx  # Question answering with image compression
    └── src/
        └── lib/api.ts      # API client with caching and retry logic
```

## Key API Endpoints
- `POST /api/mechanic/inspections/{id}/progress` - Save answer (sets status to INSPECTION_STARTED)
- `GET /api/mechanic/inspections/{id}` - Get inspection with answers
- `GET /api/mechanic/inspections` - List inspections (maps status for app)
- `GET /api/inspections/{id}/questionnaire` - Get questions
- `GET /api/inspections/{id}/live-progress` - CRM live progress view

## Third-Party Integrations
- Fast2SMS: Mechanic OTP
- Twilio: WhatsApp messages
- Razorpay: Payments
- Google Maps Places API: Address editing
- EAS (Expo Application Services): APK builds
- expo-image-manipulator: Client-side image compression
- expo-constants: App version display

## Known Issues / Limitations
- **Environment Mismatch**: Mechanic app saves to production (crmdev.wisedrive.com), CRM reads from preview backend. User must change REACT_APP_BACKEND_URL in /app/frontend/.env to production to test live progress.

## Future Tasks (Backlog)
- PDF export for inspection reports
- WhatsApp sharing for reports
- Customer reminders
- Refactor InspectionsPage.jsx (3000+ lines)
- Refactor server.py into routers
- Offline mode for mechanic app

## Test Credentials
- CRM Admin: kalyan@wisedrive.com / password123
- Mechanic Test: +919187458748 (Sai Bharath)

## APK Downloads
- **v1.4.0**: https://expo.dev/artifacts/eas/5StKNzXaLXrFEtC14xKPsV.apk
- Build page: https://expo.dev/accounts/kalyandhar/projects/wisedrive-mechanic/builds/2770d910-68fc-4467-aefc-9f20bc81af3d
